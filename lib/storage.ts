import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3'

/**
 * Neon object storage (S3-compatible) for report PDFs.
 *
 * Reports are stored as objects under `reports/<orderId>.pdf` instead of as
 * BYTEA rows, which keeps the Postgres database small and fast. Everything is
 * optional: when the storage env vars are absent the app silently falls back
 * to storing PDFs in Postgres, so local development needs no extra setup.
 */
let client: S3Client | undefined
let bucketReady: Promise<void> | undefined

const env = (...keys: string[]) => keys.map((key) => process.env[key]).find((value) => value && value.trim())

export function storageConfigured() {
  return Boolean(env('AWS_ENDPOINT_URL_S3', 'S3_ENDPOINT') && env('AWS_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID') && env('AWS_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY'))
}

function getBucket() {
  return env('AWS_S3_BUCKET', 'S3_BUCKET') ?? 'assets'
}

function getClient() {
  if (client) return client
  if (!storageConfigured()) throw new Error('Neon object storage is not configured.')
  client = new S3Client({
    endpoint: env('AWS_ENDPOINT_URL_S3', 'S3_ENDPOINT'),
    region: env('AWS_REGION', 'AWS_DEFAULT_REGION', 'S3_REGION') ?? 'auto',
    forcePathStyle: true,
    // SDK v3 adds checksum headers that some S3-compatible stores reject.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID')!,
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY')!,
    },
  })
  return client
}

/** The bucket may not exist yet on a fresh storage account, so create it once. */
async function ensureBucket() {
  if (bucketReady) return bucketReady
  bucketReady = (async () => {
    const s3 = getClient()
    const Bucket = getBucket()
    try {
      await s3.send(new HeadBucketCommand({ Bucket }))
    } catch {
      try {
        await s3.send(new CreateBucketCommand({ Bucket }))
      } catch (error) {
        // Another request may have created it concurrently — re-check once.
        await s3.send(new HeadBucketCommand({ Bucket })).catch(() => { throw error })
      }
    }
  })().catch((error) => {
    bucketReady = undefined
    throw error
  })
  return bucketReady
}

export const reportKey = (orderId: string) => `reports/${orderId}.pdf`

export async function putReportPdf(orderId: string, pdf: Buffer, contentType = 'application/pdf') {
  await ensureBucket()
  await getClient().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: reportKey(orderId),
    Body: pdf,
    ContentType: contentType,
  }))
}

export async function getReportPdfObject(orderId: string): Promise<Buffer | null> {
  await ensureBucket()
  try {
    const result = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: reportKey(orderId) }))
    if (!result.Body) return null
    return Buffer.from(await result.Body.transformToByteArray())
  } catch (error) {
    const name = (error as { name?: string }).name
    if (name === 'NoSuchKey' || name === 'NotFound') return null
    throw error
  }
}

export async function deleteReportPdf(orderId: string) {
  await ensureBucket()
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: reportKey(orderId) }))
}

export async function reportPdfExists(orderId: string) {
  try {
    await ensureBucket()
    await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: reportKey(orderId), Range: 'bytes=0-0' }))
    return true
  } catch {
    return false
  }
}

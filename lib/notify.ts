import { getSetting } from '@/lib/store'

/**
 * Staff WhatsApp delivery.
 *
 * Two modes, chosen at runtime:
 *
 *  1. **Cloud API** — when `whatsapp_phone_number_id` and `whatsapp_access_token`
 *     are set, the message is delivered automatically to the admin's number.
 *  2. **Manual link** — otherwise we build a `wa.me` link the console offers as
 *     a one-click action. Nothing is claimed as sent that wasn't sent.
 *
 * Every result states which mode was used and whether delivery actually
 * succeeded, so the admin dashboard never shows a false "sent" tick.
 */

export interface DeliveryResult {
  ok: boolean
  mode: 'cloud-api' | 'manual-link' | 'not-configured'
  detail: string
  link?: string
}

const digits = (value: string) => value.replace(/\D/g, '')

/** Admin numbers may be stored as 9876543210, +91 98765 43210, or a comma list. */
export async function adminRecipients(): Promise<string[]> {
  return ((await getSetting('admin_whatsapp')) || '')
    .split(',')
    .map((value) => digits(value))
    .filter(Boolean)
    .map((value) => (value.length === 10 ? `91${value}` : value))
}

export async function isCloudApiConfigured() {
  return Boolean(await getSetting('whatsapp_phone_number_id') && await getSetting('whatsapp_access_token'))
}

const manualLink = async (message: string) => {
  const [first] = await adminRecipients()
  return first ? `https://wa.me/${first}?text=${encodeURIComponent(message)}` : undefined
}

async function sendViaCloudApi(to: string, message: string): Promise<DeliveryResult> {
  const [phoneNumberId, token, version] = await Promise.all([getSetting('whatsapp_phone_number_id'), getSetting('whatsapp_access_token'), getSetting('whatsapp_api_version', 'v21.0')])

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
      // Don't let a slow provider stall the booking request.
      signal: AbortSignal.timeout(8000),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        mode: 'cloud-api',
        detail: payload?.error?.message ?? `WhatsApp API returned ${response.status}`,
      }
    }
    return { ok: true, mode: 'cloud-api', detail: `Delivered to ${to}` }
  } catch (error) {
    return {
      ok: false,
      mode: 'cloud-api',
      detail: (error as Error).name === 'TimeoutError' ? 'WhatsApp API timed out' : (error as Error).message,
    }
  }
}

/**
 * Sends an alert to every configured admin number.
 * Returns a summary plus the manual link so the UI can always offer a fallback.
 */
export async function notifyAdminsWhatsApp(message: string): Promise<DeliveryResult> {
  const recipients = await adminRecipients()
  if (recipients.length === 0) {
    return { ok: false, mode: 'not-configured', detail: 'No admin WhatsApp number saved in Settings → Notifications.' }
  }

  if (!await isCloudApiConfigured()) {
    return {
      ok: false,
      mode: 'manual-link',
      detail: 'Automatic sending is off — open the prepared message and press send.',
      link: await manualLink(message),
    }
  }

  const results = await Promise.all(recipients.map((to) => sendViaCloudApi(to, message)))
  const delivered = results.filter((result) => result.ok).length
  return {
    ok: delivered > 0,
    mode: 'cloud-api',
    detail: delivered === results.length ? `Delivered to ${delivered} number${delivered === 1 ? '' : 's'}` : `${delivered}/${results.length} delivered — ${results.find((result) => !result.ok)?.detail ?? 'unknown error'}`,
    link: delivered === results.length ? undefined : await manualLink(message),
  }
}

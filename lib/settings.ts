import { z } from 'zod'
import { sql } from '@/lib/db'

/**
 * Business settings live in business_settings (key → JSON). The public site
 * reads them on every request through the shared query helpers, so saving in
 * the admin panel is reflected on the website immediately.
 */

export const DEFAULT_SETTINGS = {
  brandName: 'SV Diagnostics',
  tagline: 'Lab & Imaging',
  supportPhone: '',
  supportEmail: '',
  whatsappNumber: '',
  address: '',
  announcement: 'Home sample collection now available across Hyderabad — book a slot online.',
  announcementEnabled: true,
  currency: 'INR',
  openingHours: 'Monday to Sunday, 7:00 AM – 9:00 PM',
  aboutText:
    'SV Diagnostics is a diagnostic laboratory and imaging centre serving families across Hyderabad with pathology tests, health packages and home sample collection.',
  collectionEnabled: true,
  collectionFeePaise: 0,
  bookingHorizonDays: 14,
  slotHoldMinutes: 15,
  payOnlineEnabled: true,
  payAtLabEnabled: true,
  payAtHomeEnabled: true,
  cancellationWindowHours: 4,
  consentVersion: '2026-01',
  patientConsentText:
    'I confirm that the details provided are accurate and that I consent to sample collection and diagnostic testing for the person named in this booking. I understand results are released to the contact details I have provided.',
  bookingTermsText:
    'Appointments are subject to slot availability. Prices shown are the current laboratory prices. Reports are shared only with the patient or their authorised representative.',
  timezone: 'Asia/Kolkata',
  city: 'Hyderabad',
  state: 'Telangana',
  /** Empty = use the built-in mark. Set from Admin → Business settings. */
  logoUrl: '',
  faviconUrl: '',
  /**
   * WhatsApp report delivery (Meta WhatsApp Cloud API). A staff member always
   * clicks “Send on WhatsApp” — reports are never sent automatically. Empty
   * template name = send plain text (works inside a 24h customer window).
   */
  whatsappReportsEnabled: true,
  whatsappTemplateName: '',
  whatsappTemplateLanguage: 'en',
  /** Optional first parameter for a custom template; {name} → patient name. */
  whatsappTemplateParam: '{name}',
}

type SettingsShape = typeof DEFAULT_SETTINGS

export type BusinessSettings = { [K in keyof SettingsShape]: K extends 'announcementEnabled' | 'collectionEnabled' | 'payOnlineEnabled' | 'payAtLabEnabled' | 'payAtHomeEnabled' | 'whatsappReportsEnabled' ? boolean : K extends 'collectionFeePaise' | 'bookingHorizonDays' | 'slotHoldMinutes' | 'cancellationWindowHours' ? number : string }

export const settingsSchema = z.object({
  brandName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(80),
  supportPhone: z.string().trim().max(30),
  supportEmail: z.string().trim().email().or(z.literal('')),
  whatsappNumber: z.string().trim().max(30),
  address: z.string().trim().max(300),
  announcement: z.string().trim().max(240),
  announcementEnabled: z.boolean(),
  openingHours: z.string().trim().max(160),
  aboutText: z.string().trim().max(4000),
  collectionEnabled: z.boolean(),
  collectionFeePaise: z.number().int().min(0).max(500000),
  bookingHorizonDays: z.number().int().min(1).max(60),
  slotHoldMinutes: z.number().int().min(5).max(60),
  payOnlineEnabled: z.boolean(),
  payAtLabEnabled: z.boolean(),
  payAtHomeEnabled: z.boolean(),
  cancellationWindowHours: z.number().int().min(0).max(72),
  consentVersion: z.string().trim().min(1).max(20),
  patientConsentText: z.string().trim().min(10).max(4000),
  bookingTermsText: z.string().trim().min(10).max(4000),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  /** Stored as a path under /uploads/brand/* or an absolute https URL. */
  logoUrl: z.union([z.literal(''), z.string().trim().max(500)]).optional(),
  faviconUrl: z.union([z.literal(''), z.string().trim().max(500)]).optional(),
  whatsappReportsEnabled: z.boolean(),
  whatsappTemplateName: z.string().trim().regex(/^[a-z0-9_]{0,256}$/, 'Use lowercase letters, numbers and underscores (the name shown in Meta).'),
  whatsappTemplateLanguage: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Use a language code such as en or en_US.'),
  whatsappTemplateParam: z.string().trim().max(200),
})

export async function getSettings(): Promise<BusinessSettings> {
  const rows = await sql<{ key: string; value: unknown }>('SELECT key, value FROM business_settings')
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, row.key) && row.value !== null) merged[row.key] = row.value
  }
  return merged as BusinessSettings
}

export async function saveSettings(patch: Partial<BusinessSettings>) {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS)
  for (const [key, value] of entries) {
    await sql(
      `INSERT INTO business_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)],
    )
  }
  return getSettings()
}

/** Public-safe subset; never includes anything an attacker could act on. */
export function publicSettings(settings: BusinessSettings) {
  return {
    brandName: settings.brandName,
    tagline: settings.tagline,
    supportPhone: settings.supportPhone,
    supportEmail: settings.supportEmail,
    whatsappNumber: settings.whatsappNumber,
    address: settings.address,
    announcement: settings.announcement,
    announcementEnabled: settings.announcementEnabled,
    openingHours: settings.openingHours,
    aboutText: settings.aboutText,
    collectionEnabled: settings.collectionEnabled,
    collectionFeePaise: settings.collectionFeePaise,
    bookingHorizonDays: settings.bookingHorizonDays,
    payOnlineEnabled: settings.payOnlineEnabled,
    payAtLabEnabled: settings.payAtLabEnabled,
    payAtHomeEnabled: settings.payAtHomeEnabled,
    cancellationWindowHours: settings.cancellationWindowHours,
    patientConsentText: settings.patientConsentText,
    bookingTermsText: settings.bookingTermsText,
    consentVersion: settings.consentVersion,
    city: settings.city,
    state: settings.state,
    timezone: settings.timezone,
    logoUrl: settings.logoUrl ?? '',
    faviconUrl: settings.faviconUrl ?? '',
  }
}

export type PublicSettings = ReturnType<typeof publicSettings>

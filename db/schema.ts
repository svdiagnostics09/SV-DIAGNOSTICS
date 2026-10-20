import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Drizzle mirror of db/migrations/0001_init.sql.
 * The SQL migration is the source of truth for DDL; this module gives the app
 * typed handles to the same tables.
 */
const now = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: now(),
})

export const diagnosticCategories = pgTable('diagnostic_categories', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const diagnosticTests = pgTable('diagnostic_tests', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  categoryId: integer('category_id').references(() => diagnosticCategories.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  shortDescription: text('short_description').notNull().default(''),
  description: text('description').notNull().default(''),
  sampleType: text('sample_type').notNull().default(''),
  sampleTypes: text('sample_types').array().notNull().default([]),
  reportType: text('report_type').notNull().default(''),
  turnaroundHours: integer('turnaround_hours'),
  preparation: text('preparation').notNull().default(''),
  fastingRequired: boolean('fasting_required').notNull().default(false),
  fastingHours: integer('fasting_hours'),
  pricePaise: integer('price_paise').notNull(),
  discountType: text('discount_type').notNull().default('none'),
  discountValue: integer('discount_value').notNull().default(0),
  homeCollection: boolean('home_collection').notNull().default(true),
  isPopular: boolean('is_popular').notNull().default(false),
  status: text('status').notNull().default('draft'),
  imageUrl: text('image_url').notNull().default(''),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const investigations = pgTable('investigations', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const testInvestigations = pgTable('test_investigations', {
  testId: integer('test_id').notNull().references(() => diagnosticTests.id, { onDelete: 'cascade' }),
  investigationId: integer('investigation_id').notNull().references(() => investigations.id),
}, (t) => ({ pk: primaryKey({ columns: [t.testId, t.investigationId] }) }))

export const healthPackages = pgTable('health_packages', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  preparation: text('preparation').notNull().default(''),
  sampleType: text('sample_type').notNull().default(''),
  turnaroundHours: integer('turnaround_hours'),
  pricePaise: integer('price_paise').notNull(),
  originalPricePaise: integer('original_price_paise'),
  homeCollection: boolean('home_collection').notNull().default(true),
  isPopular: boolean('is_popular').notNull().default(false),
  status: text('status').notNull().default('draft'),
  imageUrl: text('image_url').notNull().default(''),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const packageTests = pgTable('package_tests', {
  packageId: integer('package_id').notNull().references(() => healthPackages.id, { onDelete: 'cascade' }),
  testId: integer('test_id').notNull().references(() => diagnosticTests.id),
}, (t) => ({ pk: primaryKey({ columns: [t.packageId, t.testId] }) }))

export const locations = pgTable('locations', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2').notNull().default(''),
  area: text('area').notNull().default(''),
  city: text('city').notNull().default('Hyderabad'),
  state: text('state').notNull().default('Telangana'),
  pincode: text('pincode').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  mapsUrl: text('maps_url').notNull().default(''),
  openingHours: text('opening_hours').notNull().default(''),
  services: text('services').array().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const serviceAreas = pgTable('service_areas', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  city: text('city').notNull().default('Hyderabad'),
  pincodes: text('pincodes').array().notNull().default([]),
  homeCollection: boolean('home_collection').notNull().default(true),
  collectionFeePaise: integer('collection_fee_paise').notNull().default(0),
  operatingHours: text('operating_hours').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const collectionSlots = pgTable('collection_slots', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }),
  method: text('method').notNull().default('both'),
  label: text('label').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  dailyCapacity: integer('daily_capacity').notNull().default(10),
  weekdays: text('weekdays').array(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const slotReservations = pgTable('slot_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotId: integer('slot_id').notNull().references(() => collectionSlots.id),
  locationId: integer('location_id').references(() => locations.id),
  method: text('method').notNull(),
  slotDate: date('slot_date').notNull(),
  capacity: integer('capacity').notNull(),
  booked: integer('booked').notNull().default(0),
  holds: integer('holds').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ key: uniqueIndex('slot_reservations_key').on(t.slotId, t.slotDate) }))

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: text('reference').notNull().unique(),
  accessToken: text('access_token').notNull(),
  patientName: text('patient_name').notNull(),
  patientAge: integer('patient_age'),
  patientGender: text('patient_gender'),
  phone: text('phone').notNull(),
  email: text('email'),
  method: text('method').notNull(),
  locationId: integer('location_id').references(() => locations.id),
  serviceAreaId: integer('service_area_id').references(() => serviceAreas.id),
  addressLine: text('address_line').notNull().default(''),
  addressArea: text('address_area').notNull().default(''),
  pincode: text('pincode').notNull().default(''),
  appointmentDate: date('appointment_date').notNull(),
  slotId: integer('slot_id').notNull().references(() => collectionSlots.id),
  slotLabel: text('slot_label').notNull(),
  subtotalPaise: integer('subtotal_paise').notNull(),
  discountPaise: integer('discount_paise').notNull().default(0),
  collectionFeePaise: integer('collection_fee_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  paymentMethod: text('payment_method').notNull(),
  paymentStatus: text('payment_status').notNull().default('pending'),
  status: text('status').notNull().default('pending_confirmation'),
  internalNotes: text('internal_notes').notNull().default(''),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ status: index('bookings_status_idx').on(t.status) }))

export const bookingItems = pgTable('booking_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  testId: integer('test_id').references(() => diagnosticTests.id),
  packageId: integer('package_id').references(() => healthPackages.id),
  nameSnapshot: text('name_snapshot').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  listPricePaise: integer('list_price_paise').notNull(),
})

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('razorpay'),
  providerOrderId: text('provider_order_id').notNull(),
  providerPaymentId: text('provider_payment_id'),
  amountPaise: integer('amount_paise').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('created'),
  method: text('method').notNull().default(''),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const paymentEvents = pgTable('payment_events', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('razorpay'),
  eventId: text('event_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const enquiries = pgTable('enquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: text('reference').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull().default(''),
  subject: text('subject').notNull().default(''),
  message: text('message').notNull(),
  status: text('status').notNull().default('new'),
  internalNote: text('internal_note').notNull().default(''),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const banners = pgTable('banners', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  ctaLabel: text('cta_label').notNull().default(''),
  ctaHref: text('cta_href').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  placement: text('placement').notNull().default('home'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const faqs = pgTable('faqs', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: text('category').notNull().default('General'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const blogPosts = pgTable('blog_posts', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt').notNull().default(''),
  body: text('body').notNull().default(''),
  coverImageUrl: text('cover_image_url').notNull().default(''),
  author: text('author').notNull().default('SV Diagnostics'),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: now(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const businessSettings = pgTable('business_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorEmail: text('actor_email').notNull().default(''),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull().default(''),
  detail: jsonb('detail').notNull().default({}),
  createdAt: now(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  channel: text('channel').notNull(),
  recipient: text('recipient').notNull().default(''),
  template: text('template').notNull(),
  status: text('status').notNull().default('queued'),
  detail: text('detail').notNull().default(''),
  createdAt: now(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
})

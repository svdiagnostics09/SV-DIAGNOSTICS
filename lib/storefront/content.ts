/**
 * Storefront *presentation* content — imagery, marketing copy, categories,
 * testimonials and FAQ copy.
 *
 * IMPORTANT: prices, packages and tests are NOT defined here. They come from
 * the live catalogue (PostgreSQL) so the admin console stays the single source
 * of truth. Everything in this file is non-transactional copy.
 */

/* Imagery ---------------------------------------------------------------
 * Verified royalty-free photographs from Unsplash (free licence), picked for
 * subject accuracy. Swap these for brand photography when available.
 * Unsplash licence: https://unsplash.com/license
 */
export const IMAGES = {
  /** Gloved hand holding blood vacutainers — hero of the full-body banner. */
  bloodTubes: {
    src: 'https://plus.unsplash.com/premium_photo-1723044801673-9dcaf8bc7001?auto=format&fit=crop&w=1000&q=70',
    alt: 'Lab technician in gloves holding blood sample tubes with coloured caps',
  },
  /** Automated analyser bench in a diagnostic laboratory. */
  laboratory: {
    src: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=70',
    alt: 'Rows of automated analysers along a diagnostic laboratory bench',
  },
  /** Clinician discussing imaging results with a patient. */
  consultation: {
    src: 'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=900&q=70',
    alt: 'Doctor in a white coat explaining scan results to a patient at a desk',
  },
  /** Anatomical brain model — used by the organ-focus section. */
  brainModel: {
    src: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=600&q=70',
    alt: 'Anatomical model of a human brain on a stand',
  },
  /** Smiling healthcare professional in blue scrubs (portrait). */
  clinicianPortrait: {
    src: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=640&q=70',
    alt: 'Healthcare professional in blue scrubs with a stethoscope, smiling',
  },
  /** Phlebotomist in teal scrubs (portrait). */
  collectorPortrait: {
    src: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=640&q=70',
    alt: 'Medical sample collection professional in teal scrubs',
  },
} as const

/* Cities --------------------------------------------------------------- */

export interface City {
  id: string
  name: string
  state: string
  /** Home collection is only offered where we have a configured lab network. */
  collecting: boolean
}

export const CITIES: City[] = [
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', collecting: true },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', collecting: true },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', collecting: true },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', collecting: true },
  { id: 'vijayawada', name: 'Vijayawada', state: 'Andhra Pradesh', collecting: false },
  { id: 'vizag', name: 'Visakhapatnam', state: 'Andhra Pradesh', collecting: false },
]

export const DEFAULT_CITY = CITIES[0]

/* Category tiles (§6 and §11) ------------------------------------------ */

export type TileTone = 'orange' | 'teal' | 'forest'

export interface StoreCategory {
  id: string
  label: string
  /** Maps to a catalogue category slug where one exists. */
  slug?: string
  /** Search term used when the catalogue has no matching category. */
  query?: string
  tone: TileTone
}

/** Four compact tiles under "Most Booked Checkups". */
export const FEATURED_CATEGORIES: StoreCategory[] = [
  { id: 'full-body', label: 'Full Body Checkup', slug: 'packages', tone: 'orange' },
  { id: 'sexual-health', label: 'Sexual Health', slug: 'pathology', tone: 'teal' },
  { id: 'womens-health', label: "Women's Health", slug: 'pathology', query: 'women', tone: 'forest' },
  { id: 'allergy', label: 'Allergy Checkup', slug: 'pathology', query: 'allergy', tone: 'orange' },
]

/** Organ-focused quick links under "For Vital Body Organs". */
export const ORGAN_CATEGORIES: StoreCategory[] = [
  { id: 'heart', label: 'Heart', query: 'heart', tone: 'orange' },
  { id: 'liver', label: 'Liver', query: 'liver', tone: 'teal' },
  { id: 'kidney', label: 'Kidneys', query: 'kidney', tone: 'forest' },
  { id: 'thyroid', label: 'Thyroid', query: 'thyroid', tone: 'orange' },
  { id: 'lungs', label: 'Lungs', query: 'lung', tone: 'teal' },
  { id: 'brain', label: 'Brain', query: 'brain', tone: 'forest' },
  { id: 'bones', label: 'Bones', query: 'bone', tone: 'orange' },
  { id: 'pancreas', label: 'Pancreas', query: 'pancreas', tone: 'teal' },
  { id: 'vitamins', label: 'Vitamins & Nutrition', query: 'vitamin', tone: 'forest' },
]

/* Brand experience (§10) ------------------------------------------------ */

export interface ExperienceFeature {
  id: string
  eyebrow: string
  title: string
  body: string
  /** Shown only when the reader expands the row. */
  more?: string
  image: { src: string; alt: string }
}

export const EXPERIENCE_FEATURES: ExperienceFeature[] = [
  {
    id: 'precision',
    eyebrow: 'Choose precision',
    title: 'On time, every time!',
    body: 'Samples are collected in the slot you choose and reach the laboratory within the handling window, so the result you read reflects your sample as it was taken.',
    more: 'Every collection is logged against your booking reference, and the booking page shows each status change from collection to report release.',
    image: IMAGES.collectorPortrait,
  },
  {
    id: 'emedics',
    eyebrow: 'Not a pilot, just as precise',
    title: 'Meet our expert eMedics!',
    body: 'Trained sample collection professionals follow a documented procedure for every draw — tube order, fill volume, labelling and transport temperature.',
    more: 'If a sample needs repeating because of a handling issue, the laboratory arranges a fresh collection at no extra charge.',
    image: IMAGES.clinicianPortrait,
  },
  {
    id: 'comfort',
    eyebrow: 'No more painful pricks',
    title: 'Comfortable collection, first time',
    body: 'Single-use butterfly needles and paediatric-sized tubes are used where appropriate, and collectors are briefed on drawing with minimal discomfort.',
    more: 'Tell us about a needle preference or a previous difficult draw when you book and it is passed to the assigned collector.',
    image: IMAGES.consultation,
  },
  {
    id: 'labs',
    eyebrow: 'Certified processes',
    title: 'Trust our fully automated and certified labs',
    body: 'Analysers are calibrated on a fixed schedule, and every run carries internal quality controls alongside an external proficiency scheme.',
    more: 'Reports include the reference range, the method used and the laboratory that performed the assay.',
    image: IMAGES.laboratory,
  },
  {
    id: 'customers',
    eyebrow: 'Customers love us',
    title: 'Support that answers, not queues',
    body: 'A named support line answers booking questions, reschedules and report queries, and the booking page carries the same status our team sees.',
    more: 'Escalations are logged rather than dropped, so you always have a record of what was promised.',
    image: IMAGES.clinicianPortrait,
  },
]

/* Testimonials (§12) ----------------------------------------------------
 * SAMPLE CONTENT. These are illustrative placeholders written for this demo
 * and are not verified reviews of any business. Replace before launch.
 */
export interface Testimonial {
  id: string
  name: string
  city: string
  rating: number
  quote: string
}

export const TESTIMONIAL_DISCLAIMER =
  'Sample testimonials included for layout demonstration — not verified customer reviews.'

export const TESTIMONIALS: Testimonial[] = [
  { id: 't1', name: 'Ananya R.', city: 'Hyderabad', rating: 5, quote: 'The collector arrived inside the slot and explained each step. My report appeared on the booking page earlier than the estimate.' },
  { id: 't2', name: 'Vikram K.', city: 'Hyderabad', rating: 5, quote: 'I have to track numbers every quarter, and keeping the history in one place makes the follow-up visit far easier.' },
  { id: 't3', name: 'Priya M.', city: 'Bengaluru', rating: 4, quote: 'Booking was quick and the price matched the website exactly. Rescheduling by phone took a couple of minutes.' },
  { id: 't4', name: 'Rahul S.', city: 'Chennai', rating: 5, quote: 'Blood draws are usually difficult for me. This was the first time it took a single attempt.' },
  { id: 't5', name: 'Sneha D.', city: 'Pune', rating: 5, quote: 'Clear reference ranges on the report, and the FAQ answered what the numbers meant before I called the clinic.' },
  { id: 't6', name: 'Arjun T.', city: 'Hyderabad', rating: 5, quote: 'Booked a family package for three of us. All collections in one visit and reports delivered together.' },
]

/* FAQ (§13) ------------------------------------------------------------ */

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export const HOMEPAGE_FAQS: FaqItem[] = [
  { id: 'book', question: 'How can I book a blood test online?', answer: 'Choose a test or health checkup, add it to your booking, then pick a home collection slot or a lab visit. You will receive a booking reference once your slot is confirmed.' },
  { id: 'home', question: 'Can I book a home sample collection?', answer: 'Yes, where your pincode is covered. Enter your pincode in the search panel or on the booking page to check availability and any collection fee before you confirm.' },
  { id: 'reports', question: 'How long does it take to receive my reports?', answer: 'Turnaround varies by test and is shown on each test page. Most routine pathology reports are released within 24 to 48 hours, and you are notified as soon as they are ready.' },
  { id: 'status', question: 'How can I check my test booking status?', answer: 'Open Track Booking and enter your booking reference and the phone number used at booking. The page shows each status change up to report release.' },
  { id: 'cancel', question: 'How do I cancel a booking?', answer: 'Cancellation is available from the booking page until the cut-off shown on your booking. If you are outside that window, call support and we will advise on the next step.' },
  { id: 'payment', question: 'What payment methods are accepted?', answer: 'Available methods are listed at checkout and depend on whether you choose home collection or a lab visit. A payment receipt is issued against your booking reference.' },
  { id: 'fasting', question: 'Do I need to fast before my test?', answer: 'Some tests require fasting and others do not. The preparation note on each test page states whether fasting is needed and for how long.' },
  { id: 'children', question: 'Can tests be booked for children?', answer: 'Yes. Enter the patient details at booking; paediatric tubes are used where appropriate. For very young children, call support before booking to arrange the collection.' },
]

/* SEO copy (§13) ------------------------------------------------------- */

export interface SeoBlock {
  id: string
  heading: string
  paragraphs: string[]
  list?: string[]
}

export const SEO_BLOCKS: SeoBlock[] = [
  {
    id: 'significance',
    heading: 'Significance of Lab Tests in Hyderabad',
    paragraphs: [
      'Laboratory tests turn symptoms and risk factors into measurable numbers. A single blood draw can show how well the thyroid is working, whether iron stores are adequate, or whether blood sugar has been drifting upward long before symptoms appear.',
      'Regular testing is most useful when results are compared over time. Keeping reports together means a doctor can see a trend rather than a single snapshot, which is why every report here is tied to your booking history.',
    ],
  },
  {
    id: 'at-home',
    heading: 'Blood Tests That Can Be Conducted at Home in Hyderabad',
    paragraphs: [
      'Most routine pathology — complete blood count, thyroid function, vitamin levels, lipid profiles and HbA1c — can be collected at home. A trained collector visits in your chosen slot, draws the sample and transports it under controlled conditions.',
      'Imaging studies generally require a visit to a centre. If a package includes both, the booking page states which items are collected at home and which need an appointment.',
    ],
    list: ['Complete Blood Count (CBC)', 'Thyroid Function Test (TFT)', 'HbA1c', 'Vitamin B12 and Vitamin D', 'Lipid Profile'],
  },
  {
    id: 'top-tests',
    heading: 'Top Blood Tests in Hyderabad',
    paragraphs: [
      'The most frequently booked tests are the ones that support the most common decisions: annual health checks, thyroid follow-ups, diabetes monitoring and vitamin deficiency investigations.',
    ],
    list: ['Full body checkup packages', 'Thyroid Function Test', 'Glycosylated Haemoglobin (HbA1c)', 'Vitamin D and Vitamin B12', 'Liver and kidney function panels'],
  },
  {
    id: 'cost',
    heading: 'Cost of Blood Tests in Hyderabad',
    paragraphs: [
      'Prices depend on the test, the panel size and home collection fees where applicable. Individual tests are generally cheaper than bundled packages, but packages cover far more parameters for a similar outlay.',
      'The price shown on a test page is the price you pay. Collection fees, where they apply, are displayed before you confirm a slot.',
    ],
  },
  {
    id: 'booking',
    heading: 'Booking a Home Collection for Blood Tests in Hyderabad',
    paragraphs: [
      'Search for the test or checkup, add it to your booking and choose home collection. Enter your pincode to confirm coverage, select an available slot and add the patient details.',
      'You receive a booking reference immediately. The booking page tracks the appointment from confirmation through sample collection to report release.',
    ],
  },
]

/* Footer (§14) --------------------------------------------------------- */

export const FOOTER_COLUMNS = [
  {
    title: 'Popular tests',
    links: [
      { label: 'Complete Blood Count (CBC)', href: '/tests?q=cbc' },
      { label: 'Thyroid Function Test', href: '/tests?q=thyroid' },
      { label: 'HbA1c', href: '/tests?q=hba1c' },
      { label: 'Vitamin D', href: '/tests?q=vitamin%20d' },
      { label: 'Vitamin B12', href: '/tests?q=vitamin%20b12' },
      { label: 'Lipid Profile', href: '/tests?q=lipid' },
      { label: 'Full price list', href: '/price-list' },
    ],
  },
  {
    title: 'Health checkups',
    links: [
      { label: 'Full body checkup', href: '/packages' },
      { label: 'Most booked checkups', href: '/packages' },
      { label: 'All health packages', href: '/packages' },
      { label: 'Women\u2019s health', href: '/packages' },
      { label: 'Senior citizen checkup', href: '/packages' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Lab locations', href: '/locations' },
      { label: 'Service areas', href: '/service-areas' },
      { label: 'Health articles', href: '/blog' },
      { label: 'Careers', href: '/contact' },
    ],
  },
  {
    title: 'Patient support',
    links: [
      { label: 'Track a booking', href: '/track' },
      { label: 'Book a test', href: '/tests' },
      { label: 'Frequently asked questions', href: '/faq' },
      { label: 'Contact us', href: '/contact' },
      { label: 'Patient consent', href: '/patient-consent' },
    ],
  },
] as const

export const LEGAL_LINKS = [
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Terms of use', href: '/terms' },
  { label: 'Cancellation & refunds', href: '/refund-policy' },
  { label: 'Patient consent', href: '/patient-consent' },
] as const

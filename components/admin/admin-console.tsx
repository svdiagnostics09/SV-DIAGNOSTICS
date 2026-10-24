'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  Contact,
  FileDown,
  FileText,
  Handshake,
  Inbox,
  Image as ImageIcon,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Stethoscope,
  Tags,
  TestTube2,
  Wallet,
  CalendarClock,
  Newspaper,
  HelpCircle,
} from 'lucide-react'
import type { AdminUser } from '@/lib/auth'
import { AdminShell, type NavGroup } from '@/components/admin/admin-shell'
import { ToastStack, useToasts } from '@/components/admin/fetch'
import { DashboardPanel } from '@/components/admin/panels/dashboard'
import { TestsPanel } from '@/components/admin/panels/tests'
import { PackagesPanel } from '@/components/admin/panels/packages'
import { CategoriesPanel, InvestigationsPanel } from '@/components/admin/panels/catalogue-support'
import { ContentPanel } from '@/components/admin/panels/content'
import { BookingsPanel } from '@/components/admin/panels/bookings'
import { EnquiriesPanel } from '@/components/admin/panels/enquiries'
import { LocationsPanel, ServiceAreasPanel, SlotsPanel } from '@/components/admin/panels/network'
import { ReportsPanel, AuditPanel } from '@/components/admin/panels/reports'
import { SettingsPanel } from '@/components/admin/panels/settings'
import { CustomersPanel } from '@/components/admin/panels/customers'
import { PatientReportsPanel } from '@/components/admin/panels/patient-reports'
import { PartnersPanel } from '@/components/admin/panels/partners'

const TITLES: Record<string, { title: string; description: string }> = {
  dashboard: { title: 'Dashboard', description: 'Live figures from the laboratory database' },
  tests: { title: 'Diagnostic Tests', description: 'Create, publish and price the test catalogue' },
  packages: { title: 'Health Packages', description: 'Bundle tests and validate package pricing' },
  categories: { title: 'Categories', description: 'Organise the public catalogue' },
  investigations: { title: 'Investigations', description: 'Link investigations to diagnostic tests' },
  banners: { title: 'Banners', description: 'Homepage and catalogue banners' },
  faqs: { title: 'FAQs', description: 'Questions shown on the website' },
  blog: { title: 'Blog Posts', description: 'Write and publish health articles' },
  partners: { title: 'Partners', description: 'Logos in the scrolling partners band on the homepage' },
  bookings: { title: 'Bookings', description: 'Search, confirm and update patient bookings' },
  enquiries: { title: 'Enquiries', description: 'Messages submitted from the contact form' },
  customers: { title: 'Customers & Patients', description: 'Restricted view of patient booking history' },
  'patient-reports': { title: 'Patient Reports', description: 'Upload report PDFs and send them to patients on WhatsApp' },
  reports: { title: 'Reports', description: 'Operational and revenue summaries' },
  locations: { title: 'Locations', description: 'Laboratory branches and opening hours' },
  areas: { title: 'Service Areas', description: 'Home collection coverage by pincode' },
  slots: { title: 'Collection Slots', description: 'Slot capacity, schedules and blackout dates' },
  settings: { title: 'Business Settings', description: 'Brand, contact, payments and booking rules' },
  audit: { title: 'Audit Log', description: 'Every sensitive action, newest first' },
}

export function AdminConsole({ user, dashboard, bookings, brand }: { user: AdminUser; dashboard: Record<string, unknown> | null; bookings: unknown; brand: { brandName: string; logoUrl: string } }) {
  const router = useRouter()
  const [active, setActive] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [version, setVersion] = useState(0)
  const toasts = useToasts()

  const groups: NavGroup[] = [
    { label: 'Overview', items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      label: 'Content', items: [
        { key: 'tests', label: 'Tests', icon: TestTube2 },
        { key: 'packages', label: 'Health Packages', icon: Package },
        { key: 'categories', label: 'Categories', icon: Tags },
        { key: 'investigations', label: 'Investigations', icon: Stethoscope },
        { key: 'banners', label: 'Banners', icon: ImageIcon },
        { key: 'faqs', label: 'FAQs', icon: HelpCircle },
        { key: 'blog', label: 'Blog Posts', icon: Newspaper },
        { key: 'partners', label: 'Partners', icon: Handshake },
      ]
    },
    {
      label: 'Operations', items: [
        { key: 'bookings', label: 'Bookings', icon: CalendarDays },
        { key: 'patient-reports', label: 'Patient Reports', icon: FileDown },
        { key: 'enquiries', label: 'Enquiries', icon: Inbox },
        { key: 'customers', label: 'Customers', icon: Contact },
      ]
    },
    {
      label: 'Finance', items: [
        { key: 'reports', label: 'Reports', icon: FileText },
      ]
    },
    {
      label: 'Settings', items: [
        { key: 'locations', label: 'Locations', icon: MapPin },
        { key: 'areas', label: 'Service Areas', icon: MapPin },
        { key: 'slots', label: 'Slots', icon: CalendarClock },
        { key: 'settings', label: 'Business Settings', icon: Settings },
        { key: 'audit', label: 'Audit Logs', icon: ShieldCheck },
      ]
    },
  ]

  const navigate = (key: string) => {
    setActive(key)
    setVersion((value) => value + 1)
    window.scrollTo({ top: 0 })
  }

  const refresh = async () => {
    setRefreshing(true)
    setVersion((value) => value + 1)
    router.refresh()
    setTimeout(() => setRefreshing(false), 600)
  }

  const meta = TITLES[active] ?? TITLES.dashboard

  return (
    <>
      <AdminShell
        user={user}
        brand={brand}
        groups={groups}
        active={active}
        title={meta.title}
        description={meta.description}
        onNavigate={navigate}
        onRefresh={refresh}
        refreshing={refreshing}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      >
        <div key={`${active}-${version}`} className="animate-in">
          {active === 'dashboard' && <DashboardPanel initial={dashboard} onOpen={(key) => navigate(key)} />}
          {active === 'tests' && <TestsPanel onToast={toasts.push} />}
          {active === 'packages' && <PackagesPanel onToast={toasts.push} />}
          {active === 'categories' && <CategoriesPanel onToast={toasts.push} />}
          {active === 'investigations' && <InvestigationsPanel onToast={toasts.push} />}
          {active === 'banners' && <ContentPanel kind="banners" onToast={toasts.push} />}
          {active === 'faqs' && <ContentPanel kind="faqs" onToast={toasts.push} />}
          {active === 'blog' && <ContentPanel kind="blog" onToast={toasts.push} />}
          {active === 'partners' && <PartnersPanel onToast={toasts.push} />}
          {active === 'bookings' && <BookingsPanel initial={bookings} onToast={toasts.push} />}
          {active === 'enquiries' && <EnquiriesPanel onToast={toasts.push} />}
          {active === 'customers' && <CustomersPanel />}
          {active === 'patient-reports' && <PatientReportsPanel onToast={toasts.push} />}
          {active === 'reports' && <ReportsPanel />}
          {active === 'locations' && <LocationsPanel onToast={toasts.push} />}
          {active === 'areas' && <ServiceAreasPanel onToast={toasts.push} />}
          {active === 'slots' && <SlotsPanel onToast={toasts.push} />}
          {active === 'settings' && <SettingsPanel user={user} onToast={toasts.push} />}
          {active === 'audit' && <AuditPanel />}
        </div>
      </AdminShell>
      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </>
  )
}

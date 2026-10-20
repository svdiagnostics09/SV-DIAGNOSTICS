'use client'

import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { useAdminResource } from '@/components/admin/fetch'
import { formatDate } from '@/components/admin/fetch'
import { EmptyState } from '@/components/ui'

interface CustomerRow { phone: string; name: string; bookings: number; emails: number; lastBooking: string; latestReference: string }

/**
 * Restricted customer view: grouped by the booking phone number. Contact
 * details only; no clinical data is exposed here.
 */
export function CustomersPanel() {
  const [query, setQuery] = useState('')
  const search = useAdminResource<{ customers: CustomerRow[]; recent: Array<{ reference: string; patientName: string; date: string; status: string; createdAt: string }> }>(
    `/api/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`,
  )

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="customer-search" className="sr-only">Search customers</label>
          <input id="customer-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') search.reload() }} placeholder="Patient name or phone — press Enter" className="input pl-9" />
        </div>
        <button type="button" onClick={search.reload} className="btn btn-outline btn-sm">Search</button>
      </div>
      <p className="text-[11.5px] text-muted">This page is restricted to administrators. Contact details are grouped by the mobile number given at booking; reports are not shown here.</p>
      {search.error && <div className="card p-4 text-[12.5px] text-danger">{search.error}</div>}
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="border-b border-line bg-page text-[10.5px] uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Patient</th><th scope="col" className="px-3 py-2 font-semibold">Phone</th><th scope="col" className="px-3 py-2 text-right font-semibold">Bookings</th><th scope="col" className="px-3 py-2 font-semibold">Latest</th><th scope="col" className="px-3 py-2 font-semibold">Last booking</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {search.data?.customers.length === 0 && <tr><td colSpan={5}><EmptyState icon={Users} title="No customers yet" description="Patients appear here after their first booking." /></td></tr>}
              {search.data?.customers.map((customer) => (
                <tr key={customer.phone}>
                  <td className="px-3 py-2.5 font-semibold">{customer.name}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{customer.phone}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{customer.bookings}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-teal-700">{customer.latestReference}</td>
                  <td className="px-3 py-2.5 text-muted">{formatDate(customer.lastBooking)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

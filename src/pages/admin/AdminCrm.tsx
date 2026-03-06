import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CustomerProfileRow, CustomerNoteRow } from '@/types/database'

type CustomerWithNote = CustomerProfileRow & { last_note?: CustomerNoteRow | null }

export default function AdminCrm() {
  const [customers, setCustomers] = useState<CustomerWithNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('*')
        .order('company_name')
      const list = (profiles ?? []) as CustomerProfileRow[]
      if (list.length === 0) {
        setCustomers([])
        setLoading(false)
        return
      }
      const userIds = list.map((c) => c.user_id)
      const { data: notesData } = await supabase
        .from('customer_notes')
        .select('*')
        .in('customer_user_id', userIds)
        .order('created_at', { ascending: false })
      const notesByCustomer = new Map<string, CustomerNoteRow[]>()
      for (const n of notesData ?? []) {
        const row = n as CustomerNoteRow
        if (!notesByCustomer.has(row.customer_user_id)) notesByCustomer.set(row.customer_user_id, [])
        notesByCustomer.get(row.customer_user_id)!.push(row)
      }
      const withNotes: CustomerWithNote[] = list.map((c) => {
        const custNotes = notesByCustomer.get(c.user_id) ?? []
        return { ...c, last_note: custNotes[0] ?? null }
      })
      setCustomers(withNotes)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading CRM…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <p className="page-intro">
        Customer relationship view. See customers with their latest note. Open a customer to add notes and manage their profile.
      </p>
      <div className="admin-crm-grid">
        {customers.length === 0 ? (
          <div className="card admin-card">
            <p className="admin-muted">No customer profiles yet. Customers appear when they have a profile.</p>
            <Link to="/admin/customers">View customers</Link>
          </div>
        ) : (
          customers.map((c) => (
            <div key={c.id} className="card admin-card admin-crm-card">
              <div className="admin-crm-card-head">
                <Link to={`/admin/customers/${c.user_id}`} className="admin-crm-card-title">
                  {c.company_name}
                </Link>
                <span className="admin-crm-card-contact">{c.contact_name ?? '—'}</span>
              </div>
              <div className="admin-crm-card-meta">
                Balance: £{Number(c.balance_outstanding).toFixed(2)}
              </div>
              {c.last_note ? (
                <div className="admin-crm-card-note">
                  <p className="admin-crm-note-preview">{c.last_note.body.slice(0, 120)}{c.last_note.body.length > 120 ? '…' : ''}</p>
                  <span className="admin-crm-note-date">{new Date(c.last_note.created_at).toLocaleDateString()}</span>
                </div>
              ) : (
                <p className="admin-crm-no-note">No notes yet</p>
              )}
              <div className="admin-crm-card-actions">
                <Link to={`/admin/customers/${c.user_id}`} className="btn btn-small btn-outline">View & add notes</Link>
                <Link to={`/admin/create-order?customer=${c.user_id}`} className="btn btn-small">Create order</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

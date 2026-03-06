import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CustomerProfileRow, CustomerNoteRow, OrderRow } from '@/types/database'

export default function AdminCustomerDetail() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<CustomerProfileRow | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [notes, setNotes] = useState<CustomerNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '', balance_outstanding: 0, payment_terms: '' })

  useEffect(() => {
    if (!userId) return
    async function load() {
      const [profileRes, ordersRes, notesRes] = await Promise.all([
        supabase.from('customer_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('customer_notes').select('*').eq('customer_user_id', userId).order('created_at', { ascending: false }),
      ])
      const p = profileRes.data as CustomerProfileRow | null
      setProfile(p ?? null)
      if (p) setEditForm({
        company_name: p.company_name || '',
        contact_name: p.contact_name || '',
        balance_outstanding: Number(p.balance_outstanding) || 0,
        payment_terms: p.payment_terms ?? '',
      })
      setOrders(ordersRes.data ?? [])
      setNotes((notesRes.data ?? []) as CustomerNoteRow[])
      setLoading(false)
    }
    load()
  }, [userId])

  async function addNote() {
    if (!userId || !noteBody.trim() || addingNote) return
    setAddingNote(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('customer_notes').insert({
      customer_user_id: userId,
      author_user_id: user?.id ?? null,
      body: noteBody.trim(),
    })
    if (!error) {
      const { data } = await supabase.from('customer_notes').select('*').eq('customer_user_id', userId).order('created_at', { ascending: false })
      setNotes((data ?? []) as CustomerNoteRow[])
      setNoteBody('')
    }
    setAddingNote(false)
  }

  async function saveProfile() {
    if (!profile?.id || saving) return
    setSaving(true)
    await supabase.from('customer_profiles').update({
      company_name: editForm.company_name,
      contact_name: editForm.contact_name || null,
      balance_outstanding: editForm.balance_outstanding,
      payment_terms: editForm.payment_terms || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)
    setProfile((prev) => prev ? { ...prev, ...editForm, balance_outstanding: editForm.balance_outstanding, payment_terms: editForm.payment_terms || null } : null)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading customer…</p>
        </div>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <p>Customer not found.</p>
          <Link to="/admin/customers" className="btn btn-outline">← Customers</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin/customers">Customers</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{profile.company_name}</span>
        </span>
        <div className="admin-page-header-actions">
          <Link to={`/admin/create-order?customer=${userId}`} className="btn btn-small">Create order</Link>
          <Link to="/admin/customers" className="btn btn-outline btn-small">← Customers</Link>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="card admin-card">
          <h2>Profile</h2>
          <div className="admin-detail-form">
            <label>Company name</label>
            <input
              value={editForm.company_name}
              onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
            />
            <label>Contact name</label>
            <input
              value={editForm.contact_name}
              onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
            <label>Balance outstanding (£)</label>
            <input
              type="number"
              step="0.01"
              value={editForm.balance_outstanding}
              onChange={(e) => setEditForm((f) => ({ ...f, balance_outstanding: Number(e.target.value) || 0 }))}
            />
            <label>Payment terms</label>
            <input
              value={editForm.payment_terms}
              onChange={(e) => setEditForm((f) => ({ ...f, payment_terms: e.target.value }))}
              placeholder="e.g. Net 7, Net 30, Due on receipt"
            />
            <p className="admin-muted">User ID: <code>{userId}</code></p>
            <button type="button" className="btn" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
        <div className="card admin-card">
          <h2>Statement & balance</h2>
          <div className="admin-statement-summary">
            <p><strong>Balance outstanding</strong> £{Number(profile.balance_outstanding).toFixed(2)}</p>
            {profile.payment_terms && <p><strong>Payment terms</strong> {profile.payment_terms}</p>}
          </div>
          {orders.filter((o) => ['invoiced', 'paid'].includes(o.status)).length === 0 ? (
            <p className="admin-muted">No invoiced or paid orders yet.</p>
          ) : (
            <div className="admin-table-wrap admin-table-wrap--compact">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th>Total inc VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter((o) => ['invoiced', 'paid'].includes(o.status))
                    .slice(0, 15)
                    .map((o) => (
                      <tr key={o.id}>
                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td><Link to={`/admin/orders/${o.id}`}>{o.reference ?? o.id.slice(0, 8)}</Link></td>
                        <td>{o.invoice_number ?? '—'}</td>
                        <td>{o.status}</td>
                        <td>£{Number(o.total_inc_vat).toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
            <Link to={`/admin/orders?customer=${userId}`}>View all orders for this customer →</Link>
          </p>
        </div>
        <div className="card admin-card">
          <h2>Orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="admin-muted">No orders yet.</p>
          ) : (
            <ul className="admin-customer-orders">
              {orders.slice(0, 20).map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`}>
                    {o.reference || o.id.slice(0, 8)} — {o.status} — £{Number(o.total_inc_vat).toFixed(2)}
                  </Link>
                  <span className="admin-muted">{new Date(o.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
          {orders.length > 20 && <p className="admin-muted">+ {orders.length - 20} more. View all via <Link to={`/admin/orders?customer=${userId}`}>Orders filtered by customer</Link>.</p>}
        </div>
        <div className="card admin-card admin-card--notes">
          <h2>CRM notes ({notes.length})</h2>
          <div className="admin-notes-form">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="admin-notes-input"
            />
            <button type="button" className="btn btn-small" onClick={addNote} disabled={addingNote || !noteBody.trim()}>
              {addingNote ? 'Adding…' : 'Add note'}
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="admin-muted">No notes yet.</p>
          ) : (
            <ul className="admin-notes-list">
              {notes.map((n) => (
                <li key={n.id} className="admin-note-item">
                  <p className="admin-note-body">{n.body}</p>
                  <span className="admin-note-meta">{new Date(n.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

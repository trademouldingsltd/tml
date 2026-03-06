import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { useCustomerUi } from '@/contexts/CustomerUiContext'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderRow } from '@/types/database'
import type { CustomerProfileRow } from '@/types/database'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export default function Account() {
  const effectiveUserId = useEffectiveUserId()
  const { useSidebarMenu, setUseSidebarMenu } = useCustomerUi()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<CustomerProfileRow | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '' })
  const [orderFilter, setOrderFilter] = useState<'all' | 'open'>('all')
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest'>('newest')
  const [orderPageSize, setOrderPageSize] = useState(10)

  useEffect(() => {
    setOrderPageSize(10)
  }, [orderFilter, orderSort])

  useEffect(() => {
    if (!effectiveUserId) return
    Promise.all([
      supabase.from('customer_profiles').select('*').eq('user_id', effectiveUserId).maybeSingle(),
      supabase.from('orders').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false }),
    ]).then(([profileRes, ordersRes]) => {
      const p = profileRes.data ?? null
      setProfile(p as CustomerProfileRow | null)
      if (p) setEditForm({ company_name: (p as CustomerProfileRow).company_name || '', contact_name: (p as CustomerProfileRow).contact_name || '' })
      setOrders(ordersRes.data ?? [])
      setLoading(false)
    })
  }, [effectiveUserId])

  const outstanding = orders.filter((o) => ['quotation', 'placed', 'invoiced'].includes(o.status))
  const balanceOutstanding = profile ? Number(profile.balance_outstanding) : 0

  const filteredOrders = orders
    .filter((o) => orderFilter === 'open' ? ['quotation', 'placed', 'invoiced'].includes(o.status) : true)
    .sort((a, b) => orderSort === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const visibleOrders = filteredOrders.slice(0, orderPageSize)
  const hasMoreOrders = filteredOrders.length > orderPageSize

  async function saveProfile() {
    if (!profile?.id || saving) return
    setSaving(true)
    await supabase.from('customer_profiles').update({
      company_name: editForm.company_name,
      contact_name: editForm.contact_name || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)
    setProfile((prev) => prev ? { ...prev, ...editForm } : null)
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="account-page">
      <PageNav breadcrumb={[{ label: 'My account' }]} />
      <div className="account-header">
        <h1>My account</h1>
        <p className="page-intro">Manage your profile, view orders, and preferences.</p>
      </div>

      <div className="account-grid">
        <section className="account-section account-overview card">
          <h2>Overview</h2>
          <div className="account-stats">
            <div className="account-stat">
              <span className="account-stat-value">£{balanceOutstanding.toFixed(2)}</span>
              <span className="account-stat-label">Outstanding balance</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{outstanding.length}</span>
              <span className="account-stat-label">Open orders / quotations</span>
            </div>
          </div>
          <div className="account-quick-actions">
            <Link to="/ordering" className="btn">Create order</Link>
            <Link to="/downloads" className="btn btn-outline">Downloads</Link>
          </div>
        </section>

        <section className="account-section account-profile-section card">
          <h2>Profile</h2>
          {editing ? (
            <div className="account-profile-form">
              <label>Company name</label>
              <input
                value={editForm.company_name}
                onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="Company name"
              />
              <label>Contact name</label>
              <input
                value={editForm.contact_name}
                onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
                placeholder="Contact name"
              />
              <div className="account-profile-actions">
                <button type="button" className="btn" onClick={saveProfile} disabled={saving || !editForm.company_name.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => { setEditing(false); setEditForm({ company_name: profile?.company_name || '', contact_name: profile?.contact_name || '' }); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : profile ? (
            <>
              <p><strong>Company</strong> {profile.company_name}</p>
              <p><strong>Contact</strong> {profile.contact_name ?? '—'}</p>
              {profile.payment_terms && <p><strong>Payment terms</strong> {profile.payment_terms}</p>}
              <button type="button" className="btn btn-outline btn-small" onClick={() => setEditing(true)}>Edit profile</button>
            </>
          ) : (
            <p className="muted">No profile on file. Contact Trade Mouldings to set up your account details, or they will be created when you place an order.</p>
          )}
        </section>

        <section className="account-section account-preferences card">
          <h2>Preferences</h2>
          <div className="account-preference-row">
            <label className="account-preference-label">Theme</label>
            <div className="account-preference-control">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeId)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--tm-gray-light)' }}
              >
                <option value="classic">Classic (gold &amp; black)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <p className="account-preference-hint">Colour theme for the portal. Saved to your account.</p>
          </div>
          <div className="account-preference-row">
            <label className="account-preference-label">Navigation</label>
            <div className="account-preference-control">
              <button
                type="button"
                className={`btn btn-small ${!useSidebarMenu ? 'active' : 'btn-outline'}`}
                onClick={() => setUseSidebarMenu(false)}
              >
                Top menu
              </button>
              <button
                type="button"
                className={`btn btn-small ${useSidebarMenu ? 'active' : 'btn-outline'}`}
                onClick={() => setUseSidebarMenu(true)}
              >
                Side menu
              </button>
            </div>
            <p className="account-preference-hint">Choose how you prefer to navigate the site. Your choice is saved for this session.</p>
          </div>
        </section>
      </div>

      <section className="account-section account-orders-section">
        <div className="account-orders-header">
          <h2>Order history</h2>
          {orders.length > 0 && (
            <div className="account-orders-controls">
              <span className="account-orders-filter-label">Show</span>
              <div className="account-orders-toggle" role="group" aria-label="Filter orders">
                <button
                  type="button"
                  className={orderFilter === 'all' ? 'active' : ''}
                  onClick={() => setOrderFilter('all')}
                  aria-pressed={orderFilter === 'all'}
                >
                  All
                </button>
                <button
                  type="button"
                  className={orderFilter === 'open' ? 'active' : ''}
                  onClick={() => setOrderFilter('open')}
                  aria-pressed={orderFilter === 'open'}
                >
                  Open only
                </button>
              </div>
              <span className="account-orders-filter-label">Sort</span>
              <select
                value={orderSort}
                onChange={(e) => setOrderSort(e.target.value as 'newest' | 'oldest')}
                className="account-orders-sort"
                aria-label="Sort order history"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          )}
        </div>
        {filteredOrders.length === 0 ? (
          <div className="card">
            <p>
              {orders.length === 0
                ? 'No orders yet. Create an order from the ordering section and save as quotation or proceed to place.'
                : 'No orders match the current filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Total ex VAT</th>
                    <th>Total inc VAT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>{order.reference ?? '—'}</td>
                      <td><span className={`order-status order-status-${order.status}`}>{STATUS_LABELS[order.status] ?? order.status}</span></td>
                      <td>£{Number(order.total_ex_vat).toFixed(2)}</td>
                      <td>£{Number(order.total_inc_vat).toFixed(2)}</td>
                      <td><Link to={`/account/orders/${order.id}`} className="order-view-link">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMoreOrders && (
              <div className="account-orders-load-more">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setOrderPageSize((n) => n + 10)}
                >
                  Load more ({filteredOrders.length - orderPageSize} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

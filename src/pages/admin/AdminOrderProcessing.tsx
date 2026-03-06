import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderRow } from '@/types/database'

const STATUS_LABELS: Record<string, string> = {
  placed: 'Placed',
  invoiced: 'Invoiced',
}

export default function AdminOrderProcessing() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'placed' | 'invoiced' | 'both'>('placed')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load() {
    const statuses = filter === 'both' ? ['placed', 'invoiced'] : [filter]
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(200)
    const list = (orderData ?? []) as OrderRow[]
    setOrders(list)

    const userIds = [...new Set(list.map((o) => o.user_id))]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, company_name')
        .in('user_id', userIds)
      const map: Record<string, string> = {}
      ;(profiles ?? []).forEach((p) => { map[p.user_id] = p.company_name ?? p.user_id.slice(0, 8) })
      setCustomerMap(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filter])

  async function setStatus(orderId: string, status: OrderRow['status']) {
    setUpdatingId(orderId)
    const updates: Partial<OrderRow> = {
      status,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }
    await supabase.from('orders').update(updates).eq('id', orderId)
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)))
    setUpdatingId(null)
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading orders…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Order processing</span>
        <div className="admin-page-header-actions">
          <Link to="/admin/orders" className="btn btn-outline btn-small">All orders</Link>
        </div>
      </div>

      <div className="card admin-card">
        <h2>Orders to process</h2>
        <p className="admin-muted">Quick workflow: place → invoice → pay/despatch. Use this view to move placed orders to invoiced and add delivery details.</p>
        <div className="admin-order-processing-filters">
          <label>
            <input
              type="radio"
              name="processing-filter"
              checked={filter === 'placed'}
              onChange={() => setFilter('placed')}
            />
            Placed (needs invoicing)
          </label>
          <label>
            <input
              type="radio"
              name="processing-filter"
              checked={filter === 'invoiced'}
              onChange={() => setFilter('invoiced')}
            />
            Invoiced (ready to despatch)
          </label>
          <label>
            <input
              type="radio"
              name="processing-filter"
              checked={filter === 'both'}
              onChange={() => setFilter('both')}
            />
            Both
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Invoice #</th>
                <th>Expected delivery</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-muted">No orders in this status.</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/admin/orders/${o.id}`} className="admin-link">
                        {o.reference || o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{customerMap[o.user_id] ?? o.user_id.slice(0, 8)}</td>
                    <td>£{Number(o.total_inc_vat).toFixed(2)}</td>
                    <td>
                      <span className={`admin-status-badge admin-status-badge--${o.status}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td>{o.invoice_number ?? '—'}</td>
                    <td>{o.delivery_expected_date ? new Date(o.delivery_expected_date).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="admin-order-processing-actions">
                        <Link to={`/admin/orders/${o.id}`} className="btn btn-small">Open</Link>
                        {o.status === 'placed' && (
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() => setStatus(o.id, 'invoiced')}
                            disabled={!!updatingId}
                          >
                            {updatingId === o.id ? '…' : 'Mark invoiced'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

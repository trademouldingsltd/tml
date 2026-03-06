import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdminUi, formatAdminDate } from '@/contexts/AdminUiContext'
import { KanbanBoard, type KanbanColumn } from '@/components/shared/KanbanBoard'
import type { OrderRow } from '@/types/database'
import type { CustomerProfileRow } from '@/types/database'

type OrdersViewType = 'table' | 'grid' | 'cards' | 'kanban'
type OrdersSort = 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc' | 'reference_asc' | 'status_asc'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  quotation: '#3b82f6',
  placed: '#8b5cf6',
  invoiced: '#f59e0b',
  paid: '#22c55e',
  cancelled: '#64748b',
}

const ORDER_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'draft', label: 'Draft', color: STATUS_COLORS.draft },
  { id: 'quotation', label: 'Quotation', color: STATUS_COLORS.quotation },
  { id: 'placed', label: 'Placed', color: STATUS_COLORS.placed },
  { id: 'invoiced', label: 'Invoiced', color: STATUS_COLORS.invoiced },
  { id: 'paid', label: 'Paid', color: STATUS_COLORS.paid },
  { id: 'cancelled', label: 'Cancelled', color: STATUS_COLORS.cancelled },
]

export default function AdminOrders() {
  const [searchParams] = useSearchParams()
  const customerFilter = searchParams.get('customer') ?? ''
  const statusFromUrl = searchParams.get('status') ?? ''
  const adminUi = useAdminUi()
  const { tableDensity, setTableDensity, rowsPerPage, defaultOrderStatusFilter } = adminUi
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, { company_name: string; contact_name?: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || defaultOrderStatusFilter)
  const [referenceSearch, setReferenceSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [limit, setLimit] = useState(Math.max(rowsPerPage, 100))
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [viewType, setViewType] = useState<OrdersViewType>('table')
  const [sortBy, setSortBy] = useState<OrdersSort>('date_desc')

  async function updateOrderStatus(orderId: string, newStatus: OrderRow['status']) {
    setUpdatingOrderId(orderId)
    const updates: Partial<OrderRow> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'placed' || newStatus === 'invoiced') {
      updates.processed_at = new Date().toISOString()
    }
    if (newStatus === 'cancelled') {
      updates.payment_status = null
      updates.payment_intent_id = null
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)))
    }
    setUpdatingOrderId(null)
  }

  useEffect(() => {
    if (statusFromUrl) setStatusFilter(statusFromUrl)
    else setStatusFilter(defaultOrderStatusFilter)
  }, [defaultOrderStatusFilter, statusFromUrl])

  useEffect(() => {
    async function load() {
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
      if (customerFilter) q = q.eq('user_id', customerFilter)
      if (statusFilter && viewType !== 'kanban') q = q.eq('status', statusFilter)
      if (referenceSearch.trim()) q = q.ilike('reference', `%${referenceSearch.trim()}%`)
      if (dateFrom) q = q.gte('created_at', dateFrom + 'T00:00:00Z')
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59.999Z')
      const { data: orderData } = await q
      const orderList = orderData ?? []
      setOrders(orderList)

      const userIds = [...new Set(orderList.map((o) => o.user_id))]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('customer_profiles')
          .select('user_id, company_name, contact_name')
          .in('user_id', userIds)
        const map: Record<string, { company_name: string; contact_name?: string | null }> = {}
        for (const p of profiles ?? []) {
          const row = p as CustomerProfileRow & { user_id: string }
          map[row.user_id] = { company_name: row.company_name, contact_name: row.contact_name }
        }
        setCustomerMap(map)
      } else {
        setCustomerMap({})
      }
      setLoading(false)
    }
    load()
  }, [customerFilter, statusFilter, limit, referenceSearch, dateFrom, dateTo, viewType])

  const getCustomerDisplay = (userId: string) => {
    const c = customerMap[userId]
    if (c?.company_name) return c.company_name
    return userId.slice(0, 8) + '…'
  }

  const sortedOrders = useMemo(() => {
    const list = [...orders]
    switch (sortBy) {
      case 'date_desc':
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      case 'date_asc':
        return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'total_desc':
        return list.sort((a, b) => Number(b.total_ex_vat) - Number(a.total_ex_vat))
      case 'total_asc':
        return list.sort((a, b) => Number(a.total_ex_vat) - Number(b.total_ex_vat))
      case 'reference_asc':
        return list.sort((a, b) => (a.reference ?? '').localeCompare(b.reference ?? ''))
      case 'status_asc':
        return list.sort((a, b) => (STATUS_LABELS[a.status] ?? a.status).localeCompare(STATUS_LABELS[b.status] ?? b.status))
      default:
        return list
    }
  }, [orders, sortBy])

  return (
    <div className="admin-page">
      <div className="admin-orders-header">
        <h1 className="admin-page-title">Orders</h1>
        <p className="page-intro">
          Process orders, update status, edit lines, and manage delivery. Reopen cancelled orders or move orders back to edit.
        </p>
      </div>

      <div className="admin-filters admin-filters--wrap">
        <label>
          Status{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Reference{' '}
          <input
            type="search"
            placeholder="Search reference…"
            value={referenceSearch}
            onChange={(e) => setReferenceSearch(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          From{' '}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          Show{' '}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="admin-filter-input"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </label>
        <label>
          Sort{' '}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as OrdersSort)} className="admin-filter-input">
            <option value="date_desc">Date (newest)</option>
            <option value="date_asc">Date (oldest)</option>
            <option value="total_desc">Total (high–low)</option>
            <option value="total_asc">Total (low–high)</option>
            <option value="reference_asc">Reference A–Z</option>
            <option value="status_asc">Status A–Z</option>
          </select>
        </label>
        <div className="admin-orders-view-toggle" role="group" aria-label="View type">
          <button type="button" className={viewType === 'table' ? 'active' : ''} onClick={() => setViewType('table')} title="Table">☰</button>
          <button type="button" className={viewType === 'grid' ? 'active' : ''} onClick={() => setViewType('grid')} title="Grid">◫</button>
          <button type="button" className={viewType === 'cards' ? 'active' : ''} onClick={() => setViewType('cards')} title="Cards">▦</button>
          <button type="button" className={viewType === 'kanban' ? 'active' : ''} onClick={() => setViewType('kanban')} title="Kanban">▤</button>
        </div>
        <label className="admin-orders-density">
          Table density
          <select value={tableDensity} onChange={(e) => setTableDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')} className="admin-filter-input">
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        {customerFilter && (
          <span className="filter-tag">Customer: {customerFilter.slice(0, 8)}…</span>
        )}
      </div>

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading orders…</p>
        </div>
      ) : (
        <div className="card admin-card">
          <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>{sortedOrders.length} order(s)</p>
          {viewType === 'table' && (
          <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
            <table className="admin-table orders-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Total ex VAT</th>
                  <th>Total inc VAT</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      No orders match the filters. Try changing the status or date range, or{' '}
                      <Link to="/admin/create-order">create an order</Link>.
                    </td>
                  </tr>
                ) : (
                  sortedOrders.map((o) => (
                    <tr key={o.id}>
                      <td>{formatAdminDate(adminUi, o.created_at)}</td>
                      <td>
                        <Link to={`/admin/customers/${o.user_id}`} className="admin-table-link">
                          {getCustomerDisplay(o.user_id)}
                        </Link>
                      </td>
                      <td>{o.reference ?? '—'}</td>
                      <td>
                        <span className="admin-orders-status-cell">
                          <select
                            value={o.status}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderRow['status'])}
                            disabled={updatingOrderId === o.id}
                            className={`admin-orders-status-select admin-orders-status-select--${o.status}`}
                            aria-label={`Change status for order ${o.reference ?? o.id}`}
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                          {updatingOrderId === o.id && (
                            <span className="admin-orders-status-updating" aria-hidden>…</span>
                          )}
                          {o.payment_status === 'succeeded' && (
                            <span className="admin-table-paid-badge">Paid</span>
                          )}
                        </span>
                      </td>
                      <td>£{Number(o.total_ex_vat).toFixed(2)}</td>
                      <td>£{Number(o.total_inc_vat).toFixed(2)}</td>
                      <td>
                        <Link to={`/admin/orders/${o.id}`} className="btn btn-small">
                          Edit order
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
          {(viewType === 'grid' || viewType === 'cards') && (
            <div className={`admin-orders-grid admin-orders-view--${viewType}`}>
              {sortedOrders.length === 0 ? (
                <p className="admin-muted">
                  No orders match. <Link to="/admin/create-order">Create an order</Link>.
                </p>
              ) : (
                sortedOrders.map((o) => (
                  <div key={o.id} className="admin-orders-card card">
                    <div className="admin-orders-card-head">
                      <Link to={`/admin/orders/${o.id}`} className="admin-orders-card-ref">
                        {o.reference ?? o.id.slice(0, 8)}
                      </Link>
                      <span className="admin-orders-card-date">{formatAdminDate(adminUi, o.created_at)}</span>
                    </div>
                    <Link to={`/admin/customers/${o.user_id}`} className="admin-orders-card-customer">
                      {getCustomerDisplay(o.user_id)}
                    </Link>
                    <div className="admin-orders-card-status">
                      <select
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderRow['status'])}
                        disabled={updatingOrderId === o.id}
                        className={`admin-orders-status-select admin-orders-status-select--${o.status}`}
                        aria-label={`Change status`}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      {o.payment_status === 'succeeded' && <span className="admin-table-paid-badge">Paid</span>}
                      {updatingOrderId === o.id && <span className="admin-orders-status-updating">…</span>}
                    </div>
                    <div className="admin-orders-card-totals">
                      <span>£{Number(o.total_ex_vat).toFixed(2)} ex VAT</span>
                      <span>£{Number(o.total_inc_vat).toFixed(2)} inc VAT</span>
                    </div>
                    <Link to={`/admin/orders/${o.id}`} className="btn btn-small">
                      Edit order
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
          {viewType === 'kanban' && (
            <KanbanBoard<OrderRow>
              columns={ORDER_KANBAN_COLUMNS}
              items={orders}
              getItemId={(o) => o.id}
              getColumnId={(o) => o.status}
              onMove={(itemId, toColumnId) => updateOrderStatus(itemId, toColumnId as OrderRow['status'])}
              getCardColor={(o) => STATUS_COLORS[o.status]}
              emptyMessage="No orders"
              className="admin-orders-kanban"
              renderCard={(o, { isDragging }) => (
                <Link to={`/admin/orders/${o.id}`} className="kanban-card-inner" onClick={(e) => isDragging && e.preventDefault()}>
                  <div className="kanban-card-title">{o.reference ?? o.id.slice(0, 8)}</div>
                  <div className="kanban-card-detail">{getCustomerDisplay(o.user_id)}</div>
                  <div className="kanban-card-meta">
                    <span>{formatAdminDate(adminUi, o.created_at)}</span>
                    <span>£{Number(o.total_inc_vat).toFixed(2)} inc VAT</span>
                    {o.payment_status === 'succeeded' && <span className="admin-table-paid-badge">Paid</span>}
                  </div>
                  <div className="kanban-card-actions">
                    <span className="kanban-card-action-link">Edit order →</span>
                  </div>
                </Link>
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}

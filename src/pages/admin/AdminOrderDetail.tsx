import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { type OrderRow, COURIER_OPTIONS } from '@/types/database'
import { trackingUrl } from '@/lib/tracking'

const VAT_RATE = 1.2
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_ORDER: OrderRow['status'][] = ['draft', 'quotation', 'placed', 'invoiced', 'paid', 'cancelled']

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

/** Statuses we can move forward to from current */
function nextStatuses(current: OrderRow['status']): OrderRow['status'][] {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx < 0) return []
  const next: OrderRow['status'][] = []
  for (let i = idx + 1; i < STATUS_ORDER.length; i++) {
    if (STATUS_ORDER[i] !== 'cancelled') next.push(STATUS_ORDER[i])
  }
  next.push('cancelled')
  return next
}

/** Statuses we can reopen to (move backward) */
function reopenStatuses(current: OrderRow['status']): OrderRow['status'][] {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx <= 0) return []
  const prev: OrderRow['status'][] = []
  for (let i = idx - 1; i >= 0; i--) {
    prev.push(STATUS_ORDER[i])
  }
  return prev
}

const EDITABLE_STATUSES: OrderRow['status'][] = ['draft', 'quotation', 'placed', 'invoiced']
const canEditLines = (status: OrderRow['status']) => EDITABLE_STATUSES.includes(status)

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [delivery, setDelivery] = useState({
    delivery_address: '',
    delivery_postcode: '',
    delivery_notes: '',
    delivery_tracking: '',
    courier: '',
    delivery_expected_date: '',
  })
  const [productId, setProductId] = useState('')
  const [productQty, setProductQty] = useState(1)
  const [products, setProducts] = useState<{ id: string; name: string; unit_price: number; description?: string; sku?: string; image_url?: string }[]>([])
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null)
  const [setStatusValue, setSetStatusValue] = useState<OrderRow['status'] | ''>('')
  const [setStatusConfirm, setSetStatusConfirm] = useState(false)
  const [reopenToValue, setReopenToValue] = useState<OrderRow['status'] | ''>('')
  const [reopenConfirm, setReopenConfirm] = useState(false)
  const [editingPriceLineId, setEditingPriceLineId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')
  const [customerPaymentTerms, setCustomerPaymentTerms] = useState<string | null>(null)

  async function load() {
    if (!orderId) return
    const [orderRes, linesRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId),
      supabase.from('products').select('id, name, unit_price, description, sku, image_url').eq('active', true).order('name'),
    ])
    if (orderRes.data) {
      setOrder(orderRes.data as OrderRow)
      const userId = (orderRes.data as OrderRow).user_id
      const { data: profile } = await supabase.from('customer_profiles').select('payment_terms').eq('user_id', userId).maybeSingle()
      setCustomerPaymentTerms(profile?.payment_terms ?? null)
      setDelivery({
        delivery_address: orderRes.data.delivery_address ?? '',
        delivery_postcode: orderRes.data.delivery_postcode ?? '',
        delivery_notes: orderRes.data.delivery_notes ?? '',
        delivery_tracking: orderRes.data.delivery_tracking ?? '',
        courier: orderRes.data.courier ?? '',
        delivery_expected_date: orderRes.data.delivery_expected_date ? orderRes.data.delivery_expected_date.slice(0, 10) : '',
      })
      setSetStatusValue(orderRes.data.status)
      setReopenToValue('')
    }
    setLines((linesRes.data as LineRow[]) ?? [])
    setProducts((productsRes.data ?? []).map((p) => ({ id: p.id, name: p.name, unit_price: p.unit_price, description: p.description, sku: p.sku, image_url: p.image_url })))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [orderId])

  async function setStatus(status: OrderRow['status']) {
    if (!orderId || saving) return
    setSaving(true)
    const updates: Partial<OrderRow> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'placed' || status === 'invoiced') {
      updates.processed_at = new Date().toISOString()
    }
    if (status === 'cancelled') {
      updates.payment_status = null
      updates.payment_intent_id = null
    }
    await supabase.from('orders').update(updates).eq('id', orderId)
    setOrder((o) => (o ? { ...o, ...updates } : null))
    setCancelConfirm(false)
    setSetStatusConfirm(false)
    setReopenConfirm(false)
    setReopenToValue('')
    setSaving(false)
  }

  async function markAsProcessed() {
    if (!orderId || saving) return
    setSaving(true)
    const processed_at = new Date().toISOString()
    await supabase.from('orders').update({ processed_at, updated_at: processed_at }).eq('id', orderId)
    setOrder((o) => (o ? { ...o, processed_at } : null))
    setSaving(false)
  }

  async function saveDelivery() {
    if (!orderId || saving) return
    setSaving(true)
    await supabase.from('orders').update({
      delivery_address: delivery.delivery_address || null,
      delivery_postcode: delivery.delivery_postcode || null,
      delivery_notes: delivery.delivery_notes || null,
      delivery_tracking: delivery.delivery_tracking || null,
      courier: delivery.courier || null,
      delivery_expected_date: delivery.delivery_expected_date || null,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)
    setOrder((o) => (o ? { ...o, courier: delivery.courier || null, delivery_expected_date: delivery.delivery_expected_date || null } : null))
    setSaving(false)
  }

  async function addLine() {
    if (!orderId || !productId || productQty < 1) return
    const prod = products.find((p) => p.id === productId)
    if (!prod) return
    setSaving(true)
    await supabase.from('order_lines').insert({
      order_id: orderId,
      product_id: prod.id,
      product_snapshot: { name: prod.name, description: prod.description, sku: prod.sku, image_url: prod.image_url },
      quantity: productQty,
      unit_price: prod.unit_price,
      options: {},
    })
    await recalcTotals()
    const { data } = await supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId)
    setLines((data as LineRow[]) ?? [])
    setProductId('')
    setProductQty(1)
    setSaving(false)
  }

  async function updateLineQty(lineId: string, delta: number) {
    const line = lines.find((l) => l.id === lineId)
    if (!line || !orderId) return
    const newQty = Math.max(0, line.quantity + delta)
    if (newQty === 0) {
      await supabase.from('order_lines').delete().eq('id', lineId)
    } else {
      await supabase.from('order_lines').update({ quantity: newQty }).eq('id', lineId)
    }
    await recalcTotals()
    const { data } = await supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId)
    setLines((data as LineRow[]) ?? [])
    const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (o) setOrder(o as OrderRow)
  }

  async function updateLinePrice(lineId: string, newPrice: number) {
    if (!orderId || newPrice < 0) return
    setSaving(true)
    await supabase.from('order_lines').update({ unit_price: newPrice }).eq('id', lineId)
    await recalcTotals()
    const { data } = await supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId)
    setLines((data as LineRow[]) ?? [])
    const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (o) setOrder(o as OrderRow)
    setEditingPriceLineId(null)
    setEditingPriceValue('')
    setSaving(false)
  }

  async function deleteLine(lineId: string) {
    if (!orderId) return
    setDeletingLineId(lineId)
    await supabase.from('order_lines').delete().eq('id', lineId)
    await recalcTotals()
    const { data } = await supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId)
    setLines((data as LineRow[]) ?? [])
    const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (o) setOrder(o as OrderRow)
    setDeletingLineId(null)
  }

  async function recalcTotals() {
    if (!orderId) return
    const { data: orderLines } = await supabase.from('order_lines').select('quantity, unit_price').eq('order_id', orderId)
    const totalExVat = (orderLines ?? []).reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
    await supabase.from('orders').update({
      total_ex_vat: totalExVat,
      total_inc_vat: totalExVat * VAT_RATE,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)
    const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (o) setOrder(o as OrderRow)
  }

  if (!orderId || (order === null && !loading)) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <p>Order not found.</p>
          <Link to="/admin/orders" className="btn btn-outline">← Back to orders</Link>
        </div>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading order…</p>
        </div>
      </div>
    )
  }

  const currentStatus = order!.status
  const next = nextStatuses(currentStatus)
  const reopen = reopenStatuses(currentStatus)
  const isCancelled = currentStatus === 'cancelled'
  const canProcess = !isCancelled && currentStatus !== 'draft'
  const canEdit = canEditLines(currentStatus)

  return (
    <div className="admin-page admin-order-detail-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin/orders">Orders</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Order {order!.reference || orderId!.slice(0, 8)}</span>
        </span>
        <div className="admin-page-header-actions">
          {order!.invoice_number && (
            <Link to={`/admin/orders/${orderId}/invoice`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">Print invoice</Link>
          )}
          <Link to={`/admin/customers/${order!.user_id}`} className="btn btn-outline btn-small">Customer</Link>
          <Link to="/admin/orders" className="btn btn-outline btn-small">← Back to orders</Link>
        </div>
      </div>

      {/* Order actions: reopen, process, set status, cancel */}
      <div className="card admin-card admin-order-actions-card">
        <h2>Order actions</h2>
        <div className="admin-order-current-status">
          <strong>Status:</strong>{' '}
          <span className={`admin-status-badge admin-status-badge--${currentStatus}`}>
            {STATUS_LABELS[currentStatus] ?? currentStatus}
          </span>
          {order!.invoice_number && (
            <span className="admin-invoice-ref">Invoice: {order!.invoice_number}</span>
          )}
          {order!.payment_status === 'succeeded' && (
            <span className="admin-payment-badge">Paid</span>
          )}
        </div>

        {order!.processed_at && (
          <p className="admin-muted">Processed: {new Date(order!.processed_at).toLocaleString()}</p>
        )}

        <div className="admin-order-actions-grid">
          {/* Reopen cancelled: only when status is cancelled */}
          {isCancelled && (
            <div className="admin-action-block">
              <h3>Reopen cancelled order</h3>
              <p className="admin-action-hint">Set the order back to Draft or Quotation so it can be edited and progressed again.</p>
              <select
                value={reopenToValue}
                onChange={(e) => setReopenToValue((e.target.value || '') as OrderRow['status'] | '')}
              >
                <option value="">Choose new status…</option>
                <option value="draft">Draft</option>
                <option value="quotation">Quotation</option>
              </select>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => reopenToValue && setReopenConfirm(true)}
                disabled={!reopenToValue || saving}
              >
                Reopen order
              </button>
            </div>
          )}

          {/* Reopen (move backward): when not cancelled and not draft */}
          {!isCancelled && reopen.length > 0 && (
            <div className="admin-action-block">
              <h3>Reopen to earlier status</h3>
              <p className="admin-action-hint">Move the order back so you can edit lines or change details.</p>
              <div className="admin-status-buttons">
                {reopen.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn btn-small btn-outline"
                    onClick={() => setStatus(status)}
                    disabled={saving}
                  >
                    Reopen to {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Move forward */}
          {next.length > 0 && (
            <div className="admin-action-block">
              <h3>Progress order</h3>
              <div className="admin-status-buttons">
                {next.filter((s) => s !== 'cancelled').map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn btn-small"
                    onClick={() => setStatus(status)}
                    disabled={saving}
                  >
                    Mark as {STATUS_LABELS[status]}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-small btn-danger-outline"
                  onClick={() => setCancelConfirm(true)}
                  disabled={saving}
                >
                  Cancel order
                </button>
              </div>
            </div>
          )}

          {/* Manual process */}
          {canProcess && (
            <div className="admin-action-block">
              <h3>Processing</h3>
              <button type="button" className="btn btn-small btn-outline" onClick={markAsProcessed} disabled={saving}>
                Mark as processed (set date)
              </button>
            </div>
          )}

          {/* Set status to any */}
          <div className="admin-action-block admin-action-block--set-status">
            <h3>Set status to any</h3>
            <select
              value={setStatusValue}
              onChange={(e) => setSetStatusValue((e.target.value || '') as OrderRow['status'])}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                if (setStatusValue && setStatusValue !== currentStatus) {
                  if (setStatusValue === 'cancelled') setCancelConfirm(true)
                  else if (isCancelled) {
                    setReopenToValue(setStatusValue)
                    setReopenConfirm(true)
                  } else setSetStatusConfirm(true)
                }
              }}
              disabled={!setStatusValue || setStatusValue === currentStatus || saving}
            >
              Apply
            </button>
            {setStatusConfirm && setStatusValue && setStatusValue !== 'cancelled' && (
              <div className="admin-confirm-inline">
                <span>Set status to {STATUS_LABELS[setStatusValue]}?</span>
                <button type="button" className="btn btn-small" onClick={() => { setStatus(setStatusValue as OrderRow['status']); setSetStatusConfirm(false); }}>Confirm</button>
                <button type="button" className="btn btn-small btn-outline" onClick={() => setSetStatusConfirm(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {cancelConfirm && (
          <div className="admin-confirm-box">
            <p>Cancel this order? Status will be set to Cancelled.</p>
            <div className="admin-confirm-actions">
              <button type="button" className="btn btn-danger" onClick={() => setStatus('cancelled')} disabled={saving}>Yes, cancel order</button>
              <button type="button" className="btn btn-outline" onClick={() => setCancelConfirm(false)}>No, keep order</button>
            </div>
          </div>
        )}

        {reopenConfirm && reopenToValue && (
          <div className="admin-confirm-box">
            <p>Reopen this order and set status to {STATUS_LABELS[reopenToValue]}?</p>
            <div className="admin-confirm-actions">
              <button type="button" className="btn" onClick={() => { setStatus(reopenToValue as OrderRow['status']); setReopenConfirm(false); setReopenToValue(''); }} disabled={saving}>Yes, reopen</button>
              <button type="button" className="btn btn-outline" onClick={() => { setReopenConfirm(false); setReopenToValue(''); }}>No</button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-order-grid">
        <div className="card admin-card">
          <h2>Reference & customer</h2>
          <div className="admin-order-reference">
            <label>Reference</label>
            <input
              type="text"
              value={order!.reference ?? ''}
              onChange={async (e) => {
                const v = e.target.value
                await supabase.from('orders').update({ reference: v || null, updated_at: new Date().toISOString() }).eq('id', orderId)
                setOrder((o) => (o ? { ...o, reference: v || null } : null))
              }}
              placeholder="Order reference"
            />
          </div>
          {customerPaymentTerms && <p className="admin-muted"><strong>Customer payment terms:</strong> {customerPaymentTerms}</p>}
          <p className="admin-muted"><strong>Customer user_id:</strong> <code>{order!.user_id}</code></p>
        </div>

        <div className="card admin-card">
          <h2>Delivery details</h2>
          <label>Address</label>
          <textarea
            value={delivery.delivery_address}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_address: e.target.value }))}
            rows={2}
            placeholder="Delivery address"
          />
          <label>Postcode</label>
          <input
            type="text"
            value={delivery.delivery_postcode}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_postcode: e.target.value }))}
            placeholder="Postcode"
          />
          <label>Notes</label>
          <textarea
            value={delivery.delivery_notes}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_notes: e.target.value }))}
            rows={2}
            placeholder="Delivery notes"
          />
          <label>Courier</label>
          <select
            value={delivery.courier}
            onChange={(e) => setDelivery((d) => ({ ...d, courier: e.target.value }))}
          >
            <option value="">— Select —</option>
            {COURIER_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label>Expected delivery date</label>
          <input
            type="date"
            value={delivery.delivery_expected_date}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_expected_date: e.target.value }))}
          />
          <label>Tracking number / link</label>
          <input
            type="text"
            value={delivery.delivery_tracking}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_tracking: e.target.value }))}
            placeholder="Tracking number or full URL"
          />
          {delivery.delivery_tracking && delivery.courier && (
            <p className="admin-muted">
              <a href={trackingUrl(delivery.courier, delivery.delivery_tracking)} target="_blank" rel="noopener noreferrer">
                Open tracking →
              </a>
            </p>
          )}
          <button type="button" className="btn btn-small" onClick={saveDelivery} disabled={saving}>Save delivery</button>
        </div>
      </div>

      <div className="card admin-card admin-order-lines-card">
        <h2>Order lines</h2>
        <p className="admin-order-totals">
          <strong>Total ex VAT</strong> £{Number(order!.total_ex_vat).toFixed(2)} · <strong>Total inc VAT</strong> £{Number(order!.total_inc_vat).toFixed(2)}
        </p>
        <ul className="admin-order-lines">
          {lines.map((l) => (
            <li key={l.id} className="admin-order-line">
              <span className="line-name">{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</span>
              <span className="line-price">
                {editingPriceLineId === l.id ? (
                  <span className="admin-edit-price-wrap">
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      value={editingPriceValue}
                      onChange={(e) => setEditingPriceValue(e.target.value)}
                      className="admin-edit-price-input"
                    />
                    <button type="button" className="btn btn-small" onClick={() => updateLinePrice(l.id, Number(editingPriceValue))} disabled={saving}>Save</button>
                    <button type="button" className="btn btn-small btn-outline" onClick={() => { setEditingPriceLineId(null); setEditingPriceValue(''); }}>Cancel</button>
                  </span>
                ) : (
                  <>
                    £{Number(l.unit_price).toFixed(2)} × {l.quantity} = £{(l.quantity * Number(l.unit_price)).toFixed(2)}
                    {canEdit && (
                      <button type="button" className="btn btn-small btn-ghost admin-edit-price-btn" onClick={() => { setEditingPriceLineId(l.id); setEditingPriceValue(String(l.unit_price)); }}>Edit price</button>
                    )}
                  </>
                )}
              </span>
              <span className="line-actions">
                {canEdit && (
                  <>
                    <button type="button" className="btn btn-icon" onClick={() => updateLineQty(l.id, -1)} aria-label="Decrease">−</button>
                    <span className="line-qty-value">{l.quantity}</span>
                    <button type="button" className="btn btn-icon" onClick={() => updateLineQty(l.id, 1)} aria-label="Increase">+</button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger-outline"
                      onClick={() => deleteLine(l.id)}
                      disabled={!!deletingLineId}
                      aria-label="Remove line"
                    >
                      Remove
                    </button>
                  </>
                )}
                {!canEdit && <span className="line-qty-value">{l.quantity}</span>}
              </span>
            </li>
          ))}
        </ul>

        {canEdit && (
          <div className="admin-add-line">
            <h3>Add line</h3>
            <div className="admin-add-line-fields">
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — £{p.unit_price.toFixed(2)}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={productQty}
                onChange={(e) => setProductQty(Number(e.target.value) || 1)}
              />
              <button type="button" className="btn btn-small" onClick={addLine} disabled={!productId || saving}>Add line</button>
            </div>
          </div>
        )}

        {!canEdit && currentStatus !== 'cancelled' && (
          <p className="admin-muted">Lines are locked for paid orders. Reopen to an earlier status to edit.</p>
        )}
      </div>
    </div>
  )
}

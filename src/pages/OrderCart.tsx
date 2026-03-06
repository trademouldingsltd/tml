import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'

const VAT_RATE = 1.2

interface LineWithDetails {
  id: string
  quantity: number
  unit_price: number
  product_snapshot: { name?: string; description?: string; sku?: string; image_url?: string }
}

export default function OrderCart() {
  const navigate = useNavigate()
  const { draftOrder, refresh } = useDraftOrder()
  const [lines, setLines] = useState<LineWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'save' | 'place' | 'clear' | 'cancel' | null>(null)

  useEffect(() => {
    if (!draftOrder?.id) {
      setLines([])
      setLoading(false)
      return
    }
    supabase
      .from('order_lines')
      .select('id, quantity, unit_price, product_snapshot')
      .eq('order_id', draftOrder.id)
      .then(({ data }) => {
        setLines((data as LineWithDetails[]) ?? [])
        setLoading(false)
      })
  }, [draftOrder?.id])

  async function updateQuantity(lineId: string, delta: number) {
    const line = lines.find((l) => l.id === lineId)
    if (!line || !draftOrder) return
    const newQty = Math.max(0, line.quantity + delta)
    if (newQty === 0) {
      await supabase.from('order_lines').delete().eq('id', lineId)
    } else {
      await supabase.from('order_lines').update({ quantity: newQty }).eq('id', lineId)
    }
    await refresh()
    const { data } = await supabase.from('order_lines').select('id, quantity, unit_price, product_snapshot').eq('order_id', draftOrder.id)
    setLines((data as LineWithDetails[]) ?? [])
    recalcTotals()
  }

  async function recalcTotals() {
    if (!draftOrder?.id) return
    const { data: orderLines } = await supabase.from('order_lines').select('quantity, unit_price').eq('order_id', draftOrder.id)
    const totalExVat = (orderLines ?? []).reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
    await supabase
      .from('orders')
      .update({ total_ex_vat: totalExVat, total_inc_vat: totalExVat * VAT_RATE, updated_at: new Date().toISOString() })
      .eq('id', draftOrder.id)
    await refresh()
  }

  async function saveQuotation() {
    if (!draftOrder?.id || lines.length === 0) return
    setAction('save')
    try {
      await supabase.from('orders').update({ status: 'quotation', updated_at: new Date().toISOString() }).eq('id', draftOrder.id)
      await refresh()
      navigate('/account')
    } finally {
      setAction(null)
    }
  }

  async function placeOrder() {
    if (!draftOrder?.id || lines.length === 0) return
    setAction('place')
    try {
      await supabase.from('orders').update({ status: 'placed', updated_at: new Date().toISOString() }).eq('id', draftOrder.id)
      await refresh()
      navigate(`/account/orders/${draftOrder.id}`, { state: { justPlaced: true } })
    } finally {
      setAction(null)
    }
  }

  async function clearCart() {
    if (!draftOrder?.id) return
    if (!confirm('Remove all items from the cart? You can add more items from Create order.')) return
    setAction('clear')
    try {
      await supabase.from('order_lines').delete().eq('order_id', draftOrder.id)
      await recalcTotals()
      const { data } = await supabase.from('order_lines').select('id, quantity, unit_price, product_snapshot').eq('order_id', draftOrder.id)
      setLines((data as LineWithDetails[]) ?? [])
      await refresh()
    } finally {
      setAction(null)
    }
  }

  async function cancelOrder() {
    if (!draftOrder?.id) return
    if (!confirm('Cancel this draft? The order will be marked cancelled and you’ll start fresh from Create order.')) return
    setAction('cancel')
    try {
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', draftOrder.id)
      await refresh()
      setAction(null)
      navigate('/ordering')
    } finally {
      setAction(null)
    }
  }

  if (!draftOrder && !loading) {
    return (
      <div className="order-cart-page">
        <PageNav backTo="/ordering" backLabel="Create order" />
        <div className="cart-empty-state card">
          <h1>Your cart is empty</h1>
          <p>Add products from Create order to build an estimate or place an order.</p>
          <Link to="/ordering" className="btn">Go to Create order</Link>
        </div>
      </div>
    )
  }

  const totalExVat = draftOrder ? Number(draftOrder.total_ex_vat) : 0
  const totalIncVat = draftOrder ? Number(draftOrder.total_inc_vat) : 0
  const busy = !!action

  return (
    <div className="order-cart-page">
      <PageNav backTo="/ordering" backLabel="Create order" />
      <div className="cart-page-header">
        <h1>Order cart</h1>
        <p className="page-intro">Review your items, then save as a quotation or place your order.</p>
      </div>

      {loading ? (
        <div className="cart-loading">
          <p>Loading cart…</p>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-main">
            <div className="card cart-list-card">
              <h2 className="cart-list-title">Items ({lines.length})</h2>
              {lines.length === 0 ? (
                <p className="cart-no-items">No items yet. <Link to="/ordering">Add products</Link> from Create order.</p>
              ) : (
                <ul className="cart-lines">
                  {lines.map((line) => (
                    <li key={line.id} className="cart-line">
                      <div className="cart-line-media">
                        {(line.product_snapshot as { image_url?: string })?.image_url ? (
                          <img src={(line.product_snapshot as { image_url?: string }).image_url} alt="" />
                        ) : (
                          <div className="cart-line-placeholder">—</div>
                        )}
                      </div>
                      <div className="cart-line-info">
                        <span className="cart-line-name">{(line.product_snapshot as { name?: string })?.name ?? 'Product'}</span>
                        {(line.product_snapshot as { sku?: string })?.sku && (
                          <span className="cart-line-sku">SKU: {(line.product_snapshot as { sku?: string }).sku}</span>
                        )}
                        <span className="cart-line-unit">£{Number(line.unit_price).toFixed(2)} each</span>
                      </div>
                      <div className="cart-line-qty">
                        <button type="button" className="btn btn-icon" onClick={() => updateQuantity(line.id, -1)} aria-label="Decrease quantity">−</button>
                        <span className="cart-line-qty-value">{line.quantity}</span>
                        <button type="button" className="btn btn-icon" onClick={() => updateQuantity(line.id, 1)} aria-label="Increase quantity">+</button>
                      </div>
                      <span className="cart-line-total">£{(line.quantity * Number(line.unit_price)).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="cart-secondary-actions">
                <button type="button" className="btn btn-outline" onClick={clearCart} disabled={busy}>
                  Clear cart
                </button>
                <button type="button" className="btn btn-outline btn-danger-outline" onClick={cancelOrder} disabled={busy}>
                  Cancel order
                </button>
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <aside className="cart-summary-card card">
              <h2 className="cart-summary-title">Summary</h2>
              <div className="cart-summary-rows">
                <div className="cart-summary-row">
                  <span>Subtotal (ex VAT)</span>
                  <span>£{totalExVat.toFixed(2)}</span>
                </div>
                <div className="cart-summary-row">
                  <span>VAT (20%)</span>
                  <span>£{(totalIncVat - totalExVat).toFixed(2)}</span>
                </div>
                <div className="cart-summary-row cart-summary-total">
                  <span>Total (inc VAT)</span>
                  <span>£{totalIncVat.toFixed(2)}</span>
                </div>
              </div>
              <div className="cart-summary-actions">
                <button type="button" className="btn btn-block btn-primary" onClick={placeOrder} disabled={busy}>
                  {action === 'place' ? 'Placing…' : 'Place order'}
                </button>
                <p className="cart-action-hint">Order will be placed and you can pay from your account.</p>
                <button type="button" className="btn btn-block btn-outline" onClick={saveQuotation} disabled={busy}>
                  {action === 'save' ? 'Saving…' : 'Save as quotation'}
                </button>
                <p className="cart-action-hint">Request a formal quote without committing.</p>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { redirectToCheckout, verifyCheckoutSession } from '@/lib/payment'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderRow } from '@/types/database'
import { trackingUrl } from '@/lib/tracking'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const effectiveUserId = useEffectiveUserId()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState<'success' | 'cancelled' | 'error' | null>(null)
  const [, setVerifying] = useState(false)
  const verifiedSessionRef = useRef<string | null>(null)
  const location = useLocation()
  const justPlaced = (location.state as { justPlaced?: boolean })?.justPlaced

  async function loadOrder() {
    if (!orderId || !effectiveUserId) return
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', effectiveUserId)
      .single()
    if (!orderData) {
      setOrder(null)
      setLoading(false)
      return
    }
    setOrder(orderData as OrderRow)
    const { data: linesData } = await supabase
      .from('order_lines')
      .select('id, product_snapshot, quantity, unit_price')
      .eq('order_id', orderId)
    setLines((linesData as LineRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadOrder()
  }, [orderId, effectiveUserId])

  // After redirect from Stripe: verify session and show message (once per session_id)
  useEffect(() => {
    const payment = searchParams.get('payment')
    const sessionId = searchParams.get('session_id')
    if (payment === 'cancelled') {
      setPaymentMessage('cancelled')
      setSearchParams({}, { replace: true })
      return
    }
    if (payment === 'success' && sessionId && orderId && verifiedSessionRef.current !== sessionId) {
      verifiedSessionRef.current = sessionId
      setVerifying(true)
      verifyCheckoutSession(sessionId)
        .then(({ success }) => {
          if (success) {
            setPaymentMessage('success')
            loadOrder()
          } else {
            setPaymentMessage('error')
          }
        })
        .finally(() => {
          setVerifying(false)
          setSearchParams({}, { replace: true })
        })
    }
  }, [orderId, searchParams])

  async function handlePay() {
    if (!order || paying) return
    setPaying(true)
    setPaymentMessage(null)
    const { error } = await redirectToCheckout(order.id, Number(order.total_inc_vat))
    if (error) {
      setPaymentMessage('error')
    }
    setPaying(false)
  }

  const canPay =
    order &&
    (order.status === 'placed' || order.status === 'invoiced') &&
    order.payment_status !== 'succeeded' &&
    Number(order.total_inc_vat) >= 0.5

  if (loading) {
    return (
      <div className="account-page">
        <p>Loading order…</p>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="account-page">
        <PageNav backTo="/account" backLabel="My account" />
        <div className="card">
          <p>Order not found.</p>
        </div>
      </div>
    )
  }

  const orderLabel = order.reference || `Order ${order.id.slice(0, 8)}`

  return (
    <div className="account-page order-detail-page">
      <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { label: orderLabel }]} />

      {paymentMessage === 'success' && (
        <div className="order-payment-banner order-payment-banner--success">
          Payment successful. This order is now marked as paid.
        </div>
      )}
      {paymentMessage === 'cancelled' && (
        <div className="order-payment-banner order-payment-banner--info">
          Payment was cancelled. You can try again below when ready.
        </div>
      )}
      {paymentMessage === 'error' && (
        <div className="order-payment-banner order-payment-banner--error">
          Something went wrong. Please try again or contact us.
        </div>
      )}

      {justPlaced && !paymentMessage && (
        <div className="order-payment-banner order-payment-banner--info">
          Order placed. You can pay now below.
        </div>
      )}

      <div className="card order-detail-card">
        <h1>Order {order.reference || order.id.slice(0, 8)}</h1>
        <p className="order-detail-meta">
          <span className={`order-status order-status-${order.status}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          {order.invoice_number && <span>Invoice {order.invoice_number}</span>}
          {order.payment_status === 'succeeded' && (
            <span className="order-payment-badge">Paid</span>
          )}
          <span>Created {new Date(order.created_at).toLocaleDateString()}</span>
        </p>

        <div className="order-detail-totals">
          <p><strong>Total ex VAT</strong> £{Number(order.total_ex_vat).toFixed(2)}</p>
          <p><strong>Total inc VAT</strong> £{Number(order.total_inc_vat).toFixed(2)}</p>
        </div>

        {order.invoice_number && ['invoiced', 'paid'].includes(order.status) && (
          <p className="order-detail-invoice-link">
            <Link to={`/account/orders/${orderId}/invoice`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">
              View / print invoice
            </Link>
          </p>
        )}

        {canPay && (
          <div className="order-detail-pay">
            <button
              type="button"
              className="btn btn-success"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? 'Redirecting to payment…' : 'Pay now'}
            </button>
            <p className="order-detail-pay-hint">You’ll be redirected to our secure payment page.</p>
          </div>
        )}

        {(order.delivery_address || order.delivery_postcode || order.delivery_notes || order.delivery_tracking || order.courier || order.delivery_expected_date) && (
          <div className="order-detail-delivery">
            <h2>Delivery</h2>
            {(order.delivery_address || order.delivery_postcode) && (
              <p className="order-detail-address">
                {[order.delivery_address, order.delivery_postcode].filter(Boolean).join(', ')}
              </p>
            )}
            {order.courier && <p><strong>Courier</strong> {order.courier}</p>}
            {order.delivery_expected_date && (
              <p><strong>Expected delivery</strong> {new Date(order.delivery_expected_date).toLocaleDateString()}</p>
            )}
            {order.delivery_notes && <p><strong>Notes</strong> {order.delivery_notes}</p>}
            {order.delivery_tracking && (
              <p><strong>Tracking</strong>{' '}
                <a href={trackingUrl(order.courier, order.delivery_tracking)} target="_blank" rel="noopener noreferrer">
                  {order.delivery_tracking}
                </a>
              </p>
            )}
          </div>
        )}

        <h2>Order lines</h2>
        <ul className="order-detail-lines">
          {lines.map((l) => (
            <li key={l.id} className="order-detail-line">
              <span className="line-name">{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</span>
              <span className="line-qty">{l.quantity} × £{Number(l.unit_price).toFixed(2)}</span>
              <span className="line-total">£{(l.quantity * Number(l.unit_price)).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        {lines.length === 0 && <p className="muted">No lines on this order.</p>}
      </div>
    </div>
  )
}

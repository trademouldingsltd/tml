import type { OrderRow } from '@/types/database'

interface LineItem {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

interface InvoicePrintViewProps {
  order: OrderRow
  lines: LineItem[]
  companyName: string
  paymentTerms?: string | null
}

const VAT_RATE = 1.2

export default function InvoicePrintView({ order, lines, companyName, paymentTerms }: InvoicePrintViewProps) {
  const totalExVat = lines.reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
  const totalIncVat = totalExVat * VAT_RATE

  return (
    <div className="invoice-print-view">
      <header className="invoice-print-header">
        <h1>Invoice</h1>
        {order.invoice_number && <p className="invoice-print-number">{order.invoice_number}</p>}
        <p className="invoice-print-date">Date: {new Date(order.created_at).toLocaleDateString()}</p>
      </header>

      <div className="invoice-print-meta">
        <div className="invoice-print-block">
          <strong>Bill to</strong>
          <p>{companyName}</p>
          {order.delivery_address && (
            <>
              <strong>Delivery address</strong>
              <p>{[order.delivery_address, order.delivery_postcode].filter(Boolean).join(', ')}</p>
            </>
          )}
        </div>
        <div className="invoice-print-block">
          {order.reference && <p><strong>Order reference</strong> {order.reference}</p>}
          {paymentTerms && <p><strong>Payment terms</strong> {paymentTerms}</p>}
        </div>
      </div>

      <table className="invoice-print-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</td>
              <td>{l.quantity}</td>
              <td>£{Number(l.unit_price).toFixed(2)}</td>
              <td>£{(l.quantity * Number(l.unit_price)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-print-totals">
        <p><strong>Subtotal (ex VAT)</strong> £{totalExVat.toFixed(2)}</p>
        <p><strong>VAT (20%)</strong> £{(totalIncVat - totalExVat).toFixed(2)}</p>
        <p><strong>Total (inc VAT)</strong> £{totalIncVat.toFixed(2)}</p>
      </div>
    </div>
  )
}

# Trade Mouldings Portal – Feature roadmap (competitor-inspired)

Based on B2B order management, kitchen/trade supplier portals, and OMS best practices.

## ✅ Done (current)

- Order lifecycle: draft → quotation → placed → invoiced → paid | cancelled
- Delivery fields: address, postcode, notes, tracking (free text)
- Stripe payment (Pay now on order)
- Admin: create order for customer, edit lines, set status, delivery details
- Kanban orders view, table/grid/cards
- Pricelist import, product images, catalogue import/export
- CRM (customers + notes), locations, stock take
- Customer: dashboard, products, ordering, cart, account, order history, depots

---

## In progress / next

### Order management & workflow
- [x] **Invoice number** – unique ref when order moves to invoiced (migration + auto-set)
- [x] **Order processing queue** – view “Placed” orders needing processing (mark invoiced, set delivery)
- [ ] **Bulk status update** – select multiple orders, set status or assign courier
- [x] **Status transition rules** – “Mark as invoiced” sets processed_at, generates invoice number (trigger)

### Delivery & courier
- [x] **Courier options** – dropdown (DPD, FedEx, Royal Mail, Yodel, Other) on order
- [x] **Delivery expected date** – optional date on order; show to customer
- [x] **Tracking link helper** – paste tracking number, auto-build carrier link (DPD/FedEx etc.)
- [ ] **Multiple shipments** – optional: multiple tracking numbers per order (shipments table)

### Billing & invoicing
- [x] **Payment terms** – on customer (e.g. Net 7, Net 30); show on order & account
- [x] **Invoice PDF** – print invoice view (customer + admin); browser Print
- [ ] **Statement / balance** – already have balance_outstanding on profile; statement view (invoices + payments)
- [ ] **Credit memo / returns** – optional RMA or credit note flow

### Notifications & workflow
- [ ] **Email on status change** – e.g. “Your order is placed”, “Your order has been despatched”
- [ ] **Packing slip PDF** – optional download for warehouse
- [ ] **Order approval workflow** – optional: quotation requires approval before placed

### Customer & account
- [ ] **Multiple delivery addresses** – save addresses per customer; choose at checkout
- [x] **Payment terms display** – show on order (admin), account overview (customer)
- [x] **Download invoice** – customer can view/print invoice for paid/invoiced orders

### Integrations (later)
- [ ] **Accounting export** – CSV/QuickBooks for orders and invoices
- [ ] **Carrier API** – book shipment or get tracking from DPD/FedEx (if needed)

---

## Build order (logical)

1. **DB & types** – invoice_number, courier, delivery_expected_date, payment_terms
2. **Admin order detail** – courier dropdown, expected date, invoice # display/generation
3. **Order processing queue** – dedicated view for “placed” orders
4. **Tracking link helper** – UI to build carrier tracking URL from number
5. **Customer order view** – show expected delivery, courier, better tracking link
6. **Payment terms** – on customer profile, display on order
7. **Invoice PDF** – simple PDF or “Print invoice” (browser print)
8. **Email notifications** – optional Supabase Edge or external

---

*Last updated: from competitor research and current codebase.*

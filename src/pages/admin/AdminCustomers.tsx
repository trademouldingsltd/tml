import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import type { CustomerProfileRow } from '@/types/database'

export default function AdminCustomers() {
  const { tableDensity, rowsPerPage } = useAdminUi()
  const [customers, setCustomers] = useState<(CustomerProfileRow & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('*')
        .order('company_name')
        .limit(rowsPerPage)
      setCustomers(profiles ?? [])
      setLoading(false)
    }
    load()
  }, [rowsPerPage])

  return (
    <div className="admin-page">
      <p className="page-intro">Customer accounts. Open orders filtered by customer or create an order for them.</p>

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading customers…</p>
        </div>
      ) : (
        <div className="card admin-card">
          <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Balance outstanding</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-table-empty">
                      No customer profiles yet. Customers appear when they have a profile (e.g. created by staff or on first order). <Link to="/admin/create-order">Create order</Link> will list customers once profiles exist.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/admin/customers/${c.user_id}`} className="admin-table-link">{c.company_name}</Link></td>
                      <td>{c.contact_name ?? '—'}</td>
                      <td>£{Number(c.balance_outstanding).toFixed(2)}</td>
                      <td className="admin-table-actions">
                        <Link to={`/admin/customers/${c.user_id}`}>View</Link>
                        <Link to={`/admin/orders?customer=${c.user_id}`}>Orders</Link>
                        <Link to={`/admin/create-order?customer=${c.user_id}`}>Create order</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

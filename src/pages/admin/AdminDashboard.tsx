import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    ordersCount: 0,
    ordersPlaced: 0,
    customersCount: 0,
    productsCount: 0,
    assembliesCount: 0,
    recentOrders: [] as { id: string; reference: string | null; created_at: string; status: string }[],
  })

  useEffect(() => {
    async function load() {
      const [ordersRes, placedRes, customersRes, productsRes, assembliesRes, recentRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).neq('status', 'cancelled'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'placed'),
        supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('assemblies').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('orders').select('id, reference, created_at, status').order('created_at', { ascending: false }).limit(8),
      ])
      setStats({
        ordersCount: ordersRes.count ?? 0,
        ordersPlaced: placedRes.count ?? 0,
        customersCount: customersRes.count ?? 0,
        productsCount: productsRes.count ?? 0,
        assembliesCount: assembliesRes.count ?? 0,
        recentOrders: (recentRes.data ?? []) as typeof stats.recentOrders,
      })
    }
    load()
  }, [])

  return (
    <div className="admin-page">
      <p className="page-intro">Overview of orders and customers. Use the sidebar to manage orders, customers, and create orders on behalf of customers.</p>

      <div className="admin-stats">
        <Link to="/admin/orders" className="card admin-stat-card admin-stat-card--link">
          <span className="admin-stat-value">{stats.ordersCount}</span>
          <span className="admin-stat-label">Total orders (excl. cancelled)</span>
          <span className="admin-stat-card-hint">View orders →</span>
        </Link>
        <Link to="/admin/orders/processing" className="card admin-stat-card admin-stat-card--link">
          <span className="admin-stat-value">{stats.ordersPlaced}</span>
          <span className="admin-stat-label">Placed (pending process)</span>
          <span className="admin-stat-card-hint">Order processing →</span>
        </Link>
        <Link to="/admin/customers" className="card admin-stat-card admin-stat-card--link">
          <span className="admin-stat-value">{stats.customersCount}</span>
          <span className="admin-stat-label">Customers</span>
          <span className="admin-stat-card-hint">View customers →</span>
        </Link>
        <Link to="/admin/catalogue" className="card admin-stat-card admin-stat-card--link">
          <span className="admin-stat-value">{stats.productsCount}</span>
          <span className="admin-stat-label">Products</span>
          <span className="admin-stat-card-hint">Catalogue →</span>
        </Link>
        <Link to="/admin/create-order" className="card admin-stat-card admin-stat-card--link">
          <span className="admin-stat-value">{stats.assembliesCount}</span>
          <span className="admin-stat-label">Assemblies</span>
          <span className="admin-stat-card-hint">Create order →</span>
        </Link>
      </div>

      <div className="admin-dashboard-grid">
        <div className="card admin-card">
          <h2>Quick actions</h2>
          <ul className="admin-quick-links">
            <li><Link to="/admin/orders">View all orders</Link></li>
            <li><Link to="/admin/orders/processing">Order processing (placed / invoiced)</Link></li>
            <li><Link to="/admin/customers">View customers</Link></li>
            <li><Link to="/admin/create-order">Create order for customer</Link></li>
            <li><Link to="/admin/catalogue">Catalogue &amp; products</Link></li>
            <li><Link to="/admin/stock">Stock take</Link></li>
            <li><Link to="/admin/locations">Locations</Link></li>
            <li><Link to="/admin/uploads">Brochure &amp; Pricelist</Link></li>
            <li><Link to="/admin/crm">CRM</Link></li>
            <li><Link to="/admin/users/create">Create user</Link></li>
            <li><Link to="/admin/settings">Settings</Link></li>
          </ul>
        </div>
        {stats.recentOrders.length > 0 ? (
          <div className="card admin-card">
            <h2>Recent orders</h2>
            <ul className="admin-recent-orders">
              {stats.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`}>
                    {o.reference || `#${o.id.slice(0, 8)}`}
                  </Link>
                  <span className="admin-recent-meta">
                    {new Date(o.created_at).toLocaleDateString()} · {o.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card admin-card admin-card--empty">
            <h2>Recent orders</h2>
            <p className="admin-empty-message">No orders yet. <Link to="/admin/create-order">Create an order</Link> for a customer.</p>
          </div>
        )}
      </div>
    </div>
  )
}

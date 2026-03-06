import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/hooks/useStaff'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { useAdminUi } from '@/contexts/AdminUiContext'

interface CustomerOption {
  user_id: string
  label: string
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { staffProfile } = useStaff()
  const { setImpersonating } = useImpersonation()
  const { sidebarCollapsed, setSidebarCollapsed } = useAdminUi()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [viewAsOpen, setViewAsOpen] = useState(false)

  useEffect(() => {
    supabase
      .from('customer_profiles')
      .select('user_id, company_name, contact_name')
      .order('company_name')
      .then(({ data }) => {
        setCustomers((data ?? []).map((c) => ({
          user_id: c.user_id,
          label: [c.contact_name, c.company_name].filter(Boolean).join(' · ') || c.user_id.slice(0, 8),
        })))
      })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setImpersonating(null)
    navigate('/admin/login')
  }

  function handleViewAsCustomer(userId: string) {
    if (!userId) return
    setImpersonating(userId)
    setViewAsOpen(false)
    navigate('/')
  }

  const { pageTitle, breadcrumb } = (() => {
    if (location.pathname === '/admin') return { pageTitle: 'Admin Dashboard', breadcrumb: [] }
    if (location.pathname === '/admin/orders') return { pageTitle: 'Orders', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'Orders' }] }
    if (location.pathname === '/admin/orders/processing') return { pageTitle: 'Order processing', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order processing' }] }
    if (location.pathname.match(/^\/admin\/orders\/[^/]+\/invoice$/)) return { pageTitle: 'Print invoice', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Invoice' }] }
    if (location.pathname.startsWith('/admin/orders/')) return { pageTitle: 'Order detail', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order' }] }
    if (location.pathname === '/admin/customers') return { pageTitle: 'Customers', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'Customers' }] }
    if (location.pathname.startsWith('/admin/customers/')) return { pageTitle: 'Customer detail', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/customers', label: 'Customers' }, { label: 'Customer' }] }
    if (location.pathname === '/admin/crm') return { pageTitle: 'CRM', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'CRM' }] }
    if (location.pathname === '/admin/create-order') return { pageTitle: 'Create order', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Create order' }] }
    if (location.pathname === '/admin/catalogue') return { pageTitle: 'Catalogue', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'Catalogue' }] }
    if (location.pathname === '/admin/stock') return { pageTitle: 'Stock take', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/catalogue', label: 'Catalogue' }, { label: 'Stock take' }] }
    if (location.pathname === '/admin/locations') return { pageTitle: 'Locations', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { to: '/admin/stock', label: 'Stock take' }, { label: 'Locations' }] }
    if (location.pathname === '/admin/uploads') return { pageTitle: 'Brochure & Pricelist', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'Brochure & Pricelist' }] }
    if (location.pathname === '/admin/users/create') return { pageTitle: 'Create user', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'Create user' }] }
    if (location.pathname === '/admin/settings') return { pageTitle: 'Settings', breadcrumb: [{ to: '/admin', label: 'Admin Dashboard' }, { label: 'Settings' }] }
    return { pageTitle: 'Admin', breadcrumb: [] }
  })()

  return (
    <div className={`admin-app ${sidebarCollapsed ? 'admin-app--sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <Link to="/admin" className="admin-sidebar-logo">
            <span className="admin-sidebar-logo-text">TM</span>
            {!sidebarCollapsed && <span className="admin-sidebar-badge">Staff</span>}
          </Link>
          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="admin-sidebar-nav">
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Overview</span>}
            <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">◇</span>
              {!sidebarCollapsed && <span>Admin Dashboard</span>}
            </NavLink>
          </div>
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Orders</span>}
            <NavLink to="/admin/orders" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">☰</span>
              {!sidebarCollapsed && <span>Orders</span>}
            </NavLink>
            <NavLink to="/admin/orders/processing" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">⚡</span>
              {!sidebarCollapsed && <span>Order processing</span>}
            </NavLink>
            <NavLink to="/admin/create-order" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">+</span>
              {!sidebarCollapsed && <span>Create order</span>}
            </NavLink>
          </div>
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Customers & CRM</span>}
            <NavLink to="/admin/customers" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">◉</span>
              {!sidebarCollapsed && <span>Customers</span>}
            </NavLink>
            <NavLink to="/admin/crm" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">📝</span>
              {!sidebarCollapsed && <span>CRM</span>}
            </NavLink>
          </div>
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Catalogue</span>}
            <NavLink to="/admin/catalogue" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">📋</span>
              {!sidebarCollapsed && <span>Catalogue</span>}
            </NavLink>
            <NavLink to="/admin/stock" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">📦</span>
              {!sidebarCollapsed && <span>Stock take</span>}
            </NavLink>
            <NavLink to="/admin/locations" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">📍</span>
              {!sidebarCollapsed && <span>Locations</span>}
            </NavLink>
            <NavLink to="/admin/uploads" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">📄</span>
              {!sidebarCollapsed && <span>Brochure & Pricelist</span>}
            </NavLink>
          </div>
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Users</span>}
            <NavLink to="/admin/users/create" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">+</span>
              {!sidebarCollapsed && <span>Create user</span>}
            </NavLink>
          </div>
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Tools</span>}
            <a href="/" className="admin-nav-item" target="_blank" rel="noopener noreferrer">
              <span className="admin-nav-icon">↗</span>
              {!sidebarCollapsed && <span>Customer portal</span>}
            </a>
          </div>
          <div className="admin-nav-group admin-nav-group--bottom">
            <NavLink to="/admin/settings" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">⚙</span>
              {!sidebarCollapsed && <span>Settings</span>}
            </NavLink>
          </div>
        </nav>
      </aside>

      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <span className="admin-topbar-badge" aria-label="Admin area">Admin</span>
          <div className="admin-topbar-heading">
            {breadcrumb.length > 0 && (
              <nav className="admin-breadcrumb" aria-label="Breadcrumb">
                <ol className="admin-breadcrumb-list">
                  {breadcrumb.map((item, i) => (
                    <li key={i} className="admin-breadcrumb-item">
                      {i > 0 && <span className="admin-breadcrumb-sep">/</span>}
                      {item.to ? (
                        <Link to={item.to} className="admin-breadcrumb-link">{item.label}</Link>
                      ) : (
                        <span className="admin-breadcrumb-current">{item.label}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <h1 className="admin-topbar-title">{pageTitle}</h1>
          </div>
          <div className="admin-topbar-actions">
            <div className={`admin-dropdown ${viewAsOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="admin-topbar-btn"
                onClick={() => { setViewAsOpen(!viewAsOpen); setUserMenuOpen(false); }}
              >
                View as customer
              </button>
              <div className="admin-dropdown-menu">
                {customers.length === 0 ? (
                  <div className="admin-dropdown-item admin-dropdown-item--muted">No customers</div>
                ) : (
                  customers.slice(0, 15).map((c) => (
                    <button
                      key={c.user_id}
                      type="button"
                      className="admin-dropdown-item"
                      onClick={() => handleViewAsCustomer(c.user_id)}
                    >
                      {c.label}
                    </button>
                  ))
                )}
                {customers.length > 15 && (
                  <div className="admin-dropdown-item admin-dropdown-item--muted">+ {customers.length - 15} more</div>
                )}
              </div>
            </div>
            <div className={`admin-dropdown ${userMenuOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="admin-topbar-btn admin-topbar-user"
                onClick={() => { setUserMenuOpen(!userMenuOpen); setViewAsOpen(false); }}
              >
                {staffProfile?.display_name || staffProfile?.role || 'Staff'} ▾
              </button>
              <div className="admin-dropdown-menu admin-dropdown-menu--right">
                <Link to="/admin/settings" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Settings
                </Link>
                <a href="/" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Customer portal
                </a>
                <button type="button" className="admin-dropdown-item" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>

      {/* Click outside to close dropdowns */}
      {(userMenuOpen || viewAsOpen) && (
        <div
          className="admin-dropdown-backdrop"
          aria-hidden
          onClick={() => { setUserMenuOpen(false); setViewAsOpen(false); }}
        />
      )}
    </div>
  )
}

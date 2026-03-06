import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { useCustomerUi } from '@/contexts/CustomerUiContext'

export default function Layout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isStaff } = useStaff()
  const { useSidebarMenu } = useCustomerUi()
  const { impersonatingUserId, setImpersonating } = useImpersonation()
  const [impersonationName, setImpersonationName] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!impersonatingUserId) {
      setImpersonationName(null)
      return
    }
    supabase
      .from('customer_profiles')
      .select('company_name, contact_name')
      .eq('user_id', impersonatingUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setImpersonationName(data.contact_name || data.company_name || 'Customer')
        else setImpersonationName('Customer')
      })
  }, [impersonatingUserId])

  useEffect(() => {
    if (!user?.id) {
      setProfileName(null)
      return
    }
    supabase
      .from('customer_profiles')
      .select('contact_name, company_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfileName(data.contact_name || data.company_name || null)
        else setProfileName(null)
      })
  }, [user?.id])

  async function handleLogout() {
    await supabase.auth.signOut()
    setImpersonating(null)
    navigate('/login')
  }

  const sharedBanner = impersonatingUserId && (
    <div className="impersonation-banner">
      <span>Viewing as {impersonationName ?? '…'}</span>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => { setImpersonating(null); navigate('/admin'); }}
      >
        Exit view
      </button>
    </div>
  )

  if (useSidebarMenu) {
    return (
      <div className="layout customer-layout customer-layout--sidebar">
        {sharedBanner}
        <aside className="customer-sidebar">
          <Link to="/" className="customer-sidebar-logo">
            <span className="customer-sidebar-logo-text">TRADE MOULDINGS</span>
          </Link>
          <nav className="customer-sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/products" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              Products
            </NavLink>
            <NavLink to="/ordering" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              Create order
            </NavLink>
            <NavLink to="/ordering/cart" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              Cart
            </NavLink>
            <NavLink to="/downloads" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              Downloads
            </NavLink>
            <NavLink to="/depots" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              Depots
            </NavLink>
            <NavLink to="/account" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
              My account
            </NavLink>
            {isStaff && (
              <Link to="/admin" className="customer-sidebar-item customer-sidebar-item--staff">
                Staff backend
              </Link>
            )}
          </nav>
          <div className="customer-sidebar-footer">
            <div className="customer-sidebar-user">
              <span className="customer-sidebar-user-name" title={user?.email ?? ''}>
                {profileName || user?.email || 'Account'}
              </span>
              <Link to="/account" className="customer-sidebar-user-profile">My profile</Link>
            </div>
            <button type="button" className="btn btn-outline btn-small btn-block" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>
        <div className="customer-main-wrap">
          <main className="main customer-main">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  const userDisplayName = profileName || user?.email || 'Account'

  const navLinks = (
    <>
      <Link to="/" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
      <Link to="/products" onClick={() => setMobileMenuOpen(false)}>Products</Link>
      <Link to="/ordering" onClick={() => setMobileMenuOpen(false)}>Create Order</Link>
      <Link to="/downloads" onClick={() => setMobileMenuOpen(false)}>Downloads</Link>
      <Link to="/depots" onClick={() => setMobileMenuOpen(false)}>Depots</Link>
      <Link to="/account" onClick={() => setMobileMenuOpen(false)}>My Account</Link>
      {isStaff && (
        <Link to="/admin" className="nav-staff-link" onClick={() => setMobileMenuOpen(false)}>Staff backend</Link>
      )}
      <div className={`header-user-dropdown ${userMenuOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="header-user-btn"
          onClick={() => { setUserMenuOpen((o) => !o); setMobileMenuOpen(false); }}
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          {userDisplayName} ▾
        </button>
        <div className="header-user-menu" role="menu">
          <Link to="/account" className="header-user-menu-item" role="menuitem" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); }}>
            My profile
          </Link>
          <button type="button" className="header-user-menu-item" role="menuitem" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); handleLogout(); }}>
            Logout
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="layout">
      {sharedBanner}
      <header className="header">
        <Link to="/" className="header-logo" onClick={() => setMobileMenuOpen(false)}>
          <span className="header-logo-text">TRADE MOULDINGS</span>
        </Link>
        <button
          type="button"
          className="header-mobile-toggle"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        <nav className={`header-nav ${mobileMenuOpen ? 'header-nav--open' : ''}`}>
          {navLinks}
        </nav>
      </header>
      {mobileMenuOpen && (
        <div className="header-mobile-backdrop" aria-hidden onClick={() => setMobileMenuOpen(false)} />
      )}
      {userMenuOpen && (
        <div className="header-user-backdrop" aria-hidden onClick={() => setUserMenuOpen(false)} />
      )}
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

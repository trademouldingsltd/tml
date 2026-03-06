import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import Layout from '@/components/Layout'
import AdminLayout from '@/components/AdminLayout'
import MtoLayout from '@/components/MtoLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Downloads from '@/pages/Downloads'
import Ordering from '@/pages/Ordering'
import OrderCart from '@/pages/OrderCart'
import Account from '@/pages/Account'
import OrderDetail from '@/pages/OrderDetail'
import InvoicePrint from '@/pages/InvoicePrint'
import Products from '@/pages/Products'
import MtoIndex from '@/pages/mto/MtoIndex'
import MtoNonStandard from '@/pages/mto/MtoNonStandard'
import MtoAngled from '@/pages/mto/MtoAngled'
import MtoFramed from '@/pages/mto/MtoFramed'
import MtoWorktopsPanels from '@/pages/mto/MtoWorktopsPanels'
import MtoMouldingsAccessories from '@/pages/mto/MtoMouldingsAccessories'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminCustomers from '@/pages/admin/AdminCustomers'
import AdminOrders from '@/pages/admin/AdminOrders'
import AdminOrderDetail from '@/pages/admin/AdminOrderDetail'
import AdminOrderProcessing from '@/pages/admin/AdminOrderProcessing'
import AdminInvoicePrint from '@/pages/admin/AdminInvoicePrint'
import AdminCreateOrder from '@/pages/admin/AdminCreateOrder'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminSettings from '@/pages/admin/AdminSettings'
import AdminCustomerDetail from '@/pages/admin/AdminCustomerDetail'
import AdminCrm from '@/pages/admin/AdminCrm'
import AdminCatalogue from '@/pages/admin/AdminCatalogue'
import AdminDocumentUploads from '@/pages/admin/AdminDocumentUploads'
import AdminCreateUser from '@/pages/admin/AdminCreateUser'
import AdminStock from '@/pages/admin/AdminStock'
import AdminLocations from '@/pages/admin/AdminLocations'
import Depots from '@/pages/Depots'
import NotFound from '@/pages/NotFound'
import { AdminUiProvider } from '@/contexts/AdminUiContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaff()
  if (loading || staffLoading) return <div className="app-loading">Loading…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isStaff) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="downloads" element={<Downloads />} />
        <Route path="depots" element={<Depots />} />
        <Route path="ordering" element={<Ordering />} />
        <Route path="ordering/cart" element={<OrderCart />} />
        <Route path="ordering/mto" element={<MtoLayout />}>
          <Route index element={<MtoIndex />} />
          <Route path="non-standard" element={<MtoNonStandard />} />
          <Route path="angled" element={<MtoAngled />} />
          <Route path="framed" element={<MtoFramed />} />
          <Route path="worktops-panels" element={<MtoWorktopsPanels />} />
          <Route path="mouldings-accessories" element={<MtoMouldingsAccessories />} />
        </Route>
        <Route path="account" element={<Account />} />
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="account/orders/:orderId" element={<OrderDetail />} />
        <Route path="account/orders/:orderId/invoice" element={<InvoicePrint />} />
      </Route>
      <Route
        path="/admin"
        element={
          <StaffRoute>
            <AdminUiProvider>
              <AdminLayout />
            </AdminUiProvider>
          </StaffRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="customers/:userId" element={<AdminCustomerDetail />} />
        <Route path="crm" element={<AdminCrm />} />
        <Route path="catalogue" element={<AdminCatalogue />} />
        <Route path="stock" element={<AdminStock />} />
        <Route path="locations" element={<AdminLocations />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/processing" element={<AdminOrderProcessing />} />
        <Route path="orders/:orderId/invoice" element={<AdminInvoicePrint />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="create-order" element={<AdminCreateOrder />} />
        <Route path="uploads" element={<AdminDocumentUploads />} />
        <Route path="users/create" element={<AdminCreateUser />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

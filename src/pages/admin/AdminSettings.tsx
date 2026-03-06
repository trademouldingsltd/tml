import { useAdminUi, type TableDensity, type DateFormat } from '@/contexts/AdminUiContext'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'

export default function AdminSettings() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    tableDensity,
    setTableDensity,
    dateFormat,
    setDateFormat,
    rowsPerPage,
    setRowsPerPage,
    defaultOrderStatusFilter,
    setDefaultOrderStatusFilter,
  } = useAdminUi()
  const { theme, setTheme } = useTheme()

  return (
    <div className="admin-page admin-settings-page">
      <div className="admin-page-header">
        <h1>Settings</h1>
        <p className="page-intro">Customise the admin interface. Theme is saved to your account.</p>
      </div>

      <div className="admin-settings-grid">
        <section className="card admin-settings-card">
          <h2>Appearance</h2>
          <div className="admin-settings-list">
            <div className="admin-settings-row">
              <span className="admin-settings-label">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeId)}
                className="admin-settings-select"
              >
                <option value="classic">Classic (gold &amp; black)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <p className="admin-settings-hint">Colour theme for the portal and admin. Saved per account.</p>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Sidebar collapsed by default</span>
              <input
                type="checkbox"
                checked={sidebarCollapsed}
                onChange={(e) => setSidebarCollapsed(e.target.checked)}
              />
            </label>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Table density</span>
              <select
                value={tableDensity}
                onChange={(e) => setTableDensity(e.target.value as TableDensity)}
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>
            <p className="admin-settings-hint">Affects tables on Orders and Customers. Compact shows more rows; spacious is easier to scan.</p>
          </div>
        </section>

        <section className="card admin-settings-card">
          <h2>Dates &amp; format</h2>
          <div className="admin-settings-list">
            <label className="admin-settings-row">
              <span className="admin-settings-label">Date format</span>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
              >
                <option value="locale">Locale (e.g. 3 Mar 2025)</option>
                <option value="ddmmyyyy">DD/MM/YYYY</option>
                <option value="iso">ISO (YYYY-MM-DD)</option>
              </select>
            </label>
          </div>
        </section>

        <section className="card admin-settings-card">
          <h2>Advanced</h2>
          <div className="admin-settings-list">
            <label className="admin-settings-row">
              <span className="admin-settings-label">Rows per page (tables)</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Default order status filter</span>
              <select
                value={defaultOrderStatusFilter}
                onChange={(e) => setDefaultOrderStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="quotation">Quotation</option>
                <option value="placed">Placed</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <p className="admin-settings-hint">When you open the Orders page, this status will be pre-selected.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

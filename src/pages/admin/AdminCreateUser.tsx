import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const USER_TYPES = [
  { value: 'customer', label: 'Customer', description: 'Portal login, orders, account' },
  { value: 'staff', label: 'Staff', description: 'Staff backend access' },
  { value: 'admin', label: 'Admin', description: 'Full admin + user creation' },
  { value: 'supplier', label: 'Supplier', description: 'Supplier contact (optional login)' },
] as const

type UserType = (typeof USER_TYPES)[number]['value']

export default function AdminCreateUser() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState<UserType>('customer')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!email.trim() || !password.trim()) {
      setMessage({ type: 'err', text: 'Email and password required.' })
      return
    }
    if (password.length < 6) {
      setMessage({ type: 'err', text: 'Password must be at least 6 characters.' })
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMessage({ type: 'err', text: 'Not signed in.' })
        setSubmitting(false)
        return
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          type,
          company_name: (type === 'customer' || type === 'supplier') ? companyName.trim() || undefined : undefined,
          contact_name: (type === 'customer' || type === 'supplier') ? contactName.trim() || undefined : undefined,
          display_name: (type === 'staff' || type === 'admin') ? displayName.trim() || undefined : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || `Error ${res.status}` })
        setSubmitting(false)
        return
      }
      setMessage({ type: 'ok', text: `${type} created: ${data.email}. They can sign in now.` })
      setEmail('')
      setPassword('')
      setCompanyName('')
      setContactName('')
      setDisplayName('')
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Request failed' })
    }
    setSubmitting(false)
  }

  return (
    <div className="admin-page admin-create-user-page">
      <p className="page-intro">
        Create new users: customers (portal access), staff, admins, or suppliers. They sign in with the email and password you set. For manual customer creation, choose Customer and enter company and contact name.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}
      <div className="card admin-card admin-create-user-card">
        <h2 className="admin-create-user-title">Create user</h2>
        <form onSubmit={handleSubmit} className="admin-modal-form admin-create-user-form">
          <div className="admin-modal-form-section">
            <h3 className="admin-modal-form-section-title">Sign-in details</h3>
            <label>
              Email <span className="admin-required">*</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                autoComplete="off"
              />
            </label>
            <label>
              Password <span className="admin-required">*</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="admin-modal-form-section">
            <h3 className="admin-modal-form-section-title">User type</h3>
            <label>
              Role
              <select value={type} onChange={(e) => setType(e.target.value as UserType)} className="admin-create-user-select">
                {USER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(type === 'customer' || type === 'supplier') && (
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Profile (optional)</h3>
              <label>
                Company name
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={type === 'customer' ? 'Customer company' : 'Supplier company'}
                />
              </label>
              <label>
                Contact name
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact person"
                />
              </label>
            </div>
          )}
          {(type === 'staff' || type === 'admin') && (
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Profile (optional)</h3>
              <label>
                Display name
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Name shown in admin"
                />
              </label>
            </div>
          )}
          <div className="admin-modal-actions">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
        <p className="admin-create-user-note">
          Requires the Edge Function <code>admin-create-user</code> to be deployed and <code>SUPABASE_SERVICE_ROLE_KEY</code> set in Function secrets.
        </p>
      </div>
    </div>
  )
}

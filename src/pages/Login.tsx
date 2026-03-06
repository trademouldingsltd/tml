import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (!hash || hash.charAt(0) !== '#') return params
  hash
    .slice(1)
    .split('&')
    .forEach((part) => {
      const [key, value] = part.split('=')
      if (key && value) params[key] = decodeURIComponent(value.replace(/\+/g, ' '))
    })
  return params
}

export default function Login() {
  const { user, loading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaff()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const params = parseHashParams(window.location.hash)
    if (params.error === 'access_denied' && params.error_code === 'otp_expired') {
      setError('That sign-in link has expired. Please sign in with your email and password below, or request a new link.')
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    } else if (params.error && params.error_description) {
      setError(params.error_description)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  if (loading || staffLoading) return <div className="app-loading">Loading…</div>
  if (user) return <Navigate to={isStaff ? '/admin' : '/'} replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (err) {
      setError(err.message ?? 'Login failed')
      return
    }
    // Redirect staff to admin, customers to dashboard
    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()
    navigate(profile ? '/admin' : '/', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <span className="login-logo">TRADE MOULDINGS</span>
          <p className="login-tagline">Online Ordering System</p>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to create estimates, view brochures, and place orders.</p>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <label>
            Email address <span className="required">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
          <label>
            Password <span className="required">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-footer">
          Need access? <a href="mailto:support@trademouldings.com">Contact Trade Mouldings</a>.
        </p>
        <div className="login-staff-section">
          <p className="login-staff-title">Staff or admin?</p>
          <p className="login-staff-text">
            <Link to="/admin/login">Sign in to the staff area</Link> for the admin dashboard, orders, and customers.
          </p>
        </div>
      </div>
    </div>
  )
}

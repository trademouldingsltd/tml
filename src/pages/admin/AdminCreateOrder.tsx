import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/hooks/useStaff'
import type { CustomerProfileRow } from '@/types/database'

export default function AdminCreateOrder() {
  const [searchParams] = useSearchParams()
  const preselectedCustomer = searchParams.get('customer') ?? ''
  const navigate = useNavigate()
  const { staffProfile } = useStaff()
  const [customers, setCustomers] = useState<(CustomerProfileRow & { email?: string })[]>([])
  const [selectedUserId, setSelectedUserId] = useState(preselectedCustomer)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase.from('customer_profiles').select('*').order('company_name')
      setCustomers(profiles ?? [])
      if (preselectedCustomer) setSelectedUserId(preselectedCustomer)
    }
    load()
  }, [preselectedCustomer])

  async function createOrder() {
    if (!selectedUserId || !staffProfile) {
      setError('Select a customer and ensure you are logged in as staff.')
      return
    }
    setError('')
    setCreating(true)
    const { data: order, error: err } = await supabase
      .from('orders')
      .insert({
        user_id: selectedUserId,
        status: 'draft',
        total_ex_vat: 0,
        total_inc_vat: 0,
        created_by_staff_id: staffProfile.id,
      })
      .select('id')
      .single()
    setCreating(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate(`/admin/orders/${order.id}`)
  }

  return (
    <div className="admin-page">
      <p className="page-intro">Select the customer that will own this order. The order will appear in their portal; you can then add lines and set delivery details.</p>

      <div className="card admin-card admin-create-order-card">
        <h2>Customer</h2>
        <label className="admin-create-order-label">
          <span className="admin-settings-label">Select customer</span>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="admin-select-customer"
          >
            <option value="">— Select customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.user_id}>
                {c.company_name} {c.contact_name ? `(${c.contact_name})` : ''}
              </option>
            ))}
          </select>
        </label>
        {customers.length === 0 && (
          <p className="admin-muted">No customer profiles found. Create profiles in the Customers section or ensure customers have signed up and have a profile.</p>
        )}
        {error && <p className="admin-error">{error}</p>}
        <button
          type="button"
          className="btn"
          onClick={createOrder}
          disabled={!selectedUserId || creating}
        >
          {creating ? 'Creating…' : 'Create draft order'}
        </button>
        <p className="admin-muted" style={{ marginTop: '1rem' }}>After creating, you’ll be taken to the order to add lines, set delivery details, and process it.</p>
      </div>
    </div>
  )
}

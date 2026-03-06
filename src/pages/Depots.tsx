import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LocationRow } from '@/types/database'

export default function Depots() {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        setLocations(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="depots-page page">
      <div className="depots-header">
        <h1 className="depots-title">Our depots</h1>
        <p className="depots-intro">
          Trade Mouldings operates distribution centres and trade counters across the UK and Ireland. Each depot has a showroom and trade counter for collection and support.
        </p>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : locations.length === 0 ? (
        <div className="card">
          <p className="muted">Depot information will appear here. Contact Trade Mouldings for details.</p>
        </div>
      ) : (
        <div className="depots-grid">
          {locations.map((loc) => (
            <div key={loc.id} className="card depots-card">
              <h2 className="depots-card-name">{loc.name}</h2>
              {loc.code && <span className="depots-card-code">{loc.code}</span>}
              {loc.address && (
                <p className="depots-card-address">
                  <strong>Address</strong><br />
                  {loc.address}
                </p>
              )}
              {loc.phone && (
                <p className="depots-card-phone">
                  <strong>Phone</strong>{' '}
                  <a href={`tel:${loc.phone.replace(/\s/g, '')}`}>{loc.phone}</a>
                </p>
              )}
              {loc.opening_hours && (
                <p className="depots-card-hours">
                  <strong>Opening hours</strong><br />
                  {loc.opening_hours}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="depots-footer card">
        <p className="muted">
          For online ordering, quotes, price lists, and brochures, use this portal. Need access? Contact Trade Mouldings at{' '}
          <a href="mailto:sales@trademouldings.com">sales@trademouldings.com</a>.
        </p>
      </div>
    </div>
  )
}

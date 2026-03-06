import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import type { ProductRow } from '@/types/database'
import type { CategoryRow } from '@/types/database'
import type { LocationRow } from '@/types/database'
import type { ProductStockRow } from '@/types/database'

type StockSort = 'name_asc' | 'name_desc' | 'sku_asc' | 'qty_asc' | 'qty_desc'
type StockLevelFilter = 'all' | 'zero' | 'low'
type StockLayout = 'sections' | 'flat'
type StockViewType = 'table' | 'grid' | 'list'

function parseQty(s: string): number {
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function AdminStock() {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map()) // product_id -> quantity
  const [edits, setEdits] = useState<Map<string, string>>(new Map()) // product_id -> input value
  const [checked, setChecked] = useState<Set<string>>(new Set()) // product_id checked
  const [loading, setLoading] = useState(true)
  const [sectionSaving, setSectionSaving] = useState<string | null>(null) // category_id saving
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set()) // category_id collapsed
  const [bulkValue, setBulkValue] = useState('')
  const [selectedInSection, setSelectedInSection] = useState<Map<string, Set<string>>>(new Map()) // category_id -> Set of product_id
  const [searchFilter, setSearchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [stockLevelFilter, setStockLevelFilter] = useState<StockLevelFilter>('all')
  const [sortBy, setSortBy] = useState<StockSort>('name_asc')
  const [layoutMode, setLayoutMode] = useState<StockLayout>('sections')
  const [viewType, setViewType] = useState<StockViewType>('table')
  const { tableDensity, setTableDensity } = useAdminUi()

  const loadLocations = useCallback(async () => {
    const { data } = await supabase.from('locations').select('*').order('sort_order').order('name')
    setLocations(data ?? [])
  }, [])

  const loadData = useCallback(async (locId: string) => {
    if (!locId) return
    setLoading(true)
    const [prodRes, catRes, stockRes] = await Promise.all([
      supabase.from('products').select('*').order('sort_order').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      supabase.from('product_stock').select('product_id, quantity').eq('location_id', locId),
    ])
    setProducts(prodRes.data ?? [])
    setCategories(catRes.data ?? [])
    const map = new Map<string, number>()
    ;(stockRes.data ?? []).forEach((r: { product_id: string; quantity: number }) => map.set(r.product_id, r.quantity))
    setStockMap(map)
    setEdits(new Map())
    setChecked(new Set())
    setSelectedInSection(new Map())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  useEffect(() => {
    if (locationId) loadData(locationId)
    else setLoading(false)
  }, [locationId, loadData])

  // Realtime: subscribe to product_stock for this location
  useEffect(() => {
    if (!locationId) return
    const channel = supabase
      .channel(`product_stock:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_stock',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as ProductStockRow
            setStockMap((prev) => new Map(prev).set(row.product_id, row.quantity))
          }
          if (payload.eventType === 'DELETE') {
            const row = payload.old as ProductStockRow
            setStockMap((prev) => {
              const next = new Map(prev)
              next.delete(row.product_id)
              return next
            })
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationId])

  const getQty = (productId: string): number => stockMap.get(productId) ?? 0
  const getEdit = (productId: string): string | null => edits.get(productId) ?? null
  const setEdit = (productId: string, value: string) => {
    setEdits((prev) => {
      const next = new Map(prev)
      if (value === '' || value === String(getQty(productId))) next.delete(productId)
      else next.set(productId, value)
      return next
    })
  }

  const toggleChecked = (productId: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleSectionCollapsed = (categoryId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const toggleSelectedInSection = (categoryId: string, productId: string) => {
    setSelectedInSection((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(categoryId) ?? [])
      if (set.has(productId)) set.delete(productId)
      else set.add(productId)
      next.set(categoryId, set)
      return next
    })
  }

  const selectAllInSection = (categoryId: string, productIds: string[]) => {
    setSelectedInSection((prev) => {
      const next = new Map(prev)
      const current = next.get(categoryId)
      const allSelected = productIds.every((id) => current?.has(id))
      next.set(categoryId, allSelected ? new Set() : new Set(productIds))
      return next
    })
  }

  async function saveSection(categoryId: string) {
    const productIds = products.filter((p) => p.category_id === categoryId).map((p) => p.id)
    const toSave = productIds.filter((id) => edits.has(id))
    if (toSave.length === 0) {
      setMessage({ type: 'ok', text: 'No changes in this section.' })
      return
    }
    setSectionSaving(categoryId)
    setMessage(null)
    let ok = 0
    let err: string | null = null
    for (const productId of toSave) {
      const qty = parseQty(edits.get(productId)!)
      const { error } = await supabase
        .from('product_stock')
        .upsert({ product_id: productId, location_id: locationId, quantity: qty }, { onConflict: 'product_id,location_id' })
      if (error) err = error.message
      else ok++
    }
    setSectionSaving(null)
    if (err) setMessage({ type: 'err', text: err })
    else {
      setMessage({ type: 'ok', text: `Updated ${ok} item(s).` })
      setEdits((prev) => {
        const next = new Map(prev)
        toSave.forEach((id) => next.delete(id))
        return next
      })
      toSave.forEach((id) => setStockMap((m) => new Map(m).set(id, parseQty(edits.get(id)!))))
    }
  }

  function applyBulkToSection(categoryId: string) {
    const sel = selectedInSection.get(categoryId)
    if (!sel?.size || bulkValue === '') return
    const qty = parseQty(bulkValue)
    setEdits((prev) => {
      const next = new Map(prev)
      sel.forEach((productId) => next.set(productId, String(qty)))
      return next
    })
    setBulkValue('')
  }

  function applyBulkValueToSelected(categoryId: string) {
    applyBulkToSection(categoryId)
  }

  async function saveAll() {
    const toSave = [...edits.entries()]
    if (toSave.length === 0) return
    setSectionSaving('__all__')
    setMessage(null)
    let ok = 0
    let err: string | null = null
    for (const [productId, val] of toSave) {
      const qty = parseQty(val)
      const { error } = await supabase
        .from('product_stock')
        .upsert({ product_id: productId, location_id: locationId, quantity: qty }, { onConflict: 'product_id,location_id' })
      if (error) err = error.message
      else ok++
    }
    setSectionSaving(null)
    if (err) setMessage({ type: 'err', text: err })
    else {
      setMessage({ type: 'ok', text: `Updated ${ok} item(s).` })
      setEdits(new Map())
      toSave.forEach(([id, val]) => setStockMap((m) => new Map(m).set(id, parseQty(val))))
    }
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const searchLower = searchFilter.trim().toLowerCase()
  const lowStockThreshold = 5

  const filterAndSortProducts = useCallback(
    (list: ProductRow[]) => {
      const qty = (id: string) => stockMap.get(id) ?? 0
      let out = list
      if (searchLower) {
        out = out.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            (p.sku ?? '').toLowerCase().includes(searchLower)
        )
      }
      if (stockLevelFilter === 'zero') {
        out = out.filter((p) => qty(p.id) === 0)
      } else if (stockLevelFilter === 'low') {
        out = out.filter((p) => qty(p.id) <= lowStockThreshold)
      }
      const sorted = [...out].sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return a.name.localeCompare(b.name)
          case 'name_desc':
            return b.name.localeCompare(a.name)
          case 'sku_asc':
            return (a.sku ?? '').localeCompare(b.sku ?? '')
          case 'qty_asc':
            return qty(a.id) - qty(b.id)
          case 'qty_desc':
            return qty(b.id) - qty(a.id)
          default:
            return 0
        }
      })
      return sorted
    },
    [searchLower, stockLevelFilter, sortBy, stockMap]
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, ProductRow[]>()
    products.forEach((p) => {
      const list = map.get(p.category_id) ?? []
      list.push(p)
      map.set(p.category_id, list)
    })
    const filteredMap = new Map<string, ProductRow[]>()
    map.forEach((list, catId) => {
      const filtered = categoryFilter ? (catId === categoryFilter ? filterAndSortProducts(list) : []) : filterAndSortProducts(list)
      if (filtered.length > 0) filteredMap.set(catId, filtered)
    })
    return filteredMap
  }, [products, categoryFilter, filterAndSortProducts])

  const categoryIds = useMemo(
    () =>
      categories
        .filter((c) => (byCategory.get(c.id)?.length ?? 0) > 0)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => c.id),
    [categories, byCategory]
  )

  const flatProducts = useMemo(() => filterAndSortProducts(products), [products, filterAndSortProducts])

  if (!locationId && locations.length > 0 && !loading) {
    return (
      <div className="admin-page">
        <p className="page-intro">
          Select a location (depot) to perform a stock take. Stock is tracked per location. Manage locations from the Locations page.
        </p>
        <div className="card admin-card">
          <label>
            <strong>Location</strong>
            <select
              value=""
              onChange={(e) => setLocationId(e.target.value)}
              className="admin-select"
              style={{ marginTop: '0.5rem', display: 'block', minWidth: 280 }}
            >
              <option value="">Select location…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}{loc.code ? ` (${loc.code})` : ''}</option>
              ))}
            </select>
          </label>
          <p className="admin-muted" style={{ marginTop: '1rem' }}>
            <Link to="/admin/locations">Manage locations</Link> to add depots.
          </p>
        </div>
      </div>
    )
  }

  if (locations.length === 0 && !loading) {
    return (
      <div className="admin-page">
        <p className="page-intro">No locations yet. Add at least one depot to run stock takes.</p>
        <p><Link to="/admin/locations">Add locations</Link></p>
      </div>
    )
  }

  if (loading && !locationId) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="admin-page admin-stock-page">
      <p className="page-intro">
        Stock take by location. Work through sections (categories), check off lines as you count, then save each section. Changes sync in real time for other users. Use bulk “Set to” to apply one value to selected rows in a section.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}
      <div className="admin-stock-toolbar">
        <label>
          Location
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="admin-select"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}{loc.code ? ` (${loc.code})` : ''}</option>
            ))}
          </select>
        </label>
        <span className="admin-muted">Realtime on.</span>
      </div>

      <div className="admin-filters admin-filters--wrap admin-stock-filters">
        <label>
          Search
          <input
            type="search"
            placeholder="Product or SKU…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="admin-select">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Stock level
          <select value={stockLevelFilter} onChange={(e) => setStockLevelFilter(e.target.value as StockLevelFilter)} className="admin-select">
            <option value="all">All</option>
            <option value="zero">Zero only</option>
            <option value="low">Low (≤5)</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as StockSort)} className="admin-select">
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="sku_asc">SKU A–Z</option>
            <option value="qty_asc">Quantity low–high</option>
            <option value="qty_desc">Quantity high–low</option>
          </select>
        </label>
        <div className="admin-stock-view-controls" role="group" aria-label="Layout and view">
          <span className="admin-filter-label">Layout:</span>
          <button
            type="button"
            className={layoutMode === 'sections' ? 'active' : ''}
            onClick={() => setLayoutMode('sections')}
            title="Sections by category"
          >
            Sections
          </button>
          <button
            type="button"
            className={layoutMode === 'flat' ? 'active' : ''}
            onClick={() => setLayoutMode('flat')}
            title="Single list"
          >
            Flat
          </button>
          {layoutMode === 'flat' && (
            <>
              <span className="admin-filter-label">View:</span>
              <button type="button" className={viewType === 'table' ? 'active' : ''} onClick={() => setViewType('table')} title="Table">☰</button>
              <button type="button" className={viewType === 'grid' ? 'active' : ''} onClick={() => setViewType('grid')} title="Grid">◫</button>
              <button type="button" className={viewType === 'list' ? 'active' : ''} onClick={() => setViewType('list')} title="List">≡</button>
            </>
          )}
        </div>
        <label className="admin-stock-density">
          Table density
          <select value={tableDensity} onChange={(e) => setTableDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')} className="admin-select">
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="admin-muted">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="card admin-card">
          <p className="admin-muted">No products in the catalogue. Add products in Catalogue first.</p>
        </div>
      ) : layoutMode === 'flat' ? (
        <div className="card admin-card">
          <div className="admin-stock-flat-header">
            <span>{flatProducts.length} product(s)</span>
            <button
              type="button"
              className="btn btn-small"
              disabled={sectionSaving !== null || edits.size === 0}
              onClick={saveAll}
            >
              {sectionSaving === '__all__' ? 'Saving…' : `Save all changes (${edits.size})`}
            </button>
          </div>
          {viewType === 'table' && (
            <div className={`admin-table-wrap admin-table-wrap--${tableDensity}`}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right', width: 100 }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {flatProducts.map((p) => {
                    const qty = getQty(p.id)
                    const editVal = getEdit(p.id)
                    const inputVal = editVal !== null ? editVal : String(qty)
                    return (
                      <tr key={p.id} className={edits.has(p.id) ? 'admin-stock-row-dirty' : ''}>
                        <td>{categoryMap.get(p.category_id)?.name ?? '—'}</td>
                        <td>{p.name}</td>
                        <td>{p.sku ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={inputVal}
                            onChange={(e) => setEdit(p.id, e.target.value)}
                            className="admin-input admin-stock-input"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(viewType === 'grid' || viewType === 'list') && (
            <div className={`admin-stock-flat-grid admin-stock-view--${viewType}`}>
              {flatProducts.map((p) => {
                const qty = getQty(p.id)
                const editVal = getEdit(p.id)
                const inputVal = editVal !== null ? editVal : String(qty)
                return (
                  <div key={p.id} className={`admin-stock-flat-card ${edits.has(p.id) ? 'admin-stock-row-dirty' : ''}`}>
                    <span className="admin-stock-flat-cat">{categoryMap.get(p.category_id)?.name ?? '—'}</span>
                    <span className="admin-stock-flat-name">{p.name}</span>
                    <span className="admin-stock-flat-sku">{p.sku ?? '—'}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={inputVal}
                      onChange={(e) => setEdit(p.id, e.target.value)}
                      className="admin-input admin-stock-input"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="admin-stock-sections">
          {categoryIds.map((catId) => {
            const cat = categoryMap.get(catId)!
            const rows = byCategory.get(catId) ?? []
            const isCollapsed = collapsedSections.has(catId)
            const dirtyCount = rows.filter((p) => edits.has(p.id)).length
            const selectedCount = selectedInSection.get(catId)?.size ?? 0
            const saving = sectionSaving === catId

            return (
              <div key={catId} className="card admin-stock-section">
                <button
                  type="button"
                  className="admin-stock-section-head"
                  onClick={() => toggleSectionCollapsed(catId)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="admin-stock-section-title">{cat.name}</span>
                  <span className="admin-stock-section-meta">
                    {rows.length} item(s)
                    {dirtyCount > 0 && <span className="admin-stock-dirty"> · {dirtyCount} edited</span>}
                  </span>
                  <span className="admin-stock-section-toggle">{isCollapsed ? '▼' : '▲'}</span>
                </button>
                {!isCollapsed && (
                  <div className="admin-stock-section-body">
                    <div className="admin-stock-section-actions">
                      {selectedCount > 0 && (
                        <div className="admin-stock-bulk">
                          <input
                            type="number"
                            min={0}
                            value={bulkValue}
                            onChange={(e) => setBulkValue(e.target.value)}
                            placeholder="Set to"
                            className="admin-input admin-stock-input"
                          />
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => applyBulkValueToSelected(catId)}
                          >
                            Set {selectedCount} selected to value
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={saving || dirtyCount === 0}
                        onClick={() => saveSection(catId)}
                      >
                        {saving ? 'Saving…' : `Save section${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
                      </button>
                    </div>
                    <div className={`admin-table-wrap admin-table-wrap--${tableDensity}`}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>
                              <button
                                type="button"
                                className="admin-stock-check"
                                onClick={() => selectAllInSection(catId, rows.map((p) => p.id))}
                                title="Select all"
                              >
                                ✓
                              </button>
                            </th>
                            <th style={{ width: 36 }} title="Checked when counted">✓</th>
                            <th>Product</th>
                            <th>SKU</th>
                            <th style={{ textAlign: 'right', width: 100 }}>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((p) => {
                            const qty = getQty(p.id)
                            const editVal = getEdit(p.id)
                            const inputVal = editVal !== null ? editVal : String(qty)
                            const isSelected = selectedInSection.get(catId)?.has(p.id)
                            return (
                              <tr key={p.id} className={edits.has(p.id) ? 'admin-stock-row-dirty' : ''}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={isSelected ?? false}
                                    onChange={() => toggleSelectedInSection(catId, p.id)}
                                    aria-label={`Select ${p.name}`}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={checked.has(p.id)}
                                    onChange={() => toggleChecked(p.id)}
                                    aria-label={`Checked ${p.name}`}
                                    title="Mark as counted"
                                  />
                                </td>
                                <td>{p.name}</td>
                                <td>{p.sku ?? '—'}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={inputVal}
                                    onChange={(e) => setEdit(p.id, e.target.value)}
                                    onBlur={(e) => {
                                      const v = e.target.value
                                      if (v === '' || parseQty(v) === qty) setEdit(p.id, '')
                                    }}
                                    className="admin-input admin-stock-input"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

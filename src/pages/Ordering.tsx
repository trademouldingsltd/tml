import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import ProductDetailModal from '@/components/ProductDetailModal'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import type { CategoryRow, ProductRow, AssemblyWithLines } from '@/types/database'

const VAT_RATE = 1.2

type OrderMode = 'component' | 'complete'

export default function Ordering() {
  const { draftOrder, refresh, ensureDraftOrder } = useDraftOrder()
  const [mode, setMode] = useState<OrderMode>('component')
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [assemblies, setAssemblies] = useState<AssemblyWithLines[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [addingAssembly, setAddingAssembly] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)

  useEffect(() => {
    async function load() {
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .order('name')
      setCategories(catData ?? [])
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order')
        .order('name')
      setProducts(prodData ?? [])
      const { data: assyData } = await supabase
        .from('assemblies')
        .select(`
          *,
          assembly_lines (
            id,
            assembly_id,
            product_id,
            quantity,
            sort_order,
            product:products (*)
          )
        `)
        .eq('active', true)
        .order('sort_order')
        .order('width_mm', { nullsFirst: false })
      setAssemblies((assyData ?? []) as AssemblyWithLines[])
      setLoading(false)
    }
    load()
  }, [])

  const [searchQuery, setSearchQuery] = useState('')
  const [assemblyTypeFilter, setAssemblyTypeFilter] = useState<string>('')
  const [assemblyCollectionFilter, setAssemblyCollectionFilter] = useState<string>('')
  const [assemblySearch, setAssemblySearch] = useState('')
  const [addQuantity, setAddQuantity] = useState(1)
  const displayCategories = categories.filter((c) => !c.parent_id)
  const filteredAssemblies = assemblies.filter((a) => {
    if (assemblyTypeFilter && a.unit_type !== assemblyTypeFilter) return false
    if (assemblyCollectionFilter && (a.collection_slug ?? '') !== assemblyCollectionFilter) return false
    if (assemblySearch.trim()) {
      const q = assemblySearch.trim().toLowerCase()
      const name = (a.name ?? '').toLowerCase()
      const desc = (a.description ?? '').toLowerCase()
      if (!name.includes(q) && !desc.includes(q)) return false
    }
    return true
  })
  const assemblyCollections = [...new Set(assemblies.map((a) => (a.collection_slug ?? '')).filter(Boolean))].sort()
  const productsInCategory = (selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products
  ).filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.trim().toLowerCase()
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    )
  })

  async function addToCart(product: ProductRow, quantity?: number) {
    const qty = quantity ?? addQuantity
    setAdding(product.id)
    try {
      const orderId = await ensureDraftOrder()
      const productSnapshot = {
        name: product.name,
        description: product.description,
        sku: product.sku,
        image_url: product.image_url,
      }
      const { error } = await supabase.from('order_lines').insert({
        order_id: orderId,
        product_id: product.id,
        product_snapshot: productSnapshot,
        quantity: qty,
        unit_price: product.unit_price,
        options: product.options ?? {},
      })
      if (error) throw error
      await updateOrderTotals(orderId)
      await refresh()
      const { count } = await supabase.from('order_lines').select('*', { count: 'exact', head: true }).eq('order_id', orderId)
      setLineCount(count ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(null)
    }
  }

  async function addAssemblyToCart(assembly: AssemblyWithLines, quantity?: number) {
    const qty = quantity ?? addQuantity
    setAddingAssembly(assembly.id)
    try {
      const orderId = await ensureDraftOrder()
      const lines = assembly.assembly_lines ?? []
      if (lines.length === 0) return
      const inserts = lines.flatMap((line) => {
        const product = line.product as ProductRow
        if (!product) return []
        const productSnapshot = {
          name: product.name,
          description: product.description,
          sku: product.sku,
          image_url: product.image_url,
        }
        return {
          order_id: orderId,
          product_id: product.id,
          product_snapshot: productSnapshot,
          quantity: line.quantity * qty,
          unit_price: product.unit_price,
          options: product.options ?? {},
        }
      })
      const { error } = await supabase.from('order_lines').insert(inserts)
      if (error) throw error
      await updateOrderTotals(orderId)
      await refresh()
      const { count } = await supabase.from('order_lines').select('*', { count: 'exact', head: true }).eq('order_id', orderId)
      setLineCount(count ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setAddingAssembly(null)
    }
  }

  function assemblyTotal(assembly: AssemblyWithLines): number {
    const lines = assembly.assembly_lines ?? []
    return lines.reduce((sum, line) => {
      const product = line.product as ProductRow
      return sum + (product ? line.quantity * Number(product.unit_price) : 0)
    }, 0)
  }

  async function updateOrderTotals(orderId: string) {
    const { data: lines } = await supabase
      .from('order_lines')
      .select('quantity, unit_price')
      .eq('order_id', orderId)
    const totalExVat = (lines ?? []).reduce((sum, l) => sum + l.quantity * Number(l.unit_price), 0)
    const totalIncVat = totalExVat * VAT_RATE
    await supabase
      .from('orders')
      .update({ total_ex_vat: totalExVat, total_inc_vat: totalIncVat, updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }

  const [lineCount, setLineCount] = useState(0)
  const refreshLineCount = useCallback(async () => {
    if (!draftOrder?.id) {
      setLineCount(0)
      return
    }
    const { count } = await supabase
      .from('order_lines')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', draftOrder.id)
    setLineCount(count ?? 0)
  }, [draftOrder?.id])

  useEffect(() => {
    refreshLineCount()
  }, [refreshLineCount])

  if (loading) return <p>Loading…</p>

  return (
    <div className="ordering-page">
      <PageNav backTo="/" backLabel="Dashboard" />
      <div className="ordering-header">
        <h1>Create order</h1>
        <p className="page-intro">
          Build a complete kitchen or bedroom estimate in one place: doors, units, handles, lighting, and accessories. Add items below and review in the cart.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/ordering/mto" className="btn btn-outline">
            Made to measure →
          </Link>
          <Link to="/ordering/cart" className="btn btn-success">
            Cart {lineCount > 0 ? `(${lineCount})` : ''} →
          </Link>
        </div>
      </div>

      <div className="ordering-mode-tabs">
        <button
          type="button"
          className={mode === 'component' ? 'active' : ''}
          onClick={() => setMode('component')}
        >
          Component
        </button>
        <button
          type="button"
          className={mode === 'complete' ? 'active' : ''}
          onClick={() => setMode('complete')}
        >
          Complete units
        </button>
      </div>

      {mode === 'complete' ? (
        <>
          <div className="ordering-toolbar">
            <label className="ordering-qty-label">
              Add quantity
              <select
                value={addQuantity}
                onChange={(e) => setAddQuantity(Number(e.target.value))}
                className="ordering-qty-select"
                title="Quantity to add when clicking Add"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            {assemblyCollections.length > 1 && (
              <label className="ordering-filter-label">
                Collection
                <select
                  value={assemblyCollectionFilter}
                  onChange={(e) => setAssemblyCollectionFilter(e.target.value)}
                  className="ordering-filter-select"
                >
                  <option value="">All</option>
                  {assemblyCollections.map((slug) => (
                    <option key={slug} value={slug}>{slug.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="ordering-filter-label">
              Unit type
              <select
                value={assemblyTypeFilter}
                onChange={(e) => setAssemblyTypeFilter(e.target.value)}
                className="ordering-filter-select"
              >
                <option value="">All</option>
                <option value="base_unit">Base</option>
                <option value="wall_unit">Wall</option>
                <option value="tall_unit">Tall</option>
              </select>
            </label>
            <label className="ordering-search-wrap">
              <span className="ordering-filter-label">Search</span>
              <input
                type="search"
                placeholder="Search complete units…"
                value={assemblySearch}
                onChange={(e) => setAssemblySearch(e.target.value)}
                className="ordering-search-input"
              />
            </label>
          </div>
        <div className="ordering-grid">
          {filteredAssemblies.length === 0 ? (
            <div className="card">
              <p>{assemblies.length === 0 ? 'No complete units loaded.' : 'No units match the current filters or search.'}</p>
            </div>
          ) : (
            filteredAssemblies.map((assembly) => (
              <div key={assembly.id} className="card product-card">
                <div className="product-card-image">
                  {assembly.image_url ? (
                    <img src={assembly.image_url} alt={assembly.name} />
                  ) : (
                    <div className="product-card-placeholder">Complete unit</div>
                  )}
                </div>
                <div className="product-card-body">
                  <h3 className="product-card-name">{assembly.name}</h3>
                  {assembly.description && (
                    <p className="product-card-desc">{assembly.description}</p>
                  )}
                  {assembly.width_mm != null && (
                    <span className="product-card-sku">{assembly.width_mm}mm</span>
                  )}
                  <div className="product-card-footer">
                    <span className="product-card-price">£{assemblyTotal(assembly).toFixed(2)}</span>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => addAssemblyToCart(assembly)}
                      disabled={addingAssembly === assembly.id}
                    >
                      {addingAssembly === assembly.id ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </>
      ) : (
        <>
          <div className="ordering-toolbar">
            <label className="ordering-qty-label">
              Add quantity
              <select value={addQuantity} onChange={(e) => setAddQuantity(Number(e.target.value))} className="ordering-qty-select" title="Quantity to add when clicking Add">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          {displayCategories.length > 0 && (
            <div className="ordering-tabs">
              <button
                type="button"
                className={selectedCategory === null ? 'active' : ''}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </button>
              {displayCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={selectedCategory === c.id ? 'active' : ''}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="ordering-search-wrap">
            <input
              type="search"
              placeholder="Search products by name or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ordering-search-input"
            />
          </div>

          <div className="ordering-grid">
            {productsInCategory.length === 0 ? (
              <div className="card">
                <p>No products loaded yet. Add categories and products in Supabase to see them here.</p>
                <p className="downloads-placeholder">
                  Products can include name, description, SKU, unit price, and image. Use the <code>products</code> and <code>categories</code> tables.
                </p>
              </div>
            ) : (
              productsInCategory.map((product) => {
                const openDetail = () => setSelectedProduct(product)
                return (
                  <div key={product.id} className="card product-card product-card--clickable">
                    <button
                      type="button"
                      className="product-card-click-layer"
                      onClick={openDetail}
                      aria-label={`View details for ${product.name}`}
                    />
                    <div
                      className="product-card-image product-card-trigger"
                      onClick={openDetail}
                      onKeyDown={(e) => e.key === 'Enter' && openDetail()}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${product.name}`}
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.image_alt ?? product.name} />
                      ) : (
                        <div className="product-card-placeholder">No image</div>
                      )}
                    </div>
                    <div className="product-card-body">
                      <h3 className="product-card-name product-card-trigger">
                        <button type="button" onClick={openDetail} className="product-card-name-btn">
                          {product.name}
                        </button>
                      </h3>
                      {product.description && (
                        <p className="product-card-desc">{product.description}</p>
                      )}
                      {product.options && typeof product.options === 'object' && Object.keys(product.options as object).length > 0 && (
                        <div className="product-badges">
                          {(Object.entries(product.options as Record<string, unknown>).filter(([, v]) => v != null && String(v).trim() !== '') as [string, string][]).map(([key, value]) => (
                            <span key={key} className="product-badge" title={`${key}: ${value}`}>{String(value)}</span>
                          ))}
                        </div>
                      )}
                      {product.sku && <span className="product-card-sku">SKU: {product.sku}</span>}
                      <div className="product-card-footer">
                        <button
                          type="button"
                          onClick={openDetail}
                          className="product-card-price product-card-trigger"
                          aria-label={`View details – £${Number(product.unit_price).toFixed(2)}`}
                        >
                          £{Number(product.unit_price).toFixed(2)}
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                          disabled={adding === product.id}
                        >
                          {adding === product.id ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={setSelectedProduct}
        />
      )}
    </div>
  )
}

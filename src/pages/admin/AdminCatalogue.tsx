import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import AdminProductModal from '@/components/admin/AdminProductModal'
import type { CategoryRow } from '@/types/database'
import type { ProductRow } from '@/types/database'
import {
  buildExportRows,
  downloadCsv,
  downloadXlsx,
  parseCsvFile,
  parseXlsxFile,
  type CatalogueImportRow,
  type ImportResult,
} from '@/lib/catalogue-import-export'

type CatalogueViewType = 'table' | 'grid' | 'list' | 'compact'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

export default function AdminCatalogue() {
  const { tableDensity } = useAdminUi()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [viewType, setViewType] = useState<CatalogueViewType>('table')
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageAssignResult, setImageAssignResult] = useState<{ updated: number; skipped: string[] } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const productImagesInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('name'),
      supabase.from('products').select('*').order('sort_order').order('name'),
    ])
    setCategories(catRes.data ?? [])
    setProducts(prodRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filteredProducts = categoryFilter
    ? products.filter((p) => p.category_id === categoryFilter)
    : products
  const categoriesByParent = categories.filter((c) => !c.parent_id)

  const TRADE_MOULDINGS_PRODUCT_IMAGES_LINK = 'https://www.dropbox.com/scl/fo/j4oghznkllzyqs9reojvh/h?rlkey=xjpxolai0lkd1pc53gk9n0keo&dl=0'

  async function handleProductImagesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setImageUploading(true)
    setImageAssignResult(null)
    const uploadedPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = safeName
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) {
        setImageAssignResult({ updated: 0, skipped: [`${file.name}: ${error.message}`] })
        setImageUploading(false)
        e.target.value = ''
        return
      }
      uploadedPaths.push(path)
    }
    let updated = 0
    const skipped: string[] = []
    for (const path of uploadedPaths) {
      const base = path.replace(/\.[^.]+$/, '')
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(path)
      const url = publicUrlData.publicUrl
      const match = products.find((p) => p.sku && p.sku.trim().toLowerCase() === base.toLowerCase())
      if (match) {
        const { error: upErr } = await supabase.from('products').update({ image_url: url, image_alt: match.name }).eq('id', match.id)
        if (!upErr) updated++
        else skipped.push(`${path}: ${upErr.message}`)
      } else {
        skipped.push(`${path} (no product with SKU "${base}")`)
      }
    }
    setImageAssignResult({ updated, skipped })
    setImageUploading(false)
    e.target.value = ''
    if (updated > 0) load()
  }

  function handleExportCsv() {
    const rows = buildExportRows(products, categories)
    downloadCsv(rows, `catalogue-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function handleExportXlsx() {
    const rows = buildExportRows(products, categories)
    downloadXlsx(rows, `catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function runImport(rows: CatalogueImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
    const slugToId = new Map<string, string>(
      (await supabase.from('categories').select('id, slug')).data?.map((c) => [c.slug, c.id]) ?? []
    )

    for (const row of rows) {
      const catSlug = row.category_slug || slugify(row.category_name || 'other')
      let catId = slugToId.get(catSlug)
      if (!catId) {
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({
            name: row.category_name || catSlug.replace(/-/g, ' '),
            slug: catSlug,
            sort_order: 0,
          })
          .select('id')
          .single()
        if (catErr) {
          result.errors.push(`Category ${catSlug}: ${catErr.message}`)
          result.skipped++
          continue
        }
        const newId = newCat?.id
        if (newId) {
          catId = newId
          slugToId.set(catSlug, newId)
        }
      }
      if (!catId) {
        result.skipped++
        continue
      }

      const payload = {
        category_id: catId,
        name: row.name.slice(0, 255),
        description: row.description || null,
        sku: row.sku || null,
        unit_price: Math.max(0, row.unit_price),
        active: row.active,
        sort_order: 0,
        image_url: row.image_url || null,
        image_alt: row.image_alt || null,
      }

      if (row.sku) {
        const { data: existing } = await supabase.from('products').select('id').eq('sku', row.sku).maybeSingle()
        if (existing) {
          const { error: upErr } = await supabase.from('products').update(payload).eq('id', existing.id)
          if (upErr) result.errors.push(`Update ${row.sku}: ${upErr.message}`)
          else result.updated++
          continue
        }
      }

      const { error: insErr } = await supabase.from('products').insert(payload)
      if (insErr) {
        result.errors.push(`Insert ${row.name}: ${insErr.message}`)
        result.skipped++
      } else {
        result.inserted++
      }
    }
    return result
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await parseCsvFile(file)
      const result = await runImport(rows)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportResult({ inserted: 0, updated: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleImportXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await parseXlsxFile(file)
      const result = await runImport(rows)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportResult({ inserted: 0, updated: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading catalogue…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <p className="page-intro">Product catalogue. Export to CSV/XLSX or import from file. Use filters to see products by category.</p>

      <div className="admin-catalogue-import-export card admin-card">
        <h2>Import / Export</h2>
        <div className="admin-import-export-actions">
          <div className="admin-export-buttons">
            <span className="admin-export-label">Export:</span>
            <button type="button" className="btn btn-outline btn-small" onClick={handleExportCsv}>
              Download CSV
            </button>
            <button type="button" className="btn btn-outline btn-small" onClick={handleExportXlsx}>
              Download XLSX
            </button>
          </div>
          <div className="admin-import-buttons">
            <span className="admin-export-label">Import:</span>
            <label className="btn btn-outline btn-small">
              {importing ? 'Importing…' : 'From CSV'}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="admin-file-input"
                disabled={importing}
                onChange={handleImportCsv}
              />
            </label>
            <label className="btn btn-outline btn-small">
              {importing ? '…' : 'From XLS/XLSX'}
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="admin-file-input"
                disabled={importing}
                onChange={handleImportXlsx}
              />
            </label>
          </div>
        </div>
        <p className="admin-import-hint">
          Export columns: category_slug, category_name, name, description, sku, unit_price, active, image_url, image_alt. Import uses the same columns; categories are created if missing; products are matched by SKU for updates.
        </p>
        {importResult && (
          <div className={`admin-import-result ${importResult.errors.length ? 'has-errors' : ''}`}>
            <strong>Result:</strong> {importResult.inserted} inserted, {importResult.updated} updated, {importResult.skipped} skipped.
            {importResult.errors.length > 0 && (
              <ul className="admin-import-errors">
                {importResult.errors.slice(0, 10).map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
                {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="card admin-card admin-product-images-card">
        <h2>Product images</h2>
        <p className="admin-muted">
          Trade Mouldings product images:{' '}
          <a href={TRADE_MOULDINGS_PRODUCT_IMAGES_LINK} target="_blank" rel="noopener noreferrer">
            Open Dropbox folder
          </a>
          . Download the images you need, then upload them below. Name files by product <strong>SKU</strong> (e.g. <code>ABC-123.jpg</code>) so they are assigned to the matching product automatically.
        </p>
        <div className="admin-product-images-upload">
          <input
            ref={productImagesInputRef}
            type="file"
            accept="image/*"
            multiple
            className="admin-file-input"
            disabled={imageUploading}
            onChange={handleProductImagesUpload}
          />
          <span className="admin-muted">
            {imageUploading ? 'Uploading…' : 'Select one or more images. Filename (without extension) = product SKU.'}
          </span>
        </div>
        {imageAssignResult && (
          <div className="admin-import-result">
            <strong>Result:</strong> {imageAssignResult.updated} product(s) updated with new image.
            {imageAssignResult.skipped.length > 0 && (
              <ul className="admin-import-errors">
                {imageAssignResult.skipped.slice(0, 15).map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
                {imageAssignResult.skipped.length > 15 && <li>… and {imageAssignResult.skipped.length - 15} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="admin-filters admin-catalogue-toolbar">
        <label>
          Category{' '}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All</option>
            {categoriesByParent.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="admin-catalogue-view-toggle" role="group" aria-label="View type">
          <button
            type="button"
            className={viewType === 'table' ? 'active' : ''}
            onClick={() => setViewType('table')}
            title="Table"
            aria-pressed={viewType === 'table'}
          >
            ☰
          </button>
          <button
            type="button"
            className={viewType === 'grid' ? 'active' : ''}
            onClick={() => setViewType('grid')}
            title="Grid"
            aria-pressed={viewType === 'grid'}
          >
            ◫
          </button>
          <button
            type="button"
            className={viewType === 'list' ? 'active' : ''}
            onClick={() => setViewType('list')}
            title="List"
            aria-pressed={viewType === 'list'}
          >
            ≡
          </button>
          <button
            type="button"
            className={viewType === 'compact' ? 'active' : ''}
            onClick={() => setViewType('compact')}
            title="Compact"
            aria-pressed={viewType === 'compact'}
          >
            ▤
          </button>
        </div>
      </div>

      <div className="card admin-card">
        <h2>Products ({filteredProducts.length})</h2>
        {viewType === 'table' ? (
          <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit price</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">No products match.</td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="admin-catalogue-table-row"
                      onClick={() => setSelectedProduct(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedProduct(p)}
                    >
                      <td>{p.name}</td>
                      <td><code>{p.sku ?? '—'}</code></td>
                      <td>{categories.find((c) => c.id === p.category_id)?.name ?? '—'}</td>
                      <td>£{Number(p.unit_price).toFixed(2)}</td>
                      <td>{p.active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={`admin-catalogue-grid admin-catalogue-view--${viewType}`}>
            {filteredProducts.length === 0 ? (
              <p className="admin-muted">No products match.</p>
            ) : (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className={`admin-catalogue-card ${viewType === 'list' ? 'admin-catalogue-card--list' : ''}`}
                  onClick={() => setSelectedProduct(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedProduct(p)}
                >
                  <div className="admin-catalogue-card-image">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.image_alt ?? p.name ?? ''} />
                    ) : (
                      <span className="admin-muted" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No image</span>
                    )}
                  </div>
                  <div className="admin-catalogue-card-body">
                    <div className="admin-catalogue-card-name">{p.name}</div>
                    <div className="admin-catalogue-card-sku">{p.sku ?? '—'}</div>
                    <div className="admin-catalogue-card-price">£{Number(p.unit_price).toFixed(2)}</div>
                    {viewType !== 'compact' && (
                      <span className="admin-muted">{categories.find((c) => c.id === p.category_id)?.name ?? '—'}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedProduct && (
        <AdminProductModal
          product={selectedProduct}
          categories={categories}
          onClose={() => setSelectedProduct(null)}
          onSaved={() => load()}
        />
      )}

      <div className="card admin-card admin-catalogue-summary">
        <h2>Categories ({categories.length})</h2>
        <ul className="admin-catalogue-cats">
          {categoriesByParent.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <span className="admin-muted">
                {products.filter((p) => p.category_id === c.id).length} products
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

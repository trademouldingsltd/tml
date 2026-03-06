import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CategoryRow, ProductRow, DocumentRow } from '@/types/database'

const OPTION_LABELS: Record<string, string> = {
  finish: 'Finish',
  style: 'Style',
  colour: 'Colour',
  color: 'Colour',
  material: 'Material',
  thickness: 'Thickness',
  width: 'Width',
  height: 'Height',
  depth: 'Depth',
  length: 'Length',
  width_mm: 'Width (mm)',
  height_mm: 'Height (mm)',
  depth_mm: 'Depth (mm)',
}

const MEASUREMENT_KEYS = new Set([
  'width', 'height', 'depth', 'length', 'thickness',
  'width_mm', 'height_mm', 'depth_mm', 'length_mm', 'thickness_mm',
  'dimensions', 'size', 'measurements',
])

const VAT_RATE = 1.2

interface AssemblyWithName {
  id: string
  name: string
}

interface ProductDetailModalProps {
  product: ProductRow
  categories: CategoryRow[]
  allProducts: ProductRow[]
  onClose: () => void
  onSelectProduct?: (product: ProductRow) => void
}

export default function ProductDetailModal({
  product,
  categories,
  allProducts,
  onClose,
  onSelectProduct,
}: ProductDetailModalProps) {
  const [assemblies, setAssemblies] = useState<AssemblyWithName[]>([])
  const [technicalDocs, setTechnicalDocs] = useState<DocumentRow[]>([])
  const [otherDocs, setOtherDocs] = useState<DocumentRow[]>([])
  const [loadingAssemblies, setLoadingAssemblies] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(true)

  const category = categories.find((c) => c.id === product.category_id)
  const options = (product.options as Record<string, unknown>) ?? {}
  const allOptionsList = Object.entries(options).filter(
    ([k, v]) => k !== 'components' && v != null && String(v).trim() !== ''
  ) as [string, string][]
  const optionsList = allOptionsList.filter(([k]) => !MEASUREMENT_KEYS.has(k))
  const measurementsList = allOptionsList.filter(([k]) => MEASUREMENT_KEYS.has(k))
  const componentsFromOptions = Array.isArray(options.components)
    ? (options.components as string[])
    : typeof options.components === 'string'
      ? [options.components]
      : []
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 6)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingAssemblies(true)
      const { data: lineData } = await supabase
        .from('assembly_lines')
        .select('assembly_id')
        .eq('product_id', product.id)
      const assemblyIds = [...new Set((lineData ?? []).map((r) => r.assembly_id))]
      if (assemblyIds.length > 0 && !cancelled) {
        const { data: assyData } = await supabase
          .from('assemblies')
          .select('id, name')
          .in('id', assemblyIds)
          .eq('active', true)
        setAssemblies((assyData ?? []) as AssemblyWithName[])
      } else if (!cancelled) {
        setAssemblies([])
      }
      setLoadingAssemblies(false)
    }
    load()
    return () => { cancelled = true }
  }, [product.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingDocs(true)
      const [
        { data: technical },
        { data: brochureOther },
      ] = await Promise.all([
        supabase.from('documents').select('*').eq('category', 'technical').order('title'),
        supabase.from('documents').select('*').in('category', ['brochure', 'other']).order('title'),
      ])
      if (!cancelled) {
        setTechnicalDocs(technical ?? [])
        setOtherDocs(brochureOther ?? [])
      }
      setLoadingDocs(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  function getDocUrl(row: DocumentRow) {
    if (row.file_path.startsWith('http')) return row.file_path
    const { data } = supabase.storage.from('documents').getPublicUrl(row.file_path)
    return data.publicUrl
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="product-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="product-modal card">
        <button
          type="button"
          className="product-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="product-modal-layout">
          <div className="product-modal-media">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.image_alt ?? product.name ?? ''}
                className="product-modal-image"
              />
            ) : (
              <div className="product-modal-placeholder">No image</div>
            )}
          </div>
          <div className="product-modal-body">
            <h2 id="product-modal-title" className="product-modal-title">
              {product.name}
            </h2>

            {/* Product details overview – always visible */}
            <dl className="product-modal-details">
              <dt>SKU</dt>
              <dd>{product.sku ?? '—'}</dd>
              <dt>Range</dt>
              <dd>{category?.name ?? '—'}</dd>
              <dt>Price ex VAT</dt>
              <dd>£{Number(product.unit_price).toFixed(2)}</dd>
              <dt>Price inc VAT</dt>
              <dd>£{(Number(product.unit_price) * VAT_RATE).toFixed(2)}</dd>
            </dl>

            {/* Description – section always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Description</h3>
              {product.description ? (
                <p className="product-modal-desc">{product.description}</p>
              ) : (
                <p className="product-modal-muted">No description.</p>
              )}
            </section>

            {/* Specification – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Specification</h3>
              {optionsList.length > 0 ? (
                <ul className="product-modal-spec-list">
                  {optionsList.map(([key, value]) => (
                    <li key={key}>
                      <strong>{OPTION_LABELS[key] ?? key}:</strong> {String(value)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No specification.</p>
              )}
            </section>

            {/* Measurements – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Measurements</h3>
              {measurementsList.length > 0 ? (
                <ul className="product-modal-spec-list">
                  {measurementsList.map(([key, value]) => (
                    <li key={key}>
                      <strong>{OPTION_LABELS[key] ?? key}:</strong> {String(value)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No measurements.</p>
              )}
            </section>

            {/* Components / Used in units – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">
                {componentsFromOptions.length > 0 ? 'Components included' : 'Used in complete units'}
              </h3>
              {componentsFromOptions.length > 0 ? (
                <ul className="product-modal-list">
                  {componentsFromOptions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : loadingAssemblies ? (
                <p className="product-modal-muted">Loading…</p>
              ) : assemblies.length > 0 ? (
                <ul className="product-modal-list">
                  {assemblies.map((a) => (
                    <li key={a.id}>{a.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">—</p>
              )}
            </section>

            {/* Related products – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Related products</h3>
              {relatedProducts.length > 0 ? (
                <>
                  <ul className="product-modal-related">
                    {relatedProducts.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="product-modal-related-link"
                          onClick={() => onSelectProduct?.(p)}
                        >
                          {p.name}
                          {p.sku && ` (${p.sku})`}
                        </button>
                        <span className="product-modal-related-price">£{Number(p.unit_price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/products"
                    state={category ? { categoryId: category.id } : undefined}
                    className="product-modal-link"
                  >
                    View all in {category?.name ?? 'this range'} →
                  </Link>
                </>
              ) : (
                <p className="product-modal-muted">None in this range.</p>
              )}
            </section>

            {/* Product guides – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Product guides</h3>
              {loadingDocs ? (
                <p className="product-modal-muted">Loading…</p>
              ) : technicalDocs.length > 0 ? (
                <ul className="product-modal-docs">
                  {technicalDocs.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={getDocUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-modal-doc-link"
                      >
                        {doc.title}
                      </a>
                      {doc.description && (
                        <span className="product-modal-doc-desc">{doc.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No product guides uploaded yet.</p>
              )}
            </section>

            {/* Documentation – always shown */}
            <section className="product-modal-section">
              <h3 className="product-modal-section-title">Documentation</h3>
              {loadingDocs ? (
                <p className="product-modal-muted">Loading…</p>
              ) : otherDocs.length > 0 ? (
                <ul className="product-modal-docs">
                  {otherDocs.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={getDocUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-modal-doc-link"
                      >
                        {doc.title}
                      </a>
                      {doc.description && (
                        <span className="product-modal-doc-desc">{doc.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="product-modal-muted">No product documentation in this view.</p>
              )}
              <Link to="/downloads" className="product-modal-link">
                View all downloads →
              </Link>
            </section>

            <div className="product-modal-actions">
              <Link to="/ordering" className="btn">
                Add to order
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DocumentRow } from '@/types/database'

const UPLOAD_SLOTS = [
  { role: 'pricelist' as const, label: 'Pricelist', description: 'UK Pricelist PDF. Used by the import script to add 1700+ products.', storagePath: 'pricelist.pdf', category: 'pricelist' as const, title: 'UK Pricelist' },
  { role: 'main_brochure' as const, label: 'Brochure', description: 'Main brochure PDF. Shown in customer Downloads.', storagePath: 'main-brochure.pdf', category: 'brochure' as const, title: 'Main Brochure' },
  { role: 'door_finder' as const, label: 'Door finder', description: 'Door Finder poster PDF. Shown in customer Downloads.', storagePath: 'door-finder.pdf', category: 'brochure' as const, title: 'Door Finder' },
]

export default function AdminDocumentUploads() {
  const [slots, setSlots] = useState<Record<string, DocumentRow | null>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('documents')
      .select('*')
      .in('role', UPLOAD_SLOTS.map((s) => s.role))
      .then(({ data }) => {
        const byRole: Record<string, DocumentRow | null> = {}
        UPLOAD_SLOTS.forEach((s) => { byRole[s.role] = null })
        ;(data ?? []).forEach((row) => {
          const r = row as DocumentRow & { role: string }
          if (r.role) byRole[r.role] = r as DocumentRow
        })
        setSlots(byRole)
        setLoading(false)
      })
  }, [])

  async function handleUpload(role: string, file: File) {
    const slot = UPLOAD_SLOTS.find((s) => s.role === role)
    if (!slot || !file?.name) return
    setUploading(role)
    setMessage(null)
    try {
      const path = slot.storagePath
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const existing = slots[role]
      const row = {
        title: slot.title,
        description: slot.description,
        file_path: path,
        file_type: file.type || 'application/pdf',
        category: slot.category,
        role: slot.role,
      }
      if (existing?.id) {
        const { error: updateError } = await supabase.from('documents').update(row).eq('id', existing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('documents').insert(row)
        if (insertError) throw insertError
      }
      const { data: list } = await supabase.from('documents').select('*').in('role', UPLOAD_SLOTS.map((s) => s.role))
      const byRole: Record<string, DocumentRow | null> = {}
      UPLOAD_SLOTS.forEach((s) => { byRole[s.role] = null })
      ;(list ?? []).forEach((row) => {
        const r = row as DocumentRow & { role: string }
        if (r.role) byRole[r.role] = r as DocumentRow
      })
      setSlots(byRole)
      setMessage({ type: 'ok', text: `${slot.label} uploaded.` })
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Upload failed' })
    } finally {
      setUploading(null)
    }
  }

  if (loading) return <div className="admin-page"><p>Loading…</p></div>

  return (
    <div className="admin-page">
      <p className="page-intro">
        Upload the Pricelist, Brochure, and Door finder PDFs here. They are stored in Supabase and appear in customer Downloads. The <strong>Pricelist</strong> is used by the import script when you run <code>npm run import-pricelist</code> without a file path.
      </p>
      <p className="admin-upload-help" style={{ marginTop: '0.5rem' }}>
        To include all pricelist and brochure products in the catalogue: after uploading the <strong>UK Pricelist</strong> PDF here, run <code>npm run import-pricelist</code> in the project (with <code>DATABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in .env). This adds or updates every product from the PDF so inventory matches the pricelist. Re-run after uploading a new pricelist to refresh names and prices.
      </p>
      <p className="admin-upload-help">
        If customers see &quot;Bucket not found&quot; when clicking View: create the Storage bucket by running <code>npm run setup:supabase</code> (with <code>SUPABASE_SERVICE_ROLE_KEY</code> in .env), then run migration <code>011_storage_documents_public_read.sql</code> in the SQL Editor. In Dashboard → Storage, ensure the <strong>documents</strong> bucket exists and is set to <strong>Public</strong>.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}
      <div className="admin-upload-slots">
        {UPLOAD_SLOTS.map((slot) => {
          const current = slots[slot.role]
          return (
            <div key={slot.role} className="card admin-upload-card">
              <h2>{slot.label}</h2>
              <p className="admin-upload-desc">{slot.description}</p>
              {current && (
                <p className="admin-upload-current">
                  Current file: <strong>{current.file_path}</strong>
                  {current.created_at && (
                    <span className="muted"> · Updated {new Date(current.created_at).toLocaleDateString()}</span>
                  )}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')
                  if (input?.files?.[0]) handleUpload(slot.role, input.files[0])
                }}
                className="admin-upload-form"
              >
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="admin-upload-input"
                  onChange={() => setMessage(null)}
                />
                <button type="submit" className="btn btn-success" disabled={uploading === slot.role}>
                  {uploading === slot.role ? 'Uploading…' : 'Upload'}
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}

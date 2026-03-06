/**
 * Catalogue import/export: CSV and XLSX.
 * Export columns: category_slug, category_name, name, description, sku, unit_price, active
 */

import * as XLSX from 'xlsx'
import type { CategoryRow, ProductRow } from '@/types/database'

export interface CatalogueExportRow {
  category_slug: string
  category_name: string
  name: string
  description: string
  sku: string
  unit_price: number
  active: boolean
  image_url: string
  image_alt: string
}

export function buildExportRows(
  products: ProductRow[],
  categories: CategoryRow[]
): CatalogueExportRow[] {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  return products.map((p) => {
    const cat = catMap.get(p.category_id)
    return {
      category_slug: cat?.slug ?? '',
      category_name: cat?.name ?? '',
      name: p.name ?? '',
      description: p.description ?? '',
      sku: p.sku ?? '',
      unit_price: Number(p.unit_price),
      active: !!p.active,
      image_url: p.image_url ?? '',
      image_alt: p.image_alt ?? '',
    }
  })
}

const EXPORT_HEADERS = ['category_slug', 'category_name', 'name', 'description', 'sku', 'unit_price', 'active', 'image_url', 'image_alt']

function rowToCells(row: CatalogueExportRow): string[] {
  return [
    row.category_slug,
    row.category_name,
    row.name,
    row.description,
    row.sku,
    String(row.unit_price),
    row.active ? '1' : '0',
    row.image_url,
    row.image_alt,
  ]
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(rows: CatalogueExportRow[], filename = 'catalogue-export.csv') {
  const headerLine = EXPORT_HEADERS.map(escapeCsvCell).join(',')
  const dataLines = rows.map((r) => rowToCells(r).map(escapeCsvCell).join(','))
  const blob = new Blob(['\uFEFF' + [headerLine, ...dataLines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadXlsx(rows: CatalogueExportRow[], filename = 'catalogue-export.xlsx') {
  const data = [EXPORT_HEADERS, ...rows.map((r) => rowToCells(r))]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue')
  XLSX.writeFile(wb, filename)
}

// ---- Import ----

export interface CatalogueImportRow {
  category_slug: string
  category_name: string
  name: string
  description: string
  sku: string
  unit_price: number
  active: boolean
  image_url: string
  image_alt: string
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v ?? '').replace(/,/g, '')
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, '_').trim()
}

export function parseCsvFile(file: File): Promise<CatalogueImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) {
          resolve([])
          return
        }
        const headers = lines[0].split(',').map((h) => normaliseHeader(h.replace(/^"|"$/g, '').trim()))
        const rows: CatalogueImportRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i])
          const raw: Record<string, string> = {}
          headers.forEach((h, j) => {
            raw[h] = cells[j] ?? ''
          })
          const slug = (raw.category_slug ?? '').trim() || slugify(raw.category_name ?? '')
          const name = (raw.name ?? '').trim()
          if (!name) continue
          rows.push({
            category_slug: slug,
            category_name: (raw.category_name ?? '').trim() || slug.replace(/-/g, ' '),
            name,
            description: (raw.description ?? '').trim(),
            sku: (raw.sku ?? '').trim(),
            unit_price: parseNumber(raw.unit_price),
            active: parseBool(raw.active),
            image_url: (raw.image_url ?? '').trim(),
            image_alt: (raw.image_alt ?? '').trim(),
          })
        }
        resolve(rows)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'UTF-8')
  })
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

export function parseXlsxFile(file: File): Promise<CatalogueImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const firstSheet = wb.SheetNames[0]
        if (!firstSheet) {
          resolve([])
          return
        }
        const ws = wb.Sheets[firstSheet]
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (aoa.length < 2) {
          resolve([])
          return
        }
        const headers = (aoa[0] as string[]).map((h) => normaliseHeader(String(h ?? '')))
        const rows: CatalogueImportRow[] = []
        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i] as unknown[]
          const raw: Record<string, string> = {}
          headers.forEach((h, j) => {
            raw[h] = String(row[j] ?? '').trim()
          })
          const slug = (raw.category_slug ?? '').trim() || slugify(raw.category_name ?? '')
          const name = (raw.name ?? '').trim()
          if (!name) continue
          rows.push({
            category_slug: slug,
            category_name: (raw.category_name ?? '').trim() || slug.replace(/-/g, ' '),
            name,
            description: raw.description ?? '',
            sku: raw.sku ?? '',
            unit_price: parseNumber(raw.unit_price),
            active: parseBool(raw.active),
            image_url: (raw.image_url ?? '').trim(),
            image_alt: (raw.image_alt ?? '').trim(),
          })
        }
        resolve(rows)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

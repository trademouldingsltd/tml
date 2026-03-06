import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const STORAGE_KEY = 'admin-ui-prefs'

export type TableDensity = 'compact' | 'comfortable' | 'spacious'
export type DateFormat = 'locale' | 'ddmmyyyy' | 'iso'

export interface AdminUiPrefs {
  sidebarCollapsed: boolean
  tableDensity: TableDensity
  dateFormat: DateFormat
  rowsPerPage: number
  defaultOrderStatusFilter: string
}

const defaults: AdminUiPrefs = {
  sidebarCollapsed: false,
  tableDensity: 'comfortable',
  dateFormat: 'locale',
  rowsPerPage: 25,
  defaultOrderStatusFilter: '',
}

function loadPrefs(): AdminUiPrefs {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<AdminUiPrefs>
    return { ...defaults, ...parsed }
  } catch {
    return { ...defaults }
  }
}

function savePrefs(prefs: AdminUiPrefs) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch (_) {}
}

type AdminUiContextValue = AdminUiPrefs & {
  setSidebarCollapsed: (v: boolean) => void
  setTableDensity: (v: TableDensity) => void
  setDateFormat: (v: DateFormat) => void
  setRowsPerPage: (v: number) => void
  setDefaultOrderStatusFilter: (v: string) => void
  updatePrefs: (partial: Partial<AdminUiPrefs>) => void
}

const AdminUiContext = createContext<AdminUiContextValue | null>(null)

export function AdminUiProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<AdminUiPrefs>(loadPrefs)

  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])

  const setPrefs = useCallback((update: Partial<AdminUiPrefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...update }
      return next
    })
  }, [])

  const value: AdminUiContextValue = {
    ...prefs,
    setSidebarCollapsed: (v) => setPrefs({ sidebarCollapsed: v }),
    setTableDensity: (v) => setPrefs({ tableDensity: v }),
    setDateFormat: (v) => setPrefs({ dateFormat: v }),
    setRowsPerPage: (v) => setPrefs({ rowsPerPage: v }),
    setDefaultOrderStatusFilter: (v) => setPrefs({ defaultOrderStatusFilter: v }),
    updatePrefs: setPrefs,
  }

  return (
    <AdminUiContext.Provider value={value}>
      {children}
    </AdminUiContext.Provider>
  )
}

export function useAdminUi() {
  const ctx = useContext(AdminUiContext)
  if (!ctx) throw new Error('useAdminUi must be used within AdminUiProvider')
  return ctx
}

export function formatAdminDate(prefs: AdminUiPrefs, date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (prefs.dateFormat === 'iso') return d.toISOString().slice(0, 10)
  if (prefs.dateFormat === 'ddmmyyyy') return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

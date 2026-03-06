import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const STORAGE_KEY = 'customer-ui-sidebar'

function loadSidebarPreference(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch (_) {}
  return false
}

function saveSidebarPreference(value: boolean) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(value))
  } catch (_) {}
}

type CustomerUiContextValue = {
  useSidebarMenu: boolean
  setUseSidebarMenu: (value: boolean) => void
}

const CustomerUiContext = createContext<CustomerUiContextValue | null>(null)

export function CustomerUiProvider({ children }: { children: ReactNode }) {
  const [useSidebarMenu, setUseSidebarMenuState] = useState(loadSidebarPreference)

  useEffect(() => {
    saveSidebarPreference(useSidebarMenu)
  }, [useSidebarMenu])

  const setUseSidebarMenu = useCallback((value: boolean) => {
    setUseSidebarMenuState(value)
  }, [])

  const value: CustomerUiContextValue = { useSidebarMenu, setUseSidebarMenu }

  return (
    <CustomerUiContext.Provider value={value}>
      {children}
    </CustomerUiContext.Provider>
  )
}

export function useCustomerUi() {
  const ctx = useContext(CustomerUiContext)
  if (!ctx) throw new Error('useCustomerUi must be used within CustomerUiProvider')
  return ctx
}

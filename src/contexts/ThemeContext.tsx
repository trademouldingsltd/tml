import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export type ThemeId = 'classic' | 'light' | 'dark'

const PREF_KEY = 'theme'
const DEFAULT_THEME: ThemeId = 'classic'

type ThemeContextValue = {
  theme: ThemeId
  setTheme: (value: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME)
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        applyTheme(DEFAULT_THEME)
        setThemeState(DEFAULT_THEME)
        setInitialised(true)
        return
      }
      supabase
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', PREF_KEY)
        .maybeSingle()
        .then(({ data }) => {
          const v = (data?.value as ThemeId) || DEFAULT_THEME
          if (['classic', 'light', 'dark'].includes(v)) {
            setThemeState(v as ThemeId)
            applyTheme(v as ThemeId)
          }
          setInitialised(true)
        })
    })
  }, [])

  useEffect(() => {
    if (!initialised) return
    applyTheme(theme)
  }, [theme, initialised])

  const setTheme = useCallback(async (value: ThemeId) => {
    setThemeState(value)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_preferences').upsert(
      { user_id: user.id, key: PREF_KEY, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    )
  }, [])

  const value: ThemeContextValue = { theme, setTheme }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { theme: DEFAULT_THEME as ThemeId, setTheme: async () => {} }
  return ctx
}

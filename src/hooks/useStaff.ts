import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface StaffProfileRow {
  id: string
  user_id: string
  role: 'admin' | 'staff'
  display_name: string | null
}

export function useStaff() {
  const { user, loading: authLoading } = useAuth()
  const [staffProfile, setStaffProfile] = useState<StaffProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setStaffProfile(null)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('staff_profiles')
      .select('id, user_id, role, display_name')
      .eq('user_id', user.id)
      .maybeSingle()
    setStaffProfile(data ?? null)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setStaffProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    refresh()
  }, [user, refresh])

  return {
    isStaff: !!staffProfile,
    staffProfile,
    loading: authLoading || loading,
    refresh,
  }
}

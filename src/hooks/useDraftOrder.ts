import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderRow } from '@/types/database'

export function useDraftOrder() {
  const effectiveUserId = useEffectiveUserId()
  const [draftOrder, setDraftOrder] = useState<OrderRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!effectiveUserId) {
      setDraftOrder(null)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setDraftOrder(data ?? null)
    setLoading(false)
  }, [effectiveUserId])

  const ensureDraftOrder = useCallback(async (): Promise<string> => {
    if (draftOrder?.id) return draftOrder.id
    if (!effectiveUserId) throw new Error('Not logged in')
    const { data, error } = await supabase
      .from('orders')
      .insert({ user_id: effectiveUserId, status: 'draft', total_ex_vat: 0, total_inc_vat: 0 })
      .select('id')
      .single()
    if (error) throw error
    await refresh()
    return data.id
  }, [effectiveUserId, draftOrder?.id, refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { draftOrder, loading, refresh, ensureDraftOrder }
}

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useMtoCartRefresh } from '@/components/MtoLayout'

const VAT_RATE = 1.2

export interface MtoSnapshot {
  name: string
  description?: string
  sku?: string
}

async function updateOrderTotals(orderId: string) {
  const { data: lines } = await supabase
    .from('order_lines')
    .select('quantity, unit_price')
    .eq('order_id', orderId)
  const totalExVat = (lines ?? []).reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
  await supabase
    .from('orders')
    .update({ total_ex_vat: totalExVat, total_inc_vat: totalExVat * VAT_RATE, updated_at: new Date().toISOString() })
    .eq('id', orderId)
}

export function useAddMtoLine() {
  const { ensureDraftOrder } = useDraftOrder()
  const refreshCart = useMtoCartRefresh()

  const addMtoLine = useCallback(
    async (
      snapshot: MtoSnapshot,
      options: Record<string, unknown>,
      unitPrice: number,
      quantity: number
    ) => {
      const orderId = await ensureDraftOrder()
      const { error } = await supabase.from('order_lines').insert({
        order_id: orderId,
        product_id: null,
        product_snapshot: snapshot,
        quantity,
        unit_price: unitPrice,
        options,
      })
      if (error) throw error
      await updateOrderTotals(orderId)
      refreshCart()
    },
    [ensureDraftOrder, refreshCart]
  )

  return { addMtoLine }
}

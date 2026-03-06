export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface DocumentRow {
  id: string
  created_at: string
  title: string
  description: string | null
  file_path: string
  file_type: string
  category: 'brochure' | 'technical' | 'pricelist' | 'other'
  role?: 'pricelist' | 'main_brochure' | 'door_finder' | null
}

export interface CategoryRow {
  id: string
  name: string
  slug: string
  sort_order: number
  parent_id: string | null
}

export interface ProductRow {
  id: string
  category_id: string
  name: string
  description: string | null
  sku: string | null
  unit_price: number
  cost_price: number | null
  stock_quantity: number
  image_url: string | null
  image_alt: string | null
  options: Json
  active: boolean
  sort_order: number
  created_at: string
}

export interface SupplierRow {
  id: string
  user_id: string | null
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LocationRow {
  id: string
  name: string
  code: string | null
  address: string | null
  phone: string | null
  opening_hours: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProductStockRow {
  product_id: string
  location_id: string
  quantity: number
  updated_at: string
}

export interface OrderRow {
  id: string
  user_id: string
  status: 'draft' | 'quotation' | 'placed' | 'invoiced' | 'paid' | 'cancelled'
  total_ex_vat: number
  total_inc_vat: number
  reference: string | null
  created_at: string
  updated_at: string
  delivery_address?: string | null
  delivery_postcode?: string | null
  delivery_notes?: string | null
  processed_at?: string | null
  delivery_tracking?: string | null
  created_by_staff_id?: string | null
  payment_intent_id?: string | null
  payment_status?: 'pending' | 'succeeded' | 'failed' | 'refunded' | null
  invoice_number?: string | null
  courier?: string | null
  delivery_expected_date?: string | null
}

export const COURIER_OPTIONS = ['DPD', 'FedEx', 'Royal Mail', 'Yodel', 'Other'] as const

export interface StaffProfileRow {
  id: string
  user_id: string
  role: 'admin' | 'staff'
  display_name: string | null
  created_at?: string
  updated_at?: string
}

export interface OrderLineRow {
  id: string
  order_id: string
  product_id: string
  product_snapshot: Json
  quantity: number
  unit_price: number
  options: Json
}

export interface CustomerProfileRow {
  id: string
  user_id: string
  company_name: string
  contact_name: string | null
  balance_outstanding: number
  updated_at: string
  payment_terms?: string | null
}

export interface CustomerNoteRow {
  id: string
  customer_user_id: string
  author_user_id: string | null
  body: string
  created_at: string
}

export interface AssemblyRow {
  id: string
  name: string
  description: string | null
  image_url: string | null
  unit_type: 'base_unit' | 'wall_unit' | 'tall_unit' | 'other'
  width_mm: number | null
  collection_slug: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface AssemblyLineRow {
  id: string
  assembly_id: string
  product_id: string
  quantity: number
  sort_order: number
}

export type AssemblyWithLines = AssemblyRow & {
  assembly_lines: (AssemblyLineRow & { product: ProductRow })[]
}

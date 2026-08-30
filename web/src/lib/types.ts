// Domain types mirroring supabase/schema.sql. Kept hand-written (small, stable schema).

export type Role = "owner" | "counter_staff";
export type TableStatus = "free" | "occupied";
export type OrderStatus = "open" | "closed" | "void";
export type OrderType = "dine_in" | "takeaway" | "delivery";
export type DiscountType = "percent" | "fixed";
export type PaymentMethod = "cash" | "card" | "jazzcash" | "easypaisa" | "udhaar" | "other";
export type PaymentStatus = "pending" | "confirmed";

export interface Staff {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  pin: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Settings {
  id: 1;
  brand_name: string;
  service_charge_pct: number;
  discounts_role: "owner" | "any";
  retention_days: number;
  updated_at: string;
}

export interface RestaurantTable {
  id: string;
  number: number;
  seats: number | null;
  status: TableStatus;
  opened_at: string | null;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  tab_group: string | null;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  group_key: string | null;
  name: string;
  size_label: string | null;
  price: number;
  description: string | null;
  photo_url: string | null;
  is_live: boolean;
  is_placeholder: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MenuItemModifier {
  id: string;
  menu_item_id: string | null;
  group_key: string | null;
  label: string;
  sort_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  order_type: OrderType;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  server_id: string | null;
  server_name: string | null;
  status: OrderStatus;
  service_charge_pct: number;
  delivery_charge: number;
  token_number: number | null;
  type_number: number | null;
  shift_id: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
}

export interface OrderRound {
  id: string;
  order_id: string;
  round_number: number;
  sent_to_kitchen_at: string | null;
  created_at: string;
}

export interface OrderLineItem {
  id: string;
  round_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  size_snapshot: string | null;
  quantity: number;
  unit_price: number;
  note: string | null;
  modifiers: string[];
  is_voided: boolean;
  void_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  created_at: string;
}

export interface Discount {
  id: string;
  order_id: string;
  type: DiscountType;
  value: number;
  applied_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  screenshot_url: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  paid_at: string;
  created_at: string;
}

export interface DailySummary {
  day: string;
  revenue: number;
  order_count: number;
  avg_order: number;
  service_charge_total: number;
  discount_total: number;
  top_items: { name: string; qty: number }[];
  created_at: string;
}

/** A product = one or more size variants sharing a group_key. Used by the order builder. */
export interface MenuProduct {
  group_key: string;
  name: string;
  category_id: string;
  description: string | null;
  photo_url: string | null;
  variants: MenuItem[]; // one per size (or a single row)
}

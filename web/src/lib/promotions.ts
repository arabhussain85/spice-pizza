import type { SupabaseClient } from "@supabase/supabase-js";
import { lineTotal, type LineLike } from "./order-math";

export type PromoScope = "all" | "category" | "item";

export interface Promotion {
  id: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  scope: PromoScope;
  category_id: string | null;
  group_key: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface MenuMeta {
  group_key: string | null;
  category_id: string;
}

/** Active promotions, honouring an optional start/end window. */
export async function fetchActivePromotions(supa: SupabaseClient): Promise<Promotion[]> {
  const { data, error } = await supa.from("promotions").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as Promotion[]).filter((p) => {
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
    if (p.ends_at && new Date(p.ends_at).getTime() < now) return false;
    return true;
  });
}

/** menu_item_id → { group_key, category_id } — used to match item/category promos to lines. */
export async function fetchMenuMeta(supa: SupabaseClient): Promise<Map<string, MenuMeta>> {
  const { data, error } = await supa.from("menu_items").select("id,group_key,category_id");
  if (error) throw error;
  const m = new Map<string, MenuMeta>();
  for (const it of (data ?? []) as { id: string; group_key: string | null; category_id: string }[]) {
    m.set(it.id, { group_key: it.group_key, category_id: it.category_id });
  }
  return m;
}

export interface PromoLine extends LineLike {
  menu_item_id: string | null;
}

/** Best-matching active promo discount for one line (largest wins). */
export function lineDiscount(line: PromoLine, promos: Promotion[], meta: Map<string, MenuMeta>): { amount: number; name: string } | null {
  if (line.is_voided) return null;
  const lt = lineTotal(line);
  if (lt <= 0) return null;
  const info = line.menu_item_id ? meta.get(line.menu_item_id) : undefined;
  let best: { amount: number; name: string } | null = null;
  for (const p of promos) {
    const matches =
      p.scope === "all" ||
      (p.scope === "category" && !!info && p.category_id === info.category_id) ||
      (p.scope === "item" && !!info && p.group_key === info.group_key);
    if (!matches) continue;
    const amount = p.type === "percent" ? Math.round((lt * p.value) / 100) : Math.min(p.value * line.quantity, lt);
    if (!best || amount > best.amount) best = { amount, name: p.name };
  }
  return best;
}

/** Total automatic-promo discount + the distinct promo names applied. */
export function promoTotals(lines: PromoLine[], promos: Promotion[], meta: Map<string, MenuMeta>): { discount: number; names: string[] } {
  let discount = 0;
  const names = new Set<string>();
  for (const l of lines) {
    const d = lineDiscount(l, promos, meta);
    if (d) {
      discount += d.amount;
      names.add(d.name);
    }
  }
  return { discount, names: [...names] };
}

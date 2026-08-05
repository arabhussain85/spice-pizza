"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/** Permanently delete an order (cascades rounds/items/payments/discounts). Frees the table if it was open. */
export async function deleteOrder(id: string) {
  const supa = createAdminClient();
  const { data: o } = await supa.from("orders").select("table_id,status").eq("id", id).maybeSingle();
  const { error } = await supa.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (o?.table_id && o.status === "open") {
    await supa.from("restaurant_tables").update({ status: "free", opened_at: null }).eq("id", o.table_id);
  }
  return { ok: true };
}

/** Edit a line item's quantity (0 removes it). */
export async function updateOrderLineItem(id: string, quantity: number) {
  const supa = createAdminClient();
  if (quantity <= 0) {
    await supa.from("order_line_items").delete().eq("id", id);
    return { ok: true, deleted: true };
  }
  const { error } = await supa.from("order_line_items").update({ quantity }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Void / un-void a line item from history. */
export async function toggleVoidLineItem(id: string, voided: boolean, reason?: string) {
  const supa = createAdminClient();
  const { error } = await supa
    .from("order_line_items")
    .update({
      is_voided: voided,
      void_reason: voided ? reason ?? "Adjusted in admin" : null,
      voided_at: voided ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

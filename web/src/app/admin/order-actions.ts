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

/**
 * Cancel an order — requires the owner PIN. Marks it void (kept for records, no
 * payment) and frees the table. Returns { ok:false } on a missing/wrong PIN.
 */
export async function cancelOrder(
  id: string,
  opts: { pin: string; reason?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supa = createAdminClient();

  const pin = opts.pin?.trim();
  if (!pin) return { ok: false, error: "Owner PIN required." };
  const { data: owner } = await supa.from("staff").select("id").eq("role", "owner").eq("pin", pin).limit(1);
  if (!owner || owner.length === 0) return { ok: false, error: "Incorrect owner PIN." };

  const { data: o } = await supa.from("orders").select("table_id").eq("id", id).maybeSingle();
  const { error } = await supa
    .from("orders")
    .update({ status: "void", closed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (o?.table_id) {
    await supa.from("restaurant_tables").update({ status: "free", opened_at: null }).eq("id", o.table_id);
  }

  const { data: rounds } = await supa.from("order_rounds").select("id").eq("order_id", id);
  const roundIds = ((rounds ?? []) as { id: string }[]).map((r) => r.id);
  if (roundIds.length) {
    await supa
      .from("order_line_items")
      .update({ is_voided: true, void_reason: `Cancelled${opts.reason ? `: ${opts.reason}` : ""}`, voided_at: new Date().toISOString() })
      .in("round_id", roundIds);
  }
  return { ok: true };
}

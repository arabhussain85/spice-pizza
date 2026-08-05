"use server";

import { createAdminClient } from "@/lib/supabase/admin";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface MenuItemInput {
  id?: string;
  category_id: string;
  name: string;
  price: number;
  size_label?: string | null;
  description?: string | null;
  photo_url?: string | null;
  is_live?: boolean;
  group_key?: string | null;
}

export async function upsertMenuItem(input: MenuItemInput): Promise<{ id: string }> {
  const supa = createAdminClient();
  const fields = {
    category_id: input.category_id,
    name: input.name,
    price: input.price,
    size_label: input.size_label ?? null,
    description: input.description ?? null,
    photo_url: input.photo_url ?? null,
    is_live: input.is_live ?? true,
    group_key: input.group_key ?? slug(input.name),
    is_placeholder: false,
  };
  if (input.id) {
    const { error } = await supa.from("menu_items").update(fields).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await supa.from("menu_items").insert(fields).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function toggleMenuItemLive(id: string, isLive: boolean) {
  const supa = createAdminClient();
  const { error } = await supa.from("menu_items").update({ is_live: isLive }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteMenuItem(id: string) {
  const supa = createAdminClient();
  // soft delete — financial history references snapshots, not the live row
  const { error } = await supa.from("menu_items").update({ deleted_at: new Date().toISOString(), is_live: false }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addModifier(label: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("menu_item_modifiers").insert({ label });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteModifier(id: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("menu_item_modifiers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateSettings(patch: {
  service_charge_pct?: number;
  discounts_role?: "owner" | "any";
  retention_days?: number;
  brand_name?: string;
}) {
  const supa = createAdminClient();
  const { error } = await supa.from("settings").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function confirmPayment(id: string) {
  const supa = createAdminClient();
  // 1. Confirm payment
  const { data: payment, error } = await supa
    .from("payments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .select("order_id")
    .single();
  if (error) throw new Error(error.message);

  if (payment?.order_id) {
    // 2. Close order
    const { data: order } = await supa
      .from("orders")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", payment.order_id)
      .select("table_id")
      .single();

    // 3. Free table
    if (order?.table_id) {
      await supa.from("restaurant_tables").update({ status: "free", opened_at: null }).eq("id", order.table_id);
    }

    // 4. Clean empty rounds
    const { data: emptyRounds } = await supa
      .from("order_rounds")
      .select("id,order_line_items(id)")
      .eq("order_id", payment.order_id);
    for (const r of (emptyRounds ?? []) as Array<{ id: string; order_line_items: unknown[] }>) {
      if ((r.order_line_items ?? []).length === 0) {
        await supa.from("order_rounds").delete().eq("id", r.id);
      }
    }
  }
  return { ok: true };
}

/** Reject a pending online payment (removes it; the bill stays closed/unpaid for that method). */
export async function rejectPayment(id: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("payments").delete().eq("id", id).eq("status", "pending");
  if (error) throw new Error(error.message);
  return { ok: true };
}

interface StaffInput {
  id?: string;
  name: string;
  role: "owner" | "counter_staff";
  email?: string | null;
  pin?: string | null;
}

export async function upsertStaff(input: StaffInput): Promise<{ id: string }> {
  const supa = createAdminClient();
  const fields = { name: input.name, role: input.role, email: input.email ?? null, pin: input.pin ?? null };
  if (input.id) {
    const { error } = await supa.from("staff").update(fields).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await supa.from("staff").insert(fields).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function setStaffActive(id: string, isActive: boolean) {
  const supa = createAdminClient();
  const { error } = await supa.from("staff").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

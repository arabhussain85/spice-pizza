"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ensureOpenShift, nextToken } from "@/lib/shifts";
import type { PaymentMethod, PaymentStatus } from "@/lib/types";

const DEFAULT_SERVER = "AK";

/** The logged-in staff member (falls back gracefully when auth is off). */
async function sessionStaff(): Promise<{ id: string | null; name: string }> {
  try {
    const supa = await createServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return { id: null, name: DEFAULT_SERVER };
    const name = ((user.user_metadata?.name as string) || user.email?.split("@")[0] || DEFAULT_SERVER).trim();
    const admin = createAdminClient();
    const { data: staff } = await admin.from("staff").select("id").eq("email", user.email ?? "").maybeSingle();
    return { id: staff?.id ?? null, name };
  } catch {
    return { id: null, name: DEFAULT_SERVER };
  }
}

async function serviceChargePct(supa: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await supa.from("settings").select("service_charge_pct").eq("id", 1).maybeSingle();
  return Number(data?.service_charge_pct ?? 5);
}

/** The current unsent round for an order, creating one if needed. */
async function currentRound(supa: ReturnType<typeof createAdminClient>, orderId: string) {
  const { data: open } = await supa
    .from("order_rounds")
    .select("*")
    .eq("order_id", orderId)
    .is("sent_to_kitchen_at", null)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return open;

  const { data: last } = await supa
    .from("order_rounds")
    .select("round_number")
    .eq("order_id", orderId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (last?.round_number ?? 0) + 1;
  const { data: created, error } = await supa
    .from("order_rounds")
    .insert({ order_id: orderId, round_number: next })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return created;
}

export async function startOrder(tableId: string): Promise<{ orderId: string }> {
  const supa = createAdminClient();
  const { data: existing } = await supa
    .from("orders")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return { orderId: existing.id };

  const pct = await serviceChargePct(supa);
  const staff = await sessionStaff();
  const shiftId = await ensureOpenShift(supa, staff.name);
  const token = await nextToken(supa, shiftId);
  const { data: order, error } = await supa
    .from("orders")
    .insert({
      table_id: tableId,
      server_name: staff.name,
      server_id: staff.id,
      service_charge_pct: pct,
      shift_id: shiftId,
      token_number: token,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supa.from("order_rounds").insert({ order_id: order.id, round_number: 1 });
  await supa
    .from("restaurant_tables")
    .update({ status: "occupied", opened_at: new Date().toISOString() })
    .eq("id", tableId);
  return { orderId: order.id };
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
}

/** Start a takeaway or delivery order (no table, all customer fields optional). */
async function startOffTable(
  type: "takeaway" | "delivery",
  customer: CustomerInfo,
): Promise<{ orderId: string }> {
  const supa = createAdminClient();
  const staff = await sessionStaff();
  const shiftId = await ensureOpenShift(supa, staff.name);
  const token = await nextToken(supa, shiftId);
  // per-type sequence within the shift (Takeaway #1, Delivery #1, …)
  const { count } = await supa
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("order_type", type);
  const typeNumber = (count ?? 0) + 1;

  const { data: order, error } = await supa
    .from("orders")
    .insert({
      order_type: type,
      server_name: staff.name,
      server_id: staff.id,
      service_charge_pct: 0,
      shift_id: shiftId,
      token_number: token,
      type_number: typeNumber,
      customer_name: customer.name?.trim() || null,
      customer_phone: customer.phone?.trim() || null,
      customer_address: customer.address?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await supa.from("order_rounds").insert({ order_id: order.id, round_number: 1 });
  return { orderId: order.id };
}

/** Update the (optional) customer details on a takeaway/delivery order. */
export async function updateOrderCustomer(
  orderId: string,
  customer: CustomerInfo,
): Promise<{ ok: true }> {
  const supa = createAdminClient();
  const { error } = await supa
    .from("orders")
    .update({
      customer_name: customer.name?.trim() || null,
      customer_phone: customer.phone?.trim() || null,
      customer_address: customer.address?.trim() || null,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function startTakeaway(customer: CustomerInfo): Promise<{ orderId: string }> {
  return startOffTable("takeaway", customer);
}

export async function startDelivery(customer: CustomerInfo): Promise<{ orderId: string }> {
  return startOffTable("delivery", customer);
}

interface NewLineItem {
  menuItemId: string | null;
  name: string;
  size: string | null;
  unitPrice: number;
  quantity: number;
  note?: string | null;
  modifiers?: string[];
}

export async function addLineItem(orderId: string, item: NewLineItem) {
  const supa = createAdminClient();
  const round = await currentRound(supa, orderId);
  const { data, error } = await supa
    .from("order_line_items")
    .insert({
      round_id: round.id,
      menu_item_id: item.menuItemId,
      name_snapshot: item.name,
      size_snapshot: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      note: item.note ?? null,
      modifiers: item.modifiers ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { lineItem: data, roundId: round.id, roundNumber: round.round_number };
}

export async function updateLineItemQuantity(lineItemId: string, quantity: number) {
  const supa = createAdminClient();
  if (quantity <= 0) {
    await supa.from("order_line_items").delete().eq("id", lineItemId);
    return { ok: true, deleted: true };
  }
  const { error } = await supa.from("order_line_items").update({ quantity }).eq("id", lineItemId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteLineItem(lineItemId: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("order_line_items").delete().eq("id", lineItemId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function sendToKitchen(orderId: string) {
  const supa = createAdminClient();
  const round = await currentRound(supa, orderId);
  const { data: items } = await supa.from("order_line_items").select("id").eq("round_id", round.id);
  if (!items || items.length === 0) return { ok: false as const, error: "No items to send." };

  await supa
    .from("order_rounds")
    .update({ sent_to_kitchen_at: new Date().toISOString() })
    .eq("id", round.id);
  // open the next round so the builder immediately shows an empty "Round N+1"
  await supa.from("order_rounds").insert({ order_id: orderId, round_number: round.round_number + 1 });
  return { ok: true as const, roundId: round.id, roundNumber: round.round_number };
}

export async function voidLineItem(lineItemId: string, reason: string) {
  const supa = createAdminClient();
  const staff = await sessionStaff();
  const { error } = await supa
    .from("order_line_items")
    .update({ is_voided: true, void_reason: reason, voided_at: new Date().toISOString(), voided_by: staff.id })
    .eq("id", lineItemId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setDiscount(
  orderId: string,
  discount: { type: "percent" | "fixed"; value: number; reason?: string | null } | null,
) {
  const supa = createAdminClient();
  await supa.from("discounts").delete().eq("order_id", orderId);
  if (discount && discount.value > 0) {
    const { error } = await supa
      .from("discounts")
      .insert({ order_id: orderId, type: discount.type, value: discount.value, reason: discount.reason ?? null });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function validateOwnerPin(pin: string): Promise<boolean> {
  const supa = createAdminClient();
  const { data } = await supa.from("staff").select("id").eq("role", "owner").eq("pin", pin).limit(1);
  return !!(data && data.length);
}

interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  tendered?: number | null;
  screenshotUrl?: string | null;
}

export async function closeAndPay(orderId: string, payments: PaymentInput[]) {
  const supa = createAdminClient();
  const hasPending = payments.some((p) => p.method === "jazzcash" || p.method === "easypaisa" || p.method === "card");
  const rows = payments.map((p) => {
    const online = p.method === "jazzcash" || p.method === "easypaisa" || p.method === "card";
    const status: PaymentStatus = online ? "pending" : "confirmed";
    return {
      order_id: orderId,
      method: p.method,
      amount: p.amount,
      tendered: p.method === "cash" && p.tendered ? p.tendered : null,
      status,
      screenshot_url: p.screenshotUrl ?? null,
      confirmed_at: online ? null : new Date().toISOString(),
    };
  });
  const { error: pe } = await supa.from("payments").insert(rows);
  if (pe) throw new Error(pe.message);

  if (hasPending) {
    // Keep order open in pending_payment state until owner approves in Admin panel
    await supa.from("orders").update({ status: "open" }).eq("id", orderId);
    return { ok: true as const, pending: true as const };
  }

  const { data: order, error: oe } = await supa
    .from("orders")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("table_id")
    .single();
  if (oe) throw new Error(oe.message);

  // free the table + tidy any empty trailing round
  if (order?.table_id) {
    await supa.from("restaurant_tables").update({ status: "free", opened_at: null }).eq("id", order.table_id);
  }
  const { data: emptyRounds } = await supa
    .from("order_rounds")
    .select("id,order_line_items(id)")
    .eq("order_id", orderId);
  for (const r of (emptyRounds ?? []) as Array<{ id: string; order_line_items: unknown[] }>) {
    if ((r.order_line_items ?? []).length === 0) {
      await supa.from("order_rounds").delete().eq("id", r.id);
    }
  }
  return { ok: true as const, pending: false as const };
}

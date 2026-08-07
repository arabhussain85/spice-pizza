"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const NIL = "00000000-0000-0000-0000-000000000000";

async function codeMatches(code: string): Promise<boolean> {
  const supa = createAdminClient();
  const { data } = await supa.from("settings").select("dev_code").eq("id", 1).maybeSingle();
  const dev = (data?.dev_code as string) ?? "";
  return dev !== "" && code.trim() === dev;
}

/** Unlock the dev panel (server-side check of the special code). */
export async function verifyDevCode(code: string): Promise<boolean> {
  return codeMatches(code);
}

export async function getDevCode(): Promise<string> {
  const supa = createAdminClient();
  const { data } = await supa.from("settings").select("dev_code").eq("id", 1).maybeSingle();
  return (data?.dev_code as string) ?? "";
}

export async function setDevCode(code: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("settings").update({ dev_code: code.trim() }).eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Wipe all order activity — orders, rounds, line items, payments, discounts,
 * shifts and daily summaries — and free every table. Keeps menu, settings, staff.
 * Re-checks the code server-side so it can't be triggered without it.
 */
export async function devResetOrders(code: string): Promise<{ ok: boolean; error?: string; cleared?: number }> {
  if (!(await codeMatches(code))) return { ok: false, error: "Wrong dev code." };
  const supa = createAdminClient();
  const { count } = await supa.from("orders").select("id", { count: "exact", head: true });

  await supa.from("payments").delete().neq("id", NIL);
  await supa.from("discounts").delete().neq("id", NIL);
  await supa.from("order_line_items").delete().neq("id", NIL);
  await supa.from("order_rounds").delete().neq("id", NIL);
  await supa.from("orders").delete().neq("id", NIL);
  await supa.from("restaurant_tables").update({ status: "free", opened_at: null }).neq("id", NIL);
  await supa.from("shifts").delete().neq("id", NIL);
  await supa.from("daily_summaries").delete().neq("day", "1900-01-01");

  return { ok: true, cleared: count ?? 0 };
}

/** End any open shift and free tables without deleting history (soft "close day"). */
export async function devCloseAllShifts(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await codeMatches(code))) return { ok: false, error: "Wrong dev code." };
  const supa = createAdminClient();
  await supa.from("shifts").update({ closed_at: new Date().toISOString() }).is("closed_at", null);
  await supa.from("restaurant_tables").update({ status: "free", opened_at: null }).neq("id", NIL);
  return { ok: true };
}

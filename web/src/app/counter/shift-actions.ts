"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenShift, ensureOpenShift } from "@/lib/shifts";

export interface ShiftStatus {
  open: boolean;
  shiftId?: string;
  openedAt?: string;
  orders?: number;
}

/** Is the shop currently open? Includes the active shift id + order count. */
export async function getShiftStatus(): Promise<ShiftStatus> {
  const supa = createAdminClient();
  const open = await getOpenShift(supa);
  if (!open) return { open: false };
  const { count } = await supa.from("orders").select("id", { count: "exact", head: true }).eq("shift_id", open.id);
  return { open: true, shiftId: open.id, openedAt: open.opened_at, orders: count ?? 0 };
}

/** Open the shop (starts a shift; tokens reset to #1). No-op if already open. */
export async function openShift(): Promise<{ ok: true; shiftId: string }> {
  const supa = createAdminClient();
  const id = await ensureOpenShift(supa);
  return { ok: true, shiftId: id };
}

/** Close the shop. Refuses while orders are still open. Returns the shift id for the Z-report. */
export async function closeShift(): Promise<{ ok: true; shiftId: string } | { ok: false; error: string }> {
  const supa = createAdminClient();
  const open = await getOpenShift(supa);
  if (!open) return { ok: false, error: "Shop is not open." };

  const { count: stillOpen } = await supa
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", open.id)
    .eq("status", "open");
  if ((stillOpen ?? 0) > 0) {
    return { ok: false, error: `${stillOpen} order(s) still open — close or cancel them before closing the shop.` };
  }

  const { error } = await supa.from("shifts").update({ closed_at: new Date().toISOString() }).eq("id", open.id);
  if (error) throw new Error(error.message);
  return { ok: true, shiftId: open.id };
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/** Update global pricing/permission settings (service role — bypasses RLS). */
export async function updateServiceSettings(patch: {
  service_charge_pct?: number;
  discounts_role?: "owner" | "any";
}) {
  const supa = createAdminClient();
  const { error } = await supa.from("settings").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** The owner PIN used to authorize discounts (stored on the owner staff row). */
export async function getDiscountPin(): Promise<string> {
  const supa = createAdminClient();
  const { data } = await supa.from("staff").select("pin").eq("role", "owner").limit(1).maybeSingle();
  return data?.pin ?? "";
}

export async function setDiscountPin(pin: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("staff").update({ pin }).eq("role", "owner");
  if (error) throw new Error(error.message);
  return { ok: true };
}

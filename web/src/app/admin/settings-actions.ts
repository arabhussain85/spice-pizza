"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { signCounterToken } from "@/lib/counter-session";

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

/** The 4-digit PIN used to unlock the counter terminal (stored in settings). */
export async function getCounterPin(): Promise<string> {
  const supa = createAdminClient();
  const { data } = await supa.from("settings").select("counter_pin").eq("id", 1).maybeSingle();
  return (data?.counter_pin as string) ?? "1234";
}

export async function setCounterPin(pin: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("settings").update({ counter_pin: pin }).eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Server-side check for the counter terminal PIN (keeps the PIN off the client). */
export async function validateCounterPin(pin: string): Promise<boolean> {
  const supa = createAdminClient();
  const { data } = await supa.from("settings").select("counter_pin").eq("id", 1).maybeSingle();
  return pin === ((data?.counter_pin as string) ?? "1234");
}

/** Validate the PIN and, on success, return a signed session token for the cookie. */
export async function counterLogin(pin: string): Promise<{ ok: boolean; token?: string }> {
  if (!(await validateCounterPin(pin))) return { ok: false };
  return { ok: true, token: await signCounterToken() };
}

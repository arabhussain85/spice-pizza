import type { createAdminClient } from "@/lib/supabase/admin";

type Supa = ReturnType<typeof createAdminClient>;

export interface Shift {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
}

/** The current open shift (shop is "open"), or null if the shop is closed. */
export async function getOpenShift(supa: Supa): Promise<Shift | null> {
  const { data } = await supa
    .from("shifts")
    .select("*")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Shift) ?? null;
}

/** Ensure a shift is open (auto-opens one if the shop was never opened). Returns its id. */
export async function ensureOpenShift(supa: Supa, by?: string | null): Promise<string> {
  const open = await getOpenShift(supa);
  if (open) return open.id;
  const { data, error } = await supa.from("shifts").insert({ opened_by: by ?? null }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Next order token within a shift = (orders already started this shift) + 1. Resets each shift. */
export async function nextToken(supa: Supa, shiftId: string): Promise<number> {
  const { count } = await supa.from("orders").select("id", { count: "exact", head: true }).eq("shift_id", shiftId);
  return (count ?? 0) + 1;
}

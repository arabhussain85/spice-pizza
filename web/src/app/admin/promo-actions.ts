"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface PromoInput {
  name: string;
  type: "percent" | "fixed";
  value: number;
  scope: "all" | "category" | "item";
  category_id?: string | null;
  group_key?: string | null;
  ends_at?: string | null;
}

export async function createPromotion(input: PromoInput) {
  const supa = createAdminClient();
  const { error } = await supa.from("promotions").insert({
    name: input.name,
    type: input.type,
    value: input.value,
    scope: input.scope,
    category_id: input.scope === "category" ? input.category_id ?? null : null,
    group_key: input.scope === "item" ? input.group_key ?? null : null,
    ends_at: input.ends_at ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setPromotionActive(id: string, active: boolean) {
  const supa = createAdminClient();
  const { error } = await supa.from("promotions").update({ is_active: active }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletePromotion(id: string) {
  const supa = createAdminClient();
  const { error } = await supa.from("promotions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

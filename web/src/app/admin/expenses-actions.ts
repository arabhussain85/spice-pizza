"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  paid_to: string | null;
  spent_at: string;
}

export async function addExpense(input: {
  category: string;
  amount: number;
  description?: string;
  paid_to?: string;
  spent_at?: string;
}): Promise<{ ok: true }> {
  const supa = createAdminClient();
  const { error } = await supa.from("expenses").insert({
    category: input.category || "Other",
    amount: input.amount,
    description: input.description?.trim() || null,
    paid_to: input.paid_to?.trim() || null,
    spent_at: input.spent_at || new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<{ ok: true }> {
  const supa = createAdminClient();
  const { error } = await supa.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Expenses in [from,to] + the period's revenue (confirmed payments) for net-profit. */
export async function fetchExpenses(
  from: string,
  to: string,
): Promise<{ rows: ExpenseRow[]; total: number; revenue: number }> {
  const supa = createAdminClient();
  const { data } = await supa
    .from("expenses")
    .select("*")
    .gte("spent_at", from)
    .lte("spent_at", to)
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as ExpenseRow[];
  const total = rows.reduce((a, r) => a + Number(r.amount), 0);

  const { data: pays } = await supa
    .from("payments")
    .select("amount")
    .eq("status", "confirmed")
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`);
  const revenue = ((pays ?? []) as { amount: number }[]).reduce((a, p) => a + Number(p.amount), 0);

  return { rows, total, revenue };
}

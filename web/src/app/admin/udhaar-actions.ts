"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface CreditCustomer {
  name: string;
  phone: string | null;
  balance: number;
}
export interface LedgerRow {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  kind: "charge" | "payment";
  note: string | null;
  order_id: string | null;
  created_at: string;
}

/** Outstanding customers = sum(charges) − sum(payments), grouped by phone (or name). */
export async function fetchCreditCustomers(): Promise<CreditCustomer[]> {
  const supa = createAdminClient();
  const { data } = await supa.from("credit_ledger").select("customer_name, customer_phone, amount, kind");
  const map = new Map<string, CreditCustomer>();
  for (const r of (data ?? []) as { customer_name: string; customer_phone: string | null; amount: number; kind: string }[]) {
    const key = (r.customer_phone || r.customer_name).toLowerCase();
    const c = map.get(key) ?? { name: r.customer_name, phone: r.customer_phone, balance: 0 };
    c.balance += r.kind === "charge" ? Number(r.amount) : -Number(r.amount);
    map.set(key, c);
  }
  return [...map.values()].filter((c) => c.balance > 0.01).sort((a, b) => b.balance - a.balance);
}

export async function fetchCreditHistory(name: string, phone: string | null): Promise<LedgerRow[]> {
  const supa = createAdminClient();
  let q = supa.from("credit_ledger").select("*");
  q = phone ? q.eq("customer_phone", phone) : q.eq("customer_name", name);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as LedgerRow[];
}

/** Record a repayment against a customer's balance. */
export async function recordCreditPayment(input: {
  name: string;
  phone?: string | null;
  amount: number;
  note?: string;
}): Promise<{ ok: true }> {
  const supa = createAdminClient();
  const { error } = await supa.from("credit_ledger").insert({
    customer_name: input.name,
    customer_phone: input.phone || null,
    amount: input.amount,
    kind: "payment",
    note: input.note?.trim() || "Repayment",
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function totalOutstanding(): Promise<number> {
  const customers = await fetchCreditCustomers();
  return customers.reduce((a, c) => a + c.balance, 0);
}

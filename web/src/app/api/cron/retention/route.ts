import { createAdminClient } from "@/lib/supabase/admin";
import { billTotals } from "@/lib/order-math";

// Nightly data-lifecycle job (scheduled by vercel.json crons → 02:00 daily):
// 1) roll up each complete past day into daily_summaries
// 2) purge raw orders older than RETENTION_DAYS (cascades rounds/items/payments)
// 3) clear confirmed payment screenshots past a short grace window
// Protected: when CRON_SECRET is set, requires `Authorization: Bearer <secret>`
// (Vercel Cron sends this automatically).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);
const SCREENSHOT_GRACE_DAYS = 3;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

interface ClosedOrder {
  closed_at: string;
  service_charge_pct: number;
  order_rounds: { order_line_items: { name_snapshot: string; quantity: number; unit_price: number; is_voided: boolean }[] }[];
  discounts: { type: "percent" | "fixed"; value: number }[];
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supa = createAdminClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // ── 1. Roll up complete past days not yet summarized ───────────────────────
  const [{ data: closed }, { data: pays }, { data: existing }] = await Promise.all([
    supa
      .from("orders")
      .select("closed_at,service_charge_pct,order_rounds(order_line_items(name_snapshot,quantity,unit_price,is_voided)),discounts(type,value)")
      .eq("status", "closed")
      .lt("closed_at", todayStart.toISOString()),
    supa.from("payments").select("amount,paid_at").eq("status", "confirmed").lt("paid_at", todayStart.toISOString()),
    supa.from("daily_summaries").select("day"),
  ]);

  const have = new Set((existing ?? []).map((r) => (r as { day: string }).day));
  const byDay = new Map<string, { day: string; revenue: number; order_count: number; service_charge_total: number; discount_total: number; tally: Map<string, number> }>();
  for (const o of (closed ?? []) as unknown as ClosedOrder[]) {
    const k = dayKey(o.closed_at);
    if (have.has(k)) continue;
    const lines = o.order_rounds.flatMap((r) => r.order_line_items);
    const d = o.discounts?.[0];
    const t = billTotals(lines, o.service_charge_pct, d ? { type: d.type, value: d.value } : null);
    const g = byDay.get(k) ?? { day: k, revenue: 0, order_count: 0, service_charge_total: 0, discount_total: 0, tally: new Map<string, number>() };
    g.order_count += 1;
    g.service_charge_total += t.service;
    g.discount_total += t.discount;
    for (const li of lines) if (!li.is_voided) g.tally.set(li.name_snapshot, (g.tally.get(li.name_snapshot) ?? 0) + li.quantity);
    byDay.set(k, g);
  }
  for (const p of (pays ?? []) as { amount: number; paid_at: string }[]) {
    const k = dayKey(p.paid_at);
    if (have.has(k) || !byDay.has(k)) continue;
    byDay.get(k)!.revenue += Number(p.amount);
  }
  const summaries = [...byDay.values()].map((g) => ({
    day: g.day,
    revenue: g.revenue,
    order_count: g.order_count,
    avg_order: g.order_count ? Math.round(g.revenue / g.order_count) : 0,
    service_charge_total: g.service_charge_total,
    discount_total: g.discount_total,
    top_items: [...g.tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, qty]) => ({ name, qty })),
  }));
  if (summaries.length) await supa.from("daily_summaries").upsert(summaries, { onConflict: "day" });

  // ── 2. Purge raw orders past the retention window ──────────────────────────
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const { data: aging } = await supa.from("orders").select("id").lt("opened_at", cutoff.toISOString()).in("status", ["closed", "void"]);
  const purgeIds = (aging ?? []).map((o) => (o as { id: string }).id);
  if (purgeIds.length) await supa.from("orders").delete().in("id", purgeIds);

  // ── 3. Clear confirmed payment screenshots past the grace window ───────────
  const grace = new Date(now);
  grace.setDate(grace.getDate() - SCREENSHOT_GRACE_DAYS);
  const { data: shots } = await supa
    .from("payments")
    .select("id")
    .eq("status", "confirmed")
    .not("screenshot_url", "is", null)
    .lt("confirmed_at", grace.toISOString());
  const shotIds = (shots ?? []).map((s) => (s as { id: string }).id);
  if (shotIds.length) await supa.from("payments").update({ screenshot_url: null }).in("id", shotIds);

  return Response.json({
    ok: true,
    rolledUpDays: summaries.length,
    purgedOrders: purgeIds.length,
    screenshotsCleared: shotIds.length,
    retentionDays: RETENTION_DAYS,
  });
}

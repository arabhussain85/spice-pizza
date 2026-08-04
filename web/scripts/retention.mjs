// Data-lifecycle job — keeps the Supabase free tier usable.
// Runs entirely over HTTPS (service role): rollup -> export -> purge -> screenshot cleanup.
// Schedule daily (cron / Supabase scheduled function). Dry-run by default.
//
// Usage:  node scripts/retention.mjs           (dry run — reports what it would do)
//         node scripts/retention.mjs --apply    (perform rollup, export, purge)
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { billTotals } from "../src/lib/order-math";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);
const SCREENSHOT_GRACE_DAYS = 3;
const APPLY = process.argv.includes("--apply");
const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

async function main() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // ---- 1. Roll up each complete past day not yet summarized ----
  const { data: closed } = await supa
    .from("orders")
    .select("id,closed_at,service_charge_pct,order_rounds(order_line_items(name_snapshot,quantity,unit_price,is_voided)),discounts(type,value)")
    .eq("status", "closed")
    .lt("closed_at", todayStart.toISOString());
  const { data: pays } = await supa.from("payments").select("amount,paid_at,status").eq("status", "confirmed").lt("paid_at", todayStart.toISOString());
  const { data: existing } = await supa.from("daily_summaries").select("day");
  const have = new Set((existing ?? []).map((r) => r.day));

  const byDay = new Map();
  for (const o of closed ?? []) {
    const k = dayKey(o.closed_at);
    if (have.has(k)) continue;
    const lines = o.order_rounds.flatMap((r) => r.order_line_items);
    const d = o.discounts?.[0];
    const t = billTotals(lines, o.service_charge_pct, d ? { type: d.type, value: d.value } : null);
    const g = byDay.get(k) ?? { day: k, revenue: 0, order_count: 0, service_charge_total: 0, discount_total: 0, tally: new Map() };
    g.order_count += 1;
    g.service_charge_total += t.service;
    g.discount_total += t.discount;
    for (const li of lines) if (!li.is_voided) g.tally.set(li.name_snapshot, (g.tally.get(li.name_snapshot) ?? 0) + li.quantity);
    byDay.set(k, g);
  }
  for (const p of pays ?? []) {
    const k = dayKey(p.paid_at);
    if (have.has(k) || !byDay.has(k)) continue;
    byDay.get(k).revenue += Number(p.amount);
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
  console.log(`Rollup: ${summaries.length} new daily summaries.`);
  if (APPLY && summaries.length) {
    const { error } = await supa.from("daily_summaries").upsert(summaries, { onConflict: "day" });
    if (error) throw error;
  }

  // ---- 2. Export + purge raw orders past the retention window ----
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const { data: aging } = await supa
    .from("orders")
    .select("*,order_rounds(*,order_line_items(*)),discounts(*),payments(*)")
    .lt("opened_at", cutoff.toISOString())
    .in("status", ["closed", "void"]);
  console.log(`Purge: ${(aging ?? []).length} orders older than ${RETENTION_DAYS} days.`);
  if ((aging ?? []).length) {
    mkdirSync("exports", { recursive: true });
    const file = `exports/orders-before-${cutoff.toISOString().slice(0, 10)}.json`;
    writeFileSync(file, JSON.stringify(aging, null, 2));
    console.log(`  exported -> ${file}`);
    if (APPLY) {
      const ids = aging.map((o) => o.id);
      const { error } = await supa.from("orders").delete().in("id", ids); // cascades rounds/items/discounts/payments
      if (error) throw error;
      console.log(`  deleted ${ids.length} orders (raw detail).`);
    }
  }

  // ---- 3. Clear confirmed payment screenshots past the grace window ----
  const grace = new Date(now);
  grace.setDate(grace.getDate() - SCREENSHOT_GRACE_DAYS);
  const { data: shots } = await supa
    .from("payments")
    .select("id")
    .eq("status", "confirmed")
    .not("screenshot_url", "is", null)
    .lt("confirmed_at", grace.toISOString());
  console.log(`Screenshots: ${(shots ?? []).length} to clear.`);
  if (APPLY && (shots ?? []).length) {
    await supa.from("payments").update({ screenshot_url: null }).in("id", shots.map((s) => s.id));
  }

  console.log(APPLY ? "✓ Retention applied." : "Dry run complete — pass --apply to perform.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

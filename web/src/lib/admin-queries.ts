import type { SupabaseClient } from "@supabase/supabase-js";
import { billTotals } from "./order-math";

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d: Date) => d.toISOString();

interface ClosedOrderRow {
  id: string;
  order_number: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  service_charge_pct: number;
  restaurant_tables: { number: number } | null;
  order_rounds: { order_line_items: { name_snapshot: string; quantity: number; unit_price: number; is_voided: boolean }[] }[];
  discounts: { type: "percent" | "fixed"; value: number }[];
}

const ORDER_SELECT =
  "id,order_number,opened_at,closed_at,status,service_charge_pct,restaurant_tables(number),order_rounds(order_line_items(name_snapshot,quantity,unit_price,is_voided)),discounts(type,value)";

function orderLines(o: ClosedOrderRow) {
  return o.order_rounds.flatMap((r) => r.order_line_items);
}
function orderTotal(o: ClosedOrderRow): number {
  const d = o.discounts?.[0];
  return billTotals(orderLines(o), o.service_charge_pct, d ? { type: d.type, value: d.value } : null).total;
}
function orderItemCount(o: ClosedOrderRow): number {
  return orderLines(o).filter((li) => !li.is_voided).reduce((a, li) => a + li.quantity, 0);
}

async function fetchClosedOrders(supa: SupabaseClient, fromIso: string, toIso?: string) {
  let q = supa.from("orders").select(ORDER_SELECT).eq("status", "closed").gte("closed_at", fromIso).order("closed_at", { ascending: false });
  if (toIso) q = q.lt("closed_at", toIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ClosedOrderRow[];
}

async function confirmedPayments(supa: SupabaseClient, fromIso: string, toIso?: string) {
  let q = supa.from("payments").select("amount,paid_at").eq("status", "confirmed").gte("paid_at", fromIso);
  if (toIso) q = q.lt("paid_at", toIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { amount: number; paid_at: string }[];
}

// ---------------------------------------------------------------------------
export interface TodayData {
  revenue: number;
  revenueDeltaPct: number | null;
  orderCount: number;
  avgOrder: number;
  tablesOccupied: number;
  tablesTotal: number;
  liveTables: { number: number; status: string }[];
  recentBills: { id: string; orderNumber: string; table: number | null; closedAt: string | null; items: number; total: number }[];
}

export async function fetchToday(supa: SupabaseClient): Promise<TodayData> {
  const now = new Date();
  const todayS = dayStart(now);
  const yS = new Date(todayS);
  yS.setDate(yS.getDate() - 1);

  const [tablesRes, ordersRes, pays, closedToday] = await Promise.all([
    supa.from("restaurant_tables").select("id,number,status").order("number"),
    supa.from("orders").select("table_id,order_rounds(order_line_items(quantity,is_voided))").eq("status", "open"),
    confirmedPayments(supa, iso(yS)),
    fetchClosedOrders(supa, iso(todayS)),
  ]);
  const rawTables = (tablesRes.data ?? []) as { id: string; number: number; status: string }[];
  const openOrders = (ordersRes.data ?? []) as Array<{
    table_id: string;
    order_rounds: { order_line_items: { quantity: number; is_voided: boolean }[] }[];
  }>;
  const activeOrderTables = new Set(
    openOrders
      .filter((o) => o.order_rounds.flatMap((r) => r.order_line_items ?? []).some((li) => !li.is_voided && li.quantity > 0))
      .map((o) => o.table_id)
  );

  const tables = rawTables.map((t) => ({
    number: t.number,
    status: activeOrderTables.has(t.id) ? "occupied" : "free",
  }));

  const revenue = pays.filter((p) => new Date(p.paid_at) >= todayS).reduce((a, p) => a + Number(p.amount), 0);
  const revYesterday = pays
    .filter((p) => new Date(p.paid_at) >= yS && new Date(p.paid_at) < todayS)
    .reduce((a, p) => a + Number(p.amount), 0);
  const orderCount = closedToday.length;

  return {
    revenue,
    revenueDeltaPct: revYesterday > 0 ? Math.round(((revenue - revYesterday) / revYesterday) * 100) : null,
    orderCount,
    avgOrder: orderCount ? Math.round(revenue / orderCount) : 0,
    tablesOccupied: tables.filter((t) => t.status === "occupied").length,
    tablesTotal: tables.length,
    liveTables: tables,
    recentBills: closedToday.slice(0, 6).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      table: o.restaurant_tables?.number ?? null,
      closedAt: o.closed_at,
      items: orderItemCount(o),
      total: orderTotal(o),
    })),
  };
}

// ---------------------------------------------------------------------------
export interface RangeData {
  totalRevenue: number;
  prevDeltaPct: number | null;
  orderCount: number;
  avgOrder: number;
  daily: { day: string; label: string; revenue: number }[];
  topItems: { name: string; qty: number }[];
}

export async function fetchRange(supa: SupabaseClient, from: Date, to: Date): Promise<RangeData> {
  const fromS = dayStart(from);
  const toEnd = dayStart(to);
  toEnd.setDate(toEnd.getDate() + 1); // exclusive
  const spanDays = Math.max(1, Math.round((toEnd.getTime() - fromS.getTime()) / 86400000));
  const prevFrom = new Date(fromS);
  prevFrom.setDate(prevFrom.getDate() - spanDays);

  const [pays, prevPays, closed] = await Promise.all([
    confirmedPayments(supa, iso(fromS), iso(toEnd)),
    confirmedPayments(supa, iso(prevFrom), iso(fromS)),
    fetchClosedOrders(supa, iso(fromS), iso(toEnd)),
  ]);

  const totalRevenue = pays.reduce((a, p) => a + Number(p.amount), 0);
  const prevRevenue = prevPays.reduce((a, p) => a + Number(p.amount), 0);

  const daily: RangeData["daily"] = [];
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(fromS);
    d.setDate(d.getDate() + i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const rev = pays
      .filter((p) => new Date(p.paid_at) >= d && new Date(p.paid_at) < next)
      .reduce((a, p) => a + Number(p.amount), 0);
    daily.push({ day: iso(d), label: d.toLocaleDateString("en-US", { weekday: "narrow" }), revenue: rev });
  }

  const tally = new Map<string, number>();
  for (const o of closed)
    for (const li of orderLines(o))
      if (!li.is_voided) tally.set(li.name_snapshot, (tally.get(li.name_snapshot) ?? 0) + li.quantity);
  const topItems = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

  return {
    totalRevenue,
    prevDeltaPct: prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null,
    orderCount: closed.length,
    avgOrder: closed.length ? Math.round(totalRevenue / closed.length) : 0,
    daily,
    topItems,
  };
}

// ---------------------------------------------------------------------------
export interface OrderHistoryRow {
  id: string;
  orderNumber: string;
  table: number | null;
  openedAt: string;
  closedAt: string | null;
  status: string;
  items: number;
  total: number;
}

export async function fetchOrderHistory(
  supa: SupabaseClient,
  opts: { from?: Date; to?: Date; tableNumber?: number } = {},
): Promise<OrderHistoryRow[]> {
  let q = supa.from("orders").select(ORDER_SELECT).order("opened_at", { ascending: false }).limit(100);
  if (opts.from) q = q.gte("opened_at", iso(dayStart(opts.from)));
  if (opts.to) {
    const e = dayStart(opts.to);
    e.setDate(e.getDate() + 1);
    q = q.lt("opened_at", iso(e));
  }
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as unknown as ClosedOrderRow[];
  if (opts.tableNumber) rows = rows.filter((o) => o.restaurant_tables?.number === opts.tableNumber);
  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    table: o.restaurant_tables?.number ?? null,
    openedAt: o.opened_at,
    closedAt: o.closed_at,
    status: o.status,
    items: orderItemCount(o),
    total: orderTotal(o),
  }));
}

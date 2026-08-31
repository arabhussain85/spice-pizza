"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchRange, type RangeData } from "@/lib/admin-queries";
import { formatRs, formatCompact } from "@/lib/money";
import { Card } from "@/components/ui";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CounterReportsPage() {
  const supaRef = useRef(createClient());
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);

  const [from, setFrom] = useState(isoDate(weekAgo));
  const [to, setTo] = useState(isoDate(today));
  const [data, setData] = useState<RangeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchRange(supaRef.current, new Date(from), new Date(to)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Date Range", `${from} to ${to}`],
      ["Total Revenue", data.totalRevenue],
      ["Order Count", data.orderCount],
      ["Avg Order Value", data.avgOrder],
      [],
      ["Daily Revenue Breakup"],
      ["Date", "Label", "Revenue (Rs)"],
      ...data.daily.map((d) => [d.day, d.label, d.revenue]),
      [],
      ["Top Selling Items"],
      ["Item Name", "Quantity Sold"],
      ...data.topItems.map((t) => [t.name, t.qty]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bites_pizza_report_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxRev = Math.max(1, ...(data?.daily ?? []).map((d) => d.revenue));
  const rangeLabel = `${new Date(from).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} – ${new Date(to).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })}`;

  return (
    <div className="min-h-screen bg-[#FCF9F5]" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ── Top Nav ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-[56px] flex items-center justify-between px-6 md:px-10 bg-[#fff8f7] border-b border-[#e4beba] shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/counter"
            className="flex items-center gap-1 text-sm font-semibold text-[#605e5b] hover:text-[#af101a] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>arrow_back</span>
            Back to Counter
          </Link>
          <span className="h-4 w-px bg-[#e4beba]" />
          <div className="text-xl font-bold text-[#af101a]">
            Daily Reports
          </div>
        </div>

        <button
          onClick={exportCSV}
          disabled={!data}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E7D32] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-[#1B5E20] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>download</span>
          Export CSV Report
        </button>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto pt-20 pb-12 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Sales &amp; Performance Reports</h1>
            <p className="text-xs text-[#605e5b] mt-0.5">{rangeLabel}</p>
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-2 text-sm bg-white p-2 rounded-2xl border border-[#e4beba] shadow-2xs">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-[#e4beba] bg-[#fff8f7] px-3 py-1.5 text-xs outline-none focus:border-[#af101a]"
            />
            <span className="text-xs text-[#605e5b] font-medium">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-[#e4beba] bg-[#fff8f7] px-3 py-1.5 text-xs outline-none focus:border-[#af101a]"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-[#ffdad6] bg-[#fff0ef] p-4 text-sm text-[#af101a]">
            {error.includes("schema cache") ? "Database connection error." : error}
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-5 bg-white border border-[#e4beba]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#605e5b]">Total Revenue</div>
            <div className="mt-2 text-3xl font-black text-[#af101a]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              {formatRs(data?.totalRevenue ?? 0)}
            </div>
            {data?.prevDeltaPct != null && (
              <span
                className={
                  "inline-block mt-2 rounded-full px-2 py-0.5 text-[11px] font-bold " +
                  (data.prevDeltaPct >= 0 ? "bg-[#e8f5e9] text-[#2E7D32]" : "bg-[#fff0ef] text-[#af101a]")
                }
              >
                {data.prevDeltaPct >= 0 ? "+" : ""}
                {data.prevDeltaPct}% vs prev period
              </span>
            )}
          </Card>

          <Card className="p-5 bg-white border border-[#e4beba]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#605e5b]">Completed Orders</div>
            <div className="mt-2 text-3xl font-black text-[#1A1A1A]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              {data?.orderCount ?? 0}
            </div>
          </Card>

          <Card className="p-5 bg-white border border-[#e4beba]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#605e5b]">Average Order Value</div>
            <div className="mt-2 text-3xl font-black text-[#1A1A1A]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
              {formatRs(data?.avgOrder ?? 0)}
            </div>
          </Card>
        </div>

        {/* Revenue Chart Card */}
        <Card className="p-6 bg-white border border-[#e4beba] mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1A1A] mb-4">Daily Breakdown</h2>

          <div className="flex h-44 items-end justify-between gap-2 pt-6">
            {(data?.daily ?? []).map((d, i) => {
              const isMax = d.revenue === maxRev && d.revenue > 0;
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#605e5b]">{d.revenue > 0 ? formatCompact(d.revenue) : ""}</span>
                  <div
                    className={"w-full rounded-t-md transition-all " + (isMax ? "bg-[#af101a]" : "bg-[#ffe9e7]")}
                    style={{ height: `${Math.max(4, (d.revenue / maxRev) * 120)}px` }}
                  />
                  <span className="text-[10px] font-semibold text-[#605e5b]">{d.label || String(i + 1)}</span>
                </div>
              );
            })}
            {(!data || data.daily.length === 0) && <div className="text-sm text-[#605e5b]">No data in range.</div>}
          </div>
        </Card>

        {/* Top Sellers Card */}
        <Card className="p-6 bg-white border border-[#e4beba]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1A1A] mb-4">Top Selling Items</h2>
          <div className="divide-y divide-[#e4beba]/40">
            {(data?.topItems ?? []).map((t, i) => (
              <div key={t.name} className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-[#605e5b] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-semibold text-[#1A1A1A]">{t.name}</span>
                </div>
                <span className="font-bold text-[#af101a] bg-[#fff0ef] px-2.5 py-1 rounded-lg border border-[#e4beba] text-xs">
                  {t.qty} sold
                </span>
              </div>
            ))}
            {data && data.topItems.length === 0 && <div className="text-sm text-[#605e5b]">No sales recorded in this range.</div>}
          </div>
        </Card>
      </main>
    </div>
  );
}

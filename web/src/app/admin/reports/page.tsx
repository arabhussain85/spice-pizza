"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchRange, type RangeData } from "@/lib/admin-queries";
import { formatRs, formatCompact } from "@/lib/money";
import { Card } from "@/components/ui";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
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

  const maxRev = Math.max(1, ...(data?.daily ?? []).map((d) => d.revenue));
  const rangeLabel = `${new Date(from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(
    to,
  ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="text-sm text-muted">{rangeLabel}</div>
      </header>

      {/* date range */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="flex-1 rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50"
        />
        <span className="text-muted">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1 rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      {/* revenue + chart */}
      <Card className="mt-4 p-4">
        <div className="text-sm text-muted">Revenue</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-3xl font-bold">{formatRs(data?.totalRevenue ?? 0)}</span>
          {data?.prevDeltaPct != null && (
            <span
              className={
                "rounded-full px-2 py-1 text-xs font-medium " +
                (data.prevDeltaPct >= 0 ? "bg-free-tint text-free-dark" : "bg-brand-tint text-brand")
              }
            >
              {data.prevDeltaPct >= 0 ? "+" : ""}
              {data.prevDeltaPct}%
            </span>
          )}
        </div>

        <div className="mt-5 flex h-40 items-end justify-between gap-1.5">
          {(data?.daily ?? []).map((d, i) => {
            const isMax = d.revenue === maxRev && d.revenue > 0;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{d.revenue > 0 ? formatCompact(d.revenue) : ""}</span>
                <div
                  className={"w-full rounded-t-md " + (isMax ? "bg-brand" : "bg-brand-tint-2")}
                  style={{ height: `${Math.max(2, (d.revenue / maxRev) * 120)}px` }}
                />
                <span className="text-[10px] text-muted">{d.label || String(i + 1)}</span>
              </div>
            );
          })}
          {(!data || data.daily.length === 0) && <div className="text-sm text-muted">No data.</div>}
        </div>
      </Card>

      {/* orders + avg */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted">Orders</div>
          <div className="mt-1 text-3xl font-bold">{data?.orderCount ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Avg order</div>
          <div className="mt-1 text-3xl font-bold">{formatRs(data?.avgOrder ?? 0)}</div>
        </Card>
      </div>

      {/* top sellers */}
      <Card className="mt-4 p-4">
        <h2 className="font-bold">Top sellers</h2>
        <div className="mt-3 space-y-2">
          {(data?.topItems ?? []).map((t, i) => (
            <div key={t.name} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 font-medium">{t.name}</span>
              <span className="font-semibold tabular-nums">{t.qty}</span>
            </div>
          ))}
          {data && data.topItems.length === 0 && <div className="text-sm text-muted">No sales in this range.</div>}
        </div>
      </Card>
    </div>
  );
}

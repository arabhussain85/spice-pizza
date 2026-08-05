"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchToday, type TodayData } from "@/lib/admin-queries";
import { formatRs } from "@/lib/money";
import { formatClock, formatLongDate, greeting } from "@/lib/time";
import { Avatar, Card, Pill, StatCard, Button } from "@/components/ui";

export default function AdminTodayPage() {
  const supaRef = useRef(createClient());
  const [data, setData] = useState<TodayData | null>(null);
  const [ownerName, setOwnerName] = useState("Owner");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setData(await fetchToday(supaRef.current));
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const supa = supaRef.current;
    refetch();
    supa
      .from("staff")
      .select("name")
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data?.name && setOwnerName(data.name));

    const channel = supa
      .channel("admin-today")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, refetch)
      .subscribe();
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => {
      supa.removeChannel(channel);
      clearInterval(tick);
    };
  }, [refetch]);

  const updatedAgo = updatedAt
    ? (() => {
        const s = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
        if (s < 60) return "just now";
        return `${Math.floor(s / 60)}m ago`;
      })()
    : "";

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted">{formatLongDate(now)}</span>
          <h1 className="text-2xl font-black tracking-tight text-ink mt-0.5">
            {greeting(now)}, {ownerName} 👋
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={ownerName} size={42} />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand shadow-xs">
          {error.includes("schema cache") ? "Database not set up yet — run schema.sql then seed." : error}
        </div>
      )}

      {/* Main Revenue Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-red-950 p-6 text-white shadow-lg shadow-brand/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-red-200">Revenue Today</span>
          <Pill tone="neutral" className="bg-white/20 text-white font-mono text-[11px]">Live Sync {updatedAgo}</Pill>
        </div>
        <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tight">
          {formatRs(data?.revenue ?? 0)}
        </div>
        
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/15 text-xs text-red-100">
          <div className="flex items-center gap-2">
            {data?.revenueDeltaPct != null && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 font-bold text-white">
                {data.revenueDeltaPct >= 0 ? "↑ +" : "↓ "}
                {data.revenueDeltaPct}% vs yesterday
              </span>
            )}
          </div>
          <Link href="/admin/reports" className="font-bold hover:underline">
            View Analytics →
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Orders Today"
          value={data?.orderCount ?? 0}
          subtext={`Avg ticket: ${formatRs(data?.avgOrder ?? 0)}`}
          icon="📦"
        />
        <StatCard
          title="Active Occupancy"
          value={`${data?.tablesOccupied ?? 0} / ${data?.tablesTotal ?? 0}`}
          subtext={`${(data?.tablesTotal ?? 0) - (data?.tablesOccupied ?? 0)} tables available for guests`}
          icon="🪑"
        />
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/admin/settings/receipt">
          <Card className="p-4 text-center hover:border-brand/40 hover:bg-cream/40 transition-all cursor-pointer">
            <div className="text-2xl mb-1">🧾</div>
            <div className="text-xs font-bold text-ink">Receipt Customizer</div>
          </Card>
        </Link>
        <Link href="/admin/settings/printer">
          <Card className="p-4 text-center hover:border-brand/40 hover:bg-cream/40 transition-all cursor-pointer">
            <div className="text-2xl mb-1">🖨️</div>
            <div className="text-xs font-bold text-ink">Printer Section</div>
          </Card>
        </Link>
        <Link href="/admin/menu">
          <Card className="p-4 text-center hover:border-brand/40 hover:bg-cream/40 transition-all cursor-pointer">
            <div className="text-2xl mb-1">🍕</div>
            <div className="text-xs font-bold text-ink">Menu Editor</div>
          </Card>
        </Link>
        <Link href="/admin/payments">
          <Card className="p-4 text-center hover:border-brand/40 hover:bg-cream/40 transition-all cursor-pointer">
            <div className="text-2xl mb-1">💳</div>
            <div className="text-xs font-bold text-ink">Payment Approvals</div>
          </Card>
        </Link>
      </div>

      {/* Live Floor Plan Matrix */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-ink">Live Floor Grid</h2>
            <p className="text-xs text-muted">Table statuses updated real-time</p>
          </div>
          <Link href="/counter" className="text-xs font-bold text-brand hover:underline">
            Open Counter Terminal →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-1">
          {(data?.liveTables ?? []).map((t) => (
            <div
              key={t.number}
              className={
                "grid h-11 w-11 place-items-center rounded-xl text-sm font-extrabold shadow-2xs transition-transform hover:scale-105 " +
                (t.status === "occupied" ? "bg-brand text-white shadow-brand/20" : "bg-free-tint text-free-dark border border-green-200")
              }
            >
              T{t.number}
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Closed Bills */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-sm uppercase tracking-wider text-ink">Recent Closed Bills</h2>
          <Link href="/admin/orders" className="text-xs font-bold text-brand hover:underline">
            All Order History →
          </Link>
        </div>
        <div className="divide-y divide-hairline">
          {(data?.recentBills ?? []).map((b) => (
            <div key={b.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-bold text-ink">Table {b.table ?? "—"}</div>
                <div className="text-xs text-muted">
                  {b.closedAt ? formatClock(new Date(b.closedAt)) : ""} · {b.items} items
                </div>
              </div>
              <div className="font-black text-brand text-sm">{formatRs(b.total)}</div>
            </div>
          ))}
          {data && data.recentBills.length === 0 && (
            <div className="py-6 text-center text-xs font-semibold text-muted">No closed bills recorded today yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

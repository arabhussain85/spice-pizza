"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchToday, type TodayData } from "@/lib/admin-queries";
import { formatRs } from "@/lib/money";
import { formatClock, formatLongDate, greeting } from "@/lib/time";
import { Avatar, Card, Pill } from "@/components/ui";

export default function AdminTodayPage() {
  const supaRef = useRef(createClient());
  const [data, setData] = useState<TodayData | null>(null);
  const [ownerName, setOwnerName] = useState("there");
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
        return `${Math.floor(s / 60)} min ago`;
      })()
    : "";

  return (
    <div>
      <header className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted">{formatLongDate(now)}</div>
          <h1 className="text-2xl font-bold">
            {greeting(now)}, {ownerName}
          </h1>
        </div>
        <Avatar name={ownerName} />
      </header>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet — run schema.sql then seed." : error}
        </div>
      )}

      {/* revenue */}
      <div className="mt-5 rounded-2xl bg-brand p-5 text-white shadow-sm">
        <div className="text-sm opacity-90">Revenue today</div>
        <div className="mt-1 text-4xl font-bold tracking-tight">{formatRs(data?.revenue ?? 0)}</div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          {data?.revenueDeltaPct != null && (
            <span className="rounded-full bg-white/20 px-2 py-1 font-medium">
              {data.revenueDeltaPct >= 0 ? "+" : ""}
              {data.revenueDeltaPct}% vs yesterday
            </span>
          )}
          <span className="opacity-80">Updated {updatedAgo}</span>
        </div>
      </div>

      {/* stat cards */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted">Orders today</div>
          <div className="mt-1 text-3xl font-bold">{data?.orderCount ?? 0}</div>
          <div className="mt-1 text-xs text-muted">avg {formatRs(data?.avgOrder ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Tables occupied</div>
          <div className="mt-1 text-3xl font-bold">
            {data?.tablesOccupied ?? 0}
            <span className="text-lg text-muted">/{data?.tablesTotal ?? 0}</span>
          </div>
          <div className="mt-1 text-xs text-muted">
            {(data?.tablesTotal ?? 0) - (data?.tablesOccupied ?? 0)} free now
          </div>
        </Card>
      </div>

      {/* live tables */}
      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Live tables</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-brand">
            Details
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data?.liveTables ?? []).map((t) => (
            <span
              key={t.number}
              className={
                "grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold " +
                (t.status === "occupied" ? "bg-brand text-white" : "bg-free-tint text-free-dark")
              }
            >
              {t.number}
            </span>
          ))}
        </div>
      </Card>

      {/* recent bills */}
      <Card className="mt-4 p-4">
        <h2 className="font-bold">Recent closed bills</h2>
        <div className="mt-3 divide-y divide-hairline">
          {(data?.recentBills ?? []).map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm font-semibold">Table {b.table ?? "—"}</div>
                <div className="text-xs text-muted">
                  {b.closedAt ? formatClock(new Date(b.closedAt)) : ""} · {b.items} items
                </div>
              </div>
              <div className="font-semibold">{formatRs(b.total)}</div>
            </div>
          ))}
          {data && data.recentBills.length === 0 && (
            <div className="py-4 text-sm text-muted">No closed bills yet today.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

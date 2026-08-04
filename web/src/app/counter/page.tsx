"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchTableGrid, type TableGridRow } from "@/lib/queries";
import { Avatar, Logo, Pill } from "@/components/ui";
import { formatClock } from "@/lib/time";
import { TableCard } from "./TableCard";

export default function CounterHomePage() {
  const supaRef = useRef(createClient());
  const [rows, setRows] = useState<TableGridRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const refetch = useCallback(async () => {
    try {
      const data = await fetchTableGrid(supaRef.current);
      setRows(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refetch();
    const supa = supaRef.current;
    const channel = supa
      .channel("counter-grid")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_rounds" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_line_items" }, refetch)
      .subscribe();
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      supa.removeChannel(channel);
      clearInterval(tick);
    };
  }, [refetch]);

  const freeCount = rows?.filter((r) => r.table.status !== "occupied").length ?? 0;

  return (
    <div>
      {/* top bar */}
      <header className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-lg font-bold">Spice Pizza</span>
        </Link>
        <div className="flex items-center gap-4">
          {rows && <Pill tone="green">{freeCount} tables free</Pill>}
          <span className="text-sm tabular-nums text-muted">{formatClock(now)}</span>
          <Avatar name="AK" />
        </div>
      </header>

      {/* heading */}
      <div className="mt-6 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Tables</h1>
        <span className="text-sm text-muted">Tap a table to take an order</span>
      </div>

      {/* states */}
      {error && (
        <div className="mt-6 rounded-2xl border border-brand/30 bg-brand-tint/50 p-5 text-sm text-brand">
          Couldn’t load tables: {error}
          {error.includes("schema cache") && (
            <div className="mt-1 text-brand-dark">
              The database isn’t set up yet — run <code>supabase/schema.sql</code> then seed.
            </div>
          )}
        </div>
      )}

      {!rows && !error && <div className="mt-6 text-sm text-muted">Loading tables…</div>}

      {rows && rows.length === 0 && !error && (
        <div className="mt-6 text-sm text-muted">No tables yet — run the seed script.</div>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <TableCard key={row.table.id} row={row} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

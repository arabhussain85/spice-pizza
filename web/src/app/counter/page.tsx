"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTableGrid, type TableGridRow } from "@/lib/queries";
import { formatClock } from "@/lib/time";
import { TableCard } from "./TableCard";
import { ShopControl } from "./ShopControl";
import { OffTableOrders } from "./OffTableOrders";
import { cn } from "@/components/ui";
import { useConfirm } from "@/components/Confirm";

export default function CounterHomePage() {
  const { confirm, notify } = useConfirm();
  const supaRef = useRef(createClient());
  const [rows, setRows] = useState<TableGridRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
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
  const occupiedCount = rows ? rows.length - freeCount : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#FCF9F5]" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ── Top Nav ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-[56px] flex items-center justify-between px-6 md:px-10 bg-[#fff8f7] border-b border-[#e4beba] shadow-sm">
        <div className="text-xl font-bold text-[#af101a]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Spice Pizza · Counter
        </div>
        <div className="flex items-center gap-3">
          {rows && (
            <>
              <span className="hidden sm:flex items-center gap-1.5 bg-[#fff0ef] text-[#2E7D32] text-xs font-semibold px-3 py-1 rounded-full border border-green-200">
                <span className="w-2 h-2 rounded-full bg-[#2E7D32] status-pulse" />
                {freeCount} Free
              </span>
              {occupiedCount > 0 && (
                <span className="hidden sm:flex items-center gap-1.5 bg-[#fff0ef] text-[#D32F2F] text-xs font-semibold px-3 py-1 rounded-full border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-[#D32F2F]" />
                  {occupiedCount} Occupied
                </span>
              )}
            </>
          )}
          <span suppressHydrationWarning className="hidden sm:block text-xs font-mono font-semibold text-[#605e5b] bg-[#fff0ef] px-3 py-1.5 rounded-lg border border-[#e4beba]">
            {mounted ? formatClock(now) : ""}
          </span>
          <ShopControl />
          <a
            href="/counter/reports"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#e4beba] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#fff0ef] hover:border-[#af101a]/40 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>analytics</span>
            Daily Reports
          </a>
          {/* Lock terminal — clears PIN cookie and returns to counter login */}
          <button
            onClick={() => {
              document.cookie = "counter_pin=; path=/; max-age=0";
              window.location.href = "/login/counter";
            }}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#e4beba] px-3 py-1.5 text-xs font-semibold text-[#605e5b] hover:bg-[#ffe9e7] hover:text-[#af101a] hover:border-[#af101a]/40 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>lock</span>
            Lock Terminal
          </button>
        </div>
      </header>


      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="flex-1 pt-[56px] flex">
        {/* Table Grid */}
        <section className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Table Overview
            </h1>
            <div className="flex gap-2">
              <span className="bg-[#fff0ef] text-[#2E7D32] text-xs font-semibold px-3 py-1 rounded-full border border-green-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                {freeCount} Free
              </span>
              <span className="bg-[#fff0ef] text-[#D32F2F] text-xs font-semibold px-3 py-1 rounded-full border border-red-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D32F2F]" />
                {occupiedCount} Occupied
              </span>
            </div>
          </div>

          {/* Takeaway & delivery (off-table) orders */}
          <OffTableOrders />

          {/* States */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 mb-6">
              Couldn&apos;t load tables: {error}
            </div>
          )}
          {!rows && !error && (
            <div className="py-16 text-center text-sm font-semibold text-[#605e5b]">
              <span className="material-symbols-outlined text-4xl text-[#e4beba] block mb-3">table_restaurant</span>
              Loading table grid…
            </div>
          )}
          {rows && rows.length === 0 && !error && (
            <div className="py-16 text-center text-sm font-semibold text-[#605e5b]">
              <span className="material-symbols-outlined text-4xl text-[#e4beba] block mb-3">table_restaurant</span>
              No tables found — run the seed script.
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rows.map((row) => (
                <TableCard key={row.table.id} row={row} now={now} />
              ))}
            </div>
          )}
        </section>

        {/* ── Kitchen Queue & Pending Payments Panel (Desktop) ── */}
        <aside className="hidden lg:flex flex-col w-[360px] shrink-0 bg-[#fff0ef] border-l border-[#e4beba] shadow-panel h-[calc(100vh-56px)] sticky top-[56px] p-5 overflow-y-auto">
          {/* Pending Payments Section */}
          <div className="mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#af101a] mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>hourglass_top</span>
              Pending Payments
            </h3>
            <div className="bg-white rounded-xl border border-[#e4beba] p-3 text-xs text-[#605e5b] shadow-2xs">
              Online/digital payments (JazzCash / EasyPaisa / Card) remain pending approval by Owner in Admin panel before bill completion.
            </div>
          </div>

          {/* Kitchen Queue Section */}
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1A1A1A] mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>outdoor_grill</span>
            Kitchen Queue
          </h3>
          <div className="flex flex-col gap-3">
            {rows && rows.filter(r => r.table.status === "occupied").length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-[#605e5b] opacity-60">
                <span className="material-symbols-outlined text-4xl">outdoor_grill</span>
                <span className="text-xs font-medium">No active kitchen orders</span>
              </div>
            )}
            {rows?.filter(r => r.table.status === "occupied").map(row => (
              <div key={row.table.id} className="bg-white p-3 rounded-xl border border-[#e4beba] shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#ffe9e7] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#af101a]" style={{fontSize:'18px'}}>local_pizza</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#1A1A1A]">Table {row.table.number}</div>
                  <div className="text-[10px] text-[#605e5b]">#{row.order?.order_number?.slice(-4) ?? "—"}</div>
                </div>
                <span className="material-symbols-outlined text-[#FFA000]" style={{fontSize:'18px'}}>outdoor_grill</span>
              </div>
            ))}
          </div>

          {/* Footer Actions & Dev Reset */}
          <div className="mt-auto pt-4 border-t border-[#e4beba] space-y-2">
            <button
              onClick={refetch}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#af101a] text-xs font-bold h-10 rounded-xl border border-[#e4beba] hover:bg-[#ffe9e7] transition-colors active:scale-[0.98]"
            >
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>refresh</span>
              Refresh Status
            </button>
            {process.env.NODE_ENV !== "production" && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Reset all data?",
                    message: "Wipes all orders, payments and resets every table to zero. This cannot be undone.",
                    confirmLabel: "Wipe everything",
                    danger: true,
                  });
                  if (!ok) return;
                  const res = await fetch("/api/reset-demo", { method: "POST" });
                  if (res.ok) {
                    await notify({ title: "Done", message: "System completely reset." });
                    refetch();
                  } else {
                    await notify({ title: "Failed", message: "Could not reset the system.", danger: true });
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#fff0ef] text-[#d32f2f] text-xs font-bold h-10 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined" style={{fontSize:'18px'}}>delete_forever</span>
                DEV RESET DATA
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex justify-around items-center px-4 py-2 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] rounded-t-2xl" style={{paddingBottom:'env(safe-area-inset-bottom,8px)'}}>
        <a className="flex flex-col items-center justify-center bg-[#ffe9e7] text-[#af101a] rounded-full px-5 py-1 active:scale-90 transition-transform" href="/counter">
          <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1", fontSize:'24px'}}>grid_view</span>
          <span className="text-[10px] font-semibold mt-0.5">Tables</span>
        </a>
        <a className="flex flex-col items-center justify-center text-[#605e5b] px-4 py-1 rounded-lg active:scale-90 transition-transform" href="/counter/reports">
          <span className="material-symbols-outlined" style={{fontSize:'24px'}}>analytics</span>
          <span className="text-[10px] font-semibold mt-0.5">Reports</span>
        </a>
      </nav>
    </div>
  );
}

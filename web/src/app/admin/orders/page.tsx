"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderHistory, type OrderHistoryRow } from "@/lib/admin-queries";
import { fetchOrderFull, type OrderFull } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { Card, Pill, cn } from "@/components/ui";

export default function OrderHistoryPage() {
  const supaRef = useRef(createClient());
  const [rows, setRows] = useState<OrderHistoryRow[]>([]);
  const [table, setTable] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<OrderFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchOrderHistory(supaRef.current, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        tableNumber: table ? Number(table) : undefined,
      });
      setRows(rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [from, to, table]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Order history</h1>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50" />
        <input
          value={table}
          onChange={(e) => setTable(e.target.value)}
          inputMode="numeric"
          placeholder="Table #"
          className="col-span-2 rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map((o) => (
          <Card key={o.id} className="p-3">
            <button className="flex w-full items-center justify-between text-left" onClick={async () => setDetail(await fetchOrderFull(supaRef.current, o.id))}>
              <div>
                <div className="text-sm font-semibold">
                  Table {o.table ?? "—"} · #{o.orderNumber}
                </div>
                <div className="text-xs text-muted">
                  {o.closedAt ? formatClock(new Date(o.closedAt)) : formatClock(new Date(o.openedAt))} · {o.items} items
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={o.status === "closed" ? "green" : o.status === "open" ? "amber" : "red"}>{o.status}</Pill>
                <span className="font-semibold">{formatRs(o.total)}</span>
              </div>
            </button>
          </Card>
        ))}
        {rows.length === 0 && !error && <div className="py-8 text-center text-sm text-muted">No orders found.</div>}
      </div>

      {detail && <OrderDetailModal full={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function OrderDetailModal({ full, onClose }: { full: OrderFull; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Table {full.table?.number ?? "—"}</h3>
          <span className="text-xs text-muted">#{full.order.order_number}</span>
        </div>
        <div className="mt-4 space-y-4">
          {full.rounds.map((r) => (
            <div key={r.id}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Round {r.round_number}</div>
              <div className="mt-1.5 space-y-1.5">
                {r.order_line_items.map((li) => (
                  <div key={li.id} className="flex items-start gap-2 text-sm">
                    <span className="w-6 text-muted">{li.quantity}×</span>
                    <div className={cn("flex-1", li.is_voided && "text-muted line-through")}>
                      {li.name_snapshot}
                      {li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                      {li.is_voided && <span className="ml-1 text-xs">(void: {li.void_reason})</span>}
                    </div>
                    <span className={cn("font-medium tabular-nums", li.is_voided && "text-muted line-through")}>
                      {formatRs(li.unit_price * li.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderHistory, type OrderHistoryRow } from "@/lib/admin-queries";
import { fetchOrderFull, type OrderFull } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { billTotals } from "@/lib/order-math";
import { Card, Pill, cn } from "@/components/ui";
import { useConfirm } from "@/components/Confirm";
import { deleteOrder, toggleVoidLineItem, updateOrderLineItem } from "../order-actions";

export default function OrderHistoryPage() {
  const { confirm } = useConfirm();
  const supaRef = useRef(createClient());
  const [rows, setRows] = useState<OrderHistoryRow[]>([]);
  const [table, setTable] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<OrderFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchOrderHistory(supaRef.current, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        tableNumber: table ? Number(table) : undefined,
      }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [from, to, table]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => setDetail(await fetchOrderFull(supaRef.current, id));
  const reloadDetail = async () => {
    if (detail) setDetail(await fetchOrderFull(supaRef.current, detail.order.id));
    await load();
  };

  async function quickDelete(id: string, label: string) {
    const ok = await confirm({
      title: `Delete order ${label}?`,
      message: "This permanently removes it and its receipt.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await deleteOrder(id);
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A]">Order history</h1>
      <p className="text-sm text-[#605e5b]">Tap an order to view, edit items, reprint, or delete.</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50" />
        <input value={table} onChange={(e) => setTable(e.target.value)} inputMode="numeric" placeholder="Table #" className="col-span-2 rounded-xl border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand/50" />
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map((o) => (
          <Card key={o.id} className="flex items-center gap-2 p-3">
            <button className="flex flex-1 items-center justify-between text-left" onClick={() => openDetail(o.id)}>
              <div>
                <div className="text-sm font-semibold">Table {o.table ?? "—"} · #{o.orderNumber}</div>
                <div className="text-xs text-muted">
                  {o.closedAt ? formatClock(new Date(o.closedAt)) : formatClock(new Date(o.openedAt))} · {o.items} items
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={o.status === "closed" ? "green" : o.status === "open" ? "amber" : "red"}>{o.status}</Pill>
                <span className="font-semibold">{formatRs(o.total)}</span>
              </div>
            </button>
            <button
              onClick={() => quickDelete(o.id, `#${o.orderNumber}`)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[#8f6f6c] hover:bg-brand-tint hover:text-brand"
              aria-label="delete order"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
            </button>
          </Card>
        ))}
        {rows.length === 0 && !error && <div className="py-8 text-center text-sm text-muted">No orders found.</div>}
      </div>

      {detail && (
        <OrderDetailModal
          full={detail}
          onClose={() => setDetail(null)}
          reload={reloadDetail}
          onDelete={async () => { await deleteOrder(detail.order.id); setDetail(null); await load(); }}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ full, onClose, reload, onDelete }: { full: OrderFull; onClose: () => void; reload: () => Promise<void>; onDelete: () => Promise<void> }) {
  const { confirm } = useConfirm();
  const [busy, setBusy] = useState(false);
  const allLines = full.rounds.flatMap((r) => r.order_line_items);
  const totals = billTotals(allLines, full.order.service_charge_pct, full.discount ? { type: full.discount.type, value: full.discount.value } : null);

  const withBusy = (fn: () => Promise<unknown>) => async () => { setBusy(true); try { await fn(); await reload(); } finally { setBusy(false); } };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Table {full.table?.number ?? "—"} · #{full.order.order_number}</h3>
          <Pill tone={full.order.status === "closed" ? "green" : full.order.status === "open" ? "amber" : "red"}>{full.order.status}</Pill>
        </div>

        <div className="mt-4 space-y-4">
          {full.rounds.map((r) => (
            <div key={r.id}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Round {r.round_number}</div>
              <div className="mt-1.5 space-y-2">
                {r.order_line_items.map((li) => (
                  <div key={li.id} className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <button disabled={busy} onClick={withBusy(() => updateOrderLineItem(li.id, li.quantity - 1))} className="grid h-6 w-6 place-items-center rounded bg-black/5 hover:bg-black/10">−</button>
                      <span className="w-5 text-center tabular-nums">{li.quantity}</span>
                      <button disabled={busy} onClick={withBusy(() => updateOrderLineItem(li.id, li.quantity + 1))} className="grid h-6 w-6 place-items-center rounded bg-black/5 hover:bg-black/10">+</button>
                    </div>
                    <div className={cn("flex-1 min-w-0", li.is_voided && "text-muted line-through")}>
                      <span className="truncate">{li.name_snapshot}{li.size_snapshot ? ` (${li.size_snapshot})` : ""}</span>
                    </div>
                    <span className={cn("font-medium tabular-nums", li.is_voided && "text-muted line-through")}>{formatRs(li.unit_price * li.quantity)}</span>
                    <button
                      disabled={busy}
                      onClick={withBusy(() => toggleVoidLineItem(li.id, !li.is_voided))}
                      className={cn("text-xs font-semibold", li.is_voided ? "text-free-dark" : "text-[#8f6f6c] hover:text-brand")}
                    >
                      {li.is_voided ? "unvoid" : "void"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
          <span className="text-sm text-muted">Total ({full.order.service_charge_pct}% svc)</span>
          <span className="text-xl font-bold text-brand">{formatRs(totals.total)}</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={() => window.open(`/api/print/bill/${full.order.id}`, "_blank")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm font-semibold text-ink hover:bg-cream/40">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>print</span> Reprint
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({ title: "Delete this order?", message: "It is permanently removed, along with its receipt.", confirmLabel: "Delete", danger: true });
              if (ok) await onDelete();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-tint px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-tint-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span> Delete order
          </button>
        </div>
      </div>
    </div>
  );
}

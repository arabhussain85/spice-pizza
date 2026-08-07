"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { TableGridRow } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { Icon } from "@/components/Icon";
import { startOrder } from "./actions";
import { cancelOrder } from "@/app/admin/order-actions";
import { useConfirm } from "@/components/Confirm";

export function TableCard({ row, now }: { row: TableGridRow; now: Date }) {
  const router = useRouter();
  const { prompt, notify } = useConfirm();
  const [pending, startTransition] = useTransition();
  const occupied = row.table.status === "occupied" && row.order;

  function onStart() {
    startTransition(async () => {
      const { orderId } = await startOrder(row.table.id);
      router.push(`/counter/order/${orderId}`);
    });
  }

  async function onCancel() {
    const pin = await prompt({
      title: `Cancel Table ${row.table.number}'s order?`,
      message: "The table is freed and nothing is charged. Enter the owner PIN to confirm.",
      inputLabel: "Owner PIN",
      placeholder: "PIN",
      required: true,
      confirmLabel: "Cancel order",
      cancelLabel: "Keep order",
      danger: true,
    });
    if (!pin) return;
    startTransition(async () => {
      const res = await cancelOrder(row.order!.id, { pin });
      if (!res.ok) await notify({ title: "Not cancelled", message: res.error, danger: true });
    });
  }

  // long-occupied tables (>60m) flag amber like the design
  const mins = occupied && row.order ? (now.getTime() - new Date(row.order.opened_at).getTime()) / 60000 : 0;
  const stale = mins >= 60;

  return (
    <div
      className={
        "relative flex h-[200px] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-bright p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-1 " +
        (occupied ? "bg-status-occupied/5" : "")
      }
    >
      <div className={"absolute left-0 top-0 h-full w-1 " + (occupied ? "bg-status-occupied" : "bg-status-free")} />

      <div className="mb-4 flex items-start justify-between">
        <h2 className="flex items-center gap-2 font-headline-md text-headline-md text-charcoal-text">
          Table {row.table.number}
          {occupied ? (
            <span className="rounded-full bg-status-occupied px-2 py-0.5 font-label-sm text-label-sm text-white">Occupied</span>
          ) : (
            <span className="rounded-full border border-status-free/20 bg-status-free/10 px-2 py-0.5 font-label-sm text-label-sm text-status-free">
              Free
            </span>
          )}
        </h2>
        {occupied && (
          <span className={"flex items-center gap-1 font-label-bold text-label-bold " + (stale ? "text-status-pending" : "text-tertiary")}>
            <Icon name={stale ? "warning" : "schedule"} className="text-sm" />
            {formatDuration(row.order!.opened_at, now)}
          </span>
        )}
      </div>

      {occupied ? (
        <>
          <div className="flex-1">
            <div className="mb-1 text-sm text-secondary">Current Bill · {row.order!.rounds} {row.order!.rounds === 1 ? "round" : "rounds"}</div>
            <div className="font-display-price text-display-price text-primary">{formatRs(row.order!.runningTotal)}</div>
          </div>
          <div className="mt-auto flex gap-2">
            <button
              onClick={() => router.push(`/counter/order/${row.order!.id}`)}
              className="flex h-touch-target flex-1 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-surface-container font-label-bold text-label-bold text-primary transition-colors duration-100 hover:bg-surface-variant active:scale-95"
            >
              <Icon name="add_circle" /> Add items
            </button>
            <button
              onClick={() => router.push(`/counter/order/${row.order!.id}/bill`)}
              className="flex h-touch-target flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-label-bold text-label-bold text-on-primary shadow-sm transition-colors duration-100 hover:bg-surface-tint active:scale-95"
            >
              <Icon name="receipt_long" /> Bill &amp; close
            </button>
            <button
              onClick={onCancel}
              disabled={pending}
              title="Cancel order"
              aria-label="Cancel order"
              className="flex h-touch-target w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-tertiary transition-colors duration-100 hover:border-primary/40 hover:bg-status-occupied/10 hover:text-primary active:scale-95 disabled:opacity-50"
            >
              <Icon name="cancel" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-secondary opacity-50">
              <Icon name="deck" className="text-4xl" />
              <span>Ready for seating</span>
            </div>
          </div>
          <div className="mt-auto">
            <button
              onClick={onStart}
              disabled={pending}
              className="flex h-touch-target w-full items-center justify-center gap-2 rounded-lg border border-charcoal-text bg-cream-bg font-label-bold text-label-bold text-charcoal-text transition-colors duration-100 hover:bg-surface-container-low active:scale-95 disabled:opacity-50"
            >
              <Icon name="play_arrow" /> {pending ? "Starting…" : "Start order"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

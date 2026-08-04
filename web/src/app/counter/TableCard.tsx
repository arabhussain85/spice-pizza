"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { TableGridRow } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { Button, Pill, cn } from "@/components/ui";
import { startOrder } from "./actions";

export function TableCard({ row, now }: { row: TableGridRow; now: Date }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const occupied = row.table.status === "occupied" && row.order;

  function onStart() {
    startTransition(async () => {
      const { orderId } = await startOrder(row.table.id);
      router.push(`/counter/order/${orderId}`);
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-surface p-5 shadow-sm min-h-52",
        occupied ? "border-brand/60" : "border-hairline",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl font-bold leading-none">{row.table.number}</span>
        {occupied ? (
          <Pill tone="red">{formatDuration(row.order!.opened_at, now)}</Pill>
        ) : (
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-free" aria-label="free" />
        )}
      </div>

      <div className="mt-auto pt-4">
        {occupied ? (
          <>
            <div className="text-sm font-medium text-muted">
              Occupied · {row.order!.rounds} {row.order!.rounds === 1 ? "round" : "rounds"}
            </div>
            <div className="mt-1 text-3xl font-bold text-brand">{formatRs(row.order!.runningTotal)}</div>
            <div className="mt-3 grid gap-2">
              <Button variant="soft" onClick={() => router.push(`/counter/order/${row.order!.id}`)}>
                Add items
              </Button>
              <Button variant="primary" onClick={() => router.push(`/counter/order/${row.order!.id}/bill`)}>
                Bill &amp; close
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-free-dark">Free</div>
            <div className="mt-3">
              <Button variant="soft-green" className="w-full" onClick={onStart} disabled={pending}>
                {pending ? "Starting…" : "Start order"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { TableGridRow } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { cn } from "@/components/ui";
import { startOrder } from "./actions";

export function TableCard({ row, now }: { row: TableGridRow; now: Date }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const occupied = row.table.status === "occupied" && row.order;
  const durationMins = row.order ? Math.floor((now.getTime() - new Date(row.order.opened_at).getTime()) / 60000) : 0;
  const isLong = durationMins >= 60;

  function onStart() {
    startTransition(async () => {
      const { orderId } = await startOrder(row.table.id);
      router.push(`/counter/order/${orderId}`);
    });
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-4 h-[200px] overflow-hidden card-lift",
        "bg-[#fff8f7] shadow-card",
        occupied
          ? "border-[#e4beba] bg-[#fff8f7]"
          : "border-[#e4beba]"
      )}
    >
      {/* Left status accent bar */}
      <div
        className={cn(
          "absolute top-0 left-0 w-1 h-full rounded-l-xl",
          occupied ? "bg-[#D32F2F]" : "bg-[#2E7D32]"
        )}
      />

      {/* Card Header */}
      <div className="flex justify-between items-start mb-4 pl-2">
        <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
          Table {row.table.number}
          {occupied ? (
            <span className="bg-[#D32F2F] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Occupied
            </span>
          ) : (
            <span className="bg-green-50 text-[#2E7D32] border border-green-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Free
            </span>
          )}
        </h2>
        {occupied && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              isLong ? "text-[#FFA000]" : "text-[#51595b]"
            )}
          >
            {isLong && <span className="material-symbols-outlined" style={{fontSize:'14px'}}>warning</span>}
            {!isLong && <span className="material-symbols-outlined" style={{fontSize:'14px'}}>schedule</span>}
            {durationMins >= 60
              ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
              : `${durationMins}m`}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="flex-1 pl-2">
        {occupied ? (
          <>
            <div className="text-xs text-[#605e5b] mb-0.5">Current Bill</div>
            <div
              className="text-3xl font-bold text-[#af101a] tracking-tight"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
            >
              {formatRs(row.order!.runningTotal)}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#605e5b] opacity-50">
            <span className="material-symbols-outlined text-4xl">deck</span>
            <span className="text-sm mt-1">Ready for seating</span>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="mt-auto pl-2 flex gap-2">
        {occupied ? (
          <>
            <button
              onClick={() => router.push(`/counter/order/${row.order!.id}`)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#ffe9e7] text-[#af101a] text-xs font-semibold h-11 rounded-lg border border-[#e4beba] hover:bg-[#ffe2de] transition-colors active:scale-[0.97]"
            >
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>add_circle</span>
              Add items
            </button>
            <button
              onClick={() => router.push(`/counter/order/${row.order!.id}/bill`)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#af101a] text-white text-xs font-semibold h-11 rounded-lg hover:bg-[#8b0d14] transition-colors active:scale-[0.97] shadow-sm"
            >
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>receipt_long</span>
              Bill & close
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            disabled={pending}
            className="w-full flex items-center justify-center gap-1.5 bg-[#FCF9F5] border border-[#1A1A1A] text-[#1A1A1A] text-xs font-semibold h-11 rounded-lg hover:bg-[#fff0ef] transition-colors active:scale-[0.97] disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>play_arrow</span>
            {pending ? "Starting…" : "Start order"}
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getShiftStatus, openShift, closeShift, type ShiftStatus } from "./shift-actions";
import { useConfirm } from "@/components/Confirm";
import { printSilent } from "@/lib/print-client";



/** Open Shop / Close Shop control. Closing prints the daily Z-report and resets the order token counter. */
export function ShopControl() {
  const { confirm, notify } = useConfirm();
  const [status, setStatus] = useState<ShiftStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getShiftStatus());
    } catch {
      /* ignore — header stays neutral */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleOpen() {
    setBusy(true);
    try {
      await openShift();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    const ok = await confirm({
      title: "Close the shop for today?",
      message: "This prints the daily Z-report and resets order tokens to #1.",
      confirmLabel: "Close shop",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await closeShift();
      if (!res.ok) {
        await notify({ title: "Can't close yet", message: res.error, danger: true });
        return;
      }
      // Printed silently via a hidden iframe (no visible tab); @page 80mm auto.
      printSilent(`/api/print/zreport/${res.shiftId}/html`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return status.open ? (
    <div className="hidden sm:flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-[#fff0ef] px-3 py-1 text-xs font-semibold text-[#2E7D32]">
        <span className="h-2 w-2 rounded-full bg-[#2E7D32] status-pulse" />
        Shop Open
      </span>
      <button
        onClick={handleClose}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#af101a]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#af101a] transition-all hover:bg-[#ffe9e7] disabled:opacity-50"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>store</span>
        {busy ? "Closing…" : "Close Shop"}
      </button>
    </div>
  ) : (
    <button
      onClick={handleOpen}
      disabled={busy}
      className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#2E7D32]/40 bg-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#256628] disabled:opacity-50"
    >
      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>store</span>
      {busy ? "Opening…" : "Open Shop"}
    </button>
  );
}

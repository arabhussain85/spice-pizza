"use client";

import { useCallback, useEffect, useState } from "react";
import { getShiftStatus, openShift, closeShift, type ShiftStatus } from "./shift-actions";
import { useConfirm } from "@/components/Confirm";

/** Opens a PDF in a new tab and immediately triggers the Windows print dialog. */
function autoPrint(pdfPath: string, win?: Window | null) {
  const target = win ?? window.open("", "_blank");
  if (!target) { window.open(pdfPath, "_blank"); return; }
  const html = [
    '<!DOCTYPE html><html><head><title>Printing\u2026</title>',
    '<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111}',
    'iframe{position:fixed;inset:0;width:100%;height:100%;border:none}',
    '#msg{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);',
    'color:#fff;font:600 14px/1.6 system-ui;text-align:center;pointer-events:none}</style>',
    '</head><body>',
    '<div id="msg">\uD83D\uDDA8\uFE0F Preparing print\u2026<br><small>Print dialog will open automatically.</small></div>',
    '<iframe id="f" src="' + pdfPath + '"></iframe>',
    '<script>',
    'var f=document.getElementById("f"),m=document.getElementById("msg"),done=false;',
    'function go(){if(done)return;done=true;m.style.display="none";',
    'try{f.contentWindow.focus();f.contentWindow.print();}catch(e){window.print();}}',
    'f.onload=function(){setTimeout(go,600);};setTimeout(go,3500);',
    '<\/script></body></html>',
  ].join('');
  target.document.write(html);
  target.document.close();
}

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
    // Open the print tab now (on the click) so it isn't popup-blocked after the awaits.
    const printWin = window.open("", "_blank");
    const ok = await confirm({
      title: "Close the shop for today?",
      message: "This prints the daily Z-report and resets order tokens to #1.",
      confirmLabel: "Close shop",
      cancelLabel: "Not yet",
    });
    if (!ok) {
      printWin?.close();
      return;
    }
    setBusy(true);
    try {
      const res = await closeShift();
      if (!res.ok) {
        printWin?.close();
        await notify({ title: "Can't close yet", message: res.error, danger: true });
        return;
      }
      const url = `/api/print/zreport/${res.shiftId}`;
      autoPrint(url, printWin);
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

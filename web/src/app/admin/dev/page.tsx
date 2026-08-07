"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { useConfirm } from "@/components/Confirm";
import { verifyDevCode, devResetOrders, devCloseAllShifts } from "../dev-actions";

export default function DevControlPage() {
  const { confirm, notify } = useConfirm();
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function unlock() {
    setBusy(true);
    setErr(null);
    try {
      if (await verifyDevCode(code)) setUnlocked(true);
      else setErr("Wrong dev code.");
    } finally {
      setBusy(false);
    }
  }

  async function resetData() {
    const ok = await confirm({
      title: "Reset ALL order data?",
      message:
        "Deletes every order, round, item, payment, discount, shift and daily summary, and frees all tables.\n\nThe menu, settings and staff are kept. This cannot be undone.",
      confirmLabel: "Wipe order data",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await devResetOrders(code);
      if (res.ok) await notify({ title: "Done", message: `Cleared ${res.cleared ?? 0} order(s). System is fresh.` });
      else await notify({ title: "Failed", message: res.error ?? "Unknown error", danger: true });
    } finally {
      setBusy(false);
    }
  }

  async function closeShifts() {
    const ok = await confirm({
      title: "Close all open shifts?",
      message: "Ends any open shift and frees all tables. History is kept.",
      confirmLabel: "Close shifts",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await devCloseAllShifts(code);
      await notify(
        res.ok
          ? { title: "Done", message: "All shifts closed and tables freed." }
          : { title: "Failed", message: res.error ?? "Unknown error", danger: true },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Developer Controls</h1>
        <p className="mt-1 text-xs text-muted">
          Dangerous, code-gated maintenance actions. <Link href="/admin/settings" className="text-brand underline">Change the dev code</Link> under Access &amp; Security.
        </p>
      </div>

      {!unlocked ? (
        <Card className="max-w-sm space-y-3 p-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">Enter dev code</label>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="Special code"
            autoFocus
            className="w-full rounded-xl border border-hairline bg-cream/30 px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          />
          {err && <p className="text-xs font-bold text-brand">{err}</p>}
          <Button className="w-full" loading={busy} disabled={!code} onClick={unlock}>
            Unlock
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand/30 bg-brand-tint/40 px-4 py-2.5 text-xs font-semibold text-brand">
            Dev controls unlocked. Actions here are irreversible — use with care.
          </div>

          <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink">Reset all order data</h2>
              <p className="text-xs text-muted">Wipe orders / payments / shifts and free tables. Keeps menu &amp; settings.</p>
            </div>
            <Button variant="primary" loading={busy} onClick={resetData}>Reset data</Button>
          </Card>

          <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink">Close all shifts</h2>
              <p className="text-xs text-muted">End any open shift and free tables, keeping the history.</p>
            </div>
            <Button variant="outline" loading={busy} onClick={closeShifts}>Close shifts</Button>
          </Card>
        </div>
      )}
    </div>
  );
}

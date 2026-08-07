"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { Icon } from "@/components/Icon";
import { PaymentSuccess } from "@/components/PaymentSuccess";
import { useConfirm } from "@/components/Confirm";
import { confirmPayment, rejectPayment } from "../actions";

interface PayRow {
  id: string;
  method: string;
  amount: number;
  status: string;
  screenshot_url: string | null;
  paid_at: string;
  confirmed_at: string | null;
  orders: { order_number: string; restaurant_tables: { number: number } | null } | null;
}

const methodIcon: Record<string, string> = {
  cash: "payments",
  card: "credit_card",
  jazzcash: "smartphone",
  easypaisa: "smartphone",
  other: "account_balance_wallet",
};

export default function PaymentsPage() {
  const { confirm } = useConfirm();
  const supaRef = useRef(createClient());
  const [pending, setPending] = useState<PayRow[]>([]);
  const [verified, setVerified] = useState<PayRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string; amount: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supa = supaRef.current;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const sel = "id,method,amount,status,screenshot_url,paid_at,confirmed_at,orders(order_number,restaurant_tables(number))";
      const [p, v] = await Promise.all([
        supa.from("payments").select(sel).eq("status", "pending").order("paid_at", { ascending: false }),
        supa
          .from("payments")
          .select(sel)
          .eq("status", "confirmed")
          .in("method", ["jazzcash", "easypaisa", "other"])
          .gte("confirmed_at", todayStart.toISOString())
          .order("confirmed_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      setPending((p.data ?? []) as unknown as PayRow[]);
      setVerified((v.data ?? []) as unknown as PayRow[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const supa = supaRef.current;
    load();
    const ch = supa
      .channel("admin-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
  }, [load]);

  const verifiedTotal = verified.reduce((a, p) => a + Number(p.amount), 0);
  const pendingTotal = pending.reduce((a, p) => a + Number(p.amount), 0);

  async function verify(p: PayRow) {
    setBusy(p.id);
    try {
      await confirmPayment(p.id);
      setSuccess({ orderNumber: p.orders?.order_number?.replace(/^SP-/, "") ?? "—", amount: p.amount });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-charcoal-text">Payment Verification</h1>
          <p className="text-sm text-secondary">Review & verify online payments (JazzCash / EasyPaisa).</p>
        </div>
        <span className="material-symbols-outlined rounded-full bg-primary-tint p-2 text-primary">verified_user</span>
      </header>

      {/* summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-outline-variant bg-surface-bright p-4">
          <div className="flex items-center gap-2 text-status-pending">
            <Icon name="hourglass_top" className="text-lg" />
            <span className="font-label-bold text-label-bold uppercase">Pending</span>
          </div>
          <div className="mt-1 font-headline-md text-headline-md text-charcoal-text">{pending.length}</div>
          <div className="text-xs text-secondary">{formatRs(pendingTotal)} awaiting</div>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-bright p-4">
          <div className="flex items-center gap-2 text-status-free">
            <Icon name="task_alt" className="text-lg" />
            <span className="font-label-bold text-label-bold uppercase">Verified today</span>
          </div>
          <div className="mt-1 font-headline-md text-headline-md text-charcoal-text">{verified.length}</div>
          <div className="text-xs text-secondary">{formatRs(verifiedTotal)} confirmed</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-primary/30 bg-primary-tint/50 p-4 text-sm text-primary">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      {/* pending queue */}
      <section className="space-y-3">
        <h2 className="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Awaiting verification</h2>
        {pending.map((p) => (
          <div key={p.id} className="rounded-xl border border-outline-variant bg-surface-bright p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-3">
              {p.screenshot_url ? (
                <button
                  onClick={() => setPreview(p.screenshot_url)}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-outline-variant"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.screenshot_url} alt="payment proof" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-variant text-secondary">
                  <Icon name={methodIcon[p.method] ?? "receipt"} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-label-bold capitalize text-charcoal-text">{p.method}</span>
                  <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">Online</span>
                </div>
                <div className="text-xs text-secondary">
                  Table {p.orders?.restaurant_tables?.number ?? "—"} · #{p.orders?.order_number?.replace(/^SP-/, "") ?? "?"} · {formatClock(new Date(p.paid_at))}
                </div>
              </div>
              <div className="font-display-price text-2xl font-bold text-primary">{formatRs(p.amount)}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Reject this payment?",
                    message: "It is removed and the bill stays unpaid.",
                    confirmLabel: "Reject",
                    danger: true,
                  });
                  if (ok) {
                    await rejectPayment(p.id);
                    await load();
                  }
                }}
                className="flex h-touch-target flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface font-label-bold text-label-bold text-tertiary hover:bg-surface-container-low active:scale-95"
              >
                <Icon name="close" /> Reject
              </button>
              <button
                onClick={() => verify(p)}
                disabled={busy === p.id}
                className="flex h-touch-target flex-[2] items-center justify-center gap-2 rounded-lg bg-status-free font-label-bold text-label-bold text-white shadow-sm hover:brightness-95 active:scale-95 disabled:opacity-60"
              >
                <Icon name="verified" /> {busy === p.id ? "Verifying…" : "Verify payment"}
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-outline-variant py-10 text-center text-sm text-secondary">
            All online payments are verified. 🎉
          </div>
        )}
      </section>

      {/* verified today */}
      {verified.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Verified today</h2>
          <div className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-bright">
            {verified.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon name="check_circle" className="text-status-free" fill />
                  <div>
                    <div className="text-sm font-semibold capitalize text-charcoal-text">{p.method}</div>
                    <div className="text-xs text-secondary">
                      Table {p.orders?.restaurant_tables?.number ?? "—"} · {p.confirmed_at ? formatClock(new Date(p.confirmed_at)) : ""}
                    </div>
                  </div>
                </div>
                <div className="font-semibold text-charcoal-text">{formatRs(p.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="payment proof" className="max-h-[85vh] max-w-full rounded-lg" />
        </div>
      )}

      {success && (
        <PaymentSuccess
          orderNumber={success.orderNumber}
          amount={success.amount}
          primaryLabel="Done"
          onClose={() => setSuccess(null)}
          onPrint={() => setSuccess(null)}
        />
      )}
    </div>
  );
}

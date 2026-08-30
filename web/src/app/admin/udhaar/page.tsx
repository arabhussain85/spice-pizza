"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { Button, Card } from "@/components/ui";
import { useConfirm } from "@/components/Confirm";
import {
  fetchCreditCustomers,
  fetchCreditHistory,
  recordCreditPayment,
  type CreditCustomer,
  type LedgerRow,
} from "../udhaar-actions";

export default function UdhaarPage() {
  const { prompt, notify } = useConfirm();
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [open, setOpen] = useState<CreditCustomer | null>(null);
  const [history, setHistory] = useState<LedgerRow[]>([]);

  const load = useCallback(async () => {
    setCustomers(await fetchCreditCustomers());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openCustomer(c: CreditCustomer) {
    setOpen(c);
    setHistory(await fetchCreditHistory(c.name, c.phone));
  }

  async function collect(c: CreditCustomer) {
    const val = await prompt({
      title: `Collect from ${c.name}`,
      message: `Outstanding: ${formatRs(c.balance)}. Enter amount received.`,
      inputLabel: "Amount (Rs.)",
      placeholder: String(Math.round(c.balance)),
      required: true,
      confirmLabel: "Record payment",
    });
    if (!val) return;
    const amt = Number(val);
    if (!(amt > 0)) {
      await notify({ title: "Invalid amount", message: "Enter a number greater than 0.", danger: true });
      return;
    }
    await recordCreditPayment({ name: c.name, phone: c.phone, amount: amt });
    await load();
    if (open && (open.phone || open.name) === (c.phone || c.name)) await openCustomer({ ...c, balance: c.balance - amt });
  }

  const outstanding = customers.reduce((a, c) => a + c.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">Udhaar (Credit)</h1>
          <p className="mt-1 text-xs text-muted">Customers who owe money — take payments and see history.</p>
        </div>
        <Card className="px-4 py-2 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Total outstanding</div>
          <div className="text-xl font-black text-brand">{formatRs(outstanding)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-hairline">
          {customers.map((c) => (
            <div key={(c.phone || c.name)} className="flex items-center gap-3 p-3.5">
              <button onClick={() => openCustomer(c)} className="min-w-0 flex-1 text-left">
                <div className="text-sm font-semibold text-ink">{c.name}</div>
                <div className="text-xs text-muted">{c.phone || "no phone"}</div>
              </button>
              <div className="text-sm font-bold text-brand">{formatRs(c.balance)}</div>
              <Button size="sm" onClick={() => collect(c)}>Collect</Button>
            </div>
          ))}
          {customers.length === 0 && <div className="p-8 text-center text-sm text-muted">No outstanding udhaar. 🎉</div>}
        </div>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">{open.name}</h3>
                <div className="text-xs text-muted">{open.phone || "no phone"} · balance {formatRs(open.balance)}</div>
              </div>
              <button onClick={() => setOpen(null)} className="text-muted hover:text-brand" aria-label="close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-cream/40 px-3 py-2 text-sm">
                  <div>
                    <span className={h.kind === "charge" ? "font-semibold text-brand" : "font-semibold text-free-dark"}>
                      {h.kind === "charge" ? "Took credit" : "Paid"}
                    </span>
                    <span className="ml-2 text-xs text-muted">{formatClock(new Date(h.created_at))}{h.note ? ` · ${h.note}` : ""}</span>
                  </div>
                  <span className={h.kind === "charge" ? "font-bold text-brand" : "font-bold text-free-dark"}>
                    {h.kind === "charge" ? "+" : "−"}{formatRs(h.amount)}
                  </span>
                </div>
              ))}
              {history.length === 0 && <div className="py-6 text-center text-sm text-muted">No history.</div>}
            </div>
            <Button className="mt-4 w-full" onClick={() => collect(open)}>Collect payment</Button>
          </div>
        </div>
      )}
    </div>
  );
}

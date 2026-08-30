"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRs } from "@/lib/money";
import { Button, Card, cn } from "@/components/ui";
import { useConfirm } from "@/components/Confirm";
import { addExpense, deleteExpense, fetchExpenses, type ExpenseRow } from "../expenses-actions";

const CATEGORIES = ["Ingredients", "Supplies", "Salaries", "Rent", "Utilities", "Maintenance", "Marketing", "Other"];
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date().toISOString().slice(0, 8) + "01";

export default function ExpensesPage() {
  const { confirm } = useConfirm();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [revenue, setRevenue] = useState(0);

  // add form
  const [category, setCategory] = useState("Ingredients");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [spentAt, setSpentAt] = useState(today());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchExpenses(from, to);
    setRows(res.rows);
    setTotal(res.total);
    setRevenue(res.revenue);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const amt = Number(amount);
    if (!(amt > 0)) return;
    setBusy(true);
    try {
      await addExpense({ category, amount: amt, description, paid_to: paidTo, spent_at: spentAt });
      setAmount("");
      setDescription("");
      setPaidTo("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: ExpenseRow) {
    const ok = await confirm({ title: "Delete expense?", message: `${r.category} · ${formatRs(r.amount)}`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await deleteExpense(r.id);
    await load();
  }

  const profit = revenue - total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">Expenses</h1>
        <p className="mt-1 text-xs text-muted">Track money going out and see your net profit.</p>
      </div>

      {/* summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Revenue (period)</div>
          <div className="mt-1 text-2xl font-black text-free-dark">{formatRs(revenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Expenses (period)</div>
          <div className="mt-1 text-2xl font-black text-brand">{formatRs(total)}</div>
        </Card>
        <Card className={cn("p-4", profit >= 0 ? "border-free-dark/30" : "border-brand/30")}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Net Profit</div>
          <div className={cn("mt-1 text-2xl font-black", profit >= 0 ? "text-free-dark" : "text-brand")}>{formatRs(profit)}</div>
        </Card>
      </div>

      {/* date range */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-ink-muted">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs font-semibold text-ink-muted">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm outline-none focus:border-brand" />
        </label>
      </div>

      {/* add expense */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand">Add expense</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm outline-none focus:border-brand">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount Rs." className="rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm font-bold outline-none focus:border-brand" />
          <input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Paid to (optional)" className="rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm outline-none focus:border-brand" />
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} className="rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm outline-none focus:border-brand" />
        </div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl border border-hairline bg-cream/30 px-3 py-2 text-sm outline-none focus:border-brand" />
        <Button loading={busy} disabled={!(Number(amount) > 0)} onClick={add}>Add expense</Button>
      </Card>

      {/* list */}
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-hairline">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{r.category}{r.paid_to ? ` · ${r.paid_to}` : ""}</div>
                <div className="truncate text-xs text-muted">{r.spent_at}{r.description ? ` · ${r.description}` : ""}</div>
              </div>
              <div className="text-sm font-bold text-brand">{formatRs(r.amount)}</div>
              <button onClick={() => remove(r)} className="text-muted hover:text-brand" aria-label="delete">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
              </button>
            </div>
          ))}
          {rows.length === 0 && <div className="p-8 text-center text-sm text-muted">No expenses in this period.</div>}
        </div>
      </Card>
    </div>
  );
}

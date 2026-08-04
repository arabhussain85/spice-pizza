"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { Button, Card, Pill } from "@/components/ui";
import { confirmPayment, rejectPayment } from "../actions";

interface PendingRow {
  id: string;
  method: string;
  amount: number;
  screenshot_url: string | null;
  paid_at: string;
  orders: { order_number: string; restaurant_tables: { number: number } | null } | null;
}

export default function PaymentsPage() {
  const supaRef = useRef(createClient());
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supa = supaRef.current;
    try {
      const { data, error } = await supa
        .from("payments")
        .select("id,method,amount,screenshot_url,paid_at,orders(order_number,restaurant_tables(number))")
        .eq("status", "pending")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as unknown as PendingRow[]);
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment approvals</h1>
        {rows.length > 0 && <Pill tone="amber">{rows.length} pending</Pill>}
      </div>
      <p className="mt-1 text-sm text-muted">Confirm online payments (JazzCash / EasyPaisa) after checking receipt.</p>

      {error && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-tint/50 p-4 text-sm text-brand">
          {error.includes("schema cache") ? "Database not set up yet." : error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {rows.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold capitalize">{p.method}</div>
                <div className="text-xs text-muted">
                  Table {p.orders?.restaurant_tables?.number ?? "—"} · #{p.orders?.order_number ?? "?"} ·{" "}
                  {formatClock(new Date(p.paid_at))}
                </div>
              </div>
              <div className="text-lg font-bold">{formatRs(p.amount)}</div>
            </div>
            {p.screenshot_url && (
              <a href={p.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-brand underline">
                View screenshot
              </a>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  if (confirm("Reject and remove this payment?")) {
                    await rejectPayment(p.id);
                    await load();
                  }
                }}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={async () => {
                  await confirmPayment(p.id);
                  await load();
                }}
              >
                Confirm payment
              </Button>
            </div>
          </Card>
        ))}
        {rows.length === 0 && !error && (
          <div className="py-10 text-center text-sm text-muted">No pending payments. 🎉</div>
        )}
      </div>
    </div>
  );
}

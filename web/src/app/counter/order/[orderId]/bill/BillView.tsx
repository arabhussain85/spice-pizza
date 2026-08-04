"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderFull, type OrderFull } from "@/lib/queries";
import type { PaymentMethod } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { billTotals } from "@/lib/order-math";
import { Button, cn } from "@/components/ui";
import { closeAndPay, setDiscount, validateOwnerPin, voidLineItem } from "../../../actions";

export function BillView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const supaRef = useRef(createClient());
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [discountsRole, setDiscountsRole] = useState<"owner" | "any">("owner");
  const [showDiscount, setShowDiscount] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setOrder(await fetchOrderFull(supaRef.current, orderId));
  }, [orderId]);

  useEffect(() => {
    const supa = supaRef.current;
    refetch();
    supa
      .from("settings")
      .select("discounts_role")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => data && setDiscountsRole(data.discounts_role));
  }, [refetch]);

  if (!order) return <div className="mt-6 text-sm text-muted">Loading bill…</div>;

  const { order: o, rounds, discount, table } = order;
  const allLines = rounds.flatMap((r) => r.order_line_items);
  const totals = billTotals(
    allLines,
    o.service_charge_pct,
    discount ? { type: discount.type, value: discount.value } : null,
  );

  async function handleVoid(lineId: string) {
    const reason = window.prompt("Void reason (required):");
    if (!reason || !reason.trim()) return;
    await voidLineItem(lineId, reason.trim());
    await refetch();
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="px-3 py-1.5" onClick={() => router.push(`/counter/order/${orderId}`)}>
            ← Table {table?.number ?? ""}
          </Button>
          <div className="text-lg font-bold">Bill · Table {table?.number ?? "—"}</div>
        </div>
        <div className="text-xs text-muted">
          Opened {formatClock(new Date(o.opened_at))} · {rounds.length} {rounds.length === 1 ? "round" : "rounds"}
          {o.server_name ? ` · Server ${o.server_name}` : ""}
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-xl">
        <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Itemized bill</h2>
            <span className="text-xs tracking-wide text-muted">#{o.order_number}</span>
          </div>

          <div className="mt-4 space-y-4">
            {rounds.map((r) => (
              <div key={r.id}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Round {r.round_number}
                  {r.sent_to_kitchen_at ? ` · ${formatClock(new Date(r.sent_to_kitchen_at))}` : ""}
                </div>
                <div className="mt-2 space-y-2">
                  {r.order_line_items.map((li) => (
                    <div key={li.id} className="flex items-start gap-3 text-sm">
                      <span className="w-7 shrink-0 text-muted">{li.quantity}×</span>
                      <div className={cn("min-w-0 flex-1", li.is_voided && "text-muted line-through")}>
                        <span className="font-medium">
                          {li.name_snapshot}
                          {li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                        </span>
                        {(li.note || li.modifiers.length > 0) && !li.is_voided && (
                          <div className="text-xs text-muted">
                            {[li.note, ...li.modifiers].filter(Boolean).join(", ")}
                          </div>
                        )}
                        {li.is_voided && <span className="ml-1 text-xs">(void: {li.void_reason})</span>}
                      </div>
                      <div className={cn("text-right font-semibold tabular-nums", li.is_voided && "text-muted line-through")}>
                        {formatRs(li.unit_price * li.quantity)}
                      </div>
                      {!li.is_voided && (
                        <button onClick={() => handleVoid(li.id)} className="text-xs text-muted hover:text-brand">
                          void
                        </button>
                      )}
                    </div>
                  ))}
                  {r.order_line_items.length === 0 && (
                    <div className="text-xs text-muted">No items.</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-1.5 border-t border-dashed border-hairline pt-4 text-sm">
            <Row label="Subtotal" value={formatRs(totals.subtotal)} />
            <Row label={`Service charge (${o.service_charge_pct}%)`} value={formatRs(totals.service)} />
            {totals.discount > 0 && (
              <Row label={`Discount${discount?.reason ? ` · ${discount.reason}` : ""}`} value={`− ${formatRs(totals.discount)}`} />
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-base font-bold">Total</span>
              <span className="text-2xl font-bold text-brand">{formatRs(totals.total)}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => window.open(`/api/print/bill/${orderId}`, "_blank")}>
              Print bill
            </Button>
            <Button variant="soft" onClick={() => setShowDiscount(true)}>
              Apply discount
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setShowPay(true)}>
              Close &amp; Pay
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-brand">{error}</p>}
        </div>
      </div>

      {showDiscount && (
        <DiscountModal
          requirePin={discountsRole === "owner"}
          onClose={() => setShowDiscount(false)}
          onApply={async (d, pin) => {
            if (discountsRole === "owner") {
              const ok = await validateOwnerPin(pin);
              if (!ok) return "Wrong owner PIN.";
            }
            await setDiscount(orderId, d);
            await refetch();
            setShowDiscount(false);
            return null;
          }}
        />
      )}

      {showPay && (
        <PaymentModal
          total={totals.total}
          onClose={() => setShowPay(false)}
          onConfirm={async (method, amount, screenshotUrl) => {
            setError(null);
            try {
              await closeAndPay(orderId, [{ method, amount, screenshotUrl }]);
              router.push("/counter");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function DiscountModal({
  requirePin,
  onClose,
  onApply,
}: {
  requirePin: boolean;
  onClose: () => void;
  onApply: (d: { type: "percent" | "fixed"; value: number; reason?: string }, pin: string) => Promise<string | null>;
}) {
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold">Apply discount</h3>
      <div className="mt-4 flex gap-2">
        {(["percent", "fixed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
              type === t ? "border-brand bg-brand text-white" : "border-hairline",
            )}
          >
            {t === "percent" ? "Percent (%)" : "Fixed (Rs.)"}
          </button>
        ))}
      </div>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={type === "percent" ? "e.g. 10" : "e.g. 200"}
        className="mt-3 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
      />
      {requirePin && (
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Owner PIN"
          className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
        />
      )}
      {err && <p className="mt-2 text-sm text-brand">{err}</p>}
      <div className="mt-4 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={busy || !value}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const msg = await onApply({ type, value: Number(value), reason: reason || undefined }, pin);
            setBusy(false);
            if (msg) setErr(msg);
          }}
        >
          Apply
        </Button>
      </div>
    </Overlay>
  );
}

function PaymentModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, amount: number, screenshotUrl: string | null) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(String(total));
  const [screenshot, setScreenshot] = useState("");
  const [busy, setBusy] = useState(false);
  const online = method === "jazzcash" || method === "easypaisa";
  const methods: { key: PaymentMethod; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "card", label: "Card" },
    { key: "jazzcash", label: "JazzCash" },
    { key: "easypaisa", label: "EasyPaisa" },
    { key: "other", label: "Other" },
  ];

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold">Close &amp; Pay</h3>
      <div className="mt-1 text-sm text-muted">
        Total due <span className="font-semibold text-ink">{formatRs(total)}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {methods.map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-medium",
              method === m.key ? "border-brand bg-brand text-white" : "border-hairline",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium">Amount received</label>
      <input
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mt-1 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
      />
      {online && (
        <>
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Online payment — will be marked <b>pending</b> until the owner confirms it in the Admin panel.
          </div>
          <input
            value={screenshot}
            onChange={(e) => setScreenshot(e.target.value)}
            placeholder="Payment screenshot URL (optional)"
            className="mt-2 w-full rounded-xl border border-hairline bg-cream/50 px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
        </>
      )}
      <div className="mt-4 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm(method, Number(amount), online ? screenshot || null : null);
            setBusy(false);
          }}
        >
          {busy ? "Closing…" : online ? "Close (pending)" : "Close & Pay"}
        </Button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

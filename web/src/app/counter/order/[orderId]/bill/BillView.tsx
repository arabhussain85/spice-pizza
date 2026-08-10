"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Opens the 80mm HTML receipt page in a new tab.
 * The page auto-calls window.print() and sets @page { size: 80mm auto }
 * so the browser print dialog uses the correct paper width — no infinite roll.
 * No local bridge or extra software needed.
 */
function printReceipt(orderId: string) {
  window.open(`/api/print/bill/${orderId}/html`, "_blank");
}
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderFull, type OrderFull } from "@/lib/queries";
import type { PaymentMethod } from "@/lib/types";
import { formatRs } from "@/lib/money";
import { formatClock } from "@/lib/time";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals, type Promotion, type MenuMeta } from "@/lib/promotions";
import { cn } from "@/components/ui";
import { BottomSheet } from "@/components/BottomSheet";
import { useConfirm } from "@/components/Confirm";
import { LoadingScreen } from "@/components/Loader";
import { closeAndPay, setDiscount, validateOwnerPin, voidLineItem } from "../../../actions";
import { fetchReceiptConfig, RECEIPT_DEFAULTS, type ReceiptConfig } from "@/lib/receipt-config";
import { LOGO_PNG_BASE64 } from "@/lib/logo-data";

export function BillView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const confirmUi = useConfirm();
  const supaRef = useRef(createClient());
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [meta, setMeta] = useState<Map<string, MenuMeta>>(new Map());
  const [discountsRole, setDiscountsRole] = useState<"owner" | "any">("owner");
  const [cfg, setCfg] = useState<ReceiptConfig>(RECEIPT_DEFAULTS);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidTotal, setPaidTotal] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(false);
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
    fetchActivePromotions(supa).then(setPromos).catch(() => {});
    fetchMenuMeta(supa).then(setMeta).catch(() => {});
    fetchReceiptConfig(supa).then(setCfg).catch(() => {});
  }, [refetch]);

  /* ── Pending approval screen ────────────────────────────── */
  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-[#fff8f7] flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ffe2de] rounded-full blur-[100px] opacity-60 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <main className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-modal border border-[#e4beba] p-8 md:p-12 flex flex-col items-center text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-[#fff0ef] border-2 border-[#FFA000] flex items-center justify-center text-[#FFA000] shadow-sm">
                <span className="material-symbols-outlined text-4xl">hourglass_top</span>
              </div>
            </div>
            <div className="space-y-2 mb-6 w-full">
              <h1 className="text-2xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Payment Submitted
              </h1>
              <p className="text-sm text-[#605e5b]">Order #{order?.order.order_number}</p>
            </div>
            <div className="w-full bg-[#fff0ef] rounded-xl p-5 mb-6 border border-[#e4beba]">
              <p className="text-xs font-semibold text-[#FFA000] uppercase tracking-wider mb-1">Status: Pending Owner Approval</p>
              <p className="text-xs text-[#605e5b]">
                Digital payment proof logged. Once the owner approves in Admin, the bill will close automatically.
              </p>
            </div>
            <button
              onClick={() => router.push("/counter")}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-[#8b0d14] transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>grid_view</span>
              Return to Counter
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ── Payment success screen ────────────────────────────── */
  if (paid) {
    return (
      <div className="min-h-screen bg-[#fff8f7] flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ffe2de] rounded-full blur-[100px] opacity-60 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#ffe2de] rounded-full blur-[100px] opacity-60 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <main className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-modal border border-[#e4beba] p-8 md:p-12 flex flex-col items-center text-center">
            <div className="mb-8 animate-scale-in">
              <div className="w-24 h-24 rounded-full bg-[#ffe2de] flex items-center justify-center text-[#2E7D32] shadow-sm">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="check-animation" d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="opacity-0 animate-fade-up animate-delay-1 space-y-2 mb-10 w-full" style={{animationFillMode:'forwards'}}>
              <h1 className="text-3xl font-bold text-[#271816]" style={{fontFamily:"'Plus Jakarta Sans', sans-serif"}}>Payment Successful</h1>
              <p className="text-[#605e5b]">Order #{order?.order.order_number}</p>
            </div>
            <div className="opacity-0 animate-fade-up animate-delay-2 w-full bg-[#fff0ef] rounded-xl p-6 mb-10 border border-[#e4beba]" style={{animationFillMode:'forwards'}}>
              <p className="text-xs font-semibold text-[#605e5b] uppercase tracking-wider mb-2">Amount Paid</p>
              <div className="text-5xl font-bold text-[#af101a]" style={{fontFamily:"'Hanken Grotesk', sans-serif", letterSpacing:'-0.02em'}}>
                <span className="text-2xl align-top relative top-2 mr-1">Rs.</span>{formatRs(paidTotal).replace("Rs. ", "")}
              </div>
            </div>
            <div className="opacity-0 animate-fade-up animate-delay-3 w-full flex flex-col sm:flex-row gap-4" style={{animationFillMode:'forwards'}}>
              <button
                onClick={() => printReceipt(orderId)}
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-white text-[#271816] border border-[#8f6f6c] text-sm font-semibold rounded-xl shadow-sm hover:bg-[#fff0ef] transition-all active:scale-[0.97]"
              >
                <span className="material-symbols-outlined" style={{fontSize:'20px'}}>print</span>
                Print Receipt
              </button>
              <button
                onClick={() => router.push("/counter")}
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-[#8b0d14] transition-all active:scale-[0.97]"
              >
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1", fontSize:'20px'}}>grid_view</span>
                Return to Tables
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FCF9F5]">
        <LoadingScreen label="Loading bill…" />
      </div>
    );
  }

  const { order: o, rounds, discount, table } = order;
  const orderLabel =
    o.order_type === "takeaway" ? "Takeaway" : o.order_type === "delivery" ? "Delivery" : `Table ${table?.number ?? "—"}`;
  const isDineIn = o.order_type === "dine_in";
  const allLines = rounds.flatMap((r) => r.order_line_items);
  const totals = billTotals(
    allLines,
    o.service_charge_pct,
    discount ? { type: discount.type, value: discount.value } : null,
  );
  const promoRes = promoTotals(allLines, promos, meta);
  const finalTotal = Math.max(0, totals.total - promoRes.discount);

  async function handleVoid(lineId: string) {
    const reason = await confirmUi.prompt({
      title: "Void this item?",
      inputLabel: "Reason (required)",
      placeholder: "e.g. wrong item, kitchen error",
      confirmLabel: "Void item",
      required: true,
      danger: true,
    });
    if (!reason) return;
    await voidLineItem(lineId, reason);
    await refetch();
  }

  return (
    <div className="min-h-screen bg-[#FCF9F5]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-8 h-14 bg-[#fff8f7] border-b border-[#e4beba] shadow-sm">
        <button
          onClick={() => router.push(`/counter/order/${orderId}`)}
          className="flex items-center gap-1.5 text-[#605e5b] hover:text-[#af101a] transition-colors text-sm font-semibold"
        >
          <span className="material-symbols-outlined" style={{fontSize:'20px'}}>arrow_back</span>
          Back
        </button>
        <div className="text-base font-bold text-[#1A1A1A]">
          Bill · {orderLabel}
        </div>
        <div className="text-xs text-[#605e5b] hidden sm:block">
          Opened {formatClock(new Date(o.opened_at))} · {rounds.length} {rounds.length === 1 ? "round" : "rounds"}
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Receipt Paper Card */}
        <div className="receipt-paper rounded-xl relative px-6 pt-6 pb-12">
          {/* Brand Logo */}
          <div className="flex justify-center mb-4">
            <img
              src={`data:image/png;base64,${LOGO_PNG_BASE64}`}
              alt="Logo"
              className="w-[100px] h-auto object-contain filter grayscale contrast-[1.5] transition-transform duration-300"
              style={{ transform: "rotate(-7deg)" }}
            />
          </div>

          {/* Restaurant Header */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-black text-[#1a1a1a] uppercase tracking-wider mb-1">
              {cfg.brand}
            </h1>
            {cfg.tagline && <p className="text-xs text-[#605e5b] italic mb-1">{cfg.tagline}</p>}
            {cfg.address && <p className="text-xs text-[#605e5b] leading-tight mb-1">{cfg.address}</p>}
            {cfg.phone && <p className="text-xs font-semibold text-[#271816]">Tel: {cfg.phone}</p>}
            {cfg.ntn && <p className="text-[10px] text-[#605e5b] mt-1">{cfg.ntn}</p>}
          </div>

          {/* Meta */}
          <div className="flex justify-between items-start text-xs text-[#5b403d] mb-3">
            <div>
              <p>Date: {new Date(o.opened_at).toLocaleDateString("en-PK", {day:'2-digit', month:'short', year:'numeric'})}</p>
              <p>Time: {formatClock(new Date(o.opened_at))}</p>
            </div>
            <div className="text-right">
              <p>Bill # <span className="font-bold">{o.order_number}</span></p>
              {isDineIn ? (
                <p>Table <span className="font-bold text-[#af101a]">T-{String(table?.number ?? "").padStart(2,"0")}</span></p>
              ) : (
                <p className="font-bold text-[#af101a] uppercase">{orderLabel}</p>
              )}
              {o.token_number != null && <p>Token <span className="font-bold text-[#af101a]">#{o.token_number}</span></p>}
              {o.customer_name && <p>{o.customer_name}</p>}
              {o.customer_phone && <p>{o.customer_phone}</p>}
            </div>
          </div>
          <div className="dotted-line" />

          {/* Column Headers */}
          <div className="flex justify-between text-xs font-bold text-[#271816] uppercase tracking-wide mb-2">
            <span className="w-3/5">Item</span>
            <span className="w-1/5 text-center">Qty</span>
            <span className="w-1/5 text-right">Price</span>
          </div>
          <div className="dotted-line" />

          {/* Line Items by Round */}
          <div className="space-y-4">
            {rounds.map((r) => (
              <div key={r.id}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#605e5b] mb-2">
                  Round {r.round_number}
                  {r.sent_to_kitchen_at ? ` · ${formatClock(new Date(r.sent_to_kitchen_at))}` : ""}
                </div>
                <div className="space-y-2">
                  {r.order_line_items.map((li) => (
                    <div key={li.id} className="flex items-start text-sm">
                      <div className={cn("w-3/5 pr-2", li.is_voided && "text-[#605e5b] line-through")}>
                        <span className="block font-semibold">
                          {li.name_snapshot}
                          {li.size_snapshot ? ` (${li.size_snapshot})` : ""}
                        </span>
                        {(li.note || li.modifiers.length > 0) && !li.is_voided && (
                          <span className="block text-xs text-[#605e5b]">
                            {[li.note, ...li.modifiers].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {li.is_voided && <span className="text-xs">(void: {li.void_reason})</span>}
                      </div>
                      <span className="w-1/5 text-center text-[#605e5b]">{li.quantity}</span>
                      <div className="w-1/5 text-right flex items-start justify-end gap-1">
                        <span className={cn("font-semibold tabular-nums", li.is_voided && "text-[#605e5b] line-through")}>
                          {formatRs(li.unit_price * li.quantity)}
                        </span>
                        {!li.is_voided && (
                          <button onClick={() => handleVoid(li.id)} className="text-[9px] text-[#605e5b] hover:text-[#af101a] mt-0.5">
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {r.order_line_items.length === 0 && (
                    <div className="text-xs text-[#605e5b]">No items.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="dotted-line" />

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[#605e5b]">
              <span>Subtotal</span>
              <span>{formatRs(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#605e5b]">
              <span>Service charge ({o.service_charge_pct}%)</span>
              <span>{formatRs(totals.service)}</span>
            </div>
            {promoRes.discount > 0 && (
              <div className="flex justify-between text-[#2E7D32]">
                <span>Promo{promoRes.names.length ? ` · ${promoRes.names.join(", ")}` : ""}</span>
                <span>− {formatRs(promoRes.discount)}</span>
              </div>
            )}
            {totals.discount > 0 && (
              <div className="flex justify-between text-[#2E7D32]">
                <span>Discount{discount?.reason ? ` · ${discount.reason}` : ""}</span>
                <span>− {formatRs(totals.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-[#271816]">
              <span className="text-base font-bold text-[#271816]">TOTAL</span>
              <span className="text-3xl font-bold text-[#af101a]" style={{fontFamily:"'Hanken Grotesk', sans-serif", letterSpacing:'-0.02em'}}>
                {formatRs(finalTotal)}
              </span>
            </div>
          </div>

          {cfg.showWifi && cfg.wifiSsid && (
            <>
              <div className="dotted-line" />
              <div className="text-center text-xs font-semibold text-[#271816] py-1.5">
                📶 Wi-Fi: {cfg.wifiSsid} / Pass: {cfg.wifiPass}
              </div>
            </>
          )}

          <div className="dotted-line" />
          <div className="text-center text-xs text-[#605e5b] mt-2 space-y-1">
            {cfg.footer && <p className="italic">{cfg.footer}</p>}
            <p className="font-bold text-[#271816] uppercase">** THANK YOU FOR VISITING! **</p>
            <p className="text-[10px] text-[#8c7471] tracking-widest uppercase">*** POWERED BY {cfg.brand || "SPICE PIZZA"} ***</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => printReceipt(orderId)}
            className="flex items-center justify-center gap-2 bg-white text-[#271816] border border-[#8f6f6c] text-sm font-semibold h-12 px-5 rounded-xl shadow-sm hover:bg-[#fff0ef] transition-all active:scale-[0.97]"
          >
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>print</span>
            Print bill
          </button>
          <button
            onClick={() => setShowDiscount(true)}
            className="flex items-center justify-center gap-2 bg-[#ffe9e7] text-[#af101a] border border-[#e4beba] text-sm font-semibold h-12 px-5 rounded-xl hover:bg-[#ffe2de] transition-all active:scale-[0.97]"
          >
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>local_offer</span>
            Discount
          </button>
          <button
            onClick={() => setShowPay(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-[#af101a] text-white text-sm font-semibold h-12 rounded-xl shadow-sm hover:bg-[#8b0d14] transition-all active:scale-[0.97]"
          >
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>payments</span>
            Close &amp; Pay
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-[#af101a] text-center">{error}</p>}
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
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
          total={finalTotal}
          onClose={() => setShowPay(false)}
          onConfirm={async (method, tendered, screenshotUrl) => {
            setError(null);
            try {
              // Revenue is always the bill total; `tendered` (cash handed over) drives the change line only.
              const res = await closeAndPay(orderId, [
                { method, amount: finalTotal, tendered: method === "cash" ? tendered : null, screenshotUrl },
              ]);
              setPaidTotal(finalTotal);
              if (res.pending) {
                setPendingApproval(true);
              } else {
                setPaid(true);
              }
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
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
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[#af101a]" style={{fontSize:'24px'}}>local_offer</span>
        <h3 className="text-lg font-bold text-[#1A1A1A]">Apply Discount</h3>
      </div>
      <div className="flex gap-2 mb-4">
        {(["percent", "fixed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
              type === t
                ? "border-[#af101a] bg-[#af101a] text-white"
                : "border-[#e4beba] bg-white text-[#605e5b] hover:border-[#af101a]/40"
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
        className="w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a] transition-colors mb-3"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a] transition-colors mb-3"
      />
      {requirePin && (
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Owner PIN"
          className="w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a] transition-colors mb-3"
        />
      )}
      {err && <p className="text-sm text-[#af101a] mb-3">{err}</p>}
      <div className="flex gap-3 mt-1">
        <button
          onClick={onClose}
          className="flex-1 h-11 border border-[#e4beba] rounded-xl text-sm font-semibold text-[#605e5b] hover:bg-[#fff0ef] transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={busy || !value}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const msg = await onApply({ type, value: Number(value), reason: reason || undefined }, pin);
            setBusy(false);
            if (msg) setErr(msg);
          }}
          className="flex-1 h-11 bg-[#af101a] text-white rounded-xl text-sm font-semibold hover:bg-[#8b0d14] transition-colors disabled:opacity-50"
        >
          {busy ? "Applying…" : "Apply"}
        </button>
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
  onConfirm: (method: PaymentMethod, tendered: number, screenshotUrl: string | null) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(String(total));
  const [screenshot, setScreenshot] = useState("");
  const [busy, setBusy] = useState(false);
  const online = method === "jazzcash" || method === "easypaisa";
  const isCash = method === "cash";
  const change = isCash ? Math.max(0, (Number(amount) || 0) - total) : 0;
  const methods: { key: PaymentMethod; label: string; icon: string }[] = [
    { key: "cash", label: "Cash", icon: "payments" },
    { key: "card", label: "Card", icon: "credit_card" },
    { key: "jazzcash", label: "JazzCash", icon: "smartphone" },
    { key: "easypaisa", label: "EasyPaisa", icon: "smartphone" },
    { key: "other", label: "Other", icon: "more_horiz" },
  ];

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[#af101a]" style={{fontSize:'24px'}}>payments</span>
        <h3 className="text-lg font-bold text-[#1A1A1A]">Close & Pay</h3>
      </div>
      <div className="text-sm text-[#605e5b] mb-4">
        Total due{" "}
        <span className="font-bold text-[#af101a] text-base" style={{fontFamily:"'Hanken Grotesk', sans-serif"}}>
          {formatRs(total)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {methods.map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
              method === m.key
                ? "border-[#af101a] bg-[#af101a] text-white"
                : "border-[#e4beba] bg-white text-[#605e5b] hover:border-[#af101a]/40"
            )}
          >
            <span className="material-symbols-outlined" style={{fontSize:'20px'}}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold text-[#1A1A1A] mb-1.5">
        {isCash ? "Cash received" : "Amount received"}
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a] transition-colors mb-3"
      />
      {isCash && (
        <div className="flex items-center justify-between rounded-xl bg-[#fff0ef] border border-[#e4beba] px-4 py-2.5 text-sm mb-3">
          <span className="font-semibold text-[#605e5b]">Change due</span>
          <span className="font-bold text-[#af101a] text-base" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            {formatRs(change)}
          </span>
        </div>
      )}
      {online && (
        <>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800 mb-3">
            Online payment — will be marked <b>pending</b> until the owner confirms it in the Admin panel.
          </div>
          <input
            value={screenshot}
            onChange={(e) => setScreenshot(e.target.value)}
            placeholder="Payment screenshot URL (optional)"
            className="w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm outline-none focus:border-[#af101a] transition-colors mb-3"
          />
        </>
      )}
      <div className="flex gap-3 mt-1">
        <button
          onClick={onClose}
          className="flex-1 h-12 border border-[#e4beba] rounded-xl text-sm font-semibold text-[#605e5b] hover:bg-[#fff0ef] transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm(method, Number(amount), online ? screenshot || null : null);
            setBusy(false);
          }}
          className="flex-1 h-12 bg-[#af101a] text-white rounded-xl text-sm font-semibold hover:bg-[#8b0d14] transition-colors disabled:opacity-50 shadow-sm"
        >
          {busy ? "Closing…" : online ? "Close (pending)" : "Close & Pay"}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <BottomSheet onClose={onClose}>{children}</BottomSheet>;
}

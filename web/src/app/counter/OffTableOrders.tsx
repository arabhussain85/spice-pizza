"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchOffTableOrders, type OffTableOrder } from "@/lib/queries";
import { startTakeaway, startDelivery, type CustomerInfo } from "./actions";
import { cancelOrder } from "@/app/admin/order-actions";
import { formatRs } from "@/lib/money";
import { cn } from "@/components/ui";
import { BottomSheet } from "@/components/BottomSheet";
import { useConfirm } from "@/components/Confirm";

type NewType = "takeaway" | "delivery" | null;

/** Takeaway & Delivery: start off-table orders and continue the active ones. */
export function OffTableOrders() {
  const router = useRouter();
  const { prompt } = useConfirm();
  const supaRef = useRef(createClient());
  const [orders, setOrders] = useState<OffTableOrder[]>([]);
  const [modal, setModal] = useState<NewType>(null);

  const refetch = useCallback(async () => {
    try {
      setOrders(await fetchOffTableOrders(supaRef.current));
    } catch {
      /* keep last known list */
    }
  }, []);

  async function handleCancel(o: OffTableOrder) {
    const reason = await prompt({
      title: `Cancel this ${o.order_type} order?`,
      message: "Nothing is charged.",
      inputLabel: "Reason (optional)",
      placeholder: "e.g. customer cancelled",
      confirmLabel: "Cancel order",
      cancelLabel: "Keep order",
      danger: true,
    });
    if (reason === null) return;
    await cancelOrder(o.id, reason || undefined);
    await refetch();
  }

  useEffect(() => {
    refetch();
    const supa = supaRef.current;
    const channel = supa
      .channel("offtable-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_line_items" }, refetch)
      .subscribe();
    return () => {
      supa.removeChannel(channel);
    };
  }, [refetch]);

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Takeaway &amp; Delivery
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("takeaway")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#af101a]/40 bg-white px-3.5 py-2 text-xs font-bold text-[#af101a] transition-all hover:bg-[#ffe9e7] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>takeout_dining</span>
            New Takeaway
          </button>
          <button
            onClick={() => setModal("delivery")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#af101a] px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-[#8b0d14] active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delivery_dining</span>
            New Delivery
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e4beba] bg-white/60 px-4 py-6 text-center text-xs font-semibold text-[#605e5b]">
          No active takeaway or delivery orders. Start one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="group flex flex-col rounded-xl border border-[#e4beba] bg-white p-4 shadow-sm transition-all hover:border-[#af101a]/40 hover:shadow-md"
            >
              <button onClick={() => router.push(`/counter/order/${o.id}`)} className="text-left active:scale-[0.99]">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      o.order_type === "delivery"
                        ? "bg-[#fff0ef] text-[#af101a] border border-[#e4beba]"
                        : "bg-[#fff4e5] text-[#b26a00] border border-[#f0d9b0]",
                    )}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                      {o.order_type === "delivery" ? "delivery_dining" : "takeout_dining"}
                    </span>
                    {o.order_type}
                  </span>
                  {o.token_number != null && (
                    <span className="text-sm font-extrabold text-[#af101a]">#{o.token_number}</span>
                  )}
                </div>
                <div className="mt-2 text-sm font-bold text-[#1A1A1A]">
                  {o.customer_name || "Walk-in customer"}
                </div>
                <div className="text-xs text-[#605e5b]">
                  {o.customer_phone || `Order ${o.order_number}`}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#f0e4e2] pt-2">
                  <span className="text-xs text-[#605e5b]">{o.rounds} round{o.rounds === 1 ? "" : "s"}</span>
                  <span className="text-sm font-bold text-[#af101a]" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
                    {formatRs(o.runningTotal)}
                  </span>
                </div>
              </button>

              {/* Card actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCancel(o)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#e4beba] px-3 py-2 text-xs font-semibold text-[#605e5b] transition-colors hover:border-[#af101a]/40 hover:bg-[#fff0ef] hover:text-[#af101a]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>cancel</span>
                  Cancel
                </button>
                <button
                  onClick={() => router.push(`/counter/order/${o.id}/bill`)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#af101a] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8b0d14]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>payments</span>
                  Close &amp; Pay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CustomerModal
          type={modal}
          onClose={() => setModal(null)}
          onStart={async (info) => {
            const res = modal === "delivery" ? await startDelivery(info) : await startTakeaway(info);
            router.push(`/counter/order/${res.orderId}`);
          }}
        />
      )}
    </section>
  );
}

function CustomerModal({
  type,
  onClose,
  onStart,
}: {
  type: "takeaway" | "delivery";
  onClose: () => void;
  onStart: (info: CustomerInfo) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const isDelivery = type === "delivery";

  return (
    <BottomSheet onClose={onClose}>
      <div>
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#af101a]" style={{ fontSize: "24px" }}>
            {isDelivery ? "delivery_dining" : "takeout_dining"}
          </span>
          <h3 className="text-lg font-bold text-[#1A1A1A]">New {isDelivery ? "Delivery" : "Takeaway"}</h3>
        </div>

        <label className="mb-1.5 block text-sm font-semibold text-[#1A1A1A]">Customer name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
          autoFocus
          className="mb-3 w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-[#af101a]"
        />

        <label className="mb-1.5 block text-sm font-semibold text-[#1A1A1A]">Phone {isDelivery ? "" : "(optional)"}</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="03xx-xxxxxxx"
          className="mb-3 w-full rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-[#af101a]"
        />

        {isDelivery && (
          <>
            <label className="mb-1.5 block text-sm font-semibold text-[#1A1A1A]">Delivery address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="House, street, area"
              className="mb-3 w-full resize-none rounded-xl border border-[#e4beba] bg-[#fff0ef] px-4 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors focus:border-[#af101a]"
            />
          </>
        )}

        <div className="mt-1 flex gap-3">
          <button
            onClick={onClose}
            className="h-12 flex-1 rounded-xl border border-[#e4beba] text-sm font-semibold text-[#605e5b] transition-colors hover:bg-[#fff0ef]"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onStart({ name, phone, address: isDelivery ? address : undefined });
              } finally {
                setBusy(false);
              }
            }}
            className="h-12 flex-1 rounded-xl bg-[#af101a] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#8b0d14] disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start order"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

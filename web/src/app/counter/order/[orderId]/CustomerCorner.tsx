"use client";

import { useState } from "react";
import { updateOrderCustomer } from "../../actions";

/**
 * Small, optional, non-blocking corner card for takeaway/delivery orders.
 * Staff can fill customer details and move on — or ignore it entirely.
 */
export function CustomerCorner({
  orderId,
  type,
  initial,
}: {
  orderId: string;
  type: "takeaway" | "delivery";
  initial: { name?: string | null; phone?: string | null; address?: string | null; deliveryCharge?: number | null };
}) {
  const isDelivery = type === "delivery";
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [deliveryCharge, setDeliveryCharge] = useState<string>(
    initial.deliveryCharge != null ? String(initial.deliveryCharge) : "0",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateOrderCustomer(orderId, {
        name,
        phone,
        address: isDelivery ? address : undefined,
        deliveryCharge: isDelivery ? Math.max(0, Number(deliveryCharge) || 0) : 0,
      });
      setSaved(true);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-[#e4beba] bg-white px-3.5 py-2 text-xs font-bold text-[#af101a] shadow-lg lg:bottom-6"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
          {saved ? "check_circle" : "person_add"}
        </span>
        {name || (isDelivery ? "Delivery details" : "Customer details")}
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-30 w-[17rem] rounded-2xl border border-[#e4beba] bg-white p-4 shadow-2xl lg:bottom-6">
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-sm font-bold text-[#1A1A1A]">
          {isDelivery ? "Delivery details" : "Customer details"}
          <span className="font-normal text-[#605e5b]"> (optional)</span>
        </h4>
        <button onClick={() => setOpen(false)} className="text-[#605e5b] hover:text-[#af101a]" aria-label="minimize">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Customer name"
        className="mb-2 w-full rounded-lg border border-[#e4beba] bg-[#fff0ef] px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a]"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="Phone"
        className="mb-2 w-full rounded-lg border border-[#e4beba] bg-[#fff0ef] px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a]"
      />
      {isDelivery && (
        <>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            placeholder="Delivery address"
            className="mb-2 w-full resize-none rounded-lg border border-[#e4beba] bg-[#fff0ef] px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a]"
          />
          <div className="mb-2">
            <label className="mb-1 block text-xs font-semibold text-[#1A1A1A]">
              Delivery Charge (Rs.)
            </label>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {[0, 50, 100, 150, 200].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDeliveryCharge(String(amt))}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold border transition-colors ${
                    Number(deliveryCharge) === amt
                      ? "border-[#af101a] bg-[#af101a] text-white"
                      : "border-[#e4beba] bg-[#fff0ef] text-[#605e5b] hover:border-[#af101a]/40"
                  }`}
                >
                  {amt === 0 ? "Free" : `Rs ${amt}`}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
              placeholder="Delivery Charge Rs."
              className="w-full rounded-lg border border-[#e4beba] bg-[#fff0ef] px-3 py-1.5 text-sm text-[#1A1A1A] outline-none focus:border-[#af101a]"
            />
          </div>
        </>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-[#af101a] py-2 text-sm font-bold text-white transition-colors hover:bg-[#8b0d14] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save details"}
      </button>
    </div>
  );
}

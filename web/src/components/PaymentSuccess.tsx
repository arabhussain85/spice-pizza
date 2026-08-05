"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { formatRs } from "@/lib/money";

/** Payment-verified success card (Stitch `payment_verified`). Used after close/verify. */
export function PaymentSuccess({
  orderNumber,
  amount,
  onPrint,
  onClose,
  primaryLabel = "Return to Tables",
}: {
  orderNumber: string;
  amount: number;
  onPrint?: () => void;
  onClose?: () => void;
  primaryLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-6 text-center shadow-modal animate-scale-in">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-tint">
          <Icon name="check" className="text-3xl text-status-free" fill />
        </div>
        <h2 className="mt-4 font-headline-md text-headline-md text-charcoal-text">Payment Successful</h2>
        <p className="text-sm text-secondary">Order #{orderNumber}</p>

        <div className="mt-5 rounded-xl bg-primary-tint/60 p-4">
          <div className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Amount Paid</div>
          <div className="font-display-price text-display-price text-primary">{formatRs(amount)}</div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onPrint}
            className="flex h-touch-target flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-bright font-label-bold text-label-bold text-charcoal-text transition-colors hover:bg-surface-container-low active:scale-95"
          >
            <Icon name="print" /> Print Receipt
          </button>
          <button
            onClick={onClose ?? (() => router.push("/counter"))}
            className="flex h-touch-target flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-label-bold text-label-bold text-on-primary shadow-sm transition-colors hover:bg-surface-tint active:scale-95"
          >
            <Icon name="grid_view" /> {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

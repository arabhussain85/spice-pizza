// Pure money math for orders/bills. No I/O — unit-tested in order-math.test.ts.
// Rule (matches mockup line order: Subtotal → Service charge → Discount → Total):
//   service charge is computed on the subtotal; discount is then subtracted.

export interface LineLike {
  quantity: number;
  unit_price: number;
  is_voided?: boolean;
}

export interface DiscountLike {
  type: "percent" | "fixed";
  value: number;
}

export interface BillTotals {
  subtotal: number;
  service: number;
  discount: number;
  total: number;
}

/** Effective total for one line (0 if voided). */
export function lineTotal(li: LineLike): number {
  return li.is_voided ? 0 : Math.max(0, li.quantity) * li.unit_price;
}

/** Sum of non-voided line totals. */
export function sumLines(lines: LineLike[]): number {
  return lines.reduce((acc, li) => acc + lineTotal(li), 0);
}

/** Service charge on a subtotal, rounded to whole rupees. */
export function serviceCharge(subtotal: number, pct: number): number {
  return Math.round((subtotal * pct) / 100);
}

/** Discount amount for a subtotal (percent or fixed), never exceeding the subtotal. */
export function discountAmount(subtotal: number, d?: DiscountLike | null): number {
  if (!d) return 0;
  const raw = d.type === "percent" ? (subtotal * d.value) / 100 : d.value;
  return Math.min(Math.max(0, Math.round(raw)), subtotal);
}

/** Full bill breakdown across all (non-voided) line items. */
export function billTotals(
  lines: LineLike[],
  serviceChargePct: number,
  discount?: DiscountLike | null,
): BillTotals {
  const subtotal = sumLines(lines);
  const service = serviceCharge(subtotal, serviceChargePct);
  const discount_ = discountAmount(subtotal, discount);
  const total = Math.max(0, subtotal + service - discount_);
  return { subtotal, service, discount: discount_, total };
}

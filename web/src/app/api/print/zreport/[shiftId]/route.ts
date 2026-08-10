import { createAdminClient } from "@/lib/supabase/admin";
import { renderZReport, type ZReport } from "@/lib/pdf";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals } from "@/lib/promotions";
import { fetchReceiptConfig } from "@/lib/receipt-config";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmtDT = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

export async function GET(_req: Request, { params }: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await params;
  const supa = createAdminClient();

  const { data: shift } = await supa.from("shifts").select("*").eq("id", shiftId).maybeSingle();
  if (!shift) return new Response("Shift not found", { status: 404 });

  const { data: ordersRaw } = await supa
    .from("orders")
    .select("id, status, service_charge_pct, delivery_charge, order_rounds(order_line_items(*)), discounts(type, value)")
    .eq("shift_id", shiftId);

  const orders = (ordersRaw ?? []) as Array<{
    id: string;
    status: string;
    service_charge_pct: number;
    delivery_charge: number;
    order_rounds: { order_line_items: OrderLineItem[] }[];
    discounts: { type: "percent" | "fixed"; value: number }[] | null;
  }>;

  const cfg = await fetchReceiptConfig(supa);
  const promos = await fetchActivePromotions(supa);
  const menuMeta = await fetchMenuMeta(supa);

  let subTotal = 0;
  let serviceTotal = 0;
  let deliveryTotal = 0;
  let manualDisc = 0;
  let promoDisc = 0;
  let netSales = 0;
  let itemsSold = 0;
  let ordersClosed = 0;
  let ordersVoid = 0;
  const itemTally = new Map<string, number>();

  for (const o of orders) {
    if (o.status === "void") {
      ordersVoid += 1;
      continue;
    }
    if (o.status !== "closed") continue; // only completed sales count toward the Z-report
    ordersClosed += 1;

    const allLines = (o.order_rounds ?? []).flatMap((r) => r.order_line_items ?? []);
    const live = allLines.filter((li) => !li.is_voided);
    const disc = Array.isArray(o.discounts) ? o.discounts[0] : null;
    const totals = billTotals(allLines, o.service_charge_pct, disc ? { type: disc.type, value: disc.value } : null, o.delivery_charge ?? 0);
    const promo = promoTotals(live, promos, menuMeta);
    const svc = cfg.showService ? totals.service : 0;

    subTotal += totals.subtotal;
    serviceTotal += svc;
    deliveryTotal += totals.delivery;
    manualDisc += totals.discount;
    promoDisc += promo.discount;
    netSales += Math.max(0, totals.subtotal + svc + totals.delivery - promo.discount - totals.discount);

    for (const li of live) {
      itemsSold += li.quantity;
      itemTally.set(li.name_snapshot, (itemTally.get(li.name_snapshot) ?? 0) + li.quantity);
    }
  }

  // payments received by method (confirmed only)
  const orderIds = orders.map((o) => o.id);
  const byMethod = new Map<string, number>();
  if (orderIds.length) {
    const { data: pays } = await supa
      .from("payments")
      .select("method, amount, status")
      .in("order_id", orderIds)
      .eq("status", "confirmed");
    for (const p of (pays ?? []) as { method: string; amount: number }[]) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
    }
  }
  const methodLabel: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    jazzcash: "JazzCash",
    easypaisa: "EasyPaisa",
  };

  const sales: ZReport["sales"] = [
    { label: "Gross Subtotal", value: formatRs(subTotal) },
    ...(serviceTotal > 0 ? [{ label: "Service Charge", value: formatRs(serviceTotal) }] : []),
    ...(deliveryTotal > 0 ? [{ label: "Delivery Charges", value: formatRs(deliveryTotal) }] : []),
    ...(promoDisc > 0 ? [{ label: "Promotions", value: `- ${formatRs(promoDisc)}` }] : []),
    ...(manualDisc > 0 ? [{ label: "Discounts", value: `- ${formatRs(manualDisc)}` }] : []),
  ];

  const payments: ZReport["payments"] = [...byMethod.entries()].map(([m, v]) => ({
    label: methodLabel[m] ?? m,
    value: formatRs(v),
  }));
  if (!payments.length) payments.push({ label: "No payments recorded", value: formatRs(0) });

  const topItems = [...itemTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const z: ZReport = {
    brand: cfg.brand,
    address: cfg.address || undefined,
    openedAt: fmtDT(shift.opened_at),
    closedAt: fmtDT(shift.closed_at),
    ordersClosed,
    ordersVoid,
    itemsSold,
    sales,
    payments,
    netSales: formatRs(netSales),
    topItems,
    footer: "Keep for your records.",
  };

  const bytes = await renderZReport(z);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="zreport-${shiftId.slice(0, 8)}.pdf"`,
    },
  });
}

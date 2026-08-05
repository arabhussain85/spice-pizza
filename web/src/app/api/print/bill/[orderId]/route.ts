import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { renderBill, type BillSlip } from "@/lib/pdf";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals } from "@/lib/promotions";
import { fetchReceiptConfig } from "@/lib/receipt-config";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supa = createAdminClient();
  const full = await fetchOrderFull(supa, orderId);
  if (!full) return new Response("Order not found", { status: 404 });

  const allLines = full.rounds.flatMap((r) => r.order_line_items);
  const live = allLines.filter((li) => !li.is_voided);
  const totals = billTotals(
    allLines,
    full.order.service_charge_pct,
    full.discount ? { type: full.discount.type, value: full.discount.value } : null,
  );
  const promos = await fetchActivePromotions(supa);
  const promo = promoTotals(live, promos, await fetchMenuMeta(supa));
  const cfg = await fetchReceiptConfig(supa);

  const serviceAmt = cfg.showService ? totals.service : 0;
  const netTotal = Math.max(0, totals.subtotal + serviceAmt - promo.discount - totals.discount);

  const item = (li: OrderLineItem) => ({
    qty: li.quantity,
    name: `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`,
    sub: [li.note, ...li.modifiers].filter(Boolean).join(", ") || null,
    amount: formatRs(li.unit_price * li.quantity),
  });

  const slip: BillSlip = {
    brand: cfg.brand,
    tagline: cfg.tagline || undefined,
    address: cfg.address || undefined,
    phone: cfg.phone || undefined,
    ntn: cfg.ntn || undefined,
    orderNumber: full.order.order_number,
    table: `#${full.table?.number ?? "?"}`,
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    staff: full.order.server_name ? `${full.order.server_name} (Counter)` : undefined,
    items: live.map(item),
    subtotal: formatRs(totals.subtotal),
    serviceLabel: `Service Charge (${full.order.service_charge_pct}%)`,
    serviceValue: formatRs(totals.service),
    showService: cfg.showService,
    extraLines: [
      ...(promo.discount > 0 ? [{ label: `Promo${promo.names.length ? " · " + promo.names.join(", ") : ""}`, value: `- ${formatRs(promo.discount)}` }] : []),
      ...(totals.discount > 0 ? [{ label: "Discount", value: `- ${formatRs(totals.discount)}` }] : []),
    ],
    total: formatRs(netTotal),
    wifi: cfg.showWifi ? { ssid: cfg.wifiSsid, pass: cfg.wifiPass } : null,
    footer: cfg.footer || undefined,
    showItemNotes: cfg.showItemNotes,
  };

  const bytes = await renderBill(slip);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="bill-${full.order.order_number}.pdf"`,
    },
  });
}

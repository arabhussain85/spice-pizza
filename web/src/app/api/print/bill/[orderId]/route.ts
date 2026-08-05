import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { renderBill, type BillSlip } from "@/lib/pdf";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals } from "@/lib/promotions";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bare = (n: number) => formatRs(n).replace("Rs. ", "");

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
  const finalTotal = Math.max(0, totals.total - promo.discount);

  const item = (li: OrderLineItem) => ({
    qty: li.quantity,
    name: `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`,
    sub: [li.note, ...li.modifiers].filter(Boolean).join(", ") || null,
    price: bare(li.unit_price * li.quantity),
  });

  const slip: BillSlip = {
    brand: "Spice Pizza",
    branch: "Main Branch",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    orderNumber: full.order.order_number.replace(/^SP-/, ""),
    table: `T-${String(full.table?.number ?? 0).padStart(2, "0")}`,
    items: live.map(item),
    subtotal: formatRs(totals.subtotal),
    charges: [
      { label: `Service charge (${full.order.service_charge_pct}%)`, value: formatRs(totals.service) },
      ...(promo.discount > 0 ? [{ label: `Promo${promo.names.length ? " · " + promo.names.join(", ") : ""}`, value: `- ${formatRs(promo.discount)}` }] : []),
      ...(totals.discount > 0 ? [{ label: "Discount", value: `- ${formatRs(totals.discount)}` }] : []),
    ],
    total: formatRs(finalTotal),
    footer1: "THANK YOU FOR VISITING!",
    footer2: "Follow us on Instagram @SpicePizza",
  };

  const bytes = await renderBill(slip);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="bill-${slip.orderNumber}.pdf"`,
    },
  });
}

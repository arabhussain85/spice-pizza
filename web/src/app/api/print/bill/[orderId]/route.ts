import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { renderReceipt, type ReceiptModel, type ReceiptTotal } from "@/lib/pdf";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const label = (li: OrderLineItem) => `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`;
const sub = (li: OrderLineItem) => [li.note, ...li.modifiers].filter(Boolean).join(", ") || undefined;

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supa = createAdminClient();
  const full = await fetchOrderFull(supa, orderId);
  if (!full) return new Response("Order not found", { status: 404 });

  const allLines = full.rounds.flatMap((r) => r.order_line_items);
  const totals = billTotals(
    allLines,
    full.order.service_charge_pct,
    full.discount ? { type: full.discount.type, value: full.discount.value } : null,
  );

  const sections = full.rounds
    .map((r) => ({
      heading: `Round ${r.round_number}`,
      rows: r.order_line_items
        .filter((li) => !li.is_voided)
        .map((li) => ({ qty: li.quantity, name: label(li), sub: sub(li), price: formatRs(li.unit_price * li.quantity) })),
    }))
    .filter((s) => s.rows.length);

  const totalRows: ReceiptTotal[] = [
    { label: "Subtotal", value: formatRs(totals.subtotal) },
    { label: `Service charge (${full.order.service_charge_pct}%)`, value: formatRs(totals.service) },
    ...(totals.discount > 0 ? [{ label: "Discount", value: `- ${formatRs(totals.discount)}` }] : []),
    { label: "Total", value: formatRs(totals.total), bold: true },
  ];

  const model: ReceiptModel = {
    title: "SPICE PIZZA",
    subtitle: `Bill · Table ${full.table?.number ?? "—"}`,
    metaRight: `#${full.order.order_number}`,
    sections,
    totals: totalRows,
    footer: "Thank you! · Best food in town",
  };

  const bytes = await renderReceipt(model);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="bill-${full.order.order_number}.pdf"`,
    },
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { renderKitchen, renderBill, mergePdfs, type KitchenSlip, type BillSlip } from "@/lib/pdf";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bare = (n: number) => formatRs(n).replace("Rs. ", "");

export async function GET(_req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const supa = createAdminClient();
  const { data: round } = await supa
    .from("order_rounds")
    .select("id, order_id, round_number, order_line_items(*, menu_items(description))")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return new Response("Round not found", { status: 404 });

  const full = await fetchOrderFull(supa, round.order_id);
  if (!full) return new Response("Order not found", { status: 404 });

  const roundItems = ((round.order_line_items ?? []) as Array<{
    quantity: number;
    name_snapshot: string;
    size_snapshot: string | null;
    note: string | null;
    modifiers: string[];
    is_voided: boolean;
    menu_items: { description: string | null } | null;
  }>).filter((li) => !li.is_voided);

  // ── Kitchen slip (this round) ──────────────────────────────────────────────
  const kitchen: KitchenSlip = {
    table: `T-${String(full.table?.number ?? 0).padStart(2, "0")}`,
    orderNumber: full.order.order_number.replace(/^SP-/, ""),
    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    items: roundItems.map((li) => ({
      qty: li.quantity,
      name: `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`,
      modifiers: [...(li.modifiers ?? []), ...(li.note ? [li.note] : [])],
      contents:
        li.menu_items?.description && /deal/i.test(li.name_snapshot)
          ? String(li.menu_items.description).split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
    })),
  };

  // ── Customer bill (whole order so far) ─────────────────────────────────────
  const live = full.rounds.flatMap((r) => r.order_line_items).filter((li) => !li.is_voided);
  const totals = billTotals(
    full.rounds.flatMap((r) => r.order_line_items),
    full.order.service_charge_pct,
    full.discount ? { type: full.discount.type, value: full.discount.value } : null,
  );
  const billItem = (li: OrderLineItem) => ({
    qty: li.quantity,
    name: `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`,
    sub: [li.note, ...li.modifiers].filter(Boolean).join(", ") || null,
    price: bare(li.unit_price * li.quantity),
  });
  const bill: BillSlip = {
    brand: "Spice Pizza",
    branch: "Main Branch",
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    orderNumber: full.order.order_number.replace(/^SP-/, ""),
    table: `T-${String(full.table?.number ?? 0).padStart(2, "0")}`,
    items: live.map(billItem),
    subtotal: formatRs(totals.subtotal),
    charges: [
      { label: `Service charge (${full.order.service_charge_pct}%)`, value: formatRs(totals.service) },
      ...(totals.discount > 0 ? [{ label: "Discount", value: `- ${formatRs(totals.discount)}` }] : []),
    ],
    total: formatRs(totals.total),
    footer1: "THANK YOU FOR VISITING!",
    footer2: "Follow us on Instagram @SpicePizza",
  };

  const merged = await mergePdfs([await renderKitchen(kitchen), await renderBill(bill)]);
  return new Response(Buffer.from(merged), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="order-${kitchen.orderNumber}-r${round.round_number}.pdf"`,
    },
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { renderReceipts, type ReceiptModel } from "@/lib/pdf";
import { formatRs } from "@/lib/money";
import { sumLines } from "@/lib/order-math";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const label = (li: OrderLineItem) => `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`;
const sub = (li: OrderLineItem) => [li.note, ...li.modifiers].filter(Boolean).join(", ") || undefined;

export async function GET(_req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const supa = createAdminClient();
  const { data: round } = await supa
    .from("order_rounds")
    .select("id, order_id, round_number, order_line_items(*)")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return new Response("Round not found", { status: 404 });

  const full = await fetchOrderFull(supa, round.order_id);
  if (!full) return new Response("Order not found", { status: 404 });

  const tableNo = full.table?.number ?? "—";
  const items = ((round.order_line_items ?? []) as OrderLineItem[]).filter((li) => !li.is_voided);
  const runningTotal = sumLines(full.rounds.flatMap((r) => r.order_line_items));
  const clock = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const kitchen: ReceiptModel = {
    title: "SPICE PIZZA · KITCHEN",
    subtitle: `Table ${tableNo} · Round ${round.round_number}`,
    metaRight: `#${full.order.order_number} · ${clock}`,
    sections: [{ rows: items.map((li) => ({ qty: li.quantity, name: label(li), sub: sub(li) })) }],
    footer: "Kitchen copy — no prices",
  };
  const counter: ReceiptModel = {
    title: "SPICE PIZZA · COUNTER",
    subtitle: `Table ${tableNo} · Round ${round.round_number}`,
    metaRight: `#${full.order.order_number} · ${clock}`,
    sections: [
      { rows: items.map((li) => ({ qty: li.quantity, name: label(li), sub: sub(li), price: formatRs(li.unit_price * li.quantity) })) },
    ],
    totals: [
      { label: `Round ${round.round_number} subtotal`, value: formatRs(sumLines(items)) },
      { label: "Running total (all rounds)", value: formatRs(runningTotal), bold: true },
    ],
  };

  const bytes = await renderReceipts([kitchen, counter]);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="round-${round.round_number}.pdf"`,
    },
  });
}

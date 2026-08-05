import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { renderKitchen, type KitchenSlip } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const items = ((round.order_line_items ?? []) as Array<{
    quantity: number;
    name_snapshot: string;
    size_snapshot: string | null;
    note: string | null;
    modifiers: string[];
    is_voided: boolean;
    menu_items: { description: string | null } | null;
  }>).filter((li) => !li.is_voided);

  const slip: KitchenSlip = {
    table: `T-${String(full.table?.number ?? 0).padStart(2, "0")}`,
    orderNumber: full.order.order_number.replace(/^SP-/, ""),
    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    items: items.map((li) => ({
      qty: li.quantity,
      name: `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`,
      modifiers: [...(li.modifiers ?? []), ...(li.note ? [li.note] : [])],
      contents:
        li.menu_items?.description && /deal/i.test(li.name_snapshot)
          ? String(li.menu_items.description).split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
    })),
  };

  const bytes = await renderKitchen(slip);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="kitchen-${slip.orderNumber}.pdf"`,
    },
  });
}

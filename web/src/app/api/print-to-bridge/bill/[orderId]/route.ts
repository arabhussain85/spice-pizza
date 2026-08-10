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

/**
 * POST /api/print-to-bridge/bill/[orderId]
 *
 * Body: { bridgeUrl: string; printerName: string; copies?: number }
 *
 * Generates the bill PDF server-side then forwards it to the local printer bridge
 * (pdf_spooler mode) so it prints silently on Windows — no browser print dialog.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const bridgeUrl: string = body.bridgeUrl || "http://localhost:4000";
  const printerName: string = body.printerName || "";
  const copies: number = Number(body.copies) || 1;

  if (!printerName) {
    return Response.json(
      { ok: false, error: "printerName is required. Configure it in Admin → Printer Settings." },
      { status: 400 }
    );
  }

  const supa = createAdminClient();

  const [full, promos, menuMeta, cfg, paysRes] = await Promise.all([
    fetchOrderFull(supa, orderId),
    fetchActivePromotions(supa),
    fetchMenuMeta(supa),
    fetchReceiptConfig(supa),
    supa
      .from("payments")
      .select("method, tendered, created_at")
      .eq("order_id", orderId)
      .not("tendered", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (!full) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });

  const allLines = full.rounds.flatMap((r) => r.order_line_items);
  const live = allLines.filter((li) => !li.is_voided);
  const totals = billTotals(
    allLines,
    full.order.service_charge_pct,
    full.discount ? { type: full.discount.type, value: full.discount.value } : null
  );
  const promo = promoTotals(live, promos, menuMeta);

  const serviceAmt = cfg.showService ? totals.service : 0;
  const netTotal = Math.max(0, totals.subtotal + serviceAmt - promo.discount - totals.discount);

  const cashPay = (paysRes.data ?? [])[0] as { method: string; tendered: number } | undefined;

  const ot = full.order.order_type;
  const tn = full.order.type_number;
  const tableLabel =
    ot === "takeaway" ? `Takeaway${tn ? ` #${tn}` : ""}`
    : ot === "delivery" ? `Delivery${tn ? ` #${tn}` : ""}`
    : `Table #${full.table?.number ?? "?"}`;

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
    token: full.order.token_number ?? null,
    table: tableLabel,
    customer:
      ot === "dine_in"
        ? null
        : { name: full.order.customer_name, phone: full.order.customer_phone, address: full.order.customer_address },
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }),
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }),
    staff: full.order.server_name ? `${full.order.server_name} (Counter)` : undefined,
    items: live.map(item),
    subtotal: formatRs(totals.subtotal),
    serviceLabel: `Service Charge (${full.order.service_charge_pct}%)`,
    serviceValue: formatRs(totals.service),
    showService: cfg.showService && totals.service > 0,
    extraLines: [
      ...(promo.discount > 0 ? [{ label: `Promo${promo.names.length ? " · " + promo.names.join(", ") : ""}`, value: `- ${formatRs(promo.discount)}` }] : []),
      ...(totals.discount > 0 ? [{ label: "Discount", value: `- ${formatRs(totals.discount)}` }] : []),
    ],
    total: formatRs(netTotal),
    payment: cashPay
      ? {
          method: cashPay.method,
          cash: formatRs(Number(cashPay.tendered)),
          change: formatRs(Math.max(0, Number(cashPay.tendered) - netTotal)),
        }
      : null,
    wifi: cfg.showWifi ? { ssid: cfg.wifiSsid, pass: cfg.wifiPass } : null,
    footer: cfg.footer || undefined,
    showItemNotes: cfg.showItemNotes,
  };

  const bytes = await renderBill(slip);
  const pdfBase64 = Buffer.from(bytes).toString("base64");

  // Forward to local printer bridge
  try {
    const bridgeRes = await fetch(`${bridgeUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "bill",
        orderId,
        printerName,
        copies,
        pdfBase64,
        paperWidth: "80mm",
      }),
    });
    const bridgeData = await bridgeRes.json().catch(() => ({}));
    if (!bridgeRes.ok) {
      return Response.json({ ok: false, error: bridgeData.error || `Bridge error ${bridgeRes.status}` }, { status: 502 });
    }
    return Response.json({ ok: true, ...bridgeData });
  } catch (err) {
    return Response.json(
      { ok: false, error: `Cannot reach printer bridge at ${bridgeUrl}. Is it running? (npm start in printer-bridge/)` },
      { status: 503 }
    );
  }
}

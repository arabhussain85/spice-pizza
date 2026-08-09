import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals } from "@/lib/promotions";
import { fetchReceiptConfig } from "@/lib/receipt-config";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/print/bill/[orderId]/html
 *
 * Returns a self-contained HTML receipt page that:
 *  - Uses @page { size: 80mm auto; margin: 0 } so the browser print dialog
 *    sets the correct paper width (no infinite roll)
 *  - Automatically calls window.print() on load
 *  - Auto-closes the tab after the dialog is dismissed
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
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
  if (!full) return new Response("Order not found", { status: 404 });

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

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const itemRows = live.map((li: OrderLineItem, i: number) => {
    const name = `${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`;
    const sub = cfg.showItemNotes
      ? [li.note, ...li.modifiers].filter(Boolean).join(", ")
      : null;
    return `
      <tr>
        <td class="sr">${i + 1}</td>
        <td class="name">${esc(name)}${sub ? `<br><span class="note">${esc(sub)}</span>` : ""}</td>
        <td class="qty">${li.quantity}</td>
        <td class="amt">${esc(formatRs(li.unit_price * li.quantity))}</td>
      </tr>`;
  }).join("");

  const extraLines = [
    ...(promo.discount > 0
      ? [`<tr><td colspan="3" class="lbl">Promo${promo.names.length ? " · " + promo.names.join(", ") : ""}</td><td class="amt red">- ${esc(formatRs(promo.discount))}</td></tr>`]
      : []),
    ...(totals.discount > 0
      ? [`<tr><td colspan="3" class="lbl">Discount${full.discount?.reason ? ` · ${full.discount.reason}` : ""}</td><td class="amt red">- ${esc(formatRs(totals.discount))}</td></tr>`]
      : []),
  ].join("");

  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt #${esc(full.order.order_number)}</title>
<style>
  /* ── Paper size: 80mm wide, auto height ── */
  @page {
    size: 80mm auto;
    margin: 4mm 0;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10pt;
    width: 72mm;          /* printable area inside 80mm */
    margin: 0 auto;
    color: #000;
    background: #fff;
  }

  /* Screen preview styling */
  @media screen {
    body {
      padding: 10px;
      border: 1px dashed #ccc;
      margin: 20px auto;
    }
  }

  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .red    { color: #af101a; }

  h1 { font-size: 14pt; letter-spacing: 2px; margin-bottom: 2px; }
  h2 { font-size: 8pt; font-weight: normal; margin-bottom: 1px; }

  .divider {
    border: none;
    border-top: 1px dashed #555;
    margin: 4px 0;
  }
  .divider-solid {
    border: none;
    border-top: 1.5px solid #000;
    margin: 4px 0;
  }

  /* Meta row */
  .meta { display: flex; justify-content: space-between; font-size: 8.5pt; margin: 2px 0; }
  .meta span { display: block; }

  /* Items table */
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { font-size: 8pt; text-align: left; padding-bottom: 2px; }
  td { padding: 1.5px 0; vertical-align: top; }
  td.sr  { width: 12px; color: #555; }
  td.name { padding-left: 3px; }
  td.qty { width: 20px; text-align: center; }
  td.amt { width: 50px; text-align: right; white-space: nowrap; }
  td.lbl { padding-left: 3px; color: #444; }
  span.note { font-size: 8pt; color: #555; }

  /* Totals */
  .totals-row { display: flex; justify-content: space-between; font-size: 9pt; margin: 1.5px 0; }
  .totals-row.big { font-size: 13pt; font-weight: bold; margin-top: 4px; }

  /* Footer */
  .footer { font-size: 7.5pt; text-align: center; margin-top: 4px; }

  /* Hide screen-only elements when printing */
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- ── Header ── -->
<div class="center">
  <h1 class="bold red">${esc(cfg.brand || "SPICE PIZZA")}</h1>
  ${cfg.tagline ? `<h2>${esc(cfg.tagline)}</h2>` : ""}
  ${cfg.address ? `<h2>${esc(cfg.address)}</h2>` : ""}
  ${cfg.phone ? `<h2>Tel: ${esc(cfg.phone)}</h2>` : ""}
  ${cfg.ntn ? `<h2>${esc(cfg.ntn)}</h2>` : ""}
</div>

<hr class="divider">

<!-- ── Meta ── -->
<div class="meta">
  <span>
    <span>ORDER #<strong>${esc(full.order.order_number)}</strong></span>
    <span>${esc(tableLabel)}</span>
    ${full.order.customer_name ? `<span>${esc(full.order.customer_name)}</span>` : ""}
    ${full.order.customer_phone ? `<span>${esc(full.order.customer_phone)}</span>` : ""}
    ${full.order.server_name ? `<span>Staff: ${esc(full.order.server_name)}</span>` : ""}
  </span>
  <span style="text-align:right">
    ${full.order.token_number != null ? `<span class="bold red">TOKEN #${full.order.token_number}</span>` : ""}
    <span>${esc(date)}</span>
    <span>${esc(time)}</span>
  </span>
</div>

<hr class="divider">

<!-- ── Items ── -->
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>ITEM</th>
      <th style="text-align:center">QTY</th>
      <th style="text-align:right">PRICE</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<hr class="divider">

<!-- ── Totals ── -->
<div class="totals-row"><span>Subtotal</span><span>${esc(formatRs(totals.subtotal))}</span></div>
${cfg.showService && totals.service > 0
  ? `<div class="totals-row"><span>Service (${full.order.service_charge_pct}%)</span><span>${esc(formatRs(totals.service))}</span></div>`
  : ""}
${promo.discount > 0
  ? `<div class="totals-row red"><span>Promo${promo.names.length ? " · " + promo.names.join(", ") : ""}</span><span>- ${esc(formatRs(promo.discount))}</span></div>`
  : ""}
${totals.discount > 0
  ? `<div class="totals-row red"><span>Discount${full.discount?.reason ? ` · ${full.discount.reason}` : ""}</span><span>- ${esc(formatRs(totals.discount))}</span></div>`
  : ""}

<hr class="divider-solid">

<div class="totals-row big"><span>TOTAL</span><span class="red">${esc(formatRs(netTotal))}</span></div>

${cashPay ? `
<hr class="divider">
<div class="totals-row"><span>${cashPay.method.toLowerCase() === "cash" ? "Cash Tendered" : `Paid (${cashPay.method})`}</span><span>${esc(formatRs(Number(cashPay.tendered)))}</span></div>
<div class="totals-row bold"><span>Change Due</span><span class="red">${esc(formatRs(Math.max(0, Number(cashPay.tendered) - netTotal)))}</span></div>
` : ""}

<hr class="divider">

${cfg.showWifi && cfg.wifiSsid ? `<div class="footer">Wi-Fi: <strong>${esc(cfg.wifiSsid)}</strong> / ${esc(cfg.wifiPass)}</div><hr class="divider">` : ""}

<!-- ── Footer ── -->
<div class="footer">
  ${cfg.footer ? `<p>${esc(cfg.footer)}</p>` : ""}
  <p><strong>THANK YOU FOR VISITING!</strong></p>
  <p>*** POWERED BY SPICE PIZZA ***</p>
</div>

<!-- ── Auto-print + close ── -->
<script>
  window.addEventListener('load', function () {
    setTimeout(function () {
      window.print();
      // Close the tab after the print dialog is dismissed
      setTimeout(function () { window.close(); }, 500);
    }, 400);
  });
</script>

</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

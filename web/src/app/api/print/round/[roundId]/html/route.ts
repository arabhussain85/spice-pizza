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
 * GET /api/print/round/[roundId]/html
 *
 * Returns a combined HTML page containing:
 * Page 1: Kitchen/Token Slip (only items in this round)
 * Page 2: Customer Counter Bill (full bill of all items in the order so far)
 *
 * Separated by a CSS page-break so that a single print action prints both slips
 * and cuts them separately (if cutter is active). Avoids browser popup blocks.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const supa = createAdminClient();

  // 1. Fetch round data first to get the order ID
  const { data: round } = await supa
    .from("order_rounds")
    .select("id, order_id, round_number, order_line_items(*, menu_items(description))")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return new Response("Round not found", { status: 404 });

  const orderId = round.order_id;

  // 2. Fetch all details for both slips
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

  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const ot = full.order.order_type;
  const tn = full.order.type_number;
  const tableLabel =
    ot === "takeaway" ? `Takeaway${tn ? ` #${tn}` : ""}`
    : ot === "delivery" ? `Delivery${tn ? ` #${tn}` : ""}`
    : `Table #${full.table?.number ?? "?"}`;

  const kitchenTableLabel =
    ot === "takeaway" ? `TAKEAWAY${tn ? ` #${tn}` : ""}`
    : ot === "delivery" ? `DELIVERY${tn ? ` #${tn}` : ""}`
    : `TABLE T-${String(full.table?.number ?? 0).padStart(2, "0")}`;

  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time12 = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const time24 = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const orderNoShort = full.order.order_number.replace(/^SP-/, "");

  // ────────────────────────────────────────────────────────
  // SLIP 1: Kitchen Slip Data (Only items in this round)
  // ────────────────────────────────────────────────────────
  type RoundItem = {
    quantity: number;
    unit_price: number;
    name_snapshot: string;
    size_snapshot: string | null;
    note: string | null;
    modifiers: string[];
    is_voided: boolean;
    menu_items: { description: string | null } | null;
  };

  const kitchenItems = ((round.order_line_items ?? []) as RoundItem[]).filter((li) => !li.is_voided);
  const roundTotal = kitchenItems.reduce((s, li) => s + li.unit_price * li.quantity, 0);

  const kitchenRows = kitchenItems.map((li) => {
    const name = e(`${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`);
    const mods = [...(li.modifiers ?? []), ...(li.note ? [li.note] : [])];
    const contents =
      li.menu_items?.description && /deal/i.test(li.name_snapshot)
        ? String(li.menu_items.description).split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    return `<tr>
      <td class="c-qty">${li.quantity}x</td>
      <td class="c-name">
        ${name}
        ${mods.map((m) => `<span class="mod">*** ${e(m).toUpperCase()} ***</span>`).join("")}
        ${contents.map((c) => `<span class="cont">- ${e(c)}</span>`).join("")}
      </td>
      <td class="c-amt">${e(formatRs(li.unit_price * li.quantity))}</td>
    </tr>`;
  }).join("");

  // ────────────────────────────────────────────────────────
  // SLIP 2: Customer Bill Data (Full order items)
  // ────────────────────────────────────────────────────────
  const allLines = full.rounds.flatMap((r) => r.order_line_items);
  const liveLines = allLines.filter((li) => !li.is_voided);
  const totals = billTotals(
    allLines,
    full.order.service_charge_pct,
    full.discount ? { type: full.discount.type, value: full.discount.value } : null
  );
  const promo = promoTotals(liveLines, promos, menuMeta);
  const serviceAmt = cfg.showService ? totals.service : 0;
  const netTotal = Math.max(0, totals.subtotal + serviceAmt - promo.discount - totals.discount);
  const cashPay = (paysRes.data ?? [])[0] as { method: string; tendered: number } | undefined;

  let billTotalQty = 0;
  const billRows = liveLines.map((li: OrderLineItem, i: number) => {
    const name = e(`${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`);
    const mods = cfg.showItemNotes
      ? [li.note, ...li.modifiers].filter(Boolean).map(e).join(", ")
      : "";
    const price = e(formatRs(li.unit_price * li.quantity));
    billTotalQty += li.quantity;
    return `<tr>
      <td class="c-no">${i + 1}.</td>
      <td class="c-name">${name}${mods ? `<span class="mod">* ${mods}</span>` : ""}</td>
      <td class="c-qty">${li.quantity}</td>
      <td class="c-amt">${price}</td>
    </tr>`;
  }).join("");

  const billTotalRows = [
    `<tr><td class="lbl">Subtotal</td><td class="val">${e(formatRs(totals.subtotal))}</td></tr>`,
    cfg.showService && totals.service > 0
      ? `<tr><td class="lbl">Service (${full.order.service_charge_pct}%)</td><td class="val">${e(formatRs(totals.service))}</td></tr>`
      : "",
    promo.discount > 0
      ? `<tr><td class="lbl">Promo${promo.names.length ? " - " + promo.names.join(", ") : ""}</td><td class="val">- ${e(formatRs(promo.discount))}</td></tr>`
      : "",
    totals.discount > 0
      ? `<tr><td class="lbl">Discount${full.discount?.reason ? " - " + full.discount.reason : ""}</td><td class="val">- ${e(formatRs(totals.discount))}</td></tr>`
      : "",
  ].filter(Boolean).join("\n");

  const payRows = cashPay ? `<tr>
    <td class="p-lbl">${cashPay.method.toLowerCase() === "cash" ? "Cash Tendered" : `Paid (${e(cashPay.method)})`}</td>
    <td class="p-val">${e(formatRs(Number(cashPay.tendered)))}</td>
  </tr>
  <tr>
    <td class="p-lbl">Change Due</td>
    <td class="p-chg">${e(formatRs(Math.max(0, Number(cashPay.tendered) - netTotal)))}</td>
  </tr>` : "";

  const wifiBlock = cfg.showWifi && cfg.wifiSsid
    ? `<p class="wifi"><b>Wi-Fi: ${e(cfg.wifiSsid)} / ${e(cfg.wifiPass)}</b></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Order ${e(full.order.order_number)} - Slips</title>
<style>
@page { size: 80mm auto; margin: 3mm 4mm; }

* { margin:0; padding:0; box-sizing:border-box; }

html, body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 10pt;
  font-weight: bold;
  line-height: 1.5;
  width: 74mm;
  max-width: 74mm;
  color: #000;
  background: #fff;
}

@media print {
  html, body { width: 74mm; max-width: 74mm; }
  .page-break {
    display: block;
    page-break-before: always;
    break-before: page;
  }
}

@media screen {
  body {
    padding: 10px;
    margin: 20px auto;
    background: #eee;
  }
  .receipt-page {
    background: #fff;
    border: 2px solid #000;
    padding: 10px;
    margin-bottom: 20px;
  }
}

/* ────────────────────────────────────────────────────────
   COMMON STYLE COMPONENTS
   ──────────────────────────────────────────────────────── */
.brand        { font-size:16pt; font-weight:bold; letter-spacing:3px; text-align:center; margin:3px 0 2px; }
.hsub         { font-size:9pt; font-weight:bold; text-align:center; line-height:1.6; }
.sep-solid    { border:none; border-top:3px solid #000; margin:4px 0; }
.sep-solid-2  { border:none; border-top:2px solid #000; margin:4px 0; }
.sep-dash     { border:none; border-top:2px dashed #000; margin:3px 0; }
.hborder      { text-align:center; font-size:9pt; font-weight:bold; margin:1px 0; }

.token-box {
  border: 3px solid #000;
  text-align: center;
  font-size: 20pt;
  font-weight: bold;
  letter-spacing: 3px;
  padding: 3px 4px;
  margin: 4px 0;
}

.meta { width:100%; font-size:10pt; font-weight:bold; border-collapse:collapse; margin:3px 0; }
.meta td { padding:1.5px 0; vertical-align:top; }
.meta .ml { width:55%; }
.meta .mr { width:45%; text-align:right; }

/* ────────────────────────────────────────────────────────
   SLIP 1: KITCHEN SPECIFIC STYLES
   ──────────────────────────────────────────────────────── */
.kitchen-title { font-size:14pt; font-weight:bold; text-align:center; letter-spacing:2px; margin:3px 0; }
.round-badge   { font-size:13pt; font-weight:bold; text-align:center; letter-spacing:2px; margin:3px 0; padding:2px 0; border-top:3px solid #000; border-bottom:3px solid #000; }

.k-items { width:100%; border-collapse:collapse; font-size:11pt; font-weight:bold; }
.k-items col.c-qty  { width:12mm; }
.k-items col.c-name { }
.k-items col.c-amt  { width:20mm; }
.k-items thead tr   { border-top:2px solid #000; border-bottom:2px solid #000; }
.k-items thead th   { font-size:9pt; font-weight:bold; text-transform:uppercase; padding:3px 0; }
.k-items thead th.c-qty  { text-align:left; }
.k-items thead th.c-name { text-align:left; padding-left:3px; }
.k-items thead th.c-amt  { text-align:right; }
.k-items tbody tr   { border-bottom:2px dashed #000; }
.k-items tbody td   { padding:4px 0; vertical-align:top; font-weight:bold; }
.k-items tbody td.c-qty  { font-size:13pt; padding-top:5px; }
.k-items tbody td.c-name { padding-left:3px; line-height:1.4; }
.k-items tbody td.c-amt  { text-align:right; white-space:nowrap; }

.mod  { font-size:9pt; display:block; padding-left:3px; }
.cont { font-size:9pt; display:block; padding-left:3px; }

.k-total { width:100%; border-collapse:collapse; border-top:3px solid #000; border-bottom:3px solid #000; margin:4px 0; }
.k-total td { padding:4px 0; font-weight:bold; }
.k-lbl { font-size:13pt; }
.k-val { font-size:14pt; text-align:right; white-space:nowrap; }

/* ────────────────────────────────────────────────────────
   SLIP 2: BILL SPECIFIC STYLES
   ──────────────────────────────────────────────────────── */
.b-items { width:100%; border-collapse:collapse; font-size:10pt; font-weight:bold; }
.b-items col.c-no  { width:7mm; }
.b-items col.c-qty { width:10mm; }
.b-items col.c-amt { width:21mm; }
.b-items thead tr  { border-top:3px solid #000; border-bottom:3px solid #000; }
.b-items thead th  { font-size:9pt; font-weight:bold; text-transform:uppercase; padding:4px 0; }
.b-items thead th.c-no   { text-align:left; }
.b-items thead th.c-name { text-align:left; padding-left:3px; }
.b-items thead th.c-qty  { text-align:center; }
.b-items thead th.c-amt  { text-align:right; }
.b-items tbody tr  { border-bottom:2px dashed #000; }
.b-items tbody td  { padding:4px 0; vertical-align:top; font-weight:bold; }
.b-items tbody td.c-no   { font-size:9pt; padding-top:5px; }
.b-items tbody td.c-name { padding-left:3px; line-height:1.4; }
.b-items tbody td.c-qty  { text-align:center; }
.b-items tbody td.c-amt  { text-align:right; white-space:nowrap; }
.b-items tfoot tr  { border-top:3px solid #000; }
.b-items tfoot td  { padding:4px 0; font-size:9pt; font-weight:bold; }
.b-items tfoot td.c-qty { text-align:center; }

.totals { width:100%; border-collapse:collapse; font-size:10pt; font-weight:bold; margin:3px 0; }
.totals td { padding:2px 0; }
.totals .lbl { }
.totals .val { text-align:right; white-space:nowrap; }

.grand { width:100%; border-collapse:collapse; border-top:3px solid #000; border-bottom:3px solid #000; margin:4px 0; }
.grand td { padding:5px 0; }
.g-lbl { font-size:14pt; }
.g-val { font-size:17pt; text-align:right; white-space:nowrap; }

.pay { width:100%; border-collapse:collapse; font-size:10pt; font-weight:bold; margin:2px 0; }
.pay td { padding:2px 0; }
.pay .p-lbl { }
.pay .p-val { text-align:right; white-space:nowrap; }
.pay .p-chg { text-align:right; font-size:12pt; white-space:nowrap; }

.wifi   { font-size:9pt; text-align:center; margin:3px 0; }
.footer { text-align:center; font-size:9pt; line-height:1.8; margin-top:3px; }
.thanks { font-size:11pt; letter-spacing:1px; }
</style>
</head>
<body>

<!-- SLIP 1: KITCHEN / TOKEN ORDER -->
<div class="receipt-page">
  <p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
  <p class="hsub">KITCHEN ORDER</p>
  <hr class="sep-solid">

  ${full.order.token_number != null
    ? `<div class="token-box">TOKEN # ${full.order.token_number}</div>`
    : ""}

  <table class="meta">
    <tr>
      <td><b>${e(kitchenTableLabel)}</b></td>
      <td class="mr">Order #${e(orderNoShort)}</td>
    </tr>
    <tr>
      <td></td>
      <td class="mr">${e(time24)}</td>
    </tr>
  </table>

  <div class="round-badge">ROUND ${round.round_number}</div>

  <table class="k-items">
    <colgroup>
      <col class="c-qty">
      <col class="c-name">
      <col class="c-amt">
    </colgroup>
    <thead>
      <tr>
        <th class="c-qty">QTY</th>
        <th class="c-name">ITEM</th>
        <th class="c-amt">PRICE</th>
      </tr>
    </thead>
    <tbody>${kitchenRows}</tbody>
  </table>

  <table class="k-total">
    <tr>
      <td class="k-lbl">ROUND TOTAL</td>
      <td class="k-val">${e(formatRs(roundTotal))}</td>
    </tr>
  </table>

  <div class="footer" style="page-break-after: avoid; break-after: avoid;">
    <p>--- END OF KITCHEN ORDER ---</p>
  </div>
</div>

<!-- PAGE BREAK FOR PRINTER -->
<div class="page-break"></div>

<!-- SLIP 2: CUSTOMER / COUNTER BILL -->
<div class="receipt-page">
  <p class="hborder">================================</p>
  <p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
  ${cfg.tagline ? `<p class="hsub">${e(cfg.tagline)}</p>` : ""}
  ${cfg.address ? `<p class="hsub">${e(cfg.address)}</p>` : ""}
  ${cfg.phone   ? `<p class="hsub">Tel: ${e(cfg.phone)}</p>` : ""}
  ${cfg.ntn     ? `<p class="hsub">${e(cfg.ntn)}</p>` : ""}
  <p class="hborder">================================</p>

  ${full.order.token_number != null ? `<div class="token-box" style="font-size: 13pt; letter-spacing: 2px; border-width: 3px; padding: 3px 4px;">TOKEN # ${full.order.token_number}</div>` : ""}

  <table class="meta">
    <tr>
      <td class="ml">ORDER #${e(full.order.order_number)}</td>
      <td class="mr">${e(date)}</td>
    </tr>
    <tr>
      <td class="ml">${e(tableLabel)}</td>
      <td class="mr">${e(time12)}</td>
    </tr>
    ${full.order.server_name  ? `<tr><td class="ml">Staff: ${e(full.order.server_name)}</td><td></td></tr>` : ""}
    ${full.order.customer_name  ? `<tr><td class="ml">Cust: ${e(full.order.customer_name)}</td><td></td></tr>` : ""}
    ${full.order.customer_phone ? `<tr><td class="ml">Tel:  ${e(full.order.customer_phone)}</td><td></td></tr>` : ""}
  </table>

  <table class="b-items">
    <colgroup>
      <col class="c-no">
      <col class="c-name">
      <col class="c-qty">
      <col class="c-amt">
    </colgroup>
    <thead>
      <tr>
        <th class="c-no">#</th>
        <th class="c-name">DESCRIPTION</th>
        <th class="c-qty">QTY</th>
        <th class="c-amt">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${billRows}</tbody>
    <tfoot>
      <tr>
        <td class="c-no"></td>
        <td class="c-name">TOTAL ITEMS</td>
        <td class="c-qty">${billTotalQty}</td>
        <td class="c-amt"></td>
      </tr>
    </tfoot>
  </table>

  <table class="totals">${billTotalRows}</table>

  <table class="grand">
    <tr>
      <td class="g-lbl">TOTAL</td>
      <td class="g-val">${e(formatRs(netTotal))}</td>
    </tr>
  </table>

  ${cashPay ? `<table class="pay">${payRows}</table>` : ""}

  <hr class="sep-dash">
  ${wifiBlock}

  <div class="footer" style="page-break-after: avoid; break-after: avoid;">
    ${cfg.footer ? `<p>${e(cfg.footer)}</p>` : ""}
    <p class="thanks">** THANK YOU FOR VISITING! **</p>
    <p>${e(cfg.brand || "SPICE PIZZA")}</p>
    <br>
  </div>
</div>

<script>
  window.addEventListener('load', function () {
    window.addEventListener('afterprint', function () {
      setTimeout(function () { window.close(); }, 200);
    });
    setTimeout(function () { window.print(); }, 400);
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

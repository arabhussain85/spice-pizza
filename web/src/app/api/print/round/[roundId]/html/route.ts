import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals } from "@/lib/promotions";
import { fetchReceiptConfig } from "@/lib/receipt-config";
import type { OrderLineItem } from "@/lib/types";
import { LOGO_PNG_BASE64 } from "@/lib/logo-data";

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

  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
  const time12 = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });
  const time24 = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
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
    full.discount ? { type: full.discount.type, value: full.discount.value } : null,
    full.order.delivery_charge ?? 0
  );
  const promo = promoTotals(liveLines, promos, menuMeta);
  const serviceAmt = cfg.showService ? totals.service : 0;
  const netTotal = Math.max(0, totals.subtotal + serviceAmt + totals.delivery - promo.discount - totals.discount);
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
    ot === "delivery"
      ? `<tr><td class="lbl">Delivery Charge</td><td class="val">${totals.delivery > 0 ? e(formatRs(totals.delivery)) : "FREE"}</td></tr>`
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
    ? `<p class="wifi">Wi-Fi: ${e(cfg.wifiSsid)} / ${e(cfg.wifiPass)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Order ${e(full.order.order_number)} - Slips</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@page { size: 80mm auto; margin: 3mm 4mm; }

* { margin:0; padding:0; box-sizing:border-box; }

html, body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 8.5pt;
  font-weight: 400;
  line-height: 1.45;
  width: 72mm;
  max-width: 72mm;
  color: #000;
  background: #fff;
}

@media print {
  html, body { width: 72mm; max-width: 72mm; }
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
    border: 1px solid #ddd;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    padding: 15px;
    margin-bottom: 20px;
    border-radius: 8px;
  }
}

/* Logo styling */
.logo-container {
  text-align: center;
  margin: 5px 0 10px;
}
.logo-img {
  width: 32mm;
  max-width: 120px;
  height: auto;
  filter: grayscale(1) contrast(1.5);
  transform: rotate(0deg);
}

/* ── Common style elements ── */
.brand        { font-size:13pt; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; text-align:center; margin-bottom:4px; }
.hsub         { font-size:8pt; font-weight:600; text-align:center; line-height:1.4; color:#000; }
.sep-solid    { border:none; border-top:1px solid #000; margin:6px 0; }
.sep-solid-2  { border:none; border-top:1px solid #000; margin:6px 0; }
.sep-dash     { border:none; border-top:1px dashed #000; margin:6px 0; }
.hborder      { text-align:center; font-size:9pt; font-weight:bold; margin:1px 0; display:none; }

.token-box {
  border: 1.5px solid #000;
  text-align: center;
  font-size: 13pt;
  font-weight: 700;
  padding: 4px;
  margin: 8px 0;
  text-transform: uppercase;
}

.meta { width:100%; font-size:8pt; border-collapse:collapse; margin:6px 0; }
.meta td { padding:2px 0; vertical-align:top; }
.meta .ml { width:55%; color:#000; font-weight:600; }
.meta .mr { width:45%; text-align:right; color:#000; font-weight:600; }

/* ── Slip 1: Kitchen specifiche ── */
.kitchen-title { font-size:12pt; font-weight:700; text-align:center; letter-spacing:1px; margin:4px 0; text-transform:uppercase; }
.round-badge   { font-size:10pt; font-weight:700; text-align:center; letter-spacing:1px; margin:6px 0; padding:4px 0; border-top:1px solid #000; border-bottom:1px solid #000; }

.k-items { width:100%; border-collapse:collapse; font-size:9.5pt; font-weight:600; }
.k-items col.c-qty  { width:9mm; }
.k-items col.c-name { }
.k-items col.c-amt  { width:18mm; }
.k-items thead tr   { border-top:1px solid #000; border-bottom:1px solid #000; }
.k-items thead th   { font-size:8pt; font-weight:700; text-transform:uppercase; padding:5px 0; }
.k-items thead th.c-qty  { text-align:left; }
.k-items thead th.c-name { text-align:left; padding-left:3px; }
.k-items thead th.c-amt  { text-align:right; }
.k-items tbody tr   { border-bottom:1px dashed #000; }
.k-items tbody td   { padding:6px 0; vertical-align:top; }
.k-items tbody td.c-qty  { font-size:11pt; font-weight:700; padding-top:4px; }
.k-items tbody td.c-name { padding-left:3px; font-weight:600; line-height:1.35; }
.k-items tbody td.c-amt  { text-align:right; white-space:nowrap; font-weight:600; }

.mod  { font-size:8pt; font-weight:600; color:#000; display:block; padding-left:3px; margin-top:1px; }
.cont { font-size:8pt; font-weight:600; color:#000; display:block; padding-left:3px; margin-top:1px; }

.k-total { width:100%; border-collapse:collapse; border-top:1px solid #000; border-bottom:1px solid #000; margin:6px 0; }
.k-total td { padding:5px 0; font-weight:700; }
.k-lbl { font-size:10pt; }
.k-val { font-size:11pt; text-align:right; white-space:nowrap; }

/* ── Slip 2: Bill specifiche ── */
.b-items { width:100%; border-collapse:collapse; font-size:8.5pt; margin:8px 0; }
.b-items col.c-no  { width:6mm; }
.b-items col.c-qty { width:9mm; }
.b-items col.c-amt { width:18mm; }
.b-items thead tr  { border-top:1px solid #000; border-bottom:1px solid #000; }
.b-items thead th  { font-size:7.5pt; font-weight:700; text-transform:uppercase; padding:5px 0; }
.b-items thead th.c-no   { text-align:left; }
.b-items thead th.c-name { text-align:left; padding-left:3px; }
.b-items thead th.c-qty  { text-align:center; }
.b-items thead th.c-amt  { text-align:right; }
.b-items tbody tr  { border-bottom:1px dashed #000; }
.b-items tbody td  { padding:5px 0; vertical-align:top; }
.b-items tbody td.c-no   { font-size:7.5pt; color:#000; padding-top:5px; font-weight:600; }
.b-items tbody td.c-name { padding-left:3px; font-weight:600; line-height:1.35; }
.b-items tbody td.c-qty  { text-align:center; font-weight:600; }
.b-items tbody td.c-amt  { text-align:right; white-space:nowrap; font-weight:600; }
.b-items tfoot tr  { border-top:1px solid #000; }
.b-items tfoot td  { padding:6px 0; font-size:8.5pt; font-weight:700; }
.b-items tfoot td.c-qty { text-align:center; }

.totals { width:100%; border-collapse:collapse; font-size:8.5pt; margin:6px 0; }
.totals td { padding:2px 0; }
.totals .lbl { color:#000; font-weight:600; }
.totals .val { text-align:right; white-space:nowrap; font-weight:600; }

.grand { width:100%; border-collapse:collapse; border-top:1.5px solid #000; border-bottom:1.5px solid #000; margin:6px 0; }
.grand td { padding:6px 0; }
.g-lbl { font-size:11pt; font-weight:700; }
.g-val { font-size:13pt; font-weight:700; text-align:right; white-space:nowrap; }

.pay { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 4px 0; }
.pay td { padding: 2px 0; }
.pay .p-lbl { color: #000; font-weight: 600; }
.pay .p-val { text-align: right; white-space: nowrap; font-weight: 600; }
.pay .p-chg { text-align: right; font-size: 10pt; font-weight: 700; white-space: nowrap; }

.qr     { text-align:center; margin:8px 0; }
.qr img { width:150px; height:150px; image-rendering:pixelated; }
.qrcap  { font-size:8pt; font-weight:700; margin-top:2px; color:#000; }
.type-box { text-align:center; font-size:16pt; font-weight:800; letter-spacing:1px; margin:6px 0 4px; text-transform:uppercase; }
.wifi   { font-size:8pt; font-weight:700; text-align:center; margin:6px 0; color:#000; }
.footer { text-align:center; font-size:8.5pt; line-height:1.6; margin-top:8px; color:#000; font-weight:600; }
.thanks { font-size:9pt; font-weight:700; letter-spacing:0.5px; margin-top:4px; }
</style>
</head>
<body>

<!-- SLIP 1: KITCHEN / TOKEN ORDER -->
<div class="receipt-page">
  <div class="logo-container">
    <img class="logo-img" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Logo" />
  </div>

  <p class="brand">${e(cfg.brand || "PIZZA BITES")}</p>
  <p class="kitchen-title">KITCHEN ORDER</p>
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
  <div class="logo-container">
    <img class="logo-img" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Logo" />
  </div>

  <div class="header-wrap">
    <p class="brand">${e(cfg.brand || "PIZZA BITES")}</p>
    ${cfg.tagline ? `<p class="hsub">${e(cfg.tagline)}</p>` : ""}
    ${cfg.address ? `<p class="hsub">${e(cfg.address)}</p>` : ""}
    ${cfg.phone   ? `<p class="hsub">Tel: ${e(cfg.phone)}</p>` : ""}
    ${cfg.ntn     ? `<p class="hsub">${e(cfg.ntn)}</p>` : ""}
  </div>

  ${ot !== "dine_in" ? `<div class="type-box">${e(tableLabel)}</div>` : ""}
  ${full.order.token_number != null ? `<div class="token-box">TOKEN # ${full.order.token_number}</div>` : ""}

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
    ${full.order.customer_address ? `<tr><td class="ml" colspan="2">Addr: ${e(full.order.customer_address)}</td></tr>` : ""}
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
    <p>${e(cfg.brand || "PIZZA BITES")}</p>
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

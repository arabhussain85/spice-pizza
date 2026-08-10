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
 * Returns a self-contained HTML receipt page optimised for 80mm thermal printers.
 *  - @page { size: 80mm auto } → correct paper width, no infinite roll
 *  - Proper 4-column item table: # | DESCRIPTION | QTY | AMOUNT
 *  - Solid-rule headers, dashed row separators, tfoot total-items
 *  - Double-border grand total block
 *  - Auto-calls window.print() on load, closes via afterprint event
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
  const live     = allLines.filter((li) => !li.is_voided);
  const totals   = billTotals(
    allLines,
    full.order.service_charge_pct,
    full.discount ? { type: full.discount.type, value: full.discount.value } : null
  );
  const promo    = promoTotals(live, promos, menuMeta);
  const serviceAmt = cfg.showService ? totals.service : 0;
  const netTotal   = Math.max(0, totals.subtotal + serviceAmt - promo.discount - totals.discount);
  const cashPay    = (paysRes.data ?? [])[0] as { method: string; tendered: number } | undefined;

  const ot = full.order.order_type;
  const tn = full.order.type_number;
  const tableLabel =
    ot === "takeaway" ? `Takeaway${tn ? ` #${tn}` : ""}`
    : ot === "delivery" ? `Delivery${tn ? ` #${tn}` : ""}`
    : `Table #${full.table?.number ?? "?"}`;

  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  // Safe HTML escape
  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // ── Item rows ─────────────────────────────────────────────────────
  let totalQty = 0;
  const itemRows = live.map((li: OrderLineItem, i: number) => {
    const name  = e(`${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`);
    const mods  = cfg.showItemNotes
      ? [li.note, ...li.modifiers].filter(Boolean).map(e).join(", ")
      : "";
    const price = e(formatRs(li.unit_price * li.quantity));
    totalQty += li.quantity;
    return `<tr>
  <td class="c-no">${i + 1}.</td>
  <td class="c-name">${name}${mods ? `<span class="mod">&#8250; ${mods}</span>` : ""}</td>
  <td class="c-qty">${li.quantity}</td>
  <td class="c-amt">${price}</td>
</tr>`;
  }).join("");

  // ── Totals rows ───────────────────────────────────────────────────
  const totalRows = [
    `<tr><td class="lbl">Subtotal</td><td class="val">${e(formatRs(totals.subtotal))}</td></tr>`,
    cfg.showService && totals.service > 0
      ? `<tr><td class="lbl">Service Charge (${full.order.service_charge_pct}%)</td><td class="val">${e(formatRs(totals.service))}</td></tr>`
      : "",
    promo.discount > 0
      ? `<tr><td class="lbl">Promo${promo.names.length ? " - " + promo.names.join(", ") : ""}</td><td class="val disc">- ${e(formatRs(promo.discount))}</td></tr>`
      : "",
    totals.discount > 0
      ? `<tr><td class="lbl">Discount${full.discount?.reason ? " - " + full.discount.reason : ""}</td><td class="val disc">- ${e(formatRs(totals.discount))}</td></tr>`
      : "",
  ].filter(Boolean).join("\n");

  // ── Payment rows ──────────────────────────────────────────────────
  const payRows = cashPay ? `<tr>
  <td class="p-lbl">${cashPay.method.toLowerCase() === "cash" ? "Cash Tendered" : `Paid (${e(cashPay.method)})`}</td>
  <td class="p-val">${e(formatRs(Number(cashPay.tendered)))}</td>
</tr>
<tr>
  <td class="p-lbl">Change Due</td>
  <td class="p-chg">${e(formatRs(Math.max(0, Number(cashPay.tendered) - netTotal)))}</td>
</tr>` : "";

  // ── WiFi block ────────────────────────────────────────────────────
  const wifiBlock = cfg.showWifi && cfg.wifiSsid
    ? `<p class="wifi">Wi-Fi: <b>${e(cfg.wifiSsid)}</b> &nbsp;/&nbsp; ${e(cfg.wifiPass)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt #${e(full.order.order_number)}</title>
<style>
@page {
  size: 80mm auto;
  margin: 3mm 4mm;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 9pt;
  line-height: 1.4;
  width: 74mm;
  color: #000;
  background: #fff;
}
@media screen {
  body {
    width: 74mm;
    padding: 10px;
    margin: 20px auto;
    border: 1px solid #bbb;
    background: #fafafa;
    box-shadow: 0 2px 10px rgba(0,0,0,.12);
  }
}

/* ── Header ── */
.hborder { text-align:center; font-size:8pt; line-height:1.1; margin:1px 0; }
.brand   { font-size:15pt; font-weight:bold; letter-spacing:3px; text-align:center; margin:3px 0 1px; }
.hsub    { font-size:8pt; text-align:center; line-height:1.55; }

/* ── Token box ── */
.token-box {
  border: 2px solid #000;
  text-align: center;
  font-size: 12pt;
  font-weight: bold;
  letter-spacing: 2px;
  padding: 2px 4px;
  margin: 4px 0;
}

/* ── Order meta ── */
.meta { width:100%; font-size:8.5pt; border-collapse:collapse; margin:3px 0; }
.meta td { padding:1px 0; vertical-align:top; }
.meta .ml { width:55%; }
.meta .mr { width:45%; text-align:right; }

/* ── Separators ── */
.sep-solid { border:none; border-top:1.5px solid #000; margin:3px 0; }
.sep-dash  { border:none; border-top:1px dashed #666; margin:2px 0; }

/* ── Items table ── */
.items { width:100%; border-collapse:collapse; font-size:9pt; }
.items col.c-no  { width:6mm; }
.items col.c-name{ }
.items col.c-qty { width:9mm; }
.items col.c-amt { width:20mm; }

.items thead tr { border-top:2px solid #000; border-bottom:1.5px solid #000; }
.items thead th  { font-size:8pt; font-weight:bold; text-transform:uppercase; padding:3px 0; }
.items thead th.c-no   { text-align:left; }
.items thead th.c-name { text-align:left; padding-left:3px; }
.items thead th.c-qty  { text-align:center; }
.items thead th.c-amt  { text-align:right; }

.items tbody tr { border-bottom:1px dashed #888; }
.items tbody td { padding:3px 0; vertical-align:top; }
.items tbody td.c-no   { font-size:8pt; color:#333; padding-top:4px; }
.items tbody td.c-name { padding-left:3px; font-weight:bold; line-height:1.35; }
.items tbody td.c-qty  { text-align:center; font-weight:bold; }
.items tbody td.c-amt  { text-align:right; font-weight:bold; white-space:nowrap; }

.items tfoot tr { border-top:1.5px solid #000; }
.items tfoot td { padding:3px 0; font-size:8.5pt; font-weight:bold; }
.items tfoot td.c-qty { text-align:center; }

.mod { font-size:7.5pt; font-weight:normal; color:#333; padding-left:3px; display:block; }

/* ── Totals ── */
.totals { width:100%; border-collapse:collapse; font-size:9pt; margin:2px 0; }
.totals td { padding:1.5px 0; }
.totals .lbl { }
.totals .val { text-align:right; white-space:nowrap; font-weight:bold; }
.totals .disc { color:#1a7a1a; }

/* ── Grand total ── */
.grand { width:100%; border-collapse:collapse; border-top:2px solid #000; border-bottom:2px solid #000; margin:3px 0; }
.grand td { padding:4px 0; }
.g-lbl { font-size:13pt; font-weight:bold; letter-spacing:1px; }
.g-val { font-size:16pt; font-weight:bold; text-align:right; white-space:nowrap; }

/* ── Payment rows ── */
.pay { width:100%; border-collapse:collapse; font-size:9pt; margin:1px 0; }
.pay td { padding:1.5px 0; }
.pay .p-lbl { font-weight:bold; }
.pay .p-val { text-align:right; font-weight:bold; white-space:nowrap; }
.pay .p-chg { text-align:right; font-size:11pt; font-weight:bold; white-space:nowrap; }

/* ── WiFi / Footer ── */
.wifi   { font-size:7.5pt; text-align:center; margin:2px 0; }
.footer { text-align:center; font-size:8pt; line-height:1.7; margin-top:2px; }
.thanks { font-size:9.5pt; font-weight:bold; letter-spacing:1px; }
</style>
</head>
<body>

<p class="hborder">********************************</p>
<p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
${cfg.tagline ? `<p class="hsub">${e(cfg.tagline)}</p>` : ""}
${cfg.address ? `<p class="hsub">${e(cfg.address)}</p>` : ""}
${cfg.phone   ? `<p class="hsub">Tel: ${e(cfg.phone)}</p>` : ""}
${cfg.ntn     ? `<p class="hsub">${e(cfg.ntn)}</p>` : ""}
<p class="hborder">********************************</p>

${full.order.token_number != null ? `<div class="token-box">TOKEN # ${full.order.token_number}</div>` : ""}

<table class="meta">
  <tr>
    <td class="ml"><b>ORDER #${e(full.order.order_number)}</b></td>
    <td class="mr"><b>${e(date)}</b></td>
  </tr>
  <tr>
    <td class="ml"><b>${e(tableLabel)}</b></td>
    <td class="mr">${e(time)}</td>
  </tr>
  ${full.order.server_name  ? `<tr><td class="ml">Staff: ${e(full.order.server_name)}</td><td></td></tr>` : ""}
  ${full.order.customer_name  ? `<tr><td class="ml">Cust:  ${e(full.order.customer_name)}</td><td></td></tr>` : ""}
  ${full.order.customer_phone ? `<tr><td class="ml">Tel:   ${e(full.order.customer_phone)}</td><td></td></tr>` : ""}
</table>

<table class="items">
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
  <tbody>
    ${itemRows}
  </tbody>
  <tfoot>
    <tr>
      <td class="c-no"></td>
      <td class="c-name">TOTAL ITEMS</td>
      <td class="c-qty">${totalQty}</td>
      <td class="c-amt"></td>
    </tr>
  </tfoot>
</table>

<table class="totals">
  ${totalRows}
</table>

<table class="grand">
  <tr>
    <td class="g-lbl">TOTAL</td>
    <td class="g-val">${e(formatRs(netTotal))}</td>
  </tr>
</table>

${cashPay ? `<table class="pay">${payRows}</table><hr class="sep-dash">` : ""}

${wifiBlock}${wifiBlock ? `<hr class="sep-dash">` : ""}

<div class="footer">
  ${cfg.footer ? `<p>${e(cfg.footer)}</p>` : ""}
  <p class="thanks">** THANK YOU FOR VISITING! **</p>
  <p>${e(cfg.brand || "SPICE PIZZA")}</p>
  <br>
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

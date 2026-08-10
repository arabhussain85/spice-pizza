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
  const promo      = promoTotals(live, promos, menuMeta);
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

  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ── Item rows ──────────────────────────────────────────────────
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
  <td class="c-name">${name}${mods ? `<span class="mod">* ${mods}</span>` : ""}</td>
  <td class="c-qty">${li.quantity}</td>
  <td class="c-amt">${price}</td>
</tr>`;
  }).join("");

  // ── Totals rows ────────────────────────────────────────────────
  const totalRows = [
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

  // ── Payment rows ───────────────────────────────────────────────
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
<title>Receipt #${e(full.order.order_number)}</title>
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
  overflow: hidden;        /* never spill to a 2nd page */
}

@media print {
  html, body { overflow: hidden; width: 72mm; max-width: 72mm; }
  .footer { page-break-after: avoid; }
}

@media screen {
  body {
    padding: 15px;
    margin: 20px auto;
    border: 1px solid #ddd;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    background: #fff;
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
  transform: rotate(-7deg);
}

/* ── Header ── */
.header-wrap {
  text-align: center;
  border-bottom: 1px dashed #000;
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.brand   { font-size: 13pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px; }
.hsub    { font-size: 8pt; font-weight: 400; color: #333; line-height: 1.4; }

/* ── Token ── */
.token-box {
  border: 1.5px solid #000;
  text-align: center;
  font-size: 13pt;
  font-weight: 700;
  padding: 4px;
  margin: 8px 0;
  text-transform: uppercase;
}

/* ── Meta ── */
.meta { width: 100%; font-size: 8pt; border-collapse: collapse; margin: 6px 0; }
.meta td { padding: 2px 0; vertical-align: top; }
.meta .ml { width: 55%; color: #222; }
.meta .mr { width: 45%; text-align: right; color: #222; }

/* ── Separators ── */
.sep-solid { border: none; border-top: 1px solid #000; margin: 6px 0; }
.sep-dash  { border: none; border-top: 1px dashed #000; margin: 6px 0; }

/* ── Items table ── */
.items { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 8px 0; }
.items col.c-no  { width: 6mm; }
.items col.c-qty { width: 9mm; }
.items col.c-amt { width: 18mm; }

.items thead tr {
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
}
.items thead th {
  font-size: 7.5pt;
  font-weight: 600;
  text-transform: uppercase;
  padding: 5px 0;
}
.items thead th.c-no   { text-align: left; }
.items thead th.c-name { text-align: left; padding-left: 3px; }
.items thead th.c-qty  { text-align: center; }
.items thead th.c-amt  { text-align: right; }

.items tbody tr { border-bottom: 1px dashed #eee; }
.items tbody td { padding: 5px 0; vertical-align: top; }
.items tbody td.c-no   { font-size: 7.5pt; color: #555; text-align: left; }
.items tbody td.c-name { padding-left: 3px; font-weight: 500; line-height: 1.35; }
.items tbody td.c-qty  { text-align: center; font-weight: 500; }
.items tbody td.c-amt  { text-align: right; white-space: nowrap; font-weight: 500; }

.items tfoot tr { border-top: 1px solid #000; }
.items tfoot td { padding: 6px 0; font-size: 8pt; font-weight: 600; }
.items tfoot td.c-qty { text-align: center; }

/* modifier note */
.mod { font-size: 7.5pt; font-weight: 400; color: #444; display: block; padding-left: 3px; margin-top: 1px; }

/* ── Totals ── */
.totals { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 6px 0; }
.totals td { padding: 2px 0; }
.totals .lbl { color: #333; }
.totals .val { text-align: right; white-space: nowrap; font-weight: 500; }

/* ── Grand total ── */
.grand {
  width: 100%;
  border-collapse: collapse;
  border-top: 1.5px solid #000;
  border-bottom: 1.5px solid #000;
  margin: 6px 0;
}
.grand td { padding: 6px 0; }
.g-lbl { font-size: 11pt; font-weight: 700; }
.g-val { font-size: 13pt; font-weight: 700; text-align: right; white-space: nowrap; }

/* ── Payment ── */
.pay { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 4px 0; }
.pay td { padding: 2px 0; }
.pay .p-lbl { color: #333; }
.pay .p-val { text-align: right; white-space: nowrap; font-weight: 500; }
.pay .p-chg { text-align: right; font-size: 10pt; font-weight: 700; white-space: nowrap; }

/* ── WiFi / Footer ── */
.wifi   { font-size: 8pt; font-weight: 500; text-align: center; margin: 6px 0; }
.footer { text-align: center; font-size: 8pt; line-height: 1.6; margin-top: 8px; color: #222; }
.thanks { font-size: 9pt; font-weight: 600; letter-spacing: 0.5px; margin-top: 4px; }
</style>
</head>
<body>

<div class="logo-container">
  <img class="logo-img" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Logo" />
</div>

<div class="header-wrap">
  <p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
  ${cfg.tagline ? `<p class="hsub">${e(cfg.tagline)}</p>` : ""}
  ${cfg.address ? `<p class="hsub">${e(cfg.address)}</p>` : ""}
  ${cfg.phone   ? `<p class="hsub">Tel: ${e(cfg.phone)}</p>` : ""}
  ${cfg.ntn     ? `<p class="hsub">${e(cfg.ntn)}</p>` : ""}
</div>

${full.order.token_number != null ? `<div class="token-box">TOKEN # ${full.order.token_number}</div>` : ""}

<table class="meta">
  <tr>
    <td class="ml">ORDER #${e(full.order.order_number)}</td>
    <td class="mr">${e(date)}</td>
  </tr>
  <tr>
    <td class="ml">${e(tableLabel)}</td>
    <td class="mr">${e(time)}</td>
  </tr>
  ${full.order.server_name  ? `<tr><td class="ml">Staff: ${e(full.order.server_name)}</td><td></td></tr>` : ""}
  ${full.order.customer_name  ? `<tr><td class="ml">Cust: ${e(full.order.customer_name)}</td><td></td></tr>` : ""}
  ${full.order.customer_phone ? `<tr><td class="ml">Tel:  ${e(full.order.customer_phone)}</td><td></td></tr>` : ""}
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
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr>
      <td class="c-no"></td>
      <td class="c-name">TOTAL ITEMS</td>
      <td class="c-qty">${totalQty}</td>
      <td class="c-amt"></td>
    </tr>
  </tfoot>
</table>

<table class="totals">${totalRows}</table>

<table class="grand">
  <tr>
    <td class="g-lbl">TOTAL</td>
    <td class="g-val">${e(formatRs(netTotal))}</td>
  </tr>
</table>

${cashPay ? `<table class="pay">${payRows}</table>` : ""}

<hr class="sep-dash">
${wifiBlock}

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

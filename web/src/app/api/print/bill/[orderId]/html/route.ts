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
 *  - Courier New monospace, bold column headers, dashed rules
 *  - All columns fit 72mm printable area
 *  - Auto-calls window.print() on load and auto-closes after
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

  const date = new Date().toLocaleDateString("en-GB",  { day: "2-digit", month: "short", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-US",  { hour: "2-digit", minute: "2-digit", hour12: true });

  // Safe HTML escape
  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // ── Dashed separator (full printable width) ──────────────────────
  // 32 chars fits comfortably in 72mm at 9pt Courier
  const DASH = "--------------------------------";

  // ── Item rows ────────────────────────────────────────────────────
  // Layout: [##] [ITEM NAME (wraps)        ] [QTY] [   PRICE]
  // Column widths (chars @9pt Courier ~2.25mm each, total ≈32 chars):
  //   sr:2  gap:1  name:varies  qty:3  gap:1  price:8 (right-align)
  // We use a table with fixed col widths in mm for reliability.
  const itemRows = live.map((li: OrderLineItem, i: number) => {
    const name = e(`${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`);
    const mods = cfg.showItemNotes
      ? [li.note, ...li.modifiers].filter(Boolean).map(e).join(", ")
      : "";
    const price = e(formatRs(li.unit_price * li.quantity));
    return `
<tr>
  <td class="c-sr">${i + 1}.</td>
  <td class="c-name">${name}${mods ? `<div class="mod">&rsaquo; ${mods}</div>` : ""}</td>
  <td class="c-qty">${li.quantity}</td>
  <td class="c-price">${price}</td>
</tr>`;
  }).join("");

  // ── Totals rows ──────────────────────────────────────────────────
  const totalRows = [
    `<tr><td class="t-lbl">Subtotal</td><td class="t-val">${e(formatRs(totals.subtotal))}</td></tr>`,
    cfg.showService && totals.service > 0
      ? `<tr><td class="t-lbl">Service (${full.order.service_charge_pct}%)</td><td class="t-val">${e(formatRs(totals.service))}</td></tr>`
      : "",
    promo.discount > 0
      ? `<tr><td class="t-lbl">Promo${promo.names.length ? " - " + promo.names.join(", ") : ""}</td><td class="t-val">- ${e(formatRs(promo.discount))}</td></tr>`
      : "",
    totals.discount > 0
      ? `<tr><td class="t-lbl">Discount${full.discount?.reason ? " - " + full.discount.reason : ""}</td><td class="t-val">- ${e(formatRs(totals.discount))}</td></tr>`
      : "",
  ].filter(Boolean).join("\n");

  // ── Cash / change rows ───────────────────────────────────────────
  const payRows = cashPay ? `
<tr class="sep-row"><td colspan="2"><div class="dash">${DASH}</div></td></tr>
<tr>
  <td class="t-lbl">${cashPay.method.toLowerCase() === "cash" ? "Cash Tendered" : `Paid (${e(cashPay.method)})`}</td>
  <td class="t-val">${e(formatRs(Number(cashPay.tendered)))}</td>
</tr>
<tr>
  <td class="t-lbl t-bold">Change Due</td>
  <td class="t-val t-bold">${e(formatRs(Math.max(0, Number(cashPay.tendered) - netTotal)))}</td>
</tr>` : "";

  // ── WiFi ─────────────────────────────────────────────────────────
  const wifiBlock = cfg.showWifi && cfg.wifiSsid
    ? `<div class="dash">${DASH}</div>
<p class="center small">Wi-Fi: <b>${e(cfg.wifiSsid)}</b> &nbsp;/&nbsp; ${e(cfg.wifiPass)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt #${e(full.order.order_number)}</title>
<style>
/* ═══════════════════════════════════════════════════════════════
   80mm THERMAL RECEIPT  —  printable width 72mm
   @page forces the browser print dialog to 80mm paper width.
   Courier New keeps character widths consistent across OS.
═══════════════════════════════════════════════════════════════ */

@page {
  size: 80mm auto;   /* width locked to 80mm, height = content */
  margin: 4mm 4mm;   /* 4mm top/bottom, 4mm left/right = 72mm body */
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 9pt;
  line-height: 1.35;
  width: 72mm;
  color: #000;
  background: #fff;
}

/* Screen preview only */
@media screen {
  body {
    width: 72mm;
    padding: 8px;
    margin: 16px auto;
    border: 1px dashed #bbb;
    background: #fafafa;
  }
}

/* ── Utilities ── */
.center  { text-align: center; }
.right   { text-align: right; }
.bold    { font-weight: bold; }
.small   { font-size: 7.5pt; }
.muted   { color: #444; }

/* ── Dashed rule ── */
.dash {
  font-size: 8.5pt;
  letter-spacing: 0;
  color: #222;
  margin: 3px 0;
  word-break: break-all;
  white-space: nowrap;
  overflow: hidden;
}

/* ── Restaurant header ── */
.brand {
  font-size: 15pt;
  font-weight: bold;
  letter-spacing: 3px;
  text-align: center;
  margin-bottom: 1px;
}
.header-sub {
  font-size: 8pt;
  text-align: center;
  margin-bottom: 1px;
}

/* ── Order meta (two-column) ── */
.meta-table {
  width: 100%;
  font-size: 8pt;
  border-collapse: collapse;
  margin: 3px 0;
}
.meta-table td { vertical-align: top; padding: 0.5px 0; }
.meta-table td.ml { width: 52%; }
.meta-table td.mr { width: 48%; text-align: right; }

/* ── TOKEN badge ── */
.token {
  font-size: 11pt;
  font-weight: bold;
  text-align: center;
  letter-spacing: 1px;
  margin: 2px 0;
}

/* ── Items table ── */
.items {
  width: 100%;
  border-collapse: collapse;
  margin: 2px 0;
  font-size: 8.5pt;
}
/* Column widths: sr + name take remaining space; qty + price fixed */
.items col.c-sr    { width: 5mm; }
.items col.c-name  { }            /* flex */
.items col.c-qty   { width: 8mm; }
.items col.c-price { width: 18mm; }

/* Header row */
.items thead th {
  font-size: 8pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 0;
  border-top: 1.5px solid #000;
  border-bottom: 1px dashed #444;
}
.items thead th.c-sr    { text-align: left; }
.items thead th.c-name  { text-align: left; padding-left: 2px; }
.items thead th.c-qty   { text-align: center; }
.items thead th.c-price { text-align: right; }

/* Body cells */
.items tbody td { padding: 1.5px 0; vertical-align: top; }
.items tbody td.c-sr    { color: #555; font-size: 8pt; padding-top: 2px; }
.items tbody td.c-name  { padding-left: 2px; font-weight: bold; }
.items tbody td.c-qty   { text-align: center; }
.items tbody td.c-price { text-align: right; white-space: nowrap; }

/* Footer separator under last item */
.items tbody tr:last-child td {
  border-bottom: 1px dashed #444;
  padding-bottom: 3px;
}

/* Modifier / notes line */
.mod {
  font-size: 7.5pt;
  font-weight: normal;
  color: #444;
  padding-left: 2px;
}

/* ── Totals table ── */
.totals {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin: 2px 0;
}
.totals td { padding: 1px 0; }
.t-lbl { }
.t-val { text-align: right; white-space: nowrap; }
.t-bold { font-weight: bold; }

/* Grand total row */
.grand-total {
  width: 100%;
  border-collapse: collapse;
  margin: 3px 0;
  border-top: 1.5px solid #000;
  border-bottom: 1.5px solid #000;
}
.grand-total td { padding: 3px 0; }
.gt-lbl {
  font-size: 12pt;
  font-weight: bold;
  letter-spacing: 1px;
}
.gt-val {
  font-size: 14pt;
  font-weight: bold;
  text-align: right;
  white-space: nowrap;
}

/* Separator row inside totals table */
.sep-row td { padding: 1px 0; }

/* ── Footer ── */
.footer {
  text-align: center;
  font-size: 7.5pt;
  margin-top: 3px;
  line-height: 1.5;
}
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
${cfg.tagline ? `<p class="header-sub">${e(cfg.tagline)}</p>` : ""}
${cfg.address ? `<p class="header-sub">${e(cfg.address)}</p>` : ""}
${cfg.phone   ? `<p class="header-sub">Tel: ${e(cfg.phone)}</p>` : ""}
${cfg.ntn     ? `<p class="header-sub">${e(cfg.ntn)}</p>` : ""}

<div class="dash">${DASH}</div>

${full.order.token_number != null ? `<p class="token">TOKEN # ${full.order.token_number}</p>
<div class="dash">${DASH}</div>` : ""}

<!-- ══ ORDER META ══ -->
<table class="meta-table">
  <tr>
    <td class="ml"><b>ORDER #${e(full.order.order_number)}</b></td>
    <td class="mr"><b>${e(date)}</b></td>
  </tr>
  <tr>
    <td class="ml">${e(tableLabel)}</td>
    <td class="mr">${e(time)}</td>
  </tr>
  ${full.order.server_name ? `<tr><td class="ml">Staff: ${e(full.order.server_name)}</td><td></td></tr>` : ""}
  ${full.order.customer_name  ? `<tr><td class="ml">${e(full.order.customer_name)}</td><td></td></tr>` : ""}
  ${full.order.customer_phone ? `<tr><td class="ml">${e(full.order.customer_phone)}</td><td></td></tr>` : ""}
</table>

<div class="dash">${DASH}</div>

<!-- ══ ITEMS ══ -->
<table class="items">
  <colgroup>
    <col class="c-sr">
    <col class="c-name">
    <col class="c-qty">
    <col class="c-price">
  </colgroup>
  <thead>
    <tr>
      <th class="c-sr">#</th>
      <th class="c-name">ITEM</th>
      <th class="c-qty">QTY</th>
      <th class="c-price">PRICE</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<!-- ══ TOTALS ══ -->
<table class="totals">
  ${totalRows}
</table>

<!-- ══ GRAND TOTAL ══ -->
<table class="grand-total">
  <tr>
    <td class="gt-lbl">TOTAL</td>
    <td class="gt-val">${e(formatRs(netTotal))}</td>
  </tr>
</table>

${payRows ? `<table class="totals">${payRows}</table>` : ""}

<div class="dash">${DASH}</div>

${wifiBlock}

<!-- ══ FOOTER ══ -->
<div class="footer">
  ${cfg.footer ? `<p>${e(cfg.footer)}</p>` : ""}
  <p><b>** THANK YOU FOR VISITING! **</b></p>
  <p>SPICE PIZZA</p>
  <br>
</div>

<!-- ══ AUTO PRINT ══ -->
<script>
  window.addEventListener('load', function () {
    // afterprint fires after the dialog is dismissed (print or cancel).
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

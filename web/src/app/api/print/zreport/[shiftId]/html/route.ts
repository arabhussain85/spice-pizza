import { createAdminClient } from "@/lib/supabase/admin";
import { formatRs } from "@/lib/money";
import { billTotals } from "@/lib/order-math";
import { fetchActivePromotions, fetchMenuMeta, promoTotals } from "@/lib/promotions";
import { fetchReceiptConfig } from "@/lib/receipt-config";
import type { OrderLineItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmtDT = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : "—";

/**
 * GET /api/print/zreport/[shiftId]/html
 *
 * HTML Z-report locked to 80mm thermal paper.
 * @page { size: 80mm auto } prevents infinite roll.
 * Auto-prints on load and closes via afterprint.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ shiftId: string }> }) {
  const { shiftId } = await params;
  const supa = createAdminClient();

  const { data: shift } = await supa.from("shifts").select("*").eq("id", shiftId).maybeSingle();
  if (!shift) return new Response("Shift not found", { status: 404 });

  const { data: ordersRaw } = await supa
    .from("orders")
    .select("id, status, service_charge_pct, order_rounds(order_line_items(*)), discounts(type, value)")
    .eq("shift_id", shiftId);

  const orders = (ordersRaw ?? []) as Array<{
    id: string;
    status: string;
    service_charge_pct: number;
    order_rounds: { order_line_items: OrderLineItem[] }[];
    discounts: { type: "percent" | "fixed"; value: number }[] | null;
  }>;

  const cfg = await fetchReceiptConfig(supa);
  const promos = await fetchActivePromotions(supa);
  const menuMeta = await fetchMenuMeta(supa);

  let subTotal = 0, serviceTotal = 0, manualDisc = 0, promoDisc = 0;
  let netSales = 0, itemsSold = 0, ordersClosed = 0, ordersVoid = 0;
  const itemTally = new Map<string, number>();

  for (const o of orders) {
    if (o.status === "void") { ordersVoid += 1; continue; }
    if (o.status !== "closed") continue;
    ordersClosed += 1;
    const allLines = (o.order_rounds ?? []).flatMap((r) => r.order_line_items ?? []);
    const live = allLines.filter((li) => !li.is_voided);
    const disc = Array.isArray(o.discounts) ? o.discounts[0] : null;
    const totals = billTotals(allLines, o.service_charge_pct, disc ? { type: disc.type, value: disc.value } : null);
    const promo = promoTotals(live, promos, menuMeta);
    const svc = cfg.showService ? totals.service : 0;
    subTotal += totals.subtotal;
    serviceTotal += svc;
    manualDisc += totals.discount;
    promoDisc += promo.discount;
    netSales += Math.max(0, totals.subtotal + svc - promo.discount - totals.discount);
    for (const li of live) {
      itemsSold += li.quantity;
      itemTally.set(li.name_snapshot, (itemTally.get(li.name_snapshot) ?? 0) + li.quantity);
    }
  }

  const orderIds = orders.map((o) => o.id);
  const byMethod = new Map<string, number>();
  if (orderIds.length) {
    const { data: pays } = await supa
      .from("payments").select("method, amount, status")
      .in("order_id", orderIds).eq("status", "confirmed");
    for (const p of (pays ?? []) as { method: string; amount: number }[])
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
  }
  const methodLabel: Record<string, string> = {
    cash: "Cash", card: "Card", jazzcash: "JazzCash", easypaisa: "EasyPaisa",
  };

  const topItems = [...itemTally.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const salesRows = [
    `<tr><td class="lbl">Gross Subtotal</td><td class="val">${e(formatRs(subTotal))}</td></tr>`,
    serviceTotal > 0 ? `<tr><td class="lbl">Service Charge</td><td class="val">${e(formatRs(serviceTotal))}</td></tr>` : "",
    promoDisc > 0    ? `<tr><td class="lbl">Promotions</td><td class="val">- ${e(formatRs(promoDisc))}</td></tr>` : "",
    manualDisc > 0   ? `<tr><td class="lbl">Discounts</td><td class="val">- ${e(formatRs(manualDisc))}</td></tr>` : "",
  ].filter(Boolean).join("");

  const payRows = byMethod.size
    ? [...byMethod.entries()].map(([m, v]) =>
        `<tr><td class="lbl">${e(methodLabel[m] ?? m)}</td><td class="val">${e(formatRs(v))}</td></tr>`
      ).join("")
    : `<tr><td class="lbl" colspan="2">No payments recorded</td></tr>`;

  const topRows = topItems.map(([name, qty]) =>
    `<tr><td class="lbl">${e(name)}</td><td class="val">${qty}</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Z-Report — ${e(cfg.brand || "Spice Pizza")}</title>
<style>
@page { size: 80mm auto; margin: 3mm 4mm; }

* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 10pt;
  font-weight: bold;
  line-height: 1.5;
  width: 74mm;
  color: #000;
  background: #fff;
}

@media screen {
  body { padding: 10px; margin: 20px auto; border: 2px solid #000; }
}

.brand  { font-size:14pt; font-weight:bold; text-align:center; letter-spacing:3px; margin-bottom:2px; }
.sub    { font-size:9pt; font-weight:bold; text-align:center; }
.sep    { border:none; border-top:3px solid #000; margin:4px 0; }
.dash   { border:none; border-top:2px dashed #000; margin:3px 0; }

.z-title {
  font-size: 13pt;
  font-weight: bold;
  text-align: center;
  letter-spacing: 2px;
  border-top: 3px solid #000;
  border-bottom: 3px solid #000;
  padding: 3px 0;
  margin: 4px 0;
}

.meta  { width:100%; border-collapse:collapse; font-size:9.5pt; font-weight:bold; margin:3px 0; }
.meta td { padding:1.5px 0; }
.meta .mr { text-align:right; }

.section-head {
  font-size: 9pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 4px 0 2px;
}

.tbl { width:100%; border-collapse:collapse; font-size:10pt; font-weight:bold; margin:2px 0; }
.tbl td { padding:2px 0; }
.tbl .lbl { }
.tbl .val { text-align:right; white-space:nowrap; }

.grand {
  width:100%;
  border-collapse:collapse;
  border-top:3px solid #000;
  border-bottom:3px solid #000;
  margin:4px 0;
}
.grand td { padding:4px 0; font-weight:bold; }
.g-lbl { font-size:12pt; }
.g-val { font-size:14pt; text-align:right; white-space:nowrap; }

.counts { width:100%; border-collapse:collapse; font-size:10pt; font-weight:bold; }
.counts td { padding:2px 0; }
.counts .cr { text-align:right; }

.footer { text-align:center; font-size:9pt; font-weight:bold; margin-top:4px; line-height:1.8; }
</style>
</head>
<body>

<p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
${cfg.address ? `<p class="sub">${e(cfg.address)}</p>` : ""}
<div class="z-title">*** Z-REPORT ***</div>

<table class="meta">
  <tr><td>Opened</td><td class="mr">${e(fmtDT(shift.opened_at))}</td></tr>
  <tr><td>Closed</td><td class="mr">${e(fmtDT(shift.closed_at))}</td></tr>
</table>

<hr class="sep">

<p class="section-head">Order Summary</p>
<table class="counts">
  <tr><td>Orders Completed</td><td class="cr">${ordersClosed}</td></tr>
  <tr><td>Orders Voided</td><td class="cr">${ordersVoid}</td></tr>
  <tr><td>Items Sold</td><td class="cr">${itemsSold}</td></tr>
</table>

<hr class="dash">

<p class="section-head">Sales Breakdown</p>
<table class="tbl">${salesRows}</table>

<table class="grand">
  <tr>
    <td class="g-lbl">NET SALES</td>
    <td class="g-val">${e(formatRs(netSales))}</td>
  </tr>
</table>

<p class="section-head">Payments Received</p>
<table class="tbl">${payRows}</table>

${topItems.length ? `<hr class="dash">
<p class="section-head">Top Items</p>
<table class="tbl">${topRows}</table>` : ""}

<hr class="sep">

<div class="footer">
  <p>Keep for your records.</p>
  <p>--- END OF Z-REPORT ---</p>
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

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOrderFull } from "@/lib/queries";
import { formatRs } from "@/lib/money";
import { fetchReceiptConfig } from "@/lib/receipt-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/print/round/[roundId]/html
 *
 * Returns a self-contained HTML kitchen slip for one round.
 * - @page { size: 80mm auto } — no infinite roll, no A4
 * - Everything bold, large, Courier New for thermal clarity
 * - Auto-calls window.print() and closes via afterprint event
 * - No browser print dialog settings needed — paper size is locked
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const supa = createAdminClient();

  const { data: round } = await supa
    .from("order_rounds")
    .select("id, order_id, round_number, order_line_items(*, menu_items(description))")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return new Response("Round not found", { status: 404 });

  const [full, cfg] = await Promise.all([
    fetchOrderFull(supa, round.order_id),
    fetchReceiptConfig(supa),
  ]);
  if (!full) return new Response("Order not found", { status: 404 });

  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const ot = full.order.order_type;
  const tn = full.order.type_number;
  const tableLabel =
    ot === "takeaway" ? `TAKEAWAY${tn ? ` #${tn}` : ""}`
    : ot === "delivery" ? `DELIVERY${tn ? ` #${tn}` : ""}`
    : `TABLE T-${String(full.table?.number ?? 0).padStart(2, "0")}`;

  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const orderNo = full.order.order_number.replace(/^SP-/, "");

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

  const items = ((round.order_line_items ?? []) as RoundItem[]).filter((li) => !li.is_voided);
  const roundTotal = items.reduce((s, li) => s + li.unit_price * li.quantity, 0);

  const itemRows = items.map((li, i) => {
    const name = e(`${li.name_snapshot}${li.size_snapshot ? ` (${li.size_snapshot})` : ""}`);
    const mods = [...(li.modifiers ?? []), ...(li.note ? [li.note] : [])];

    // If it's a deal/bundle, expand the description as contents
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Kitchen — Round ${round.round_number} — ${e(tableLabel)}</title>
<style>
@page { size: 80mm auto; margin: 3mm 4mm; }

* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11pt;
  font-weight: bold;
  line-height: 1.5;
  width: 74mm;
  color: #000;
  background: #fff;
}

@media screen {
  body {
    padding: 10px;
    margin: 20px auto;
    border: 2px solid #000;
    background: #fff;
  }
}

/* ── Header ── */
.brand    { font-size:13pt; font-weight:bold; text-align:center; letter-spacing:2px; margin-bottom:2px; }
.sub      { font-size:9pt; font-weight:bold; text-align:center; }
.sep      { border:none; border-top:3px solid #000; margin:4px 0; }
.sep-dash { border:none; border-top:2px dashed #000; margin:3px 0; }

/* ── Kitchen title ── */
.kitchen-title {
  font-size: 14pt;
  font-weight: bold;
  text-align: center;
  letter-spacing: 3px;
  margin: 3px 0;
}

/* ── Token ── */
.token {
  font-size: 20pt;
  font-weight: bold;
  text-align: center;
  border: 3px solid #000;
  padding: 3px 0;
  margin: 4px 0;
  letter-spacing: 3px;
}

/* ── Meta row ── */
.meta { width:100%; border-collapse:collapse; font-size:10pt; font-weight:bold; margin:3px 0; }
.meta td { padding:1px 0; vertical-align:top; }
.meta .mr { text-align:right; }

/* ── Round badge ── */
.round-badge {
  font-size: 13pt;
  font-weight: bold;
  text-align: center;
  letter-spacing: 2px;
  margin: 3px 0;
  padding: 2px 0;
  border-top: 3px solid #000;
  border-bottom: 3px solid #000;
}

/* ── Items table ── */
.items { width:100%; border-collapse:collapse; font-size:11pt; font-weight:bold; }
.items col.c-qty  { width:12mm; }
.items col.c-name { }
.items col.c-amt  { width:20mm; }

.items thead tr { border-top:2px solid #000; border-bottom:2px solid #000; }
.items thead th { font-size:9pt; font-weight:bold; text-transform:uppercase; padding:3px 0; }
.items thead th.c-qty  { text-align:left; }
.items thead th.c-name { text-align:left; padding-left:3px; }
.items thead th.c-amt  { text-align:right; }

.items tbody tr { border-bottom:2px dashed #000; }
.items tbody td { padding:4px 0; vertical-align:top; font-weight:bold; }
.items tbody td.c-qty  { font-size:13pt; padding-top:5px; }
.items tbody td.c-name { padding-left:3px; line-height:1.4; }
.items tbody td.c-amt  { text-align:right; white-space:nowrap; }

/* modifier line — bold red-style emphasis */
.mod  { font-size:9pt; font-weight:bold; display:block; padding-left:3px; }
.cont { font-size:9pt; font-weight:bold; display:block; padding-left:3px; }

/* ── Total ── */
.total {
  width:100%;
  border-collapse:collapse;
  border-top:3px solid #000;
  border-bottom:3px solid #000;
  margin:4px 0;
}
.total td { padding:4px 0; font-weight:bold; }
.t-lbl { font-size:13pt; }
.t-val { font-size:14pt; text-align:right; white-space:nowrap; }

/* ── Footer ── */
.footer { text-align:center; font-size:9pt; font-weight:bold; margin-top:4px; }
</style>
</head>
<body>

<p class="brand">${e(cfg.brand || "SPICE PIZZA")}</p>
<p class="sub">KITCHEN ORDER</p>
<hr class="sep">

${full.order.token_number != null
  ? `<div class="token">TOKEN # ${full.order.token_number}</div>`
  : ""}

<table class="meta">
  <tr>
    <td><b>${e(tableLabel)}</b></td>
    <td class="mr">Order #${e(orderNo)}</td>
  </tr>
  <tr>
    <td></td>
    <td class="mr">${e(time)}</td>
  </tr>
</table>

<div class="round-badge">ROUND ${round.round_number}</div>

<table class="items">
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
  <tbody>${itemRows}</tbody>
</table>

<table class="total">
  <tr>
    <td class="t-lbl">ROUND TOTAL</td>
    <td class="t-val">${e(formatRs(roundTotal))}</td>
  </tr>
</table>

<div class="footer">
  <p>--- END OF ORDER ---</p>
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

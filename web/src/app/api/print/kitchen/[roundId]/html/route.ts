import { createAdminClient } from "@/lib/supabase/admin";
import { formatRs } from "@/lib/money";
import { fetchReceiptConfig } from "@/lib/receipt-config";
import { LOGO_PNG_BASE64 } from "@/lib/logo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/print/kitchen/[roundId]/html
 *
 * Returns an HTML page containing ONLY the Kitchen Order slip for a specific round.
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

  const { data: order } = await supa
    .from("orders")
    .select("*, table:restaurant_tables(number)")
    .eq("id", round.order_id)
    .maybeSingle();
  if (!order) return new Response("Order not found", { status: 404 });

  const cfg = await fetchReceiptConfig(supa);

  const e = (s?: string | null) =>
    (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const ot = order.order_type;
  const tn = order.type_number;
  const kitchenTableLabel =
    ot === "takeaway" ? `TAKEAWAY${tn ? ` #${tn}` : ""}`
    : ot === "delivery" ? `DELIVERY${tn ? ` #${tn}` : ""}`
    : `TABLE T-${String(order.table?.number ?? 0).padStart(2, "0")}`;

  const now = new Date();
  const time24 = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
  const orderNoShort = order.order_number.replace(/^SP-/, "");

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Kitchen Order R${round.round_number} - ${e(order.order_number)}</title>
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
  overflow: hidden;
}

@media print {
  html, body { width: 72mm; max-width: 72mm; overflow: hidden; }
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
    border-radius: 8px;
  }
}

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

.brand        { font-size:13pt; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; text-align:center; margin-bottom:4px; }
.sep-solid    { border:none; border-top:1px solid #000; margin:6px 0; }

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
.meta .mr { width:45%; text-align:right; color:#000; font-weight:600; }

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

.footer { text-align:center; font-size:8.5pt; line-height:1.6; margin-top:8px; color:#000; font-weight:600; }
</style>
</head>
<body>

<div class="receipt-page">
  <div class="logo-container">
    <img class="logo-img" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Logo" />
  </div>

  <p class="brand">${e(cfg.brand || "BITES PIZZA")}</p>
  <p class="kitchen-title">KITCHEN ORDER</p>
  <hr class="sep-solid">

  ${order.token_number != null
    ? `<div class="token-box">TOKEN # ${order.token_number}</div>`
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

  <div class="footer">
    <p>--- END OF KITCHEN ORDER ---</p>
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

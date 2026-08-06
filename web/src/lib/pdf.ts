import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { LOGO_PNG_BASE64, LOGO_W, LOGO_H } from "./logo-data";

// 80mm thermal-receipt renderers matching the Stitch kitchen + customer-bill slips.
const W = 226.77; // 80mm in pt
const M = 14; // side margin
const LEFT = M;
const RIGHT = W - M;
const RED = rgb(0.686, 0.063, 0.102); // #af101a
const INK = rgb(0.1, 0.09, 0.09);
const MUTED = rgb(0.42, 0.35, 0.33);
const RULE = rgb(0.72, 0.6, 0.58);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type Draw = {
  page: PDFPage;
  left: (s: string, y: number, size: number, f: PDFFont, c?: ReturnType<typeof rgb>) => void;
  right: (s: string, y: number, size: number, f: PDFFont, c?: ReturnType<typeof rgb>) => void;
  center: (s: string, y: number, size: number, f: PDFFont, c?: ReturnType<typeof rgb>) => void;
  at: (s: string, x: number, y: number, size: number, f: PDFFont, c?: ReturnType<typeof rgb>) => void;
  dashed: (y: number) => void;
  solid: (y: number) => void;
};

function drawing(page: PDFPage): Draw {
  const at: Draw["at"] = (s, x, y, size, f, c = INK) => page.drawText(s, { x, y, size, font: f, color: c });
  return {
    page,
    at,
    left: (s, y, size, f, c) => at(s, LEFT, y, size, f, c),
    right: (s, y, size, f, c) => at(s, RIGHT - f.widthOfTextAtSize(s, size), y, size, f, c),
    center: (s, y, size, f, c) => at(s, (W - f.widthOfTextAtSize(s, size)) / 2, y, size, f, c),
    dashed: (y) =>
      page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.8, color: RULE, dashArray: [2, 2] }),
    solid: (y) => page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1.2, color: INK }),
  };
}

// ---------------------------------------------------------------------------
// Customer bill
// ---------------------------------------------------------------------------
export interface BillItem {
  qty: number;
  name: string;
  sub?: string | null;
  amount: string; // "Rs. 3,600"
}
export interface BillSlip {
  brand: string;
  tagline?: string;
  address?: string;
  phone?: string;
  ntn?: string;
  orderNumber: string;
  token?: number | null;
  table: string;
  date: string;
  time: string;
  staff?: string;
  items: BillItem[];
  subtotal: string;
  serviceLabel?: string;
  serviceValue?: string;
  showService?: boolean;
  extraLines?: { label: string; value: string }[];
  total: string;
  payment?: { method: string; cash: string; change: string } | null;
  wifi?: { ssid: string; pass: string } | null;
  footer?: string;
  showItemNotes?: boolean;
}

export async function renderBill(slip: BillSlip): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const logoW = 42;
  const logoH = (logoW * LOGO_H) / LOGO_W;

  // ---- measure ----
  let h = M + logoH + 8 + 15;
  if (slip.tagline) h += 11;
  if (slip.address) h += wrap(slip.address, font, 8, RIGHT - LEFT).length * 10;
  if (slip.phone) h += 11;
  if (slip.ntn) h += 11;
  h += 2 + 8 + 12 + 11 + (slip.staff ? 11 : 0) + 8 + 14 + 6;
  for (const it of slip.items) {
    h += Math.max(1, wrap(it.name, bold, 9, 115).length) * 12 + (slip.showItemNotes && it.sub ? 10 : 0) + 4;
  }
  h += 2 + 8 + 13 + 13 + (slip.showService ? 13 : 0) + (slip.extraLines?.length ?? 0) * 13 + 2 + 20;
  if (slip.payment) h += 12 + 13;
  if (slip.wifi) h += 12 + 8;
  if (slip.footer) h += wrap(slip.footer, italic, 8, RIGHT - LEFT).length * 10 + 2;
  h += 24 + M;

  const page = doc.addPage([W, Math.max(h, 300)]);
  const d = drawing(page);
  let y = page.getHeight() - M;

  // ---- logo + business header ----
  page.drawImage(logo, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
  y -= logoH + 8;
  d.center(slip.brand.toUpperCase(), y, 15, bold, INK); y -= 13;
  if (slip.tagline) { d.center(slip.tagline, y, 8, italic, MUTED); y -= 11; }
  if (slip.address) { for (const ln of wrap(slip.address, font, 8, RIGHT - LEFT)) { d.center(ln, y, 8, font, INK); y -= 10; } }
  if (slip.phone) { d.center(`Tel: ${slip.phone}`, y, 8, bold, INK); y -= 11; }
  if (slip.ntn) { d.center(slip.ntn, y, 7.5, font, MUTED); y -= 11; }
  y -= 2; d.dashed(y); y -= 12;

  // ---- meta ----
  d.left(`ORDER #${slip.orderNumber}`, y, 9, bold, INK);
  if (slip.token != null) d.right(`TOKEN #${slip.token}`, y, 11, bold, RED);
  y -= 12;
  d.left(`Table ${slip.table}`, y, 8, font, MUTED);
  d.right(slip.date, y, 8, font, MUTED);
  y -= 11;
  if (slip.staff) d.left(`Staff: ${slip.staff}`, y, 8, font, MUTED);
  d.right(`Time: ${slip.time}`, y, 8, font, MUTED);
  y -= 11;
  d.dashed(y); y -= 12;

  // ---- items: #  ITEM  QTY  PRICE ----
  const ITEM_X = LEFT + 15;
  const QTY_X = 150;
  const ITEM_MAX = QTY_X - ITEM_X - 6;
  d.at("#", LEFT, y, 8, bold, INK);
  d.at("ITEM", ITEM_X, y, 8, bold, INK);
  d.at("QTY", QTY_X, y, 8, bold, INK);
  d.right("PRICE", y, 8, bold, INK);
  y -= 6; d.dashed(y); y -= 14;
  let totalQty = 0;
  let sr = 0;
  for (const it of slip.items) {
    sr += 1;
    totalQty += it.qty;
    const lines = wrap(it.name, bold, 9, ITEM_MAX);
    lines.forEach((ln, i) => {
      if (i === 0) {
        d.at(`${sr}`, LEFT, y, 9, font, MUTED);
        d.at(String(it.qty), QTY_X + 5, y, 9, font, INK);
        d.right(it.amount, y, 9, font, INK);
      }
      d.at(ln, ITEM_X, y, 9, bold, INK);
      y -= 12;
    });
    if (slip.showItemNotes && it.sub) { d.at(`» ${it.sub}`, ITEM_X, y, 7.5, font, MUTED); y -= 10; }
    y -= 4;
  }

  // ---- totals ----
  y -= 2; d.dashed(y); y -= 12;
  d.left("Total Items", y, 9, font, MUTED); d.right(String(totalQty), y, 9, bold, INK); y -= 13;
  d.left("Subtotal", y, 9, font, MUTED); d.right(slip.subtotal, y, 9, font, INK); y -= 13;
  if (slip.showService && slip.serviceValue) {
    d.left(slip.serviceLabel ?? "Service Charge", y, 9, font, MUTED); d.right(slip.serviceValue, y, 9, font, INK); y -= 13;
  }
  for (const l of slip.extraLines ?? []) { d.left(l.label, y, 9, font, MUTED); d.right(l.value, y, 9, font, INK); y -= 13; }
  y -= 2; d.solid(y); y -= 20;
  d.left("NET TOTAL", y, 12, bold, INK);
  d.right(slip.total, y, 18, bold, RED);
  y -= 20;
  if (slip.payment) {
    const payLabel = slip.payment.method.toLowerCase() === "cash" ? "Cash Tendered" : `Paid (${slip.payment.method})`;
    d.left(payLabel, y, 8, font, MUTED); d.right(slip.payment.cash, y, 9, font, INK); y -= 12;
    d.left("Change Due", y, 9, bold, INK); d.right(slip.payment.change, y, 10, bold, RED); y -= 13;
  }
  d.dashed(y); y -= 12;

  // ---- wifi + footer ----
  if (slip.wifi) {
    d.center(`Customer Wi-Fi: ${slip.wifi.ssid} / Pass: ${slip.wifi.pass}`, y, 7.5, font, INK);
    y -= 12; d.dashed(y); y -= 12;
  }
  if (slip.footer) { for (const ln of wrap(slip.footer, italic, 8, RIGHT - LEFT)) { d.center(ln, y, 8, italic, MUTED); y -= 10; } y -= 2; }
  d.center("*** POWERED BY SPICE PIZZA ***", y, 7, font, MUTED);

  return doc.save();
}

// ---------------------------------------------------------------------------
// Kitchen order (monospace)
// ---------------------------------------------------------------------------
export interface KitchenItem {
  qty: number;
  name: string;
  modifiers?: string[];
  contents?: string[];
}
export interface KitchenSlip {
  table: string;
  orderNumber: string;
  time: string;
  items: KitchenItem[];
}

export async function renderKitchen(slip: KitchenSlip): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const logoW = 40;
  const logoH = (logoW * LOGO_H) / LOGO_W;

  let h = M + logoH + 6 + 26 + 16 + 12;
  for (const it of slip.items) {
    h += Math.max(1, wrap(`${it.qty}x ${it.name.toUpperCase()}`, bold, 10, RIGHT - LEFT).length) * 13;
    h += (it.modifiers?.length ?? 0) * 12 + (it.contents?.length ?? 0) * 12 + 6;
  }
  h += 12 + 26 + M;
  const page = doc.addPage([W, Math.max(h, 220)]);
  const d = drawing(page);
  let y = page.getHeight() - M;

  page.drawImage(logo, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
  y -= logoH + 20;
  d.center("KITCHEN ORDER", y, 14, bold, INK);
  y -= 18;
  d.left(slip.table, y, 10, bold, INK);
  d.center(`Order #${slip.orderNumber}`, y, 9, font, INK);
  d.right(slip.time, y, 9, font, INK);
  y -= 8; d.dashed(y); y -= 16;

  for (const it of slip.items) {
    for (const ln of wrap(`${it.qty}x ${it.name.toUpperCase()}`, bold, 10, RIGHT - LEFT)) {
      d.left(ln, y, 10, bold, INK);
      y -= 13;
    }
    for (const m of it.modifiers ?? []) {
      d.at(`*** ${m.toUpperCase()} ***`, LEFT + 12, y, 9, bold, RED);
      y -= 12;
    }
    for (const c of it.contents ?? []) {
      d.at(`- ${c}`, LEFT + 12, y, 9, font, INK);
      y -= 12;
    }
    y -= 6;
  }

  d.dashed(y); y -= 16;
  d.center("*** SPICE PIZZA KITCHEN ***", y, 9, bold, INK); y -= 12;
  d.center("End of Order", y, 8, font, MUTED);

  return doc.save();
}

/** Merge several single-doc PDFs into one (e.g. kitchen slip + customer bill). */
export async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of parts) {
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

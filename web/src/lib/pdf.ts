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
  price: string;
}
export interface BillSlip {
  brand: string;
  branch?: string;
  phone?: string;
  date: string;
  time: string;
  orderNumber: string;
  table: string;
  items: BillItem[];
  subtotal: string;
  charges: { label: string; value: string }[];
  total: string;
  footer1?: string;
  footer2?: string;
}

const QTY_X = 150;
const NAME_MAX = QTY_X - LEFT - 6;

export async function renderBill(slip: BillSlip): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const logoW = 46;
  const logoH = (logoW * LOGO_H) / LOGO_W;

  // measure
  let h = M + logoH + 8 + 24 + 12 + 12 + 6 + 24 + 8 + 16 + 8;
  for (const it of slip.items) {
    h += Math.max(1, wrap(it.name, bold, 9, NAME_MAX).length) * 12 + (it.sub ? 10 : 0) + 6;
  }
  h += 8 + (1 + slip.charges.length) * 13 + 8 + 30 + 8 + 26;
  const page = doc.addPage([W, Math.max(h, 260)]);
  const d = drawing(page);
  let y = page.getHeight() - M;

  // logo + header
  page.drawImage(logo, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
  y -= logoH + 4;
  d.center(slip.brand.toUpperCase(), y, 17, bold, RED);
  y -= 14;
  if (slip.branch) { d.center(slip.branch, y, 8.5, font, MUTED); y -= 11; }
  if (slip.phone) { d.center(slip.phone, y, 8.5, font, MUTED); y -= 11; }
  y -= 8;

  // meta rows
  d.left(`Date: ${slip.date}`, y, 8, font, MUTED);
  d.right(`Bill #${slip.orderNumber}`, y, 8, font, MUTED);
  y -= 11;
  d.left(`Time: ${slip.time}`, y, 8, font, MUTED);
  d.at("Table ", RIGHT - bold.widthOfTextAtSize(slip.table, 8) - font.widthOfTextAtSize("Table ", 8), y, 8, font, MUTED);
  d.right(slip.table, y, 8, bold, RED);
  y -= 10;
  d.dashed(y); y -= 12;

  // column heads
  d.left("ITEM", y, 8, bold, INK);
  d.at("QTY", QTY_X, y, 8, bold, INK);
  d.right("PRICE", y, 8, bold, INK);
  y -= 8;
  d.dashed(y); y -= 14;

  // items
  for (const it of slip.items) {
    const lines = wrap(it.name, bold, 9, NAME_MAX);
    lines.forEach((ln, i) => {
      d.left(ln, y, 9, bold, INK);
      if (i === 0) {
        d.at(String(it.qty), QTY_X + 4, y, 9, font, INK);
        d.right(it.price, y, 9, font, INK);
      }
      y -= 12;
    });
    if (it.sub) { d.left(it.sub, y, 7.5, font, MUTED); y -= 10; }
    y -= 4;
  }

  y -= 2; d.dashed(y); y -= 12;
  d.left("Subtotal", y, 9, font, MUTED); d.right(slip.subtotal, y, 9, font, INK); y -= 13;
  for (const c of slip.charges) { d.left(c.label, y, 9, font, MUTED); d.right(c.value, y, 9, font, INK); y -= 13; }
  y -= 2; d.solid(y); y -= 22;
  d.left("TOTAL", y, 13, bold, INK);
  d.right(slip.total, y, 20, bold, RED);
  y -= 22; d.dashed(y); y -= 16;
  d.center(slip.footer1 ?? "THANK YOU FOR VISITING!", y, 9, bold, INK); y -= 12;
  if (slip.footer2) d.center(slip.footer2, y, 7.5, font, MUTED);

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

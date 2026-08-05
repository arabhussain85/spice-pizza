import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Thermal-receipt style page dimensions.
const WIDTH_80MM = 226.77; // 80mm in pt
const MARGIN = 12;
const BRAND = rgb(0.86, 0.15, 0.15); // #dc2626
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);

export interface ReceiptRow {
  qty?: number;
  name: string;
  sub?: string;
  price?: string;
}
export interface ReceiptSection {
  heading?: string;
  rows: ReceiptRow[];
}
export interface ReceiptTotal {
  label: string;
  value: string;
  bold?: boolean;
}
export interface ReceiptModel {
  title: string;
  subtitle?: string;
  metaRight?: string;
  address?: string;
  phone?: string;
  sections: ReceiptSection[];
  totals?: ReceiptTotal[];
  footer?: string;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function addReceiptPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  model: ReceiptModel,
) {
  const CONTENT = WIDTH_80MM - MARGIN * 2;
  // ---- measure height ----
  let h = MARGIN + 22; // title
  if (model.subtitle) h += 14;
  if (model.address) h += 12;
  if (model.phone) h += 12;
  if (model.metaRight) h += 12;
  h += 8;
  for (const s of model.sections) {
    if (s.heading) h += 16;
    for (const r of s.rows) {
      const nameLines = wrap(`${r.qty ? `${r.qty}x ` : ""}${r.name}`, font, 9, CONTENT - 46);
      h += nameLines.length * 12;
      if (r.sub) h += wrap(r.sub, font, 7.5, CONTENT - 46).length * 10;
      h += 3;
    }
    h += 8;
  }
  if (model.totals?.length) h += 6 + model.totals.length * 15;
  if (model.footer) h += 20;
  h += MARGIN;

  const page = doc.addPage([WIDTH_80MM, Math.max(h, 160)]);
  let y = page.getHeight() - MARGIN;

  const text = (
    p: PDFPage,
    s: string,
    x: number,
    yy: number,
    size: number,
    f: PDFFont,
    color = INK,
  ) => p.drawText(s, { x, y: yy, size, font: f, color });

  const rightText = (s: string, yy: number, size: number, f: PDFFont, color = INK) =>
    text(page, s, WIDTH_80MM - MARGIN - f.widthOfTextAtSize(s, size), yy, size, f, color);

  // ---- title & header ----
  y -= 14;
  text(page, model.title, MARGIN, y, 13, bold, BRAND);
  y -= 14;
  if (model.subtitle) {
    text(page, model.subtitle, MARGIN, y, 8.5, font, MUTED);
    y -= 12;
  }
  if (model.address) {
    text(page, model.address, MARGIN, y, 8, font, INK);
    y -= 11;
  }
  if (model.phone) {
    text(page, `Tel: ${model.phone}`, MARGIN, y, 8, font, INK);
    y -= 11;
  }
  if (model.metaRight) {
    text(page, model.metaRight, MARGIN, y, 8, font, MUTED);
    y -= 11;
  }
  const hr = () => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: WIDTH_80MM - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.82),
    });
    y -= 8;
  };
  y -= 2;
  hr();

  // ---- sections ----
  for (const s of model.sections) {
    if (s.heading) {
      text(page, s.heading.toUpperCase(), MARGIN, y, 8, bold, MUTED);
      y -= 14;
    }
    for (const r of s.rows) {
      const label = `${r.qty ? `${r.qty}x ` : ""}${r.name}`;
      const nameLines = wrap(label, font, 9, CONTENT - 46);
      nameLines.forEach((ln, i) => {
        text(page, ln, MARGIN, y, 9, bold);
        if (i === 0 && r.price) rightText(r.price, y, 9, bold);
        y -= 12;
      });
      if (r.sub) {
        for (const sl of wrap(r.sub, font, 7.5, CONTENT - 46)) {
          text(page, sl, MARGIN + 4, y, 7.5, font, MUTED);
          y -= 10;
        }
      }
      y -= 3;
    }
    y -= 4;
  }

  // ---- totals ----
  if (model.totals?.length) {
    hr();
    for (const t of model.totals) {
      const f = t.bold ? bold : font;
      const size = t.bold ? 11 : 9;
      text(page, t.label, MARGIN, y, size, f, t.bold ? INK : MUTED);
      rightText(t.value, y, size, f, t.bold ? BRAND : INK);
      y -= t.bold ? 16 : 14;
    }
  }

  if (model.footer) {
    y -= 6;
    const fl = wrap(model.footer, font, 7.5, CONTENT);
    for (const ln of fl) {
      text(page, ln, MARGIN, y, 7.5, font, MUTED);
      y -= 10;
    }
  }
}

export async function renderReceipts(models: ReceiptModel[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const m of models) await addReceiptPage(doc, font, bold, m);
  return doc.save();
}

export async function renderReceipt(model: ReceiptModel): Promise<Uint8Array> {
  return renderReceipts([model]);
}

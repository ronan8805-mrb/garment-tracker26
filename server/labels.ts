// Thermal garment labels, 70 x 38 mm, one per page.
//
// Built for the cab SQUIX thermal-transfer printer at 200 dpi (override with
// LABEL_DPI=300 for a 300 dpi head). Every bar and QR cell is snapped to whole
// printer dots so the printer never has to round widths, which keeps the
// barcode readable.
//
// Each label carries the garment ID twice: as a Code 128 barcode across the
// top, and as a QR code bottom-left (backup for 2D scanners such as the
// Netum CS7501). Both encode exactly the same text.
//
// The layout is worked out once (buildLabelLayout) and then drawn either as a
// PDF (downloads) or as an HTML page of SVGs (printing). The HTML route is what
// "Print labels" uses: it prints the same in Chrome, Edge and the Windows app
// (Electron has no PDF viewer, so printing a PDF there produced blank labels).

import PDFDocument from "pdfkit";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export interface LabelItem {
  garmentId: string;
  garmentType: string;
  size: string;
  /** Factory name, printed large, e.g. "Demo Factory" */
  factoryLine: string;
}

const LABEL_W = 70; // mm
const LABEL_H = 38; // mm (the physical label)
// Height of each printed page. Slightly shorter than the label so that, with
// the printer's vertical offset, a print never runs onto the next label
// (which makes the printer feed an extra blank one).
const PRINT_PAGE_H = Math.min(LABEL_H, Number(process.env.LABEL_PRINT_HEIGHT_MM) || 36);
const DPI = Number(process.env.LABEL_DPI) || 200;
const DOT = 25.4 / DPI; // one printer dot in mm
const pt = (v: number) => (v * 72) / 25.4; // mm -> PDF points
const snap = (v: number) => Math.round(v / DOT) * DOT; // snap a position to the dot grid
const PT_MM = 25.4 / 72; // one typographic point in mm
const HELVETICA_ASCENT = 0.718; // Helvetica ascender, as a fraction of font size

interface Rect { x: number; y: number; w: number; h: number } // mm
interface TextRun { text: string; x: number; top: number; sizePt: number; bold: boolean; width: number } // mm
interface LabelLayout { rects: Rect[]; texts: TextRun[] }

// One PDFKit document used only to measure text with real Helvetica metrics
const measurer = new PDFDocument({ autoFirstPage: false });
function measure(text: string, bold: boolean, sizePt: number): number {
  measurer.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(sizePt);
  return measurer.widthOfString(text) / 72 * 25.4; // mm
}

/** A single line of text, shrunk until it fits `widthMm` */
function fitText(text: string, x: number, top: number, widthMm: number, bold: boolean, maxPt: number, minPt = 5): TextRun {
  let size = maxPt;
  while (size > minPt && measure(text, bold, size) > widthMm) size -= 0.5;
  return { text, x, top, sizePt: size, bold, width: Math.min(measure(text, bold, size), widthMm) };
}

/** Code 128 bars, each a whole number of printer dots, centred across the label */
function barcodeRects(value: string, top: number, height: number): Rect[] {
  const enc: any = {};
  JsBarcode(enc, value, { format: "CODE128" });
  const bits: string = enc.encodings.map((e: any) => e.data).join("");
  const quiet = 20; // 10 modules each side
  const maxWidth = LABEL_W - 2;
  let dots = 4;
  while (dots > 1 && (bits.length + quiet) * dots * DOT > maxWidth) dots--;
  const module = dots * DOT;
  const x0 = snap((LABEL_W - bits.length * module) / 2);
  const rects: Rect[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let run = 1;
      while (bits[i + run] === "1") run++;
      rects.push({ x: x0 + i * module, y: top, w: run * module, h: height });
      i += run;
    } else {
      i++;
    }
  }
  return rects;
}

/** QR code cells (runs merged per row), each cell a whole number of dots */
function qrRects(value: string, x: number, y: number, maxSize: number): { rects: Rect[]; size: number } {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n: number = qr.modules.size;
  const cell = Math.max(1, Math.floor(maxSize / n / DOT)) * DOT;
  const x0 = snap(x), y0 = snap(y);
  const rects: Rect[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (qr.modules.get(r, c)) {
        let run = 1;
        while (c + run < n && qr.modules.get(r, c + run)) run++;
        rects.push({ x: x0 + c * cell, y: y0 + r * cell, w: run * cell, h: cell });
        c += run;
      } else {
        c++;
      }
    }
  }
  return { rects, size: n * cell };
}

export function buildLabelLayout(item: LabelItem): LabelLayout {
  const rects = barcodeRects(item.garmentId, 2.5, 13);
  const qr = qrRects(item.garmentId, 3, 18, 17);
  rects.push(...qr.rects);
  const tx = 3 + qr.size + 2.5;
  const tw = LABEL_W - tx - 2.5;
  const texts = [
    fitText(item.factoryLine, tx, 18.6, tw, true, 12),
    fitText(item.garmentId, tx, 24, tw, true, 7.5),
    fitText(`${item.garmentType.toUpperCase()}  ·  SIZE ${item.size}`, tx, 28.2, tw, true, 9),
  ];
  return { rects, texts };
}

/** PDF of 70 x 38 mm pages (for downloading / keeping) */
export function generateLabelPdf(res: any, items: LabelItem[], filename: string, inline: boolean) {
  const doc = new PDFDocument({
    size: [pt(LABEL_W), pt(LABEL_H)],
    margin: 0,
    autoFirstPage: false,
    info: { Title: filename.replace(/\.pdf$/i, ""), Author: "Mr Bubbles Express" },
  });
  // Ask PDF viewers not to "fit to page" when printing
  try {
    (doc as any)._root.data.ViewerPreferences = (doc as any).ref({ PrintScaling: "None" });
  } catch {}

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`);
  doc.pipe(res);

  for (const item of items) {
    const layout = buildLabelLayout(item);
    doc.addPage({ size: [pt(LABEL_W), pt(LABEL_H)], margin: 0 });
    doc.fillColor("#000");
    for (const r of layout.rects) doc.rect(pt(r.x), pt(r.y), pt(r.w), pt(r.h)).fill("#000");
    for (const t of layout.texts) {
      doc.font(t.bold ? "Helvetica-Bold" : "Helvetica").fontSize(t.sizePt);
      doc.text(t.text, pt(t.x), pt(t.top), { lineBreak: false, width: pt(t.width) + 1 });
    }
  }
  doc.end();
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n3 = (v: number) => Number(v.toFixed(3));

/** One label as an SVG drawn in millimetres */
function labelSvg(item: LabelItem, heightMm: number): string {
  const { rects, texts } = buildLabelLayout(item);
  const path = rects.map((r) => `M${n3(r.x)} ${n3(r.y)}h${n3(r.w)}v${n3(r.h)}h${n3(-r.w)}z`).join("");
  const textEls = texts
    .map((t) => {
      const size = t.sizePt * PT_MM;
      const baseline = t.top + HELVETICA_ASCENT * size;
      return `<text x="${n3(t.x)}" y="${n3(baseline)}" font-size="${n3(size)}" font-weight="${t.bold ? 700 : 400}" textLength="${n3(t.width)}" lengthAdjust="spacingAndGlyphs">${esc(t.text)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_W}mm" height="${heightMm}mm" viewBox="0 0 ${LABEL_W} ${heightMm}" shape-rendering="crispEdges"><path d="${path}" fill="#000"/>${textEls}</svg>`;
}

/** Printable HTML page: one label per printed page, sized for the label printer */
export function generateLabelHtml(res: any, items: LabelItem[], title: string) {
  const h = PRINT_PAGE_H;
  const pages = items.map((item) => `<div class="label">${labelSvg(item, h)}</div>`).join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: ${LABEL_W}mm ${h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .label { width: ${LABEL_W}mm; height: ${h}mm; overflow: hidden; break-after: page; page-break-after: always; }
  .label:last-child { break-after: auto; page-break-after: auto; }
  svg { display: block; font-family: Helvetica, Arial, "Liberation Sans", sans-serif; }
  @media screen { body { background: #ddd; padding: 8px; } .label { background: #fff; margin: 0 auto 8px; } }
</style></head>
<body>
${pages}
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
}

/** mode=html → printable page; mode=print → inline PDF; otherwise PDF download */
export function sendLabels(res: any, items: LabelItem[], filename: string, mode: unknown) {
  if (mode === "html") return generateLabelHtml(res, items, filename.replace(/\.pdf$/i, ""));
  return generateLabelPdf(res, items, filename, mode === "print");
}

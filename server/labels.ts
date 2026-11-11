// Thermal garment labels, 70 x 38 mm, one per page.
//
// Built for the cab SQUIX 4.3/200 thermal-transfer printer. Its print head
// has 8 dots per mm and its Windows driver reports 203 dpi, so 203 is the
// default (override with LABEL_DPI=300 for a 300 dpi head, or per request
// with ?dpi=). Every bar and QR cell is a whole number of printer dots, so
// the printer never has to round widths, which keeps the barcode readable.
//
// Each label carries the garment ID twice: as a Code 128 barcode across the
// top, and as a QR code bottom-left (backup for 2D scanners such as the
// Netum CS7501). Both encode exactly the same text.
//
// The layout is worked out once on the printer's dot grid (buildLabelSpec)
// and then sent as:
//   - mode=json  dot-exact layout for the Windows app, which draws each
//                label at the printer's own resolution and sends it straight
//                to the label printer (no print dialog, one label per page)
//   - mode=print PDF shown inline (browsers print it from their own dialog)
//   - mode=html  printable page of SVGs
//   - otherwise  PDF download

import PDFDocument from "pdfkit";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export interface LabelItem {
  garmentId: string;
  garmentType: string;
  size: string;
  /** Optional colour, e.g. "Red" */
  colour?: string | null;
  /** Factory name, printed large, e.g. "Demo Factory" */
  factoryLine: string;
}

const LABEL_W = 70; // mm
const LABEL_H = 38; // mm (the physical label)
// Height of each printed page. Slightly shorter than the label so that, with
// the printer's vertical offset, a print never runs onto the next label
// (which makes the printer feed an extra blank one).
const PRINT_PAGE_H = Math.min(LABEL_H, Number(process.env.LABEL_PRINT_HEIGHT_MM) || 36);
const DEFAULT_DPI = Number(process.env.LABEL_DPI) || 203;
const pt = (v: number) => (v * 72) / 25.4; // mm -> PDF points
const PT_MM = 25.4 / 72; // one typographic point in mm
const HELVETICA_ASCENT = 0.718; // Helvetica ascender, as a fraction of font size

interface Rect { x: number; y: number; w: number; h: number } // mm
interface TextRun { text: string; x: number; top: number; sizePt: number; bold: boolean; width: number } // mm
interface LabelLayout { rects: Rect[]; texts: TextRun[] }

/** Code 128 bars: start position, height and module width in dots, plus the bar pattern ("1" = black module) */
interface BarcodeSpec { x: number; y: number; h: number; module: number; bits: string }
/** QR code: top-left corner and cell size in dots, n x n cells, row by row ("1" = black cell) */
interface QrSpec { x: number; y: number; cell: number; n: number; bits: string }
interface LabelSpec { barcode: BarcodeSpec; qr: QrSpec; texts: TextRun[] }

/** A printer resolution from a request, or the default */
export function parseDpi(value: unknown): number {
  const dpi = Number(value);
  return Number.isFinite(dpi) && dpi >= 100 && dpi <= 1200 ? dpi : DEFAULT_DPI;
}

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

/** Code 128 bars, each module a whole number of printer dots, centred across the label */
function barcodeSpec(value: string, dot: number, topMm: number, heightMm: number): BarcodeSpec {
  const enc: any = {};
  JsBarcode(enc, value, { format: "CODE128" });
  const bits: string = enc.encodings.map((e: any) => e.data).join("");
  const quiet = 20; // 10 modules each side
  const maxWidth = LABEL_W - 2;
  let module = 4;
  while (module > 1 && (bits.length + quiet) * module * dot > maxWidth) module--;
  return {
    x: Math.round((LABEL_W / dot - bits.length * module) / 2),
    y: Math.round(topMm / dot),
    h: Math.round(heightMm / dot),
    module,
    bits,
  };
}

/** QR code cells, each a whole number of dots */
function qrSpec(value: string, dot: number, xMm: number, yMm: number, maxMm: number): QrSpec {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n: number = qr.modules.size;
  let bits = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bits += qr.modules.get(r, c) ? "1" : "0";
  return {
    x: Math.round(xMm / dot),
    y: Math.round(yMm / dot),
    cell: Math.max(1, Math.floor(maxMm / n / dot)),
    n,
    bits,
  };
}

/** The whole label on the printer's dot grid (texts stay in mm) */
export function buildLabelSpec(item: LabelItem, dpi = DEFAULT_DPI): LabelSpec {
  const dot = 25.4 / dpi;
  const barcode = barcodeSpec(item.garmentId, dot, 2.5, 13);
  const qr = qrSpec(item.garmentId, dot, 3, 18, 17);
  const tx = 3 + qr.n * qr.cell * dot + 2.5;
  const tw = LABEL_W - tx - 2.5;
  const texts = [
    fitText(item.factoryLine, tx, 18.6, tw, true, 12),
    fitText(item.garmentId, tx, 24, tw, true, 7.5),
    fitText(
      [item.garmentType, item.colour, `SIZE ${item.size}`].filter(Boolean).join("  ·  ").toUpperCase(),
      tx, 28.2, tw, true, 9,
    ),
  ];
  return { barcode, qr, texts };
}

/** Runs of "1" in a bit string, as [start, length] pairs */
function runs(bits: string, from: number, to: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = from;
  while (i < to) {
    if (bits[i] === "1") {
      let run = 1;
      while (i + run < to && bits[i + run] === "1") run++;
      out.push([i - from, run]);
      i += run;
    } else {
      i++;
    }
  }
  return out;
}

/** The label as black rectangles in mm (for the PDF and SVG renderers) */
export function buildLabelLayout(item: LabelItem, dpi = DEFAULT_DPI): LabelLayout {
  const dot = 25.4 / dpi;
  const { barcode: b, qr: q, texts } = buildLabelSpec(item, dpi);
  const rects: Rect[] = [];
  for (const [start, run] of runs(b.bits, 0, b.bits.length)) {
    rects.push({ x: (b.x + start * b.module) * dot, y: b.y * dot, w: run * b.module * dot, h: b.h * dot });
  }
  for (let r = 0; r < q.n; r++) {
    for (const [c, run] of runs(q.bits, r * q.n, (r + 1) * q.n)) {
      rects.push({ x: (q.x + c * q.cell) * dot, y: (q.y + r * q.cell) * dot, w: run * q.cell * dot, h: q.cell * dot });
    }
  }
  return { rects, texts };
}

/** PDF of 70 x 38 mm pages (for downloading / keeping) */
export function generateLabelPdf(res: any, items: LabelItem[], filename: string, inline: boolean, dpi = DEFAULT_DPI) {
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
    const layout = buildLabelLayout(item, dpi);
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
function labelSvg(item: LabelItem, heightMm: number, dpi: number): string {
  const { rects, texts } = buildLabelLayout(item, dpi);
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
export function generateLabelHtml(res: any, items: LabelItem[], title: string, dpi = DEFAULT_DPI) {
  const h = PRINT_PAGE_H;
  const pages = items.map((item) => `<div class="label">${labelSvg(item, h, dpi)}</div>`).join("\n");
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

/**
 * Dot-exact layout for the Windows app. All positions are in printer dots
 * (pixels at `dpi`). The app draws each label as a black-and-white picture
 * of width x height dots and prints it 1:1, one label per page.
 */
export function generateLabelJson(res: any, items: LabelItem[], dpi = DEFAULT_DPI) {
  const perMm = dpi / 25.4;
  const px = (mm: number) => Math.round(mm * perMm * 100) / 100;
  res.setHeader("Cache-Control", "no-store");
  res.json({
    dpi,
    widthMm: LABEL_W,
    heightMm: PRINT_PAGE_H,
    width: Math.round(LABEL_W * perMm),
    height: Math.round(PRINT_PAGE_H * perMm),
    labels: items.map((item) => {
      const spec = buildLabelSpec(item, dpi);
      return {
        id: item.garmentId,
        barcode: spec.barcode,
        qr: spec.qr,
        texts: spec.texts.map((t) => ({
          text: t.text,
          bold: t.bold,
          x: px(t.x),
          baseline: px(t.top + HELVETICA_ASCENT * t.sizePt * PT_MM),
          size: px(t.sizePt * PT_MM),
          width: px(t.width),
        })),
      };
    }),
  });
}

/** mode=json → layout for the Windows app; mode=html → printable page; mode=print → inline PDF; otherwise PDF download */
export function sendLabels(res: any, items: LabelItem[], filename: string, mode: unknown, dpi?: unknown) {
  const d = parseDpi(dpi);
  if (mode === "json") return generateLabelJson(res, items, d);
  if (mode === "html") return generateLabelHtml(res, items, filename.replace(/\.pdf$/i, ""), d);
  return generateLabelPdf(res, items, filename, mode === "print", d);
}

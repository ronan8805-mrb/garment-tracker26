// Thermal garment labels: one 70 x 38 mm label per PDF page.
//
// Built for the cab SQUIX thermal-transfer printer at 200 dpi (override with
// LABEL_DPI=300 for a 300 dpi head). Every bar and QR cell is snapped to whole
// printer dots so the printer never has to round widths, which keeps the
// barcode readable.
//
// Each label carries the garment ID twice: as a Code 128 barcode across the
// top, and as a QR code bottom-left (backup for 2D scanners such as the
// Netum CS7501). Both encode exactly the same text.

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
const LABEL_H = 38; // mm
const DPI = Number(process.env.LABEL_DPI) || 200;
const DOT = 25.4 / DPI; // one printer dot in mm
const mm = (v: number) => (v * 72) / 25.4; // mm -> PDF points
const snap = (v: number) => Math.round(v / DOT) * DOT; // snap a position to the dot grid

export function generateLabelPdf(
  res: any,
  items: LabelItem[],
  filename: string,
  inline: boolean,
) {
  const doc = new PDFDocument({
    size: [mm(LABEL_W), mm(LABEL_H)],
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

  // One line of text, shrunk until it fits `widthMm`; aligned left or centred.
  const fitText = (
    text: string,
    xMm: number,
    topMm: number,
    widthMm: number,
    font: string,
    maxSize: number,
    align: "left" | "center" = "left",
    minSize = 5,
  ) => {
    const maxW = mm(widthMm);
    let size = maxSize;
    doc.font(font).fontSize(size);
    while (size > minSize && doc.widthOfString(text) > maxW) {
      size -= 0.5;
      doc.fontSize(size);
    }
    const w = Math.min(doc.widthOfString(text), maxW);
    const x = align === "center" ? mm(xMm) + (maxW - w) / 2 : mm(xMm);
    doc.text(text, x, mm(topMm), { lineBreak: false, width: maxW + 1 });
  };

  // Code 128, bar widths a whole number of dots (largest that fits the label width)
  const drawBarcode = (value: string, topMm: number, heightMm: number) => {
    const enc: any = {};
    JsBarcode(enc, value, { format: "CODE128" });
    const bits: string = enc.encodings.map((e: any) => e.data).join("");
    const quiet = 20; // 10 modules each side
    const maxWidth = LABEL_W - 2;
    let dots = 4;
    while (dots > 1 && (bits.length + quiet) * dots * DOT > maxWidth) dots--;
    const module = dots * DOT;
    const total = bits.length * module;
    const x0 = snap((LABEL_W - total) / 2);

    let i = 0;
    while (i < bits.length) {
      if (bits[i] === "1") {
        let run = 1;
        while (bits[i + run] === "1") run++;
        doc.rect(mm(x0 + i * module), mm(topMm), mm(run * module), mm(heightMm)).fill("#000");
        i += run;
      } else {
        i++;
      }
    }
  };

  // QR code, cells a whole number of dots, no bigger than `maxSizeMm`
  const drawQr = (value: string, xMm: number, yMm: number, maxSizeMm: number) => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n: number = qr.modules.size;
    const cellDots = Math.max(1, Math.floor(maxSizeMm / n / DOT));
    const cell = cellDots * DOT;
    const x0 = snap(xMm);
    const y0 = snap(yMm);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.modules.get(r, c)) {
          doc.rect(mm(x0 + c * cell), mm(y0 + r * cell), mm(cell), mm(cell)).fill("#000");
        }
      }
    }
    return n * cell; // printed size in mm
  };

  for (const item of items) {
    doc.addPage({ size: [mm(LABEL_W), mm(LABEL_H)], margin: 0 });
    doc.fillColor("#000");

    // Top: Code 128 across the label
    drawBarcode(item.garmentId, 2.5, 13);

    // Bottom-left: QR code
    const qrSize = drawQr(item.garmentId, 3, 18, 17);

    // Bottom-right: text block
    const tx = 3 + qrSize + 2.5;
    const tw = LABEL_W - tx - 2.5;
    fitText(item.factoryLine, tx, 18.6, tw, "Helvetica-Bold", 12);
    fitText(item.garmentId, tx, 24, tw, "Helvetica-Bold", 7.5);
    fitText(`${item.garmentType.toUpperCase()}  ·  SIZE ${item.size}`, tx, 28.2, tw, "Helvetica-Bold", 9);
  }

  doc.end();
}

// Helpers for downloading and printing labels and barcode sheets without
// opening pop-up tabs, which some browsers and app shells block.
//
// Printing labels works two ways:
//   - In the LaundryTrack Windows app the labels go straight to the label
//     printer: each label is drawn here as a black-and-white picture at the
//     printer's own resolution and the app prints it 1:1 on the label size
//     set in the printer driver, one label per page. No print dialog, so no
//     paper size to get wrong.
//   - In a browser the label PDF opens in the browser's print dialog.

/** Download a file by URL without leaving the page. */
export function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Build a label URL from any barcode endpoint ("print" = inline PDF, "download" = PDF file). */
export function labelUrl(baseUrl: string, mode: "print" | "download") {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}format=label&mode=${mode}`;
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let message = "Could not create the labels";
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }
  return res;
}

/**
 * Load a printable page (PDF) into a hidden frame and open the browser's
 * print dialog. Rejects with a readable message if the server returned an error.
 */
export async function printPdf(url: string): Promise<void> {
  // Check first, so errors show as a message rather than a blank print job
  const res = await fetchOk(url);
  const type = res.headers.get("content-type") || "";
  const blob = new Blob([await res.arrayBuffer()], { type: type.split(";")[0] || "application/octet-stream" });
  const blobUrl = URL.createObjectURL(blob);

  document.getElementById("pdf-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "pdf-print-frame";
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });

  await new Promise<void>((resolve) => {
    frame.onload = () => {
      setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(blobUrl, "_blank");
        }
        resolve();
      }, 300);
    };
    frame.src = blobUrl;
    document.body.appendChild(frame);
  });

  // Free the blob after the print dialog has had time to read it
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

// ---------------------------------------------------------------------------
// Windows app: print straight to the label printer

interface LabelPrinterInfo {
  ok: boolean;
  name?: string;
  dpi?: number;
  widthMm?: number;
  heightMm?: number;
  message?: string;
}

interface PrintResult {
  ok: boolean;
  printed?: number;
  message?: string;
}

interface DesktopApi {
  isElectron?: boolean;
  labelPrinter?: () => Promise<LabelPrinterInfo>;
  printLabelImages?: (printer: string, images: string[]) => Promise<PrintResult>;
}

interface BarcodeSpec { x: number; y: number; h: number; module: number; bits: string }
interface QrSpec { x: number; y: number; cell: number; n: number; bits: string }
interface TextSpec { text: string; bold: boolean; x: number; baseline: number; size: number; width: number }
interface LabelSpec { id: string; barcode: BarcodeSpec; qr: QrSpec; texts: TextSpec[] }
interface LabelJob { dpi: number; width: number; height: number; labels: LabelSpec[] }

function desktopApi(): DesktopApi | undefined {
  return typeof window !== "undefined" ? (window as any).electronAPI : undefined;
}

export type LabelPrintChoice = "test" | "all";

export interface LabelPrintRequest {
  count: number;
  printer: string;
  answer: (choice: LabelPrintChoice | null) => void;
}

// The confirm box lives in <LabelPrintDialogHost/>, mounted once in App
let askListener: ((req: LabelPrintRequest) => void) | null = null;

/** Used by LabelPrintDialogHost to show the "how many labels?" box */
export function onLabelPrintRequest(listener: (req: LabelPrintRequest) => void) {
  askListener = listener;
  return () => {
    if (askListener === listener) askListener = null;
  };
}

function askHowMany(count: number, printer: string): Promise<LabelPrintChoice | null> {
  return new Promise((resolve) => {
    let done = false;
    const answer = (choice: LabelPrintChoice | null) => {
      if (done) return;
      done = true;
      resolve(choice);
    };
    if (askListener) askListener({ count, printer, answer });
    else answer(window.confirm(`Print ${count} label${count === 1 ? "" : "s"} on ${printer}?`) ? "all" : null);
  });
}

const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

/** Draw one label as a black-and-white PNG (base64, no data: prefix) at printer resolution */
export function drawLabel(ctx: CanvasRenderingContext2D, job: LabelJob, label: LabelSpec): string {
  const { width, height } = job;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000";

  // Barcode: every module is exactly `module` dots wide
  const b = label.barcode;
  for (let i = 0; i < b.bits.length; ) {
    if (b.bits[i] !== "1") {
      i++;
      continue;
    }
    let run = 1;
    while (b.bits[i + run] === "1") run++;
    ctx.fillRect(b.x + i * b.module, b.y, run * b.module, b.h);
    i += run;
  }

  // QR code: every cell is exactly `cell` dots square
  const q = label.qr;
  for (let r = 0; r < q.n; r++) {
    for (let c = 0; c < q.n; ) {
      if (q.bits[r * q.n + c] !== "1") {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < q.n && q.bits[r * q.n + c + run] === "1") run++;
      ctx.fillRect(q.x + c * q.cell, q.y + r * q.cell, run * q.cell, q.cell);
      c += run;
    }
  }

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const t of label.texts) {
    ctx.font = `${t.bold ? "bold " : ""}${t.size}px Arial, Helvetica, sans-serif`;
    ctx.fillText(t.text, t.x, t.baseline, t.width + 1);
  }

  // Pure black and white: thermal printers can't print grey
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < 128 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx.canvas.toDataURL("image/png").slice("data:image/png;base64,".length);
}

const CHUNK = 100; // labels per print job, so the printer starts while the rest are prepared

async function printDirect(
  baseUrl: string,
  api: Required<Pick<DesktopApi, "labelPrinter" | "printLabelImages">>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ printed: number; printer: string }> {
  const printer = await api.labelPrinter();
  if (!printer?.ok || !printer.name) {
    throw new Error(printer?.message || "The label printer was not found. Check it is switched on and connected.");
  }

  const sep = baseUrl.includes("?") ? "&" : "?";
  const dpi = printer.dpi && printer.dpi >= 100 ? printer.dpi : 203;
  const job: LabelJob = await (await fetchOk(`${baseUrl}${sep}format=label&mode=json&dpi=${dpi}`)).json();
  if (!job.labels?.length) throw new Error("No labels to print");

  const choice = await askHowMany(job.labels.length, printer.name);
  if (!choice) return { printed: 0, printer: printer.name };
  const labels = choice === "test" ? job.labels.slice(0, 1) : job.labels;

  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not draw the labels");

  let printed = 0;
  onProgress?.(0, labels.length);
  for (let start = 0; start < labels.length; start += CHUNK) {
    const images: string[] = [];
    for (const label of labels.slice(start, start + CHUNK)) {
      images.push(drawLabel(ctx, job, label));
      if (images.length % 20 === 0) await yieldToBrowser();
    }
    const result = await api.printLabelImages(printer.name, images);
    if (!result?.ok) {
      const sent = printed ? ` (${printed} of ${labels.length} were already sent)` : "";
      throw new Error((result?.message || "The printer did not accept the labels") + sent);
    }
    printed += images.length;
    onProgress?.(printed, labels.length);
  }
  return { printed, printer: printer.name };
}

/**
 * Print 70 x 38 mm labels from a barcode endpoint (e.g. /api/batches/:id/barcodes).
 * Windows app: asks "1 test label or all", then prints straight to the label
 * printer and resolves with what was sent. Browser: opens the print dialog
 * and resolves with null.
 */
export async function printLabels(
  baseUrl: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ printed: number; printer: string } | null> {
  const api = desktopApi();
  if (api?.isElectron) {
    if (typeof api.labelPrinter !== "function" || typeof api.printLabelImages !== "function") {
      throw new Error(
        "This copy of the LaundryTrack app is out of date and can't print labels. Close it and open the new LaundryTrack app on the desktop.",
      );
    }
    return printDirect(baseUrl, { labelPrinter: api.labelPrinter, printLabelImages: api.printLabelImages }, onProgress);
  }
  await printPdf(labelUrl(baseUrl, "print"));
  return null;
}

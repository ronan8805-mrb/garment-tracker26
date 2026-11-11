// Helpers for downloading and printing labels and barcode sheets without
// opening pop-up tabs, which some browsers and app shells block.

/** Download a file by URL without leaving the page. */
export function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Build a label URL from any barcode endpoint.
 * "print" asks for the printable HTML page (works in Chrome, Edge and the
 * Windows app, which has no PDF viewer); "download" asks for the PDF file.
 */
export function labelUrl(baseUrl: string, mode: "print" | "download") {
  const sep = baseUrl.includes("?") ? "&" : "?";
  // The Windows app (Electron) has no PDF viewer, so a PDF prints as blank
  // labels there: it gets the printable HTML page instead. Browsers keep the
  // PDF, which prints correctly on the SQUIX.
  const isWindowsApp = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
  const printMode = isWindowsApp ? "html" : "print";
  return `${baseUrl}${sep}format=label&mode=${mode === "print" ? printMode : "download"}`;
}

/**
 * Load a printable page (HTML or PDF) into a hidden frame and open the print
 * dialog, so the user can pick the label printer straight away.
 * Rejects with a readable message if the server returned an error.
 */
export async function printPdf(url: string): Promise<void> {
  // Check first, so errors show as a message rather than a blank print job
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let message = "Could not create the labels";
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }
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

/** Same as printPdf; clearer name for label printing */
export const printLabels = printPdf;

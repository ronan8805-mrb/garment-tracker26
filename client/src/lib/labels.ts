// Helpers for downloading and printing PDFs (barcode sheets, 70 x 38 mm labels)
// without opening pop-up tabs, which some browsers and app shells block.

/** Download a file by URL without leaving the page. */
export function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Build a label URL from any barcode endpoint, adding format=label and the mode. */
export function labelUrl(baseUrl: string, mode: "print" | "download") {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}format=label&mode=${mode}`;
}

/**
 * Load a PDF into a hidden frame and open the browser's print dialog,
 * so the user can pick the label printer straight away.
 * Resolves once the dialog has been opened; rejects with a readable message
 * if the server returned an error instead of a PDF.
 */
export async function printPdf(url: string): Promise<void> {
  // Check first, so errors show as a message rather than an empty print job
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let message = "Could not create the labels";
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
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
          // Some browsers won't print a PDF from a frame: open it instead
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

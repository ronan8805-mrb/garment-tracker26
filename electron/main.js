const { app, BrowserWindow, Menu, ipcMain, net, session } = require("electron");
const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PRODUCTION_URL = process.env.LAUNDRYTRACK_URL || "https://garment-tracker26-production.up.railway.app";
const APP_ORIGIN = new URL(PRODUCTION_URL).origin;

// ---------------------------------------------------------------------------
// Label printing
//
// Labels are printed through Windows GDI (System.Drawing), not Chromium's
// print engine. Chromium ignores the label size set in the printer driver
// and sends a whole page, which makes the label printer feed lots of blank
// labels. GDI prints on the driver's own label size (70 x 36 mm on the cab
// SQUIX), one label per page, and each label picture (drawn by the web app
// at the printer's resolution) is placed 1:1 on the printer's dots.

// Exact printer name to use; otherwise the first printer called "SQUIX" or "cab"
const LABEL_PRINTER = process.env.LAUNDRYTRACK_LABEL_PRINTER || "";
// Distance from the top of one label to the top of the next, in mm (the
// Thermopatch 70 x 38 tags on the SQUIX: 38). 0 = leave it to the driver.
const LABEL_PITCH_MM = process.env.LAUNDRYTRACK_LABEL_PITCH_MM !== undefined ? Number(process.env.LAUNDRYTRACK_LABEL_PITCH_MM) || 0 : 38;
// For testing: save the label pictures in this folder instead of printing
const DRY_RUN_DIR = process.env.LAUNDRYTRACK_LABEL_DRYRUN || "";

const PRINT_SCRIPT = String.raw`
param(
  [Parameter(Mandatory = $true)][ValidateSet('Info', 'Print')][string]$Action,
  [Parameter(Mandatory = $true)][string]$Printer,
  [string]$Dir = '',
  [double]$PitchMm = 0
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $Printer
if (-not $doc.PrinterSettings.IsValid) { throw "Printer not found: $Printer" }

if ($Action -eq 'Info') {
  $page = $doc.PrinterSettings.DefaultPageSettings
  $g = $doc.PrinterSettings.CreateMeasurementGraphics()
  try {
    $info = [ordered]@{
      dpi = [int][math]::Round($g.DpiX)
      dpiY = [int][math]::Round($g.DpiY)
      widthMm = [math]::Round($page.PaperSize.Width * 0.254, 1)
      heightMm = [math]::Round($page.PaperSize.Height * 0.254, 1)
    }
  } finally { $g.Dispose() }
  ConvertTo-Json -InputObject $info -Compress
  exit 0
}

$files = @(Get-ChildItem -LiteralPath $Dir -Filter '*.png' | Sort-Object Name)
if ($files.Count -eq 0) { throw 'No labels to print' }

# Use the label size, offsets and settings saved in the printer driver
$doc.DocumentName = 'LaundryTrack labels'
$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$doc.PrinterSettings.Copies = 1
$doc.DefaultPageSettings.Landscape = $false
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.OriginAtMargins = $false

$script:next = 0
$doc.add_PrintPage({
  param($s, $e)
  $src = New-Object System.Drawing.Bitmap($files[$script:next].FullName)
  try {
    # Black and white, one image pixel per printer dot
    $rect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
    $mono = $src.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format1bppIndexed)
    try {
      $g = $e.Graphics
      $g.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $g.TranslateTransform([single](-$e.PageSettings.HardMarginX * $g.DpiX / 100), [single](-$e.PageSettings.HardMarginY * $g.DpiY / 100))
      $g.DrawImage($mono, 0, 0, $mono.Width, $mono.Height)
    } finally { $mono.Dispose() }
  } finally { $src.Dispose() }
  $script:next++
  $e.HasMorePages = ($script:next -lt $files.Count)
})

if ($PitchMm -le 0) {
  $doc.Print()
  Write-Output ('{"printed":' + $files.Count + '}')
  exit 0
}

# The driver tells the printer the label pitch is the page length (36 mm),
# but the real distance from one label to the next is longer, so the printer
# drifts and feeds blank labels. Let the driver render the job to a file,
# put the real pitch into its label size command, and send that to the printer.
$raw = Join-Path ([IO.Path]::GetTempPath()) ('laundrytrack-' + [guid]::NewGuid().ToString('N') + '.prn')
$doc.DocumentName = 'LaundryTrack labels ' + [IO.Path]::GetFileNameWithoutExtension($raw)
$doc.PrinterSettings.PrintToFile = $true
$doc.PrinterSettings.PrintFileName = $raw
$doc.Print()

# The spooler writes the file in the background: wait for the job to finish
$deadline = (Get-Date).AddSeconds(120)
do {
  Start-Sleep -Milliseconds 200
  $pending = @(Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.Document -eq $doc.DocumentName }).Count
} while ($pending -gt 0 -and (Get-Date) -lt $deadline)
if (-not (Test-Path -LiteralPath $raw)) { throw 'The printer driver did not produce the labels' }

$latin1 = [Text.Encoding]::GetEncoding(28591)
$text = $latin1.GetString([IO.File]::ReadAllBytes($raw))
$pitch = $PitchMm.ToString('0.00', [Globalization.CultureInfo]::InvariantCulture)
$script:patched = 0
$text = [regex]::Replace($text, '(?m)^(S\s*l1;[-0-9.]+,[-0-9.]+,[0-9.]+,)[0-9.]+,', [Text.RegularExpressions.MatchEvaluator]{
  param($m)
  $script:patched++
  $m.Groups[1].Value + $pitch + ','
})
if ($script:patched -lt 1) { throw 'Could not set the label pitch (label size command not found)' }

Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class LaundryTrackRaw {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool OpenPrinter(string name, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] static extern int StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int w);
  public static void Send(string printer, string docName, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("Could not open printer " + printer);
    try {
      if (StartDocPrinter(h, 1, new DOCINFO { pDocName = docName, pDataType = "RAW" }) == 0) throw new Exception("Could not start the print job");
      StartPagePrinter(h);
      int written;
      if (!WritePrinter(h, data, data.Length, out written) || written != data.Length) throw new Exception("Could not send the labels to the printer");
      EndPagePrinter(h);
      EndDocPrinter(h);
    } finally { ClosePrinter(h); }
  }
}
'@
try {
  [LaundryTrackRaw]::Send($Printer, 'LaundryTrack labels', $latin1.GetBytes($text))
} finally {
  Remove-Item -LiteralPath $raw -ErrorAction SilentlyContinue
}
Write-Output ('{"printed":' + $files.Count + '}')
`;

function powershell(args, timeoutMs) {
  const exe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const script = path.join(app.getPath("userData"), "print-labels.ps1");
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, PRINT_SCRIPT.replace(/\r?\n/g, "\r\n"), "utf8");
  return new Promise((resolve, reject) => {
    execFile(
      exe,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...args],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const firstLine = String(stderr || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)[0];
          reject(new Error(firstLine || err.message));
        } else {
          resolve(String(stdout).trim());
        }
      },
    );
  });
}

/** Only the LaundryTrack site itself may print */
function fromApp(event) {
  try {
    return new URL(event.senderFrame.url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

async function installedPrinters(webContents) {
  return (await webContents.getPrintersAsync()).map((p) => p.name);
}

function pickLabelPrinter(names) {
  if (LABEL_PRINTER) return names.includes(LABEL_PRINTER) ? LABEL_PRINTER : null;
  return names.find((n) => /squix/i.test(n)) || names.find((n) => /\bcab\b/i.test(n)) || null;
}

let printerInfo = null;

ipcMain.handle("labels:printer", async (event) => {
  if (!fromApp(event)) return { ok: false, message: "Not allowed" };
  try {
    const name = pickLabelPrinter(await installedPrinters(event.sender));
    if (!name) {
      return { ok: false, message: "No label printer found. Check the cab SQUIX is switched on and installed in Windows." };
    }
    if (!printerInfo || printerInfo.name !== name) {
      printerInfo = { name, ...JSON.parse(await powershell(["-Action", "Info", "-Printer", name], 60_000)) };
    }
    return { ok: true, name, dpi: printerInfo.dpi, widthMm: printerInfo.widthMm, heightMm: printerInfo.heightMm };
  } catch (err) {
    return { ok: false, message: `Label printer problem: ${err.message}` };
  }
});

let printing = false;

ipcMain.handle("labels:print", async (event, printer, images) => {
  if (!fromApp(event)) return { ok: false, message: "Not allowed" };
  if (printing) return { ok: false, message: "Still printing the last labels, please wait" };
  if (typeof printer !== "string" || !Array.isArray(images) || images.length === 0 || images.length > 1000) {
    return { ok: false, message: "Nothing to print" };
  }
  if (!(await installedPrinters(event.sender)).includes(printer)) {
    return { ok: false, message: `Printer not found: ${printer}` };
  }

  printing = true;
  let dir = null;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "laundrytrack-labels-"));
    images.forEach((b64, i) => {
      const png = Buffer.from(String(b64), "base64");
      if (png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("A label picture was damaged");
      fs.writeFileSync(path.join(dir, `${String(i).padStart(5, "0")}.png`), png);
    });
    if (DRY_RUN_DIR) {
      fs.mkdirSync(DRY_RUN_DIR, { recursive: true });
      const stamp = Date.now();
      for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(DRY_RUN_DIR, `${stamp}-${f}`));
      return { ok: true, printed: images.length, dryRun: true };
    }
    await powershell(["-Action", "Print", "-Printer", printer, "-Dir", dir, "-PitchMm", String(LABEL_PITCH_MM)], 10 * 60_000);
    return { ok: true, printed: images.length };
  } catch (err) {
    return { ok: false, message: err.message };
  } finally {
    printing = false;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "LaundryTrack - Mr Bubbles Express",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(PRODUCTION_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.loadURL(PRODUCTION_URL);
      }
    }, 5000);
  });
}

// ---------------------------------------------------------------------------
// Automatic backups to this PC
//
// The garment labels are heat-pressed onto the garments for good, so the data
// behind them must never be lost. While the app is open it downloads a full
// backup (every factory, garment, scan, batch and invoice) and a garment list
// for Excel into Documents\LaundryTrack Backups, using the admin login the
// app already has. A new dated copy is kept whenever anything has changed;
// old copies are never deleted. The *_LATEST files are always the newest.

const BACKUP_DIR = process.env.LAUNDRYTRACK_BACKUP_DIR || path.join(app.getPath("documents"), "LaundryTrack Backups");
const BACKUP_EVERY_MS = 3 * 60 * 60 * 1000; // every 3 hours while the app is open

function getWithAppLogin(url) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, session: session.defaultSession, useSessionCookies: true });
    const chunks = [];
    request.on("response", (response) => {
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
}

let backupRunning = false;

/** Returns true when a backup was saved */
async function backupToPc() {
  if (backupRunning) return false;
  backupRunning = true;
  try {
    const full = await getWithAppLogin(`${PRODUCTION_URL}/api/backup`);
    if (full.status !== 200) {
      console.log(`Backup skipped: server answered ${full.status} (not logged in as admin?)`);
      return false;
    }
    const data = JSON.parse(full.body.toString("utf8"));
    if (!Array.isArray(data.garments) || !Array.isArray(data.factories)) throw new Error("backup file looks wrong");
    const csv = await getWithAppLogin(`${PRODUCTION_URL}/api/backup/garments.csv`);

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const { exportedAt, ...content } = data;
    const hash = crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
    const hashFile = path.join(BACKUP_DIR, ".last-backup-hash");
    const lastHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, "utf8").trim() : "";

    // Always refresh the "latest" copies
    fs.writeFileSync(path.join(BACKUP_DIR, "LaundryTrack_backup_LATEST.json"), full.body);
    if (csv.status === 200) fs.writeFileSync(path.join(BACKUP_DIR, "LaundryTrack_garments_LATEST.csv"), csv.body);

    // Keep a dated copy whenever something changed
    if (hash !== lastHash) {
      const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
      fs.writeFileSync(path.join(BACKUP_DIR, `LaundryTrack_backup_${stamp}.json`), full.body);
      if (csv.status === 200) fs.writeFileSync(path.join(BACKUP_DIR, `LaundryTrack_garments_${stamp}.csv`), csv.body);
      fs.writeFileSync(hashFile, hash);
    }
    fs.writeFileSync(
      path.join(BACKUP_DIR, "last-backup.txt"),
      `Last backup: ${new Date().toString()}\r\nGarments: ${data.garments.length}\r\nFactories: ${data.factories.length}\r\nScans: ${(data.scanEvents || []).length}\r\n`,
    );
    console.log(`Backup saved to ${BACKUP_DIR} (${data.garments.length} garments)`);
    return true;
  } catch (err) {
    console.error("Backup failed:", err);
    return false;
  } finally {
    backupRunning = false;
  }
}

function startBackups() {
  // Try every minute until the admin is logged in and a backup is saved,
  // then every 3 hours
  const loop = async () => {
    const saved = await backupToPc();
    setTimeout(loop, saved ? BACKUP_EVERY_MS : 60_000);
  };
  setTimeout(loop, 20_000);
}

// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  startBackups();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

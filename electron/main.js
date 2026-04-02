const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

const PRODUCTION_URL = process.env.LAUNDRYTRACK_URL || "https://garment-tracker26-production.up.railway.app";

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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

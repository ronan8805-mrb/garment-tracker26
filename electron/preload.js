const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  // Labels go straight to the label printer (see main.js)
  labelPrinter: () => ipcRenderer.invoke("labels:printer"),
  printLabelImages: (printer, images) => ipcRenderer.invoke("labels:print", printer, images),
});

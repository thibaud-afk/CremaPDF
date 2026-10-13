const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  open: () => ipcRenderer.invoke("open"),
  pending: () => ipcRenderer.invoke("pending"),
  onPdfRequested: (fn) => ipcRenderer.on("pdf-requested", () => fn()),
  defaultApp: () => ipcRenderer.invoke("default-app"),
  save: (data) => ipcRenderer.invoke("save", data),
  loadSignature: () => ipcRenderer.invoke("signature-load"),
  saveSignature: (data) => ipcRenderer.invoke("signature-save", data),
});

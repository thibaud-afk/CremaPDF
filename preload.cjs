const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  open: () => ipcRenderer.invoke("open"),
  pending: () => ipcRenderer.invoke("pending"),
  onPdfRequested: (fn) => ipcRenderer.on("pdf-requested", () => fn()),
  defaultApp: () => ipcRenderer.invoke("default-app"),
  save: (data) => ipcRenderer.invoke("save", data),
  print: (images,settings) => ipcRenderer.invoke('print-pdf',{images,settings}),
  printers: () => ipcRenderer.invoke('printers'),
  printerCapabilities: name => ipcRenderer.invoke('printer-capabilities',name),
  updateInfo: () => ipcRenderer.invoke('update-info'),
  chooseUpdateFolder: () => ipcRenderer.invoke('update-folder'),
  checkUpdate: source => ipcRenderer.invoke('update-check',source),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateProgress: fn => ipcRenderer.on('update-progress',(_,message)=>fn(message)),
  loadSignature: () => ipcRenderer.invoke("signature-load"),
  saveSignature: (data) => ipcRenderer.invoke("signature-save", data),
});

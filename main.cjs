const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  shell,
  net,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
let win;
let pending = process.argv.find((a) => /\.pdf$/i.test(a));
if (!process.env.CREMAPDF_TEST_DATA && !app.requestSingleInstanceLock())
  app.quit();
app.on("second-instance", (e, argv) => {
  const p = argv.find((a) => /\.pdf$/i.test(a));
  if (p) {
    pending = p;
    win?.webContents.send("pdf-requested");
  }
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
if (process.env.CREMAPDF_TEST_DATA)
  app.setPath("userData", process.env.CREMAPDF_TEST_DATA);
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 950,
    minHeight: 650,
    show: !process.env.CREMAPDF_TEST_DATA,
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#f4f5f7",
    title: "CremaPDF",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadFile("index.html");
  require('./updates.cjs').register({app,ipcMain,dialog,net,shell,win});
  let printBusy=false;
  ipcMain.handle('print-pdf',async(e,images)=>{
    if(e.sender!==win.webContents||printBusy)throw Error('Une impression est déjà en cours.');
    if(!Array.isArray(images)||!images.length||images.some(i=>typeof i!=='string'||!i.startsWith('data:image/png;base64,')))throw Error('Pages à imprimer non valides.');
    printBusy=true;let printWindow;
    try{printWindow=new BrowserWindow({show:false,parent:win,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
      await printWindow.loadFile(path.join(__dirname,'print.html'));
      await printWindow.webContents.executeJavaScript(`window.preparePrint(${JSON.stringify(images)})`);
      return await new Promise((resolve,reject)=>{try{printWindow.webContents.print({silent:false,printBackground:true,pageSize:'A4',margins:{marginType:'none'}},(success,reason)=>resolve({success,reason}));}catch(error){reject(error);}});
    }finally{printWindow?.destroy();printBusy=false;}
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  const readPdf = async (p) => ({
    name: path.basename(p),
    bytes: new Uint8Array(await fs.readFile(p)),
  });
  ipcMain.handle("pending", async () => {
    const p = pending;
    pending = null;
    return p ? readPdf(p) : null;
  });
  ipcMain.handle("default-app", () =>
    shell.openExternal("ms-settings:defaultapps"),
  );
  win.webContents.on("will-prevent-unload", (e) => {
    if (
      dialog.showMessageBoxSync(win, {
        type: "question",
        buttons: ["Rester", "Fermer sans enregistrer"],
        defaultId: 0,
        cancelId: 0,
        message: "Des ajouts ne sont pas enregistrés. Fermer quand même ?",
      }) === 1
    )
      e.preventDefault();
  });
  ipcMain.handle("open", async () => {
    const r = await dialog.showOpenDialog(win, {
      filters: [{ name: "Documents PDF", extensions: ["pdf"] }],
      properties: ["openFile"],
    });
    if (r.canceled) return null;
    const p = r.filePaths[0];
    return {
      name: path.basename(p),
      bytes: new Uint8Array(await fs.readFile(p)),
    };
  });
  ipcMain.handle("save", async (e, { name, bytes }) => {
    if (!(bytes instanceof Uint8Array) || bytes.length > 500 * 1024 * 1024)
      throw Error("Fichier non valide");
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.basename(name),
      filters: [{ name: "Document PDF", extensions: ["pdf"] }],
    });
    if (r.canceled) return false;
    await fs.writeFile(r.filePath, bytes);
    return true;
  });
  const sigPath = path.join(app.getPath("userData"), "signature.bin");
  ipcMain.handle("signature-load", async () => {
    try {
      return safeStorage.decryptString(await fs.readFile(sigPath));
    } catch {
      return null;
    }
  });
  ipcMain.handle("signature-save", async (e, data) => {
    if (data === null) {
      await fs.rm(sigPath, { force: true });
      return;
    }
    if (
      typeof data !== "string" ||
      !data.startsWith("data:image/png;base64,") ||
      data.length > 6000000
    )
      throw Error("Signature non valide");
    if (!safeStorage.isEncryptionAvailable())
      throw Error("Le stockage sécurisé Windows est indisponible.");
    await fs.writeFile(sigPath, safeStorage.encryptString(data));
  });
});
app.on("window-all-closed", () => app.quit());

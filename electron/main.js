const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let engineWorker;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#101019',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // En dev, le renderer est servi par Vite (HMR).
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // En prod, on charge le build Vite de la couche UI.
    mainWindow.loadFile(path.join(__dirname, '../src/ui/dist/index.html'));
  }
}

function startEngineWorker() {
  engineWorker = new Worker(path.join(__dirname, '../engine/worker.js'));

  engineWorker.on('message', (msg) => {
    if (mainWindow) mainWindow.webContents.send('engine:message', msg);
  });

  engineWorker.on('error', (err) => console.error('[engine] error:', err));
  engineWorker.on('exit', (code) => console.log('[engine] exited with code', code));
}

// UI → engine
ipcMain.on('engine:send', (_event, msg) => {
  if (engineWorker) engineWorker.postMessage(msg);
});

// Capture de la carte : screenshot puis dialogue natif d'enregistrement.
ipcMain.handle('capture:map', async (_event, { rect, defaultName }) => {
  const img = await mainWindow.webContents.capturePage(rect);
  const pngBuffer = img.toPNG();

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer la zone',
    defaultPath: `${defaultName || 'zone'}.png`,
    filters: [{ name: 'Image PNG', extensions: ['png'] }],
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, pngBuffer);
    return { ok: true, filePath };
  }
  return { ok: false };
});

app.whenReady().then(() => {
  createWindow();
  startEngineWorker();
  if (!app.isPackaged) enableHotReload();
});

app.on('window-all-closed', () => {
  if (engineWorker) engineWorker.terminate();
  if (process.platform !== 'darwin') app.quit();
});

function enableHotReload() {
  const chokidar = require('chokidar');

  // Le renderer (src/ui) est rechargé par Vite (HMR) — on ne le surveille pas ici.
  // engine/ → redémarre le worker (les .js sont régénérés par `tsc`/`watch:engine`).
  chokidar.watch(path.join(__dirname, '../engine'), { ignoreInitial: true })
    .on('change', () => {
      if (engineWorker) engineWorker.terminate().then(startEngineWorker);
    });
}

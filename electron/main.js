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
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../src/dist/index.html'));
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

// Map screenshot: capture then open native save dialog
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
});

app.on('window-all-closed', () => {
  if (engineWorker) engineWorker.terminate();
  if (process.platform !== 'darwin') app.quit();
});


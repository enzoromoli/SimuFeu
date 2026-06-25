const { app, BrowserWindow, ipcMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');

let mainWindow;
let engineWorker;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
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

  // src/ → recharge la fenêtre
  chokidar.watch(path.join(__dirname, '../src'), { ignoreInitial: true })
    .on('change', () => {
      if (mainWindow) mainWindow.webContents.reload();
    });

  // engine/ → redémarre le worker
  chokidar.watch(path.join(__dirname, '../engine'), { ignoreInitial: true })
    .on('change', () => {
      if (engineWorker) engineWorker.terminate().then(startEngineWorker);
    });

  // electron/ → relance le process entier
  chokidar.watch(__dirname, { ignoreInitial: true })
    .on('change', () => {
      app.relaunch();
      app.exit(0);
    });
}

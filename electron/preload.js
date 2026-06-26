const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('engine', {
  send: (msg) => ipcRenderer.send('engine:send', msg),
  onMessage: (callback) => ipcRenderer.on('engine:message', (_event, msg) => callback(msg)),
});

contextBridge.exposeInMainWorld('capture', {
  map: (rect, defaultName) => ipcRenderer.invoke('capture:map', { rect, defaultName }),
});

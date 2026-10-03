const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maxenDesktop', {
  windowAction(action) {
    if (['minimize', 'maximize', 'close'].includes(action)) ipcRenderer.send('maxen:window-action', action);
  },
  onWindowState(callback) {
    if (typeof callback === 'function') {
      ipcRenderer.on('maxen:window-maximized-state', (_event, isMaximized) => callback(isMaximized));
    }
  },
  reportPlayback(isPlaying) {
    ipcRenderer.send('maxen:playback-state', Boolean(isPlaying));
  },
  showInFolder(target) {
    if (target && typeof target === 'string') {
      ipcRenderer.send('maxen:show-in-folder', target);
    }
  },
});

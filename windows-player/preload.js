const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maxenDesktop', {
  windowAction(action) {
    if (['minimize', 'maximize', 'close'].includes(action)) ipcRenderer.send('maxen:window-action', action);
  },
});

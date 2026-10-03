const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, shell, ipcMain, powerSaveBlocker } = require('electron');

let mainWindow;
let localServer;
let sleepBlockerId = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  async function createWindow() {
    process.env.MAXEN_PLAYER_PORT = process.env.MAXEN_PLAYER_PORT || '47831';
    process.env.MAXEN_CACHE_DIR = path.join(app.getPath('userData'), 'cache');
    process.env.MAXEN_DOWNLOAD_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'Maxen', 'downloads');

    const backend = require('./server');
    localServer = backend.server;
    const address = await backend.startServer(Number(process.env.MAXEN_PLAYER_PORT));
    const localOrigin = `http://127.0.0.1:${address.port}`;

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 640,
      show: true,
      frame: false,
      backgroundColor: '#050505',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(localOrigin)) {
        event.preventDefault();
        if (/^https?:/i.test(url)) shell.openExternal(url);
      }
    });

    mainWindow.on('maximize', () => {
      mainWindow?.webContents.send('maxen:window-maximized-state', true);
    });
    mainWindow.on('unmaximize', () => {
      mainWindow?.webContents.send('maxen:window-maximized-state', false);
    });

    try {
      await mainWindow.loadURL(process.env.MAXEN_HOT_RELOAD === '1' ? `${localOrigin}/?dev` : localOrigin);
    } catch (err) {
      console.error('loadURL error:', err);
    }
    mainWindow.show();
    mainWindow.maximize();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
    setTimeout(() => {
      try { mainWindow?.setAlwaysOnTop(false); } catch {}
    }, 1500);
    mainWindow.webContents.send('maxen:window-maximized-state', mainWindow.isMaximized());
  }

  app.whenReady().then(createWindow).catch((error) => {
    console.error(error);
    app.quit();
  });

  ipcMain.on('maxen:window-action', (event, action) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    if (action === 'close') mainWindow.close();
  });

  ipcMain.on('maxen:playback-state', (event, isPlaying) => {
    if (event.sender !== mainWindow?.webContents) return;
    if (isPlaying) {
      if (sleepBlockerId === null || !powerSaveBlocker.isStarted(sleepBlockerId)) {
        sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      }
    } else {
      if (sleepBlockerId !== null && powerSaveBlocker.isStarted(sleepBlockerId)) {
        powerSaveBlocker.stop(sleepBlockerId);
        sleepBlockerId = null;
      }
    }
  });

  ipcMain.on('maxen:show-in-folder', (event, targetIdOrPath) => {
    if (event.sender !== mainWindow?.webContents || !targetIdOrPath) return;
    const downloadDir = process.env.MAXEN_DOWNLOAD_DIR || path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'Maxen', 'downloads');
    const folder = path.isAbsolute(targetIdOrPath) ? targetIdOrPath : path.join(downloadDir, targetIdOrPath);
    if (fs.existsSync(folder)) {
      shell.showItemInFolder(folder);
    } else if (fs.existsSync(downloadDir)) {
      shell.openPath(downloadDir);
    }
  });

  app.on('window-all-closed', () => {
    if (sleepBlockerId !== null && powerSaveBlocker.isStarted(sleepBlockerId)) {
      powerSaveBlocker.stop(sleepBlockerId);
      sleepBlockerId = null;
    }
    app.quit();
  });

  app.on('before-quit', () => {
    if (localServer?.listening) localServer.close();
  });
}

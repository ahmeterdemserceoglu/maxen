const path = require('path');
const { app, BrowserWindow, shell, ipcMain } = require('electron');

let mainWindow;
let localServer;

async function createWindow() {
  process.env.MAXEN_PLAYER_PORT = process.env.MAXEN_PLAYER_PORT || '47831';
  process.env.MAXEN_CACHE_DIR = path.join(app.getPath('userData'), 'cache');
  process.env.MAXEN_DOWNLOAD_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'Maxen', 'downloads');

  const backend = require('./server');
  localServer = backend.server;
  const address = await backend.startServer();
  const localOrigin = `http://127.0.0.1:${address.port}`;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
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

  await mainWindow.loadURL(process.env.MAXEN_HOT_RELOAD === '1' ? `${localOrigin}/?dev` : localOrigin);
  mainWindow.maximize();
  mainWindow.show();
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

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  if (localServer?.listening) localServer.close();
});

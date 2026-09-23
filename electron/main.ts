import { app, BrowserWindow, Menu, screen, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';

const WINDOW = { width: 280, height: 320 };
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;

function startAutoUpdater() {
  if (!app.isPackaged) return;

  const { autoUpdater } = electronUpdater;
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', error => console.error('Auto-update failed:', error));

  const check = () => void autoUpdater.checkForUpdatesAndNotify().catch(error => {
    console.error('Unable to check for updates:', error);
  });
  setTimeout(check, 10_000);
  setInterval(check, UPDATE_INTERVAL_MS);
}

function senderWindow(event: IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || event.senderFrame !== window.webContents.mainFrame) throw new Error('Invalid settings sender');
  return window;
}
ipcMain.handle('companion:get-top', event => senderWindow(event).isAlwaysOnTop());
ipcMain.handle('companion:set-top', (event, value: unknown) => {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean');
  const window = senderWindow(event);
  if (value) window.focus();
  if (window.isAlwaysOnTop() === value) return value;
  return new Promise<boolean>((resolve) => {
    window.once('always-on-top-changed', (_event, enabled) => resolve(enabled));
    window.setAlwaysOnTop(value);
  });
});
ipcMain.handle('companion:close', event => { senderWindow(event); app.quit(); });

async function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    ...WINDOW,
    x: area.x + area.width - WINDOW.width - 32,
    y: area.y + area.height - WINDOW.height - 32,
    title: 'BDC — Bubu Dudu Companion',
    backgroundColor: '#00000000',
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: fileURLToPath(new URL('../preload/preload.cjs', import.meta.url)),
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([{ label: 'Quit BDC', click: () => app.quit() }]).popup({ window });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => console.error('Renderer exited:', details.reason));

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  }
}

app.whenReady().then(async () => {
  await createWindow();
  startAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch(error => { console.error(error); app.quit(); });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

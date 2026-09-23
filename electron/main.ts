import { app, BrowserWindow, Menu, screen, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import electronUpdater from 'electron-updater';

const WINDOW = { width: 280, height: 320 };
let roomWindow: BrowserWindow | undefined;
let shopWindow: BrowserWindow | undefined;
function positionShop() {
  if (!roomWindow || !shopWindow) return;
  const room = roomWindow.getBounds(), area = screen.getDisplayMatching(room).workArea;
  const panel = shopWindow.getBounds();
  const x = room.x + room.width + panel.width + 10 <= area.x + area.width ? room.x + room.width + 10 : room.x - panel.width - 10;
  shopWindow.setPosition(Math.max(area.x, x), Math.max(area.y, Math.min(room.y, area.y + area.height - panel.height)));
}
ipcMain.handle('companion:open-shop', async event => {
  if (senderWindow(event) !== roomWindow) return;
  if (shopWindow) { shopWindow.show(); shopWindow.focus(); return; }
  shopWindow = new BrowserWindow({ width: 300, height: 460, frame: false, resizable: false, show: false,
    backgroundColor: '#fff7eb', parent: roomWindow, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: fileURLToPath(new URL('../preload/preload.cjs', import.meta.url)) } });
  positionShop();
  shopWindow.setAlwaysOnTop(roomWindow.isAlwaysOnTop());
  shopWindow.on('closed', () => { shopWindow = undefined; roomWindow?.webContents.send('room-command', { type: 'cancel' }); });
  shopWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  shopWindow.webContents.on('will-navigate', e => e.preventDefault());
  shopWindow.once('ready-to-show', () => shopWindow?.show());
  if (process.env.ELECTRON_RENDERER_URL) await shopWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#shop`);
  else await shopWindow.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)), { hash: 'shop' });
});
ipcMain.on('room-command', (event, command) => {
  if (senderWindow(event) !== shopWindow || !command || !['sync', 'buy', 'place', 'store', 'cancel'].includes(command.type)) return;
  roomWindow?.webContents.send('room-command', command);
});
ipcMain.on('room-state', (event, state) => { if (senderWindow(event) === roomWindow) shopWindow?.webContents.send('room-state', state); });
ipcMain.handle('companion:close-shop', event => { if (senderWindow(event) === shopWindow) shopWindow?.close(); });
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;

function startAutoUpdater() {
  if (!app.isPackaged) return;

  const { autoUpdater } = electronUpdater;
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', error => console.error('Auto-update failed:', error));
  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  const check = () => void autoUpdater.checkForUpdatesAndNotify().catch(error => {
    console.error('Unable to check for updates:', error);
  });
  setTimeout(check, 3_000);
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
  const icon = process.env.ELECTRON_RENDERER_URL
    ? resolve(app.getAppPath(), 'public/assets/logo/logo.png')
    : fileURLToPath(new URL('../renderer/assets/logo/logo.png', import.meta.url));
  const window = new BrowserWindow({
    ...WINDOW,
    x: area.x + area.width - WINDOW.width - 32,
    y: area.y + area.height - WINDOW.height - 32,
    title: 'BDC — Bubu Dudu Companion',
    icon,
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
  roomWindow = window;
  window.on('move', positionShop);
  window.on('always-on-top-changed', (_event, value) => shopWindow?.setAlwaysOnTop(value));
  window.on('closed', () => { shopWindow?.destroy(); shopWindow = undefined; roomWindow = undefined; });
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

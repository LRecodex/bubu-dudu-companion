import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('companion', {
  getAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('companion:get-top'),
  setAlwaysOnTop: (value: boolean): Promise<boolean> => ipcRenderer.invoke('companion:set-top', value),
  close: (): Promise<void> => ipcRenderer.invoke('companion:close'),
  openShop: (): Promise<void> => ipcRenderer.invoke('companion:open-shop'),
  closeShop: (): Promise<void> => ipcRenderer.invoke('companion:close-shop'),
  roomCommand: (command: unknown) => ipcRenderer.send('room-command', command),
  publishRoom: (state: unknown) => ipcRenderer.send('room-state', state),
  onRoomCommand: (callback: (command: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: unknown) => callback(command);
    ipcRenderer.on('room-command', listener); return () => ipcRenderer.removeListener('room-command', listener);
  },
  onRoomState: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on('room-state', listener); return () => ipcRenderer.removeListener('room-state', listener);
  },
});

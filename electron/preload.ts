import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('companion', {
  getAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('companion:get-top'),
  setAlwaysOnTop: (value: boolean): Promise<boolean> => ipcRenderer.invoke('companion:set-top', value),
  close: (): Promise<void> => ipcRenderer.invoke('companion:close'),
});

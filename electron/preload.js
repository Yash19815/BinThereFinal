const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe bridge between renderer (React SPA) and main process.
 * Only explicitly listed functions are exposed — no raw Node/Electron access.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Returns the running app version from package.json (e.g. "2.13.0"). */
  getVersion: () => ipcRenderer.invoke('app-version'),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
});

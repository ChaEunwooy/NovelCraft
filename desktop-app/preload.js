const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openTomatoLogin: () => ipcRenderer.invoke('open-tomato-login'),
  onLoginSuccess: (callback) => ipcRenderer.on('tomato-login-success', (event, data) => callback(data))
});

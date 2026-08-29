const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openTomatoLogin: () => ipcRenderer.invoke('open-tomato-login'),
  onLoginSuccess: (callback) => ipcRenderer.on('tomato-login-success', (event, data) => callback(data))
});

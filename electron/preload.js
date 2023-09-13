const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersions: () => ['chrome', 'node', 'electron'].reduce((x, y) => Object.assign(x, { [y]: process.versions[y] }), {}),
  connectServer: (...args) => ipcRenderer.invoke('connectServer', ...args),
  getState: () => ipcRenderer.invoke('getState'),
  getChildren: (...args) => ipcRenderer.invoke('getChildren', ...args),
  getData: (...args) => ipcRenderer.invoke('getData', ...args),
  setData: (...args) => ipcRenderer.invoke('setData', ...args),
  disConnect: () => ipcRenderer.invoke('disConnect'),
  getQuickLinks: () => ipcRenderer.invoke('getQuickLinks'),
  createNode: (...args) => ipcRenderer.invoke('createNode', ...args),
  removeRecursive: (...args) => ipcRenderer.invoke('removeRecursive', ...args),
  remove: (...args) => ipcRenderer.invoke('remove', ...args)
})
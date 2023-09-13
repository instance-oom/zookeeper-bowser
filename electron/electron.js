const path = require('path');
const { app, BrowserWindow } = require('electron');
const { globSync } = require('glob');

const initialize = () => {
  loadMainProcess();

  const createWindow = () => {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true
      }
    });
    if (app.isPackaged) {
      win.loadFile(path.join(__dirname, 'public/index.html'))
    } else {
      win.loadURL('http://localhost:5173/');
      win.webContents.openDevTools();
    }
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

const loadMainProcess = () => {
  const files = globSync('main-process/**/*.js', { cwd: __dirname, absolute: true });
  files.forEach((file) => require(file));
}

initialize();
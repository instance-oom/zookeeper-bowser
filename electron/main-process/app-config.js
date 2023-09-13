const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

let appConfigs = {};
const AppDir = path.dirname(app.getPath('exe'));

if (fs.existsSync(path.join(AppDir, 'appsettings.json'))) {
  const fileContent = fs.readFileSync(path.join(AppDir, 'appsettings.json')).toString('utf-8');
  const data = _.attempt(JSON.parse, fileContent);
  appConfigs = _.isError(data) ? {} : data;
}

ipcMain.handle('getQuickLinks', async (event) => {
  return Array.isArray(appConfigs.quickLinks) ? appConfigs.quickLinks : [];
});
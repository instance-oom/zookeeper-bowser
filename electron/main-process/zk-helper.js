const _ = require('lodash');
const { ipcMain } = require('electron');
const zookeeper = require('@instance-oom/node-zookeeper-client-async');

class ZKFactory {

  /** @type {ReturnType<zookeeper.createClient>} */
  #client = null;
  #host = null;

  async newClient(host) {
    this.#host = host;
    if (this.#client) this.#client.close();
    this.#client = zookeeper.createClient(host);
    this.#client.on('state', evt => {
      if (evt.name === 'DISCONNECTED') this.#client = null;
    });

    await this.#client.connectAsync();
  }

  /**
   * Get Zookeeper Client
   * @returns {Promise<ReturnType<zookeeper.createClient>>}
   */
  async getClient() {
    if (!this.#host) return null;
    if (this.#client) return this.#client;
    await this.newClient(this.#host);
    return this.#client;
  }
}
const zkFactory = new ZKFactory();


ipcMain.handle('connectServer', async (event, host) => {
  await zkFactory.newClient(host);
});

ipcMain.handle('disConnect', async (event) => {
  const client = await zkFactory.getClient();
  if (!client) return null;  
  client.close();
});

ipcMain.handle('getState', async (event) => {
  return (await zkFactory.getClient())?.getState();
});

ipcMain.handle('getChildren', async (event, nodePath) => {
  const client = await zkFactory.getClient();
  if (!client) return null;
  const { children } = await client.getChildrenAsync(nodePath);
  return await Promise.all(_.map(children, x => {
    const subNodePath = '/' + `${nodePath}/${x}`.split('/').filter(x => _.trim(x)).join('/');
    return client.existsAsync(subNodePath).then(state => ({ path: x, numChildren: state ? state.numChildren : 0 }))
  }));
});

ipcMain.handle('getData', async (event, nodePath) => {
  const client = await zkFactory.getClient();
  if (!client) return null;
  const { data, stat } = await client.getDataAsync(nodePath);
  return {
    data: data.toString('utf8'),
    stat: stat
      ? {
        ctime: Number(stat.ctime.readBigInt64BE()),
        mtime: Number(stat.mtime.readBigInt64BE()),
        version: stat.version,
        cversion: stat.cversion,
        aversion: stat.aversion,
        ephemeralOwner: Number(stat.ephemeralOwner.readBigInt64BE()),
        dataLength: stat.dataLength,
        numChildren: stat.numChildren
      } : null
  };
});

ipcMain.handle('setData', async (event, nodePath, value) => {
  const client = await zkFactory.getClient();
  if (!client) return null;
  return await client.setDataAsync(nodePath, Buffer.from(value || ''));
});

ipcMain.handle('createNode', async (event, nodePath, value) => {
  const client = await zkFactory.getClient();
  if (!client) return null;
  return await client.createAsync(nodePath, Buffer.from(value || ''));
});

ipcMain.handle('removeRecursive', async (event, nodePath) => {
  const client = await zkFactory.getClient();
  if (!client) return null;
  return await client.removeRecursiveAsync(nodePath);
});

ipcMain.handle('remove', async (event, nodePath) => {
  const client = await zkFactory.getClient();
  if (!client) return null;
  return await client.removeAsync(nodePath);
});
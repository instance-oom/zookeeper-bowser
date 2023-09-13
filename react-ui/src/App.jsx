import { useState, useEffect } from 'react'
import { Tree, Input, message, Button, Descriptions, Popconfirm, Space, Divider, Modal, Form } from 'antd';
import { map, orderBy, split, toLower, trim } from 'lodash';
import moment from 'moment-timezone';

const { TextArea } = Input;

const updateTreeData = (origin, key, children) => {
  return origin.map(node => {
    if (node.key === key || node.children) {
      return {
        ...node,
        children: node.children ? updateTreeData(node.children, key, children) : children
      }
    }
    return node;
  });
}

const removeTreeNode = (origin, key) => {
  return origin.map(node => {
    if (node.key === key) return null;
    return node.children ? {
      ...node,
      children: removeTreeNode(node.children, key)
    } : node;
  }).filter(x => x !== null);
}

function App() {
  const [clientHeight, setCliengHeight] = useState(100);
  const [messageApi, contextHolder] = message.useMessage();
  const [children, setChildren] = useState([]);
  const [loadedKeys, setLoadedKeys] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [connectInfo, setConnectInfo] = useState({ connected: false, connecting: false, host: '' });
  const [selectedKey, setSelectedKey] = useState({ key: null, data: null, stat: null, valueChanged: false });
  const [quickLinks, setQuickLinks] = useState([]);
  const [newNode, setNewNode] = useState({ showModal: false, nodeName: null });
  const defaultHost = '127.0.0.1:2181';

  const runElectronAPI = async (method, ...args) => {
    if (!window.electronAPI || !window.electronAPI[method]) {
      messageApi.error(`${method} not exists`);
    }
    try {
      return await window.electronAPI[method](...args)
    } catch (err) {
      console.error(err);
      const msg = split(err.message, ':').splice(1).join('').trim();
      messageApi.error(msg);
      throw msg;
    }
  }

  useEffect(() => {
    runElectronAPI('disConnect');

    runElectronAPI('getQuickLinks').then(data => {
      setQuickLinks(Array.isArray(data) ? data : [])
    });

    const resize = () => setCliengHeight(document.documentElement.clientHeight - 72 - 40);
    window.addEventListener('resize', resize);
    resize();

    return () => { window.removeEventListener('resize', resize) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getChildren = async (nodePath) => {
    const subNodes = await runElectronAPI('getChildren', nodePath);
    let subChildren = map(subNodes, x => ({
      title: x.path,
      key: '/' + `${nodePath}/${x.path}`.split('/').filter(x => x !== '').join('/'),
      isLeaf: !x.numChildren
    }));
    subChildren = orderBy(subChildren, [x => toLower(x.key)]);
    setChildren(origin => updateTreeData(nodePath === '/' ? [{ title: '/', key: '/' }] : origin, nodePath, subChildren));
    if (nodePath === '/') {
      setSelectedKey({ key: null, data: null, stat: null });
      setExpandedKeys(['/']);
      setLoadedKeys(['/']);
    }
  }

  const changeHostValue = (e) => setConnectInfo(origin => Object.assign({}, origin, { host: e.target.value }));
  const selectHost = (e) => {
    setConnectInfo(origin => Object.assign({}, origin, { host: e }));
    setTimeout(() => connect(), 100);
  }

  const onLoadData = ({ key }) => getChildren(key);

  const reloadTree = async () => {
    await getChildren('/')
  }

  const onExpand = (keys) => {
    let newLoadedKeys = loadedKeys;
    if (expandedKeys.length > keys.length) {
      newLoadedKeys = loadedKeys.filter(x => keys.includes(x));
    }
    setLoadedKeys(newLoadedKeys);
    setExpandedKeys(keys);
  }

  const onSelect = async (key) => {
    if (!key[0] || key[0] === selectedKey.key) return;
    const { data, stat } = await runElectronAPI('getData', key[0]);
    setSelectedKey({ key: key[0], data, stat, valueChanged: false });
  }

  const toggleConnect = (e) => {
    e?.preventDefault();
    connectInfo.connected ? disConnect() : connect();
  }

  const connect = async () => {
    if (connectInfo.connected) return;
    setConnectInfo(origin => Object.assign({}, origin, { connecting: true }));
    await runElectronAPI('connectServer', connectInfo.host || defaultHost);
    await getChildren('/');
    setConnectInfo(origin => Object.assign({}, origin, { connected: true, connecting: false }));
  }

  const disConnect = async () => {
    if (!connectInfo.connected) return;
    runElectronAPI('disConnect');
    setConnectInfo(origin => Object.assign({}, origin, { connected: false }));
    setSelectedKey({ key: null, data: null, stat: null, valueChanged: false });
  }

  const showNewNodeModal = () => {
    setNewNode({ showModal: true, nodeName: null });
  }

  const createNode = async () => {
    if (!newNode.nodeName) return;
    const nodeName = '/' + split(newNode.nodeName, '/').map(x => trim(x)).filter(x => x).join('/');
    if (!nodeName || nodeName === '/') return;
    setNewNode(origin => Object.assign({}, origin, { nodeName }));
    await runElectronAPI('createNode', nodeName);
    setNewNode(origin => Object.assign({}, origin, { nodeName: null, showModal: false }));
    const parnet = '/' + split(nodeName, '/').filter(x => x).splice(0, split(nodeName, '/').length - 2).join('/');
    await getChildren(parnet);
  }

  const changeNodeValue = e => {
    setSelectedKey(origin => Object.assign({}, origin, { data: e.target.value, valueChanged: true }));
  }

  const saveValue = async () => {
    await runElectronAPI('setData', selectedKey.key, selectedKey.data);
    messageApi.success('Data updated.');
    setSelectedKey(origin => Object.assign({}, origin, { valueChanged: false }));
  }

  const deleteNode = async (isRecursive) => {
    if (selectedKey.key === '/') {
      messageApi.error('Cannot delete root node');
      return
    }
    if (isRecursive) {
      await runElectronAPI('removeRecursive', selectedKey.key);
    } else {
      await runElectronAPI('remove', selectedKey.key);
    }
    setChildren(origin => removeTreeNode(origin, selectedKey.key));
    setSelectedKey({ key: null, data: null, stat: null, valueChanged: false });
  }

  const nodeDetails = [];
  if (selectedKey.key && selectedKey.stat) {
    nodeDetails.push(...[
      { key: 'ctime', label: 'Create Time', children: moment(selectedKey.stat.ctime).format('YYYY/MM/DD HH:mm:ss') },
      { key: 'mtime', label: 'Modify Time', children: moment(selectedKey.stat.mtime).format('YYYY/MM/DD HH:mm:ss') },
      { key: 'version', label: 'Version', children: selectedKey.stat.version },
      { key: 'aversion', label: 'ACL Version', children: selectedKey.stat.aversion },
      { key: 'numChildren', label: 'Children', children: selectedKey.stat.numChildren },
    ])
  }

  const zkTree = connectInfo.connected
    ? <>
      <div className='siderbar'>
        <div className='btn-group'>
          <Button style={{ flex: '1', marginRight: '4px' }} type='default' onClick={reloadTree} block>
            Reload
          </Button>
          <Button style={{ flex: '1', marginLeft: '4px' }} type='default' onClick={showNewNodeModal} block>
            Create Node
          </Button>
        </div>
        <Tree loadData={onLoadData} treeData={children} height={clientHeight}
          onLoad={setLoadedKeys} loadedKeys={loadedKeys}
          onExpand={onExpand} expandedKeys={expandedKeys} onSelect={onSelect}
          blockNode
          showLine rootStyle={{ backgroundColor: '#fff', borderRadius: '0' }} />
      </div>
    </>
    : null;

  return (
    <>
      {contextHolder}
      <header className='zk-bowser-header'>
        <form noValidate onSubmit={toggleConnect} style={{ flex: '1', display: 'flex', alignItems: 'center' }}>
          <Input style={{ flex: '1' }} value={connectInfo.host} onChange={changeHostValue}
            addonBefore='Host' placeholder={defaultHost} readOnly={connectInfo.connected} />
          <Button style={{ marginLeft: '8px' }} type='default' htmlType='submit'
            loading={connectInfo.connecting} >
            {connectInfo.connected ? 'Disconnect' : 'Connect'}
          </Button>
        </form>
        {
          quickLinks && quickLinks.length > 0
            ? (
              <div className='quick-links'>
                <strong>Quick Links:</strong>
                {
                  quickLinks.map(({ name, host }, index) => {
                    return (
                      <a href='javascript:;' onClick={() => { selectHost(host) }} key={index}>
                        {name}
                      </a>
                    )
                  })
                }
              </div>
            ) : null
        }
      </header>
      <main style={{ '--header-height': quickLinks.length > 0 ? '94px' : '72px' }}>
        {zkTree}
        {
          selectedKey.key
            ? <>
              <div className='node-detail'>
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', marginBottom: '16px' }}>
                  <span style={{ flex: '1' }}>{selectedKey.key}</span>
                  <Space>
                    <Button type='primary' onClick={saveValue} size='small' disabled={!selectedKey.valueChanged}>
                      Save
                    </Button>
                    <Divider type='vertical' />
                    <Popconfirm
                      title="Delete the node"
                      description="Are you sure to delete this node?"
                      onConfirm={() => deleteNode(false)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type='primary' danger ghost size='small'>Delete</Button>
                    </Popconfirm>
                    <Popconfirm
                      title="Delete the node"
                      description="Are you sure to delete this node and his children?"
                      onConfirm={() => deleteNode(true)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type='primary' danger ghost size='small'>Recursive Delete</Button>
                    </Popconfirm>
                  </Space>
                </div>
                <Descriptions bordered size='small' items={nodeDetails}
                  column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1 }}
                  labelStyle={{ textTransform: 'capitalize', fontWeight: '500' }} />
                <TextArea
                  value={selectedKey.data}
                  placeholder='No Data'
                  onChange={changeNodeValue}
                  className='value-editor'
                />
              </div>
            </>
            : null
        }
      </main>
      <Modal title="Create Node" open={newNode.showModal} closable={false} footer={null}>
        <Form layout='vertical'>
          <Form.Item label="">
            <Input autoFocus value={newNode.nodeName} onChange={(e) => setNewNode(x => Object.assign({}, x, { nodeName: trim(e.target.value) }))}
              placeholder='Node path' />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button type='default' htmlType='button' onClick={() => setNewNode(origin => Object.assign({}, origin, { showModal: false }))}>
                Cancel
              </Button>
              <Button type='primary' htmlType='submit' onClick={createNode}>
                Save
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </>
  )
}

export default App

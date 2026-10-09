// 正式 main/preload 入口配合隔离 userData；辅助窗口只验证同源存储，不增加生产桥。
const { BrowserWindow, clipboard } = require('electron');
if (!process.send || !process.env.PROJECT_LIST_TEST_PROFILE) throw new Error('需要隔离 profile 和父进程 IPC');
const testWindows = new Map();
process.on('message', async message => {
  if (!message?.type?.startsWith('assessment-')) return;
  try {
    let result;
    if (message.type === 'assessment-read-clipboard') result = { text: clipboard.readText() };
    else if (message.type === 'assessment-create-page') {
      const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      testWindows.set(window.id, window);
      await window.loadURL(message.url);
      result = { windowId: window.id };
    } else if (message.type === 'assessment-close-page') {
      testWindows.get(message.windowId)?.destroy();
      testWindows.delete(message.windowId);
      result = {};
    } else return;
    process.send({ type: 'assessment-result', id: message.id, ...result });
  } catch (error) { process.send({ type: 'assessment-result', id: message.id, error: error.message }); }
});
require('./project-list-electron.cjs');

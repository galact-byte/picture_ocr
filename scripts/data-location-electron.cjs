// 隔离测试入口：使用正式 main/preload，仅原生对话框由受控选择替代。
const { app, dialog } = require('electron');
const fs = require('node:fs');
if (!process.env.LOCATION_QA_PROFILE) throw new Error('缺少隔离目录');
app.setPath('userData', process.env.LOCATION_QA_PROFILE);
let windowCount = 0;
const events = [];
const finish = (report, code = 0) => {
  fs.writeFileSync(process.env.LOCATION_QA_REPORT, JSON.stringify({ ...report, events, windowCount }, null, 2));
  app.exit(code);
};
dialog.showMessageBox = async options => {
  events.push({ title: options.title, windowCount });
  if (windowCount !== 0) throw new Error('定位前已创建工作台');
  if (options.type === 'error') return { response: 0 };
  return { response: process.env.LOCATION_QA_MODE === 'cancel' ? 1 : 0 };
};
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [process.env.LOCATION_QA_CHOSEN] });
app.on('before-quit', () => finish({ exitedBeforeWindow: windowCount === 0 }));
app.on('browser-window-created', (_event, win) => {
  windowCount++;
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(fs.readFileSync(process.env.LOCATION_QA_BUNDLE, 'utf8'));
      const value = await win.webContents.executeJavaScript(`(async () => {
        const api = locationApi;
        if (${JSON.stringify(process.env.LOCATION_QA_MODE)} === 'seed') {
          const doc = api.createProjectDocument({ systemName: '目录重连测试系统' });
          doc.id = 'location-qa-system';
          doc.assets = [{id:'asset',name:'测试资产',categoryId:doc.categories[0].id,items:[{id:'item',label:'截图',required:true,fromTemplateId:null,images:[{id:'image',fileName:'qa.png',caption:'测试图片',uploadedAt:'2026-10-13',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}]}]}];
          await api.saveProjectWithImages(doc);
        }
        const project = await api.loadProject('location-qa-system');
        const summaries = await api.listProjects();
        const image = project?.assets[0].items[0].images[0];
        const data = image ? await api.resolveImageData(project.id, image) : null;
        if (data) { const img = new Image(); img.src = data; await img.decode(); }
        const location = await window.evidenceData.getLocation();
        const selection = ${JSON.stringify(process.env.LOCATION_QA_MODE)} === 'choose' ? await window.evidenceData.chooseLocation() : null;
        let visibleSystem = false;
        let renderedImage = false;
        if (project && ${JSON.stringify(process.env.LOCATION_QA_MODE)} !== 'seed') {
          const waitFor = async predicate => {
            const deadline = Date.now() + 10000;
            while (!predicate()) {
              if (Date.now() >= deadline) throw new Error('等待客户端界面超时');
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          };
          await waitFor(() => document.body.innerText.includes('目录重连测试系统'));
          visibleSystem = true;
          const open = Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === '打开');
          if (!open) throw new Error('客户端列表缺少打开入口');
          open.click();
          await waitFor(() => {
            const thumbnail = document.querySelector('img[alt="qa.png"]');
            return thumbnail?.complete && thumbnail.naturalWidth > 0;
          });
          renderedImage = true;
        }
        return { project, summaries, data, location, selection, visibleSystem, renderedImage };
      })()`);
      if (value.renderedImage && process.env.LOCATION_QA_SCREENSHOT) {
        fs.writeFileSync(process.env.LOCATION_QA_SCREENSHOT, (await win.webContents.capturePage()).toPNG());
      }
      finish(value);
    } catch (err) { finish({ error: err.stack }, 1); }
  });
});
setTimeout(() => finish({ error: '客户端回归超时' }, 1), 30000);
require('../electron/main.cjs');

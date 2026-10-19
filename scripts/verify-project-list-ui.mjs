import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
const require = createRequire(import.meta.url);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const presetMode = process.argv.includes('--presets');
const imageMode = process.argv.includes('--images');
const groupMode = process.argv.includes('--system-groups');
const workspaceMode = process.argv.includes('--workspace');
const output = path.resolve(`.trellis/.runtime/${workspaceMode ? 'workspace-qa' : groupMode ? 'system-group-qa' : imageMode ? 'image-state-qa' : presetMode ? 'preset-qa' : 'project-list-qa'}`);
require('node:fs').mkdirSync(output, { recursive: true });
const bundle = (await build({ entryPoints: [workspaceMode ? 'scripts/workspace-browser-cases.mjs' : groupMode ? 'scripts/system-group-browser-cases.mjs' : imageMode ? 'scripts/image-state-browser-cases.mjs' : presetMode ? 'scripts/preset-browser-cases.mjs' : 'scripts/project-list-browser-cases.mjs'], bundle: true, loader: { '.png': 'dataurl' }, write: false, format: 'iife', globalName: 'cases', platform: 'browser' })).outputFiles[0].text + '\nwindow.cases = cases;';
let webLanEnabled = false;
let webLanSnapshot = null;
let webLanRunning = false;
let webUpload = null;
let confirmUpload;
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/control/') && webLanEnabled) {
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = body ? JSON.parse(body) : {};
    const operation = req.url.slice('/api/control/'.length);
    if (operation === 'start') { webLanSnapshot = payload.snapshot; webLanRunning = true; }
    if (operation === 'update') webLanSnapshot = payload.snapshot;
    if (operation === 'stop') webLanRunning = false;
    if (operation === 'confirm') { webUpload = null; confirmUpload?.(payload); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(operation === 'pending' ? { upload: webUpload } : { running: webLanRunning, url: webLanRunning ? `http://127.0.0.1:${server.address().port}/#/lan/qa` : null, addresses: [{ name: '隔离测试', address: '127.0.0.1' }] }));
    return;
  }
  const relative = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve('dist', `.${relative === '/' ? '/index.html' : relative}`);
  if (!file.startsWith(path.resolve('dist') + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function connect(port) {
  for (let n = 0; n < 150; n++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
      const target = targets.find(target => target.type === 'page' && (target.url.startsWith('file:') || target.url.startsWith('http:')));
      if (target) {
        const socket = new WebSocket(target.webSocketDebuggerUrl); const pending = new Map(); let id = 0;
        socket.addEventListener('message', event => { const message = JSON.parse(event.data); const result = pending.get(message.id); if (!result) return; pending.delete(message.id); message.error ? result.reject(new Error(message.error.message)) : result.resolve(message.result); });
        socket.addEventListener('close', () => { for (const result of pending.values()) result.reject(new Error('测试浏览器连接已关闭')); pending.clear(); });
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        const send = (method, params = {}) => new Promise((resolve, reject) => {
          if (socket.readyState !== WebSocket.OPEN) { reject(new Error(`测试浏览器已断连：${method}`)); return; }
          const requestId = ++id;
          const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`浏览器命令超时：${method} ${params.expression?.slice(0, 100) ?? ''}`)); }, 30000);
          pending.set(requestId, {
            resolve: value => { clearTimeout(timeout); resolve(value); },
            reject: error => { clearTimeout(timeout); reject(error); },
          });
          socket.send(JSON.stringify({ id: requestId, method, params }));
        });
        return { send, close: () => socket.close(), evaluate: async expression => {
          const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
          return result.result.value;
        } };
      }
    } catch { /* 浏览器尚未启动。 */ }
    await delay(100);
  }
  throw new Error('无法连接隔离浏览器');
}
const report = [];
try {
  for (const platform of (process.argv.includes('--web-only') ? ['web'] : process.argv.includes('--desktop-only') ? ['desktop'] : ['web', 'desktop'])) {
    const profile = mkdtempSync(path.join(tmpdir(), 'picture-ocr-project-list-'));
    // 仅测试进程使用随机调试端口，正式 Web 服务固定端口不变。
    const reservation = createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve)); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    const env = { ...process.env, PROJECT_LIST_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
    const child = platform === 'web'
      ? spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`], { stdio: 'ignore' })
      : spawn(require('electron'), ['scripts/project-list-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: 'ignore' });
    let client;
    const exited = new Promise(resolve => child.once('exit', resolve));
    const timeout = setTimeout(() => child.kill(), 120000);
    const pass = name => { console.log(`${platform} PASS ${name}`); report.push({ platform, name, ok: true }); };
    try {
      client = await connect(port);
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.enable');
      // 本套件验证前台交互；窗口被遮挡时仅关闭计时节流仍不能保证 requestAnimationFrame 执行。
      await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      for (let n = 0; n < 100; n++) {
        if (await client.evaluate('document.readyState === "complete" && !!document.querySelector("#root")')) break;
        await delay(50);
      }
      await client.evaluate(bundle);
      await client.evaluate('window.cases.until(() => document.querySelector("#project-list-title"), "初始页面")');
      if (workspaceMode) {
        await client.evaluate('window.cases.seed()');
        const size = async (width, height = 900) => { await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await delay(100); };
        const screenshot = async name => { const image = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-${name}.png`), Buffer.from(image.data, 'base64')); };
        const key = async (key, code, virtual, modifiers = 0) => {
          await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) });
          await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, modifiers });
        };
        const openNavigation = async (space = false) => {
          if (await client.evaluate('window.cases.navigationOpen()')) return;
          await client.evaluate('window.cases.prepareNavigation()'); await key(space ? ' ' : 'Enter', space ? 'Space' : 'Enter', space ? 32 : 13);
          await client.evaluate('window.cases.until(() => window.cases.navigationOpen(), "原生按键打开导航")');
        };
        await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
        for (const width of [1440, 375]) {
          await size(width);
          for (const action of ['backdrop', 'cancel', 'escape', 'confirm']) {
            await client.evaluate('window.cases.prepareTemplateConfirm()'); await key('Enter', 'Enter', 13);
            await client.evaluate('window.cases.until(() => document.querySelectorAll("[role=dialog]").length === 2, "嵌套删除确认")');
            if (action === 'backdrop') {
              await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 8, y: 8, button: 'left', clickCount: 1 });
              await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 8, y: 8, button: 'left', clickCount: 1 });
            } else if (action === 'escape') await key('Escape', 'Escape', 27);
            else { if (action === 'confirm') await key('Tab', 'Tab', 9); await key('Enter', 'Enter', 13); }
            pass(`${width}px ${action}: ${await client.evaluate(`window.cases.checkTemplateConfirm(${action === 'confirm'})`)}`);
          }
        }
        await size(375); await openNavigation(); await client.evaluate('window.cases.prepareNested(true)'); await key('Enter', 'Enter', 13);
        for (const width of [375, 320]) { await size(width); pass(await client.evaluate('window.cases.confirmGeometry()')); await screenshot(`confirm-${width}`); }
        await key('Escape', 'Escape', 27); await client.evaluate('window.cases.checkNested(false)');
        await size(375); await client.evaluate('window.cases.prepareRename()');
        for (const width of [375, 320]) { await size(width); pass(await client.evaluate('window.cases.renameGeometry()')); }
        await size(1440); pass(await client.evaluate('window.cases.checkRenameDraft()'));
        await size(375); assert.equal(await client.evaluate('window.cases.navigationOpen()'), true, '缩窄时保留侧栏编辑焦点');
        pass(await client.evaluate('window.cases.checkRenameDraft()')); await key('Escape', 'Escape', 27); await key('Escape', 'Escape', 27);
        await openNavigation(); await client.evaluate('window.cases.prepareNested()'); await key('Enter', 'Enter', 13); await client.evaluate('window.cases.checkNested()');
        await key('Tab', 'Tab', 9); assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '删除资产');
        await size(1440); assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '删除资产', '父组件跨断点重渲染不能重置已选中的确认按钮焦点');
        await key('Tab', 'Tab', 9); assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '取消');
        await client.evaluate('document.querySelector("header button").focus()'); assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '取消', '内层模态阻止焦点跑到背景');
        await size(375); await client.evaluate('window.cases.checkNested()'); await key('Escape', 'Escape', 27); await client.evaluate('window.cases.checkNested(false)'); await key('Escape', 'Escape', 27);
        pass('删除确认跨断点保留独立焦点闭环，背景不可聚焦');
        for (const width of [375, 320, 768, 1024, 1440]) { await size(width); pass(await client.evaluate('window.cases.geometry()')); await screenshot(String(width)); }
        pass(await client.evaluate('window.cases.selectLongAsset()'));
        for (const width of [375, 768, 1440]) { await size(width); pass(await client.evaluate('window.cases.geometry()')); await screenshot(`long-${width}`); }
        await size(375); await openNavigation();
        assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-label")'), '关闭分类导航');
        assert.equal(await client.evaluate('!!document.querySelector("[data-workspace] main").closest("[inert]")'), true);
        pass(await client.evaluate('window.cases.navigationMetrics()')); await screenshot('navigation-375');
        await key('Tab', 'Tab', 9, 8); assert.equal(await client.evaluate('document.activeElement.title'), '添加资产');
        assert.equal(await client.evaluate('!!document.activeElement.closest(".border-b").querySelector("button[title=其他]")'), true, '反向 Tab 到最后分类的添加入口');
        await key('Tab', 'Tab', 9); assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-label")'), '关闭分类导航');
        await client.evaluate('window.cases.focusAsset()'); await key('Enter', 'Enter', 13);
        pass(await client.evaluate('window.cases.checkImage()')); await client.evaluate('document.querySelector("main").scrollTop = 300'); await screenshot('selected-375');
        assert.equal(await client.evaluate('document.activeElement.tagName'), 'MAIN');
        await openNavigation(true); await client.evaluate('window.cases.prepareNested()'); await key('Enter', 'Enter', 13);
        await client.evaluate('window.cases.checkNested()'); await key('Tab', 'Tab', 9); await key('Tab', 'Tab', 9);
        assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '取消');
        await key('Escape', 'Escape', 27); pass(await client.evaluate('window.cases.checkNested(false)'));
        await key('Escape', 'Escape', 27);
        assert.equal(await client.evaluate('window.cases.navigationOpen()'), false);
        assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '分类导航');
        await openNavigation();
        await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 367, y: 450, button: 'left', clickCount: 1 });
        await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 367, y: 450, button: 'left', clickCount: 1 });
        assert.equal(await client.evaluate('window.cases.navigationOpen()'), false);
        pass('真实 Enter/Space、双向 Tab、Escape 与遮罩关闭，焦点恢复和背景 inert');
        await openNavigation(); await client.evaluate('window.cases.prepareDraft()');
        await size(1440); pass(await client.evaluate('window.cases.checkDraft()'));
        const before = await client.evaluate('document.querySelector("aside").getBoundingClientRect().width');
        await client.evaluate('document.querySelector("[aria-label=拖动调整侧栏宽度]").focus()'); await key('ArrowRight', 'ArrowRight', 39);
        assert.equal(await client.evaluate('document.querySelector("aside").getBoundingClientRect().width'), before + 16);
        const handle = await client.evaluate('(() => { const rect = document.querySelector("[aria-label=拖动调整侧栏宽度]").getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: 450 }; })()');
        await client.evaluate('window.workspacePointerDown = null; document.addEventListener("pointerdown", event => { window.workspacePointerDown = { target: event.target.outerHTML, x: event.clientX, y: event.clientY }; }, { once: true })');
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...handle });
        await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...handle, button: 'left', buttons: 1, clickCount: 1 });
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: handle.x + 64, y: handle.y, button: 'left', buttons: 1 });
        await client.evaluate(`window.cases.until(() => document.querySelector('aside').getBoundingClientRect().width === ${before + 80}, '拖动宽度实际更新')`);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: handle.x + 64, y: handle.y, button: 'left', buttons: 0, clickCount: 1 });
        assert.equal(await client.evaluate('document.querySelector("aside").getBoundingClientRect().width'), before + 80, JSON.stringify(await client.evaluate('window.workspacePointerDown')));
        await client.evaluate('window.cases.rememberWidth()');
        await size(375); await openNavigation(); pass(await client.evaluate('window.cases.checkDraft()'));
        await client.evaluate('document.querySelector("aside input[placeholder]").focus()'); await key('Enter', 'Enter', 13);
        pass(await client.evaluate('window.cases.createFromDraft()'));
        if (await client.evaluate('window.cases.navigationOpen()')) await key('Escape', 'Escape', 27);
        await size(1440); pass(await client.evaluate('window.cases.checkDesktop()')); await size(375);
        await openNavigation(); await client.evaluate('window.cases.focusAsset()'); await key('Enter', 'Enter', 13); await client.evaluate('window.cases.checkImage()');
        pass(await client.evaluate('window.cases.toolbarDialogs()'));
        const downloads = path.join(profile, 'workspace-downloads'); require('node:fs').mkdirSync(downloads);
        await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
        await client.evaluate('window.cases.button("报告", document.querySelector("header")).click(); window.cases.until(() => window.cases.button("继续导出"), "新增资产保留必填检查提醒")');
        await client.evaluate('window.cases.button("继续导出").click()');
        let docx;
        for (let n = 0; n < 100; n++) { docx = readdirSync(downloads).find(name => name.endsWith('.docx')); if (docx) break; await delay(100); }
        assert.ok(docx, '工作台报告入口触发真实 DOCX 下载');
        const reportZip = await JSZip.loadAsync(readFileSync(path.join(downloads, docx)));
        assert.ok(reportZip.file('word/document.xml')); assert.ok(Object.values(reportZip.files).some(file => file.name.startsWith('word/media/') && !file.dir));
        pass('报告按钮生成真实 DOCX，正文与图片条目可读取');
        pass(await client.evaluate('window.cases.createItem()'));
        pass(await client.evaluate('window.cases.checkData()'));
        await size(375, 640); pass(await client.evaluate('window.cases.geometry()')); await screenshot('short-375');
        pass(await client.evaluate('window.cases.emptyWorkspace()')); await screenshot('empty-375');
        continue;
      }
      if (groupMode) {
        await client.evaluate('window.cases.seed()');
        for (const name of ['integrationFlow', 'typesUi', 'storage', 'failures', 'conversionUi', 'refreshFailureUi', 'assetExamples']) pass(await client.evaluate(`window.cases.${name}()`));
        await client.evaluate('window.cases.prepareLayout()');
        for (const width of [375, 768, 1440]) {
          await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          pass(`${width}px ${await client.evaluate('window.cases.layout()')}`);
          const image = await client.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path.join(output, `${platform}-creation-${width}.png`), Buffer.from(image.data, 'base64'));
        }
        await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
        await client.evaluate('window.cases.focusType()');
        await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        assert.equal(await client.evaluate('window.cases.selectedType()'), 'group');
        await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
        assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '保存', '选中系统组时反向 Tab 闭环到保存');
        await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        assert.equal(await client.evaluate('document.activeElement.value'), 'group', '保存 Tab 回到当前选中类型');
        pass('真实方向键切换原生类型单选，选中组后的双向 Tab 焦点闭环');
        await client.evaluate('window.cases.prepareAssetLayout()');
        for (const width of [375, 768, 1440]) {
          await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          pass(`${width}px ${await client.evaluate('window.cases.assetLayout()')}`);
          const image = await client.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path.join(output, `${platform}-asset-${width}.png`), Buffer.from(image.data, 'base64'));
        }
        await client.evaluate('document.querySelector("aside input[placeholder]").focus()');
        await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        pass(await client.evaluate('window.cases.finishAssetLayout()'));
        await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle });
        await client.send('Page.reload', { ignoreCache: true }); await delay(400);
        pass(await client.evaluate('window.cases.afterReload()'));
        continue;
      }
      if (imageMode) {
        await client.evaluate('window.cases.seed()');
        await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle + '\nwindow.cases.instrument();' });
        await client.send('Page.reload', { ignoreCache: true });
        await delay(400);
        for (const name of ['desktop', 'mobile']) {
          pass(await client.evaluate(`window.cases.${name}()`));
          const image = await client.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path.join(output, `${platform}-${name}.png`), Buffer.from(image.data, 'base64'));
        }
        continue;
      }
      if (presetMode) {
        for (const name of ['onboardingStorage', 'onboardingCandidateBoundaries', 'storage', 'exports', 'ui', 'failures']) pass(await client.evaluate(`window.cases.${name}()`));
        for (const width of [375, 768, 1440]) {
          await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          pass(`${width}px ${await client.evaluate('window.cases.layout()')}`);
          const image = await client.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path.join(output, `${platform}-${width}.png`), Buffer.from(image.data, 'base64'));
        }
        await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle + '\nwindow.onboardingReads = window.cases.instrumentOnboarding();' });
        const reloadOnboarding = async () => {
          const token = `${Date.now()}-${Math.random()}`;
          await client.evaluate(`window.presetReloadToken = ${JSON.stringify(token)}`);
          await client.send('Page.reload', { ignoreCache: true });
          let ready = false;
          for (let attempt = 0; attempt < 150; attempt++) {
            ready = await client.evaluate(`window.presetReloadToken !== ${JSON.stringify(token)} && document.readyState === 'complete' && !!window.cases && !!document.querySelector('#project-list-title') && !!document.querySelector('[aria-busy="false"]')`).catch(() => false);
            if (ready) break;
            await delay(50);
          }
          assert(ready, '等待新文档摘要首屏，而不是上一页面的残留 DOM');
          assert.equal(await client.evaluate('window.onboardingReads.firstListDocuments'), 0);
          assert.equal(await client.evaluate('window.onboardingReads.images'), 0);
        };
        await client.evaluate('window.cases.seedOnboarding()');
        await reloadOnboarding();
        pass('旧库首屏无完整项目和图片读取');
        pass(await client.evaluate('window.cases.onboardingDeferredModal()'));
        await client.evaluate('window.cases.seedOnboarding()');
        await reloadOnboarding();
        pass(await client.evaluate('window.cases.onboardingAutomatic()'));
        for (const name of ['onboardingBackgroundFailure', 'onboardingSharedScan', 'onboardingConcurrentUi', 'onboardingRecentUi']) {
          await client.evaluate(`window.cases.seedOnboarding('${name === 'onboardingRecentUi' ? 'different' : 'legacy'}')`);
          await client.evaluate(`sessionStorage.${name === 'onboardingSharedScan' ? "setItem('preset-shared-scan', '1')" : "removeItem('preset-shared-scan')"}`);
          await reloadOnboarding();
          pass(await client.evaluate(`window.cases.${name}()`));
        }
        await client.evaluate('window.cases.seedOnboarding()');
        await reloadOnboarding();
        pass(await client.evaluate('window.cases.onboardingLifecycle()'));
        await reloadOnboarding();
        await client.evaluate('window.cases.openOnboarding()');
        for (const width of [375, 768, 1440]) {
          await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          pass(`${width}px ${await client.evaluate('window.cases.onboardingLayout()')}`);
          const image = await client.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path.join(output, `${platform}-onboarding-${width}.png`), Buffer.from(image.data, 'base64'));
        }
        await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
        const key = async (key, code, virtual, modifiers = 0) => {
          await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) });
          await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, modifiers });
        };
        assert.equal(await client.evaluate('document.activeElement.textContent'), '继续使用通用模板');
        await key('Tab', 'Tab', 9, 8);
        assert.equal(await client.evaluate('document.activeElement.textContent'), '沿用最近等保模板');
        await key('Tab', 'Tab', 9);
        assert.equal(await client.evaluate('document.activeElement.textContent'), '继续使用通用模板');
        await key('Escape', 'Escape', 27);
        assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '新建项目');
        await client.evaluate('window.cases.openOnboarding()');
        pass(await client.evaluate('window.cases.onboardingUi()'));
        await reloadOnboarding();
        await client.evaluate('document.querySelector("#project-list-title"); [...document.querySelectorAll("button")].find(el => el.textContent.trim()==="新建项目").click(); window.cases.onboardingForm("legacy")');
        pass('沿用后真实重载不再提示');
        await client.evaluate('window.cases.seedOnboarding()');
        await reloadOnboarding();
        await client.evaluate('window.cases.openOnboarding()');
        await key('Enter', 'Enter', 13);
        await client.evaluate('window.cases.onboardingGeneric()');
        await reloadOnboarding();
        await client.evaluate('[...document.querySelectorAll("button")].find(el => el.textContent.trim()==="新建项目").click(); window.cases.onboardingForm()');
        pass('键盘焦点闭环、取消不记录、通用选择创建及真实重载持久化');
        for (const kind of ['new', 'mixed', 'default']) {
          await client.evaluate(`window.cases.seedOnboarding('${kind}')`);
          await reloadOnboarding();
          await client.evaluate('[...document.querySelectorAll("button")].find(el => el.textContent.trim()==="新建项目").click(); window.cases.onboardingForm()');
          pass(`${kind} 真实新建入口不误提示`);
        }
        continue;
      }
      await client.evaluate('window.cases.seed()');
      // 新文档执行前安装读计数，验证生产首屏仅加载摘要。
      await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bundle + '\nwindow.listReads = window.cases.instrument();' });
      await client.send('Page.reload', { ignoreCache: true });
      await delay(400);
      await client.evaluate('window.cases.until(() => document.querySelectorAll("[data-group-id]").length === 4, "夹具加载")');
      assert.deepEqual(await client.evaluate('window.listReads'), { documents: 0, images: 0 });
      pass('生产首屏只读摘要，无项目文档/图片读取');
      if (platform === 'web') { assert.equal(await client.evaluate('!!window.cases.button("手机采集")'), false); pass('无桥网页不显示手机采集'); }
      for (const name of ['core', 'mutations', 'exportAndImport', 'batchExport', 'batchBoundaries', 'failedLoad', 'savedButRefreshFailed']) pass(await client.evaluate(`window.cases.${name}()`));
      for (const width of [375, 768, 1440]) {
        await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        pass(`${width}px ${await client.evaluate('window.cases.layout()')}`);
        const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(output, `${platform}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
        pass(`${width}px ${await client.evaluate('window.cases.groupLayout()')}`);
        const groupScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(output, `${platform}-groups-${width}.png`), Buffer.from(groupScreenshot.data, 'base64'));
      }
      await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await client.evaluate('window.cases.tab("independent")');
      await client.evaluate('document.querySelector("[data-system-id] summary").focus()');
      const key = async (key, code, virtual) => { await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, ...(key === 'Enter' ? { text: '\r' } : {}) }); await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual }); };
      await key('Enter', 'Enter', 13); await delay(100);
      assert.equal(await client.evaluate('!!document.querySelector("details[open]")'), true);
      await key('Tab', 'Tab', 9); assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '编辑');
      await key('Escape', 'Escape', 27); await delay(60);
      assert.equal(await client.evaluate('document.activeElement.tagName'), 'SUMMARY');
      assert.equal(await client.evaluate('!!document.querySelector("details[open]")'), false);
      pass('真实 Enter/Tab/Escape 按键与焦点恢复');
      const downloadPath = path.join(profile, 'downloads'); require('node:fs').mkdirSync(downloadPath);
      await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath });
      await client.evaluate('window.cases.prepareBatchKeyboard()');
      await key(' ', 'Space', 32); await delay(80);
      assert.equal(await client.evaluate('document.querySelector("input[type=checkbox]").checked'), true);
      await client.evaluate('window.cases.button("导出选中 1").focus()');
      assert.equal(await client.evaluate('document.activeElement === window.cases.button("导出选中 1") && !document.activeElement.matches(":disabled")'), true);
      await key('Enter', 'Enter', 13);
      let downloadedFile;
      for (let n = 0; n < 100; n++) {
        downloadedFile = readdirSync(downloadPath).find(name => name.endsWith('.zip'));
        if (downloadedFile) break;
        await delay(50);
      }
      if (!downloadedFile) console.error(await client.evaluate('({focused: document.activeElement?.outerHTML, status: document.querySelector("[data-batch-status]")?.textContent, alerts: [...document.querySelectorAll("[role=alert], [role=status]")].map(el => el.textContent)})'));
      assert.ok(downloadedFile, '键盘批量导出实际下载文件');
      const downloadedBytes = readFileSync(path.join(downloadPath, downloadedFile));
      const downloadedZip = await JSZip.loadAsync(downloadedBytes);
      const children = Object.values(downloadedZip.files).filter(file => !file.dir);
      assert.equal(children.length, 1);
      assert.ok((await JSZip.loadAsync(await children[0].async('nodebuffer'))).file('manifest.json'));
      writeFileSync(path.join(output, `${platform}-batch-download.zip`), downloadedBytes);
      pass('真实 Space 全选/Enter 批量导出，磁盘总 ZIP 及子包可打开');
      await client.evaluate('window.cases.tab("groups")');
      await client.evaluate('document.getElementById("group-toggle-multi").focus()');
      assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-expanded")'), 'true');
      await key('Enter', 'Enter', 13); await delay(80);
      assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-expanded")'), 'false');
      assert.equal(await client.evaluate('!!window.cases.systemRow("g1")'), false);
      await key(' ', 'Space', 32); await delay(80);
      assert.equal(await client.evaluate('document.activeElement.getAttribute("aria-expanded")'), 'true');
      assert.equal(await client.evaluate('!!window.cases.systemRow("g1")'), true);
      await client.evaluate('window.cases.systemRow("g1").querySelector("button").focus(); document.getElementById("group-toggle-multi").click()');
      assert.equal(await client.evaluate('document.activeElement.id'), 'group-toggle-multi');
      pass('项目 Enter/Space 原地展开收起，隐藏组内焦点返回项目按钮');
      if (platform === 'web') {
        webLanEnabled = true;
        await client.send('Page.reload', { ignoreCache: true }); await delay(400);
      }
      for (const scope of ['group', 'system']) {
        const url = await client.evaluate(`window.cases.startLan('${scope}')`);
        let snapshot;
        if (platform === 'web') snapshot = webLanSnapshot;
        else {
          const base = new URL(url); const token = base.hash.split('/').pop();
          snapshot = await fetch(`${base.origin}/api/session?token=${token}`).then(r => r.json());
        }
        assert.deepEqual(snapshot.systems.map(system => system.projectId).sort(), scope === 'group' ? ['g1', 'g2'] : ['g1']);
        assert.equal(snapshot.groupId, 'multi');
        if (scope === 'group') {
          if (platform === 'web') {
            const confirmed = new Promise(resolve => { confirmUpload = resolve; });
            webUpload = { requestId: 'qa-upload', projectId: 'g2', assetId: 'asset', itemId: 'item', image: { fileName: 'qa.png', mimeType: 'image/png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' } };
            assert.equal((await confirmed).success, true);
          } else {
            const base = new URL(url); const token = base.hash.split('/').pop();
            const response = await fetch(`${base.origin}/api/upload?token=${token}&projectId=g2&assetId=asset&itemId=item`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-file-name': 'qa.png' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
            assert.equal(response.status, 201, await response.text());
          }
          await client.evaluate('window.cases.verifyLanImage()');
        }
        await client.evaluate('window.cases.stopLan()');
        pass(`${scope} 采集范围${scope === 'group' ? '、上传写入正确系统与计数更新' : '仅包含所选系统'}`);
      }
      for (const kind of ['independent', 'groups']) {
        await client.evaluate(`window.cases.prepareDefault('${kind}')`);
        await client.send('Page.reload', { ignoreCache: true }); await delay(400);
        await client.evaluate('window.cases.until(() => document.querySelector("[aria-busy=\\"false\\"]"), "默认页签加载")');
        assert.equal(await client.evaluate('document.querySelector("#project-list-title").textContent'), kind === 'independent' ? '独立系统' : '多系统项目');
        pass(kind === 'independent' ? '仅有独立系统时默认独立页签' : '空库默认项目页签及空态');
      }
    } catch (error) {
      report.push({ platform, ok: false, name: error.stack });
      if (client) {
        console.error(await client.evaluate('({step: window.projectListTestStep, reads: window.onboardingReads, text: document.body.innerText.slice(-1800)})').catch(() => '无法读取失败页面'));
        const image = await client.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
        if (image) writeFileSync(path.join(output, `${platform}-failure.png`), Buffer.from(image.data, 'base64'));
      }
      throw error;
    } finally {
      clearTimeout(timeout); client?.close(); child.kill(); await exited;
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  }
} finally {
  server.closeAllConnections(); server.close();
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
}

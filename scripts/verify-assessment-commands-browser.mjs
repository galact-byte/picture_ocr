import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { connectBrowser } from './browser-test-client.mjs';
const require = createRequire(import.meta.url);
const output = path.resolve('.trellis/.runtime/assessment-command-qa'); mkdirSync(output, { recursive: true });
const bundle = (await build({ entryPoints: ['scripts/assessment-command-browser-cases.mjs'], bundle: true, write: false, format: 'iife', globalName: 'cases', platform: 'browser' })).outputFiles[0].text + '\nwindow.commandCases = cases;';
const server = createServer((req, res) => {
  const relative = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve('dist', `.${relative === '/' ? '/index.html' : relative}`);
  if (!file.startsWith(path.resolve('dist') + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const localUrl = `http://127.0.0.1:${server.address().port}/`;
const lanAddress = Object.values(networkInterfaces()).flat().find(info => info?.family === 'IPv4' && !info.internal)?.address;
if (!lanAddress) throw new Error('缺少可验证局域网 HTTP 的 IPv4 地址');
const report = [];
const layoutOnly = process.argv.includes('--layout-only');
const concurrencyOnly = process.argv.includes('--concurrency-only');
const platforms = layoutOnly ? ['web'] : process.argv.includes('--lan-only') ? ['lan'] : process.argv.includes('--web-only') ? ['web', 'lan'] : process.argv.includes('--desktop-only') ? ['desktop'] : ['web', 'desktop', 'lan'];
try {
  for (const platform of platforms) {
    const profile = mkdtempSync(path.join(tmpdir(), 'picture-ocr-command-qa-'));
    const reservation = createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve)); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    const url = platform === 'lan' ? `http://${lanAddress}:${server.address().port}/` : localUrl;
    const env = { ...process.env, PROJECT_LIST_TEST_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
    const child = platform === 'desktop'
      ? spawn(require('electron'), ['scripts/assessment-command-electron.cjs', `--remote-debugging-port=${port}`], { env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
      : spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', '--no-proxy-server', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, url], { stdio: 'ignore' });
    const exited = new Promise(resolve => child.once('exit', resolve));
    const timer = setTimeout(() => child.kill(), 240000); let client;
    const pass = name => { console.log(`${platform} PASS ${name}`); report.push({ platform, name, ok: true }); };
    try {
      client = await connectBrowser(port);
      await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.enable'); await client.send('Runtime.enable');
      await client.send('Page.bringToFront');
      await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      for (let n = 0; n < 100; n++) {
        try { if (await client.evaluate('document.readyState === "complete" && !!document.querySelector("#project-list-title")')) break; } catch { /* 初次导航会替换执行上下文。 */ }
        await delay(50);
      }
      await client.evaluate(bundle);
      const initial = await client.evaluate('window.commandCases.seed()'); await client.evaluate('window.commandCases.open()');
      if (layoutOnly) {
        await client.evaluate('window.commandCases.prepareAlignment()');
        for (const width of [375, 768, 1280]) {
          await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          pass(`${width}px ${await client.evaluate('window.commandCases.inlineLayout()')}`);
          await client.evaluate('document.querySelector("[aria-controls=item-commands-item-0]")?.scrollIntoView({ block: "center" })');
          const image = await client.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(path.join(output, `alignment-${width}.png`), Buffer.from(image.data, 'base64'));
        }
        continue;
      }
      if (platform === 'lan') {
        assert.equal(await client.evaluate('isSecureContext'), false);
        assert.equal(await client.evaluate('!!navigator.clipboard'), false);
        pass('实际非安全局域网 HTTP，Clipboard API 不存在');
      } else if (platform === 'web') {
        await client.send('Browser.grantPermissions', { origin: new URL(url).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
      }
      const realClick = async (selector, all = false) => {
        const point = await client.evaluate(`window.commandCases.copyCoordinates(${JSON.stringify(selector)}, ${all})`);
        await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
        await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
      };
      const desktopRequest = (type, args = {}) => new Promise((resolve, reject) => {
        const id = `${type}-${Date.now()}`;
        const requestTimer = setTimeout(() => { child.off('message', receive); reject(new Error('隔离主进程请求超时')); }, 10000);
        const receive = message => {
          if (message?.type !== 'assessment-result' || message.id !== id) return;
          clearTimeout(requestTimer); child.off('message', receive);
          if (message.error) reject(new Error(message.error)); else resolve(message);
        };
        child.on('message', receive); child.send({ type, id, ...args });
      });
      const readClipboard = async () => {
        if (platform === 'desktop') return (await desktopRequest('assessment-read-clipboard')).text;
        if (platform === 'web') return client.evaluate('navigator.clipboard.readText()');
        // 同一 Chrome 进程的安全读取页只用于读回真实剪贴板；被测页仍保持非安全 HTTP。
        const target = await client.send('Target.createTarget', { url: localUrl });
        const reader = await connectBrowser(port, item => item.id === target.targetId);
        try {
          await reader.send('Browser.grantPermissions', { origin: new URL(localUrl).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
          await reader.send('Page.bringToFront');
          await reader.send('Emulation.setFocusEmulationEnabled', { enabled: true });
          assert.equal(await reader.evaluate('document.hasFocus()'), true);
          return await reader.evaluate('navigator.clipboard.readText()');
        } finally { reader.close(); await client.send('Target.closeTarget', { targetId: target.targetId }); await client.send('Page.bringToFront'); }
      };
      if (!concurrencyOnly) {
        for (const [id, groupId, all] of [['linux-rhel', 'linux-rhel-identity', true], ['huawei', 'huawei-remote', true], ['h3c', 'h3c-version', false], ['windows', 'windows-identity', true], ['mysql', 'mysql-identity', true], ['oracle', 'oracle-identity', false]]) {
          const copy = await client.evaluate(`window.commandCases.prepareCopy(${JSON.stringify(id)}, ${JSON.stringify(groupId)}, ${all})`);
          await realClick(copy.selector, all); await client.evaluate('window.commandCases.copied()');
          const copiedText = (await readClipboard()).replace(/\r\n/g, '\n');
          if (copiedText !== copy.expected && platform === 'desktop') {
            console.log('桌面剪贴板诊断', await client.evaluate(`navigator.clipboard.readText().then(text => ({ matches: text.replace(/\\r\\n/g, '\\n') === ${JSON.stringify(copy.expected)}, length: text.length, focused: document.hasFocus(), visibility: document.visibilityState })).catch(error => ({ error: error.message, focused: document.hasFocus() }))`));
          }
          assert.ok(copiedText === copy.expected, `系统剪贴板文本与 ${id} 的所选命令不匹配`); pass(`${id} ${all ? '分组' : '单段'}真实点击复制并读回（归一化 Windows 换行）`);
        }
        pass(await client.evaluate('window.commandCases.searchAndLifecycle()'));
        pass(await client.evaluate('window.commandCases.crud()'));
        await client.send('Page.reload', { ignoreCache: true }); await delay(500); await client.evaluate(bundle);
        await client.evaluate('window.commandCases.until(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "测评命令"), "刷新后的资产")');
        pass(await client.evaluate('window.commandCases.persistedAndDelete()'));
        await client.send('Page.reload', { ignoreCache: true }); await delay(500); await client.evaluate(bundle); await client.evaluate('window.commandCases.until(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "测评命令"), "删除后刷新")');
        await client.evaluate('window.commandCases.open();'); await client.evaluate('window.commandCases.profile("linux-rhel")');
        assert.equal(await client.evaluate('document.querySelector("[data-command-id=linux-rhel-identity-1]") === null'), true); pass('内置删除标记在刷新后保留');
        pass(await client.evaluate('window.commandCases.failures()'));
        await client.evaluate('window.commandCases.breakClipboard()');
        const failedCopy = await client.evaluate('window.commandCases.prepareCopy("windows")'); await realClick(failedCopy.selector);
        pass(await client.evaluate('window.commandCases.manualFailure()'));
        pass(await client.evaluate('window.commandCases.delayedRace()'));
        const key = async (key, code, virtual, modifiers = 0) => {
          await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) });
          await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual, modifiers });
        };
        await client.evaluate('document.querySelector("[aria-labelledby=assessment-command-title] select").focus()');
        await key('Tab', 'Tab', 9, 8);
        assert.equal(await client.evaluate('document.querySelector("[aria-labelledby=assessment-command-title]").contains(document.activeElement)'), true);
        await key('Escape', 'Escape', 27); await delay(60);
        assert.equal(await client.evaluate('document.activeElement.textContent.trim()'), '测评命令');
        await key('Enter', 'Enter', 13); await delay(100);
        assert.equal(await client.evaluate('!!document.querySelector("[aria-labelledby=assessment-command-title]")'), true); pass('真实 Tab/Escape/Enter、焦点约束及触发按钮焦点恢复');
        await client.evaluate('window.commandCases.profile("oracle")');
        for (const width of [375, 768, 1280]) {
          await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          pass(`${width}px ${await client.evaluate('window.commandCases.layout()')}`);
          const image = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-${width}.png`), Buffer.from(image.data, 'base64'));
          pass(`${width}px 平台配置展开 ${await client.evaluate('window.commandCases.configurationLayout()')}`);
          const configuration = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-config-${width}.png`), Buffer.from(configuration.data, 'base64'));
          await client.evaluate('window.commandCases.configurationLayout(false)');
        }
        pass(await client.evaluate('window.commandCases.itemLinks()'));
      }
      const otherUrl = (await client.evaluate('location.href')).split('#')[0];
      const otherTarget = platform === 'desktop'
        ? await desktopRequest('assessment-create-page', { url: otherUrl })
        : await client.send('Target.createTarget', { url: otherUrl });
      const other = await connectBrowser(port, item => platform === 'desktop' ? item.url === otherUrl : item.id === otherTarget.targetId);
      let savedCommandStorage;
      try {
        await other.send('Page.enable'); await other.send('Runtime.enable');
        for (let n = 0; n < 100; n++) {
          if (await other.evaluate('document.readyState === "complete"')) break;
          await delay(50);
        }
        await other.evaluate(bundle);
        if (!concurrencyOnly) {
          await other.evaluate('window.commandCases.externalEdit()');
          await client.evaluate('window.commandCases.until(() => document.querySelector("main").textContent.includes("另一窗口同步命令"), "真实其他页面库修改同步")');
          pass('真实其他页面编辑，经原生 storage 事件同步到检查项');
        }
        savedCommandStorage = await client.evaluate('window.commandCases.crossWindowSnapshot()');
        await client.evaluate('window.commandCases.holdCommandWrites()');
        await client.evaluate('window.concurrentResult = window.commandCases.concurrentWrite("a").then(() => "saved", error => error.message); "queued"');
        await other.evaluate('window.concurrentResult = window.commandCases.concurrentWrite("b").then(() => "saved", error => error.message); "queued"');
        await delay(50);
        assert.deepEqual(await client.evaluate('window.commandCases.crossWindowSnapshot()'), savedCommandStorage, '等待锁时不得写入命令或关联');
        await client.evaluate('window.releaseCommandWrites()');
        assert.deepEqual(await Promise.all([client.evaluate('window.concurrentResult'), other.evaluate('window.concurrentResult')]), ['saved', 'saved']);
        const expected = await client.evaluate('window.commandCases.verifyConcurrentWrites()');
        await other.evaluate('window.commandCases.verifyConcurrentWrites()');
        assert.deepEqual(await client.evaluate('window.commandCases.crossWindowSnapshot()'), await other.evaluate('window.commandCases.crossWindowSnapshot()'), '两个窗口的三个存储键内容一致');
        pass(await client.evaluate('window.commandCases.verifyDelayedBindingObservation()'));
        pass(await client.evaluate('window.commandCases.verifyDelayedBindingObservation(true)'));
        const edits = await Promise.all([
          client.evaluate(`window.commandCases.concurrentEdit(${JSON.stringify(expected)}, "页面 A 修改")`),
          other.evaluate(`window.commandCases.concurrentEdit(${JSON.stringify(expected)}, "页面 B 修改")`),
        ]);
        assert.equal(edits.filter(value => value === 'saved').length, 1);
        assert.equal(edits.filter(value => value.includes('已被修改或删除')).length, 1);
        const title = edits[0] === 'saved' ? '页面 A 修改' : '页面 B 修改';
        for (const page of [client, other]) {
          await page.evaluate(`window.commandCases.until(() => window.commandCases.crossWindowSnapshot()[0][1]?.includes(${JSON.stringify(title)}), "并发修改结果同步")`);
          await page.send('Page.reload', { ignoreCache: true });
          await delay(500); await page.evaluate(bundle);
          await page.evaluate('window.commandCases.verifyConcurrentWrites()');
        }
        assert.deepEqual(await client.evaluate('window.commandCases.crossWindowSnapshot()'), await other.evaluate('window.commandCases.crossWindowSnapshot()'), '刷新后两页的命令、关联与默认配置一致');
        assert.ok((await client.evaluate('window.commandCases.crossWindowSnapshot()'))[0][1].includes(title), '获胜的并发编辑刷新后仍保留');
        pass('两个真实页面等待同一锁；三个键双方内容一致且刷新保留，同段并发修改拒绝旧快照');
      } catch (error) {
        const diagnostic = { error: String(error.stack || error), capturedAt: new Date().toISOString(), snapshots: [] };
        try {
          for (let sample = 0; sample < 6; sample++) {
            diagnostic.snapshots.push({ sample, pages: await Promise.all([client, other].map(page => page.evaluate('window.commandCases.crossWindowSnapshot()'))) });
            if (sample < 5) await delay(1000);
          }
        } catch (captureError) { diagnostic.captureError = String(captureError); }
        writeFileSync(path.join(output, `${platform}-concurrency-failure.json`), JSON.stringify(diagnostic, null, 2));
        throw error;
      } finally {
        await client.evaluate('window.releaseCommandWrites?.()');
        if (savedCommandStorage) await other.evaluate(`for (const [key, value] of ${JSON.stringify(savedCommandStorage)}) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }`);
        other.close();
        if (platform === 'desktop') await desktopRequest('assessment-close-page', { windowId: otherTarget.windowId });
        else await client.send('Target.closeTarget', { targetId: otherTarget.targetId });
        await client.send('Page.bringToFront');
      }
      await client.send('Page.reload', { ignoreCache: true }); await delay(500); await client.evaluate(bundle);
      if (concurrencyOnly) {
        assert.equal(await client.evaluate('window.commandCases.snapshot()'), initial);
        pass('并发操作前后项目证据保持一致');
        continue;
      }
      pass(await client.evaluate('window.commandCases.persistedItemLinks()'));
      pass(await client.evaluate('window.commandCases.itemBindingFailures()'));
      const inlineCopy = await client.evaluate('window.commandCases.prepareInlineCopy()'); await realClick(inlineCopy.selector);
      await client.evaluate('window.commandCases.inlineCopied()');
      assert.ok((await readClipboard()).replace(/\r\n/g, '\n') === inlineCopy.expected, '检查项剪贴板文本与最新命令不匹配'); pass('检查项旁真实点击复制并读回最新命令');
      await client.evaluate('window.commandCases.breakClipboard()'); await realClick(inlineCopy.selector); pass(await client.evaluate('window.commandCases.inlineManual()'));
      for (const width of [375, 768, 1280]) {
        await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        pass(`${width}px ${await client.evaluate('window.commandCases.inlineLayout()')}`);
        const image = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-inline-${width}.png`), Buffer.from(image.data, 'base64'));
      }
      await client.evaluate('window.commandCases.previewInline()');
      const previewImage = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-inline-preview.png`), Buffer.from(previewImage.data, 'base64'));
      pass(await client.evaluate('window.commandCases.defaultInheritance()'));
      await client.send('Page.reload', { ignoreCache: true }); await delay(500); await client.evaluate(bundle);
      pass(await client.evaluate('window.commandCases.defaultsAfterReload()'));
      pass(await client.evaluate('window.commandCases.newAssetInheritance()'));
      for (const scenario of [
        ['cat-1', '网络设备', 'huawei', 'h3c'], ['cat-1', '网络设备', 'h3c'],
        ['cat-2', '安全设备', 'huawei-usg'],
        ...['mysql', 'oracle', 'dameng', 'kingbase', 'highgo-46', 'highgo-9'].map(id => ['cat-3', '数据库', id, id === 'mysql' ? 'oracle' : undefined]),
      ]) pass(await client.evaluate(`window.commandCases.otherFamilyInheritance(...${JSON.stringify(scenario)})`));
      const syncTarget = platform === 'desktop' ? await desktopRequest('assessment-create-page', { url: otherUrl }) : await client.send('Target.createTarget', { url: otherUrl });
      const syncPage = await connectBrowser(port, item => platform === 'desktop' ? item.url === otherUrl : item.id === syncTarget.targetId);
      try {
        await syncPage.send('Runtime.enable');
        for (let n = 0; n < 100; n++) { if (await syncPage.evaluate('document.readyState === "complete"')) break; await delay(50); }
        await syncPage.evaluate(bundle); await syncPage.evaluate('window.commandCases.externalDefault()');
        await client.evaluate('window.commandCases.observeExternalDefault()'); pass('另一真实页面默认平台修改，经原生 storage 同步行内命令');
      } finally {
        syncPage.close();
        if (platform === 'desktop') await desktopRequest('assessment-close-page', { windowId: syncTarget.windowId });
        else await client.send('Target.closeTarget', { targetId: syncTarget.targetId });
        await client.send('Page.bringToFront');
      }
      for (const width of [375, 768, 1280]) {
        await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        const shot = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-defaults-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
      await client.evaluate('window.commandCases.open()');
      await client.send('Network.enable'); await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
      await client.evaluate('window.commandCases.close()'); await client.evaluate('window.commandCases.open()');
      assert.equal(await client.evaluate('document.querySelectorAll("[data-command-id]").length > 0'), true); pass('断网后打开并查看命令');
      assert.equal(await client.evaluate('window.commandCases.snapshot()'), initial); pass('命令操作前后项目分类、检查项、图片数据保持一致');
    } catch (error) {
      report.push({ platform, name: String(error.stack || error), ok: false });
      if (client) { try { const image = await client.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(output, `${platform}-failure.png`), Buffer.from(image.data, 'base64')); } catch {} }
      throw error;
    } finally {
      clearTimeout(timer); client?.close(); child.kill(); await Promise.race([exited, delay(5000)]);
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 15, retryDelay: 100 }); } catch (error) { console.warn(`临时 profile 清理失败：${error.message}`); }
      writeFileSync(path.join(output, layoutOnly ? 'alignment-report.json' : concurrencyOnly ? 'concurrency-report.json' : 'report.json'), JSON.stringify(report, null, 2));
    }
  }
} finally { server.closeAllConnections(); server.close(); }
console.log(`验证报告及截图：${output}`);

import * as db from '../src/utils/db';
import { assessmentCommandProfiles } from '../src/data/assessmentCommands';
import { COMMAND_BINDINGS_KEY, commandBindingKey, readCommandBindings, setCommandLinked } from '../src/utils/assessmentCommandBindings';
import { COMMAND_STORAGE_KEY, saveCommand } from '../src/utils/assessmentCommandStore';
import { COMMAND_DEFAULTS_KEY, setCommandDefault, readCommandDefaults } from '../src/utils/assessmentCommandDefaults';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
export async function until(check, label) {
  for (let n = 0; n < 100; n++) { if (await check()) return; await pause(50); }
  throw new Error(`等待超时：${label}；${document.body.innerText.slice(-1500)}`);
}
const dialog = () => document.querySelector('[aria-labelledby="assessment-command-title"]');
const button = (text, root = dialog() ?? document) => [...root.querySelectorAll('button')].find(el => el.textContent.trim() === text);
async function manageMode() { if (button('管理命令库')) { button('管理命令库').click(); await pause(60); } }
async function click(text, root) { if (text === '新增命令') await manageMode(); const el = button(text, root); assert(el && !el.disabled, `按钮不可用：${text}`); el.click(); await pause(80); await until(() => dialog()?.getAttribute('aria-busy') !== 'true', '命令写入结束'); }
function input(el, value) { assert(el, '输入控件存在'); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }
async function select(el, value) { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await pause(60); }
export async function seed() {
  const doc = db.createProjectDocument({ systemName: '命令库隔离验证系统', unitName: '测试单位' }); doc.id = 'command-qa';
  doc.categories = ['服务器', '网络设备', '安全设备', '数据库', '自定义分类', '未分类'].map((name, i) => ({ id: `cat-${i}`, name, type: 'checklist', order: i + 1, defaultItems: [] }));
  doc.assets = doc.categories.map((cat, i) => ({ id: `asset-${i}`, categoryId: cat.id, name: `测试${cat.name}资产`, items: [{ id: `item-${i}`, label: '截图核查', required: false, images: [] }, { id: `door-${i}`, label: '门禁', required: true, images: [] }] }));
  for (let i = 0; i < 10; i++) doc.assets.push({ id: `server-${i}`, categoryId: 'cat-0', name: `继承测试服务器${i}`, items: [
    { id: `identity-${i}`, label: '身份鉴别', required: true, images: [] },
    { id: `audit-${i}`, label: '安全审计', required: true, images: [] },
    { id: `unknown-${i}`, label: '身份鉴别与访问控制', required: true, images: [] },
    { id: `door-server-${i}`, label: '门禁', required: true, images: [] },
  ] });
  for (const category of doc.categories.slice(1, 4)) {
    for (let i = 0; i < 10; i++) doc.assets.push({ id: `${category.id}-batch-${i}`, categoryId: category.id, name: `继承测试${category.name}${i}`, items: [
      { id: `${category.id}-identity-${i}`, label: '身份鉴别', required: true, images: [] },
      { id: `${category.id}-audit-${i}`, label: '安全审计', required: true, images: [] },
    ] });
  }
  await db.saveProject(doc);
  localStorage.setItem('evidence-image-migration-v5', JSON.stringify({ completed: [doc.id], damaged: [] }));
  window.location.hash = '/project/command-qa';
  await until(() => button('测评命令', document), '资产页入口');
  return snapshot();
}
export async function snapshot() { const doc = await db.loadProject('command-qa'); return JSON.stringify({ categories: doc.categories, assets: doc.assets }); }
export async function open() { await click('测评命令', document); await until(() => dialog(), '命令弹窗'); }
export async function close() { await click('×'); await until(() => !dialog(), '关闭弹窗'); }
export async function profile(id) {
  const target = assessmentCommandProfiles.find(p => p.id === id); assert(target, '平台存在');
  await select(dialog().querySelectorAll('select')[0], target.family);
  await select(dialog().querySelectorAll('select')[1], id);
}
export async function prepareCopy(id, groupId, all = false) {
  await profile(id);
  const target = assessmentCommandProfiles.find(p => p.id === id).groups.find(g => !groupId || g.id === groupId);
  if (groupId) {
    const nav = [...dialog().querySelectorAll('nav button')].find(el => el.textContent === target.title);
    nav.click(); await pause(80);
  }
  return { expected: all ? target.snippets.map(s => s.command).join('\n\n') : target.snippets[0].command,
    selector: all ? '[aria-labelledby="assessment-command-title"] button[data-unused]' : `[data-command-id="${target.snippets[0].id}"] button:last-child` };
}
export function copyCoordinates(selector, all = false) {
  const el = all ? button('复制本组') : document.querySelector(selector); assert(el && !el.disabled, '复制按钮可用');
  el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
export async function copied() { await until(() => [...(dialog()?.querySelectorAll('[role="status"]') ?? [])].some(el => el.textContent.startsWith('已复制：')), '真实复制成功'); return dialog().querySelector('[role="status"]').textContent; }
export async function asset(index) {
  if (dialog()) await close();
  const name = `测试${['服务器', '网络设备', '安全设备', '数据库', '自定义分类', '未分类'][index]}资产`;
  const catName = ['服务器', '网络设备', '安全设备', '数据库', '自定义分类', '未分类'][index];
  let label = document.querySelector(`aside span[title="${name}"]`);
  if (!label) { document.querySelector(`aside button[title="${catName}"]`).click(); await pause(60); label = document.querySelector(`aside span[title="${name}"]`); }
  label.closest('.group').click(); await pause(120); await open();
  const expected = ['server', 'network', 'security', 'database', 'network', 'network'][index];
  assert(dialog().querySelector('select').value === expected, '切换资产按分类定位');
}
export async function searchAndLifecycle() {
  await profile('linux-rhel'); input(dialog().querySelector('[type="search"]'), '不存在的命令'); await pause(80);
  assert(dialog().textContent.includes('没有找到匹配的命令') && !button('复制本组'), '搜索空态不可误复制');
  await click('清空搜索'); assert(document.querySelectorAll('[data-command-id]').length === 4, '清空搜索恢复分组');
  input(dialog().querySelector('[type="search"]'), 'SYSTEM-AUTH'); await pause(80);
  assert(!button('复制本组') && [...dialog().querySelectorAll('code')].every(el => el.textContent.includes('/etc/pam.d/system-auth')), '搜索直接显示匹配段且不能整组复制');
  input(dialog().querySelector('[type="search"]'), '身份鉴别'); await pause(80);
  assert(dialog().querySelectorAll('[data-command-id]').length === 4 && !button('复制本组'), '用途搜索显示该组全部命令但不混入整组操作');
  await close(); await open(); assert(dialog().querySelectorAll('select')[1].value === 'linux-rhel' && dialog().querySelector('[type="search"]').value === '', '同资产重开平台保留且搜索清空');
  for (const index of [1, 2, 3, 4, 5, 0]) await asset(index);
  await close(); await click('调整顺序', document); assert(!button('测评命令', document), '排序模式隐藏命令入口'); await click('完成排序', document); await open();
  return '分类定位、自定义/未分类、搜索空态、关闭重开、切换资产与排序入口';
}
export async function crud() {
  await profile('linux-rhel'); await click('新增命令');
  const fields = dialog().querySelectorAll('form input, form textarea');
  input(fields[0], '现场自定义查询'); input(fields[1], "printf '%s\\n' 'a | b'\nwhoami"); input(fields[2], '不应进入剪贴板的说明'); await click('保存命令');
  let article = [...dialog().querySelectorAll('article')].find(el => el.textContent.includes('现场自定义查询')); assert(article, '新增后可见');
  article.querySelector('button').click(); await pause(80);
  input(dialog().querySelector('form input'), '现场修改查询'); await click('保存命令');
  const raw = localStorage.getItem(COMMAND_STORAGE_KEY); assert(raw.includes('现场修改查询'), '修改写入本机存储');
  article = [...dialog().querySelectorAll('article')].find(el => el.textContent.includes('现场修改查询')); article.querySelectorAll('button')[1].click(); await pause(80); await click('取消');
  assert(dialog().textContent.includes('现场修改查询'), '取消删除保留');
  await click('新增命令'); input(dialog().querySelector('form input'), '未保存草稿'); await click('×');
  assert(dialog().textContent.includes('放弃未保存'), '关闭确认'); await click('取消'); assert(dialog().querySelector('form input').value === '未保存草稿', '确认取消保留草稿');
  await click('取消'); await click('确认');
  const first = dialog().querySelector('article'); first.querySelector('button').click(); await pause(80); input(dialog().querySelector('form input'), '内置查询修改'); await click('保存命令');
  assert(dialog().textContent.includes('内置查询修改'), '内置可修改');
  return '新增/编辑、内置修改、删除取消、未保存关闭与草稿保留';
}
export async function persistedAndDelete() {
  await open(); await profile('linux-rhel'); await manageMode();
  assert(dialog().textContent.includes('现场修改查询') && dialog().textContent.includes('内置查询修改'), '刷新后命令保留');
  for (const title of ['现场修改查询', '内置查询修改']) {
    const article = [...dialog().querySelectorAll('article')].find(el => el.querySelector('h4').textContent.includes(title));
    article.querySelectorAll('button')[1].click(); await pause(60); await click('确认');
    assert(!dialog().textContent.includes(title), '删除立即生效');
  }
  return '刷新持久化、自定义删除和内置隐藏';
}
export async function failures() {
  await click('新增命令'); const fields = dialog().querySelectorAll('form input, form textarea');
  input(fields[0], '失败保留标题'); input(fields[1], 'whoami');
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) { if (key === COMMAND_STORAGE_KEY) throw new Error('受控存储已满'); return original.call(this, key, value); };
  try {
    await click('保存命令'); assert(dialog().textContent.includes('保存失败') && dialog().querySelector('form input').value === '失败保留标题', '保存失败保留表单');
    assert([...dialog().querySelectorAll('form input, form textarea')].every(el => el.getAttribute('aria-invalid') === 'false' && !el.hasAttribute('aria-describedby')), '存储失败不把有效字段标为非法');
  }
  finally { Storage.prototype.setItem = original; }
  await click('取消'); await click('确认');
  const previous = localStorage.getItem(COMMAND_STORAGE_KEY); await close(); localStorage.setItem(COMMAND_STORAGE_KEY, 'broken-command-library'); await open(); await manageMode();
  assert(dialog().textContent.includes('读取失败') && button('新增命令').disabled && !button('复制本组').disabled, '损坏库只读且可复制内置');
  assert(localStorage.getItem(COMMAND_STORAGE_KEY) === 'broken-command-library', '损坏库未覆盖');
  await close(); localStorage.setItem(COMMAND_STORAGE_KEY, previous); await open();
  await click('新增命令'); const editor = dialog().querySelectorAll('form input, form textarea'); input(editor[0], '   '); input(editor[1], '   '); input(editor[2], 'x'.repeat(4001)); await click('保存命令');
  const invalidTitle = dialog().querySelector('form input');
  assert(dialog().textContent.includes('保存失败') && invalidTitle.getAttribute('aria-invalid') === 'true', '空白标题拒绝并标记字段');
  assert(document.getElementById(invalidTitle.getAttribute('aria-describedby'))?.textContent.includes('非空标题') && document.activeElement === invalidTitle, '字段关联错误说明并聚焦');
  assert([...dialog().querySelectorAll('form input, form textarea')].every(el => el.getAttribute('aria-invalid') === 'true' && document.getElementById(el.getAttribute('aria-describedby'))?.textContent), '各字段错误独立关联说明');
  input(invalidTitle, '修正标题'); await pause(50);
  assert(invalidTitle.getAttribute('aria-invalid') === 'false' && !invalidTitle.hasAttribute('aria-describedby'), '修正字段后移除错误关联'); await click('取消'); await click('确认');
  const snippet = assessmentCommandProfiles.find(p => p.id === 'linux-rhel').groups[0].snippets[1];
  const article = dialog().querySelector(`[data-command-id="${snippet.id}"]`); article.querySelector('button').click(); await pause(80);
  await saveCommand('linux-rhel', 'linux-rhel-identity', { ...snippet, title: '另一窗口已修改' }, snippet);
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_STORAGE_KEY })); input(dialog().querySelector('form input'), '冲突草稿'); await click('保存命令');
  assert(dialog().textContent.includes('已被修改') && dialog().querySelector('form input').value === '冲突草稿', '跨窗口冲突不覆盖'); await click('取消'); await click('确认');
  await click('新增命令'); input(dialog().querySelector('form input'), '默认平台变更时保留的草稿');
  const priorDefaults = localStorage.getItem(COMMAND_DEFAULTS_KEY);
  await setCommandDefault('asset', { projectId: 'command-qa', assetId: 'asset-0' }, 'windows');
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_DEFAULTS_KEY })); await pause(80);
  assert(dialog().querySelector('form p').textContent.includes('Linux') && dialog().querySelector('form input').value === '默认平台变更时保留的草稿', '外部默认平台变化不改变编辑环境和草稿');
  if (priorDefaults === null) localStorage.removeItem(COMMAND_DEFAULTS_KEY); else localStorage.setItem(COMMAND_DEFAULTS_KEY, priorDefaults);
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_DEFAULTS_KEY })); await pause(60);
  await click('取消'); await click('确认');
  input(dialog().querySelector('[type="search"]'), '另一窗口已修改'); await pause(80);
  dialog().querySelector('[aria-label="编辑：另一窗口已修改"]').click(); await pause(80);
  const searched = resolveSnippet('linux-rhel-identity-2');
  await saveCommand('linux-rhel', 'linux-rhel-identity', { ...searched, title: '外部重命名后的策略' }, searched);
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_STORAGE_KEY })); await pause(80);
  assert(dialog().querySelector('form p').textContent.includes('身份鉴别') && dialog().querySelector('form p').textContent.includes('Linux Shell'), '搜索命中被外部修改后编辑器仍标明原分组及执行环境');
  assert(dialog().querySelector('form input').value === searched.title, '外部修改不覆盖搜索编辑草稿');
  await click('保存命令'); assert(dialog().textContent.includes('已被修改'), '搜索编辑仍拒绝过期快照');
  await click('取消'); await click('清空搜索');
  return '存储拒绝、损坏库保护、空白输入、跨窗口编辑冲突及平台/搜索结果变化期间保留编辑环境';
}
let clipboardDescriptor, execCommand, resolveCopy;
export function breakClipboard(delayed = false) {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); execCommand = document.execCommand;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => delayed ? new Promise(resolve => { resolveCopy = resolve; }) : Promise.reject(new Error('受控拒绝')) } });
  document.execCommand = () => false;
}
export function restoreClipboard() { if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor); else delete navigator.clipboard; document.execCommand = execCommand; resolveCopy?.(); }
export async function manualFailure() {
  await until(() => dialog().querySelector('[aria-label="手动复制文本"]'), '手动复制回退');
  const textarea = dialog().querySelector('[aria-label="手动复制文本"]'); const expected = dialog().querySelector('code').textContent;
  assert(textarea.value === expected, '失败后文本保持完整'); assert(document.activeElement === textarea && textarea.selectionEnd === expected.length, '失败后自动聚焦并选中'); await click('选中全部命令'); assert(textarea.selectionStart === 0 && textarea.selectionEnd === expected.length, '可选中手动复制'); restoreClipboard();
  return 'Clipboard 拒绝及旧复制失败时显示完整可选文本';
}
export async function delayedRace() {
  breakClipboard(true); button('复制本组').click(); await pause(30); await profile('windows'); restoreClipboard(); await pause(80);
  assert(!dialog().textContent.includes('已复制：') && !dialog().textContent.includes('正在复制'), '旧复制结果不得污染新平台');
  return '平台切换时忽略陈旧异步复制结果';
}
export function layout() {
  const panel = dialog(), bounds = panel.getBoundingClientRect();
  assert(bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1, '弹窗位于视口');
  assert(panel.scrollWidth <= panel.clientWidth + 1, '长命令不撑破弹窗');
  for (const el of panel.querySelectorAll('button, select, input')) {
    if (!el.getClientRects().length) continue;
    const r = el.getBoundingClientRect(); assert(r.width >= 20 && r.height >= 43, `控件可操作：${el.textContent}`);
  }
  return '弹窗控件完整、44px 操作区域、长命令内部滚动';
}

const itemRoot = (id = 'item-0') => document.getElementById(`item-commands-${id}`).parentElement;
async function expandCommands(id = 'item-0') {
  const toggle = itemRoot(id).querySelector(`[aria-controls="item-commands-${id}"]`);
  if (toggle.getAttribute('aria-expanded') !== 'true') { toggle.click(); await pause(80); }
  return itemRoot(id);
}
async function manageItem(id = 'item-0') { const root = await expandCommands(id); if (!dialog()) await click('管理关联', root); await until(() => dialog(), '检查项关联弹窗'); }
async function linkCommand(id) { const el = dialog().querySelector(`[data-link-command="${id}"]`); assert(el && !el.disabled, '关联按钮可用'); el.click(); await pause(80); await until(() => dialog()?.getAttribute('aria-busy') !== 'true', '关联写入结束'); }
export async function itemLinks() {
  await close();
  const beforePaste = document.querySelector('main').textContent.includes('当前粘贴目标：');
  assert(itemRoot().querySelector('[aria-expanded]').getAttribute('aria-expanded') === 'false', '检查项默认折叠');
  await manageItem(); assert(dialog() && !itemRoot().querySelector('code'), '无关联直接进入选择界面'); await profile('linux-rhel');
  await linkCommand('linux-rhel-identity-2'); await linkCommand('linux-rhel-identity-3');
  await click('新增命令'); const fields = dialog().querySelectorAll('form input, form textarea');
  input(fields[0], '检查项自定义查询'); input(fields[1], "printf '%s\\n' 'a | b'\nwhoami"); input(fields[2], '关联说明不参与复制'); await click('保存命令');
  const custom = [...dialog().querySelectorAll('article')].find(el => el.textContent.includes('检查项自定义查询')).dataset.commandId;
  await linkCommand(custom); await close(); await expandCommands();
  assert(itemRoot().querySelectorAll('[data-linked-command-id]').length === 3, '内置和自定义在检查项显示');
  assert(itemRoot().querySelector(`[data-linked-command-id="${custom}"] code`).textContent === "printf '%s\\n' 'a | b'\nwhoami", '共用命令正文');
  await manageItem(); await profile('linux-rhel'); await manageMode();
  dialog().querySelector('[data-command-id="linux-rhel-identity-3"] button').click(); await pause(80);
  input(dialog().querySelector('form input'), '检查项同步密码策略'); input(dialog().querySelector('form textarea'), 'cat /etc/login.defs\nid'); await click('保存命令'); await close();
  assert(itemRoot().textContent.includes('检查项同步密码策略') && itemRoot().querySelector('[data-linked-command-id="linux-rhel-identity-3"] code').textContent === 'cat /etc/login.defs\nid', '编辑库同步正文和标题');
  await manageItem(); await profile('linux-rhel'); await manageMode(); dialog().querySelector(`[data-command-id="${custom}"]`).querySelectorAll('button')[1].click(); await pause(80); await click('确认'); await close();
  assert(itemRoot().textContent.includes('1 段关联命令已从命令库删除') && !itemRoot().querySelector(`[data-linked-command-id="${custom}"]`), '库删除后不显示旧命令');
  const door = await expandCommands('door-0'); assert(dialog() && !door.querySelector('code'), '门禁没有自动挂无关命令，直接选择'); await close();
  assert(document.querySelector('main').textContent.includes('当前粘贴目标：') === beforePaste, '命令操作不改变截图粘贴目标');
  return '检查项就地关联、自定义/内置共用、库编辑删除同步、跨窗口变更、门禁空态和粘贴目标隔离';
}
export async function externalEdit() {
  const original = resolveSnippet('linux-rhel-identity-3');
  await saveCommand('linux-rhel', 'linux-rhel-identity', { ...original, title: '另一窗口同步命令' }, original);
}
export async function concurrentWrite(side) {
  const id = `custom-cross-window-${side}`;
  await saveCommand('linux-rhel', 'linux-rhel-identity', { id, title: `并发核查 ${side}`, command: 'whoami' });
  await setCommandLinked({ projectId: 'cross-window-test', assetId: 'asset', itemId: side }, id, true);
  await setCommandDefault('asset', { projectId: 'cross-window-test', assetId: side }, side === 'a' ? 'windows' : 'linux-rhel');
}
export async function concurrentEdit(expected, title) {
  try {
    await saveCommand('linux-rhel', 'linux-rhel-identity', { ...expected, title }, expected);
    return 'saved';
  } catch (error) { return error.message; }
}
export function crossWindowSnapshot() {
  return [COMMAND_STORAGE_KEY, COMMAND_BINDINGS_KEY, COMMAND_DEFAULTS_KEY].map(key => [key, localStorage.getItem(key)]);
}
export async function verifyConcurrentWrites() {
  // 三个键独立同步；一个键可见不能代表其他键已经到达当前 renderer。
  await until(() => ['a', 'b'].every(side => {
    const key = commandBindingKey({ projectId: 'cross-window-test', assetId: 'asset', itemId: side });
    const snippet = resolveSnippet(`custom-cross-window-${side}`);
    return readCommandDefaults().assets[JSON.stringify(['cross-window-test', side])] === (side === 'a' ? 'windows' : 'linux-rhel')
      && snippet?.command === 'whoami'
      && readCommandBindings()[key]?.includes(`custom-cross-window-${side}`);
  }), '两个页面的命令、关联与默认平台配置全部同步');
  for (const side of ['a', 'b']) {
    assert(readCommandDefaults().assets[JSON.stringify(['cross-window-test', side])] === (side === 'a' ? 'windows' : 'linux-rhel'), '两个页面平台配置都保留');
    assert(resolveSnippet(`custom-cross-window-${side}`), '两个页面新增的命令都保留');
    const key = commandBindingKey({ projectId: 'cross-window-test', assetId: 'asset', itemId: side });
    assert(readCommandBindings()[key]?.includes(`custom-cross-window-${side}`), '两个页面新增的关联都保留');
  }
  return resolveSnippet('custom-cross-window-a');
}
export async function verifyDelayedBindingObservation(permanentlyMissing = false) {
  const original = Storage.prototype.getItem;
  let staleReads = 0;
  let remainingStaleReads = 3;
  Storage.prototype.getItem = function(key) {
    if (this === localStorage && key === COMMAND_BINDINGS_KEY && (permanentlyMissing || remainingStaleReads-- > 0)) {
      staleReads++;
      return null;
    }
    return original.call(this, key);
  };
  try {
    let failure;
    try { await verifyConcurrentWrites(); } catch (error) { failure = error; }
    if (permanentlyMissing) {
      assert(failure?.message.startsWith('等待超时：两个页面的命令、关联与默认平台配置全部同步'), '关联持续缺失必须有界失败，不能降低保留数据的要求');
    } else if (failure) throw failure;
    assert(staleReads > 0, '确实观察到关联键延迟，而默认平台键已同步');
  } finally { Storage.prototype.getItem = original; }
  return permanentlyMissing ? '关联持续缺失仍在原有时限内失败' : '默认平台先可见、关联延后可见时等待完整同步，不误判为丢写';
}
export function holdCommandWrites() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('evidence-command-write-lock', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('mutex');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const tx = database.transaction('mutex', 'readwrite');
      tx.oncomplete = tx.onabort = () => database.close();
      window.releaseCommandWrites = () => { held = false; };
      let held = true;
      const keep = () => {
        const request = tx.objectStore('mutex').get('write');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { resolve(true); if (held) keep(); };
      };
      keep();
    };
  });
}
function resolveSnippet(id) {
  const parsed = JSON.parse(localStorage.getItem(COMMAND_STORAGE_KEY) || '{"changes":[]}');
  return parsed.changes.find(c => c.id === id)?.snippet ?? assessmentCommandProfiles.flatMap(p => p.groups.flatMap(g => g.snippets)).find(s => s.id === id);
}
export async function persistedItemLinks() {
  await until(() => document.getElementById('item-commands-item-0'), '刷新后检查项');
  const root = await expandCommands();
  assert(root.textContent.includes('另一窗口同步命令') && root.querySelector('[data-linked-command-id="linux-rhel-identity-3"] code').textContent === 'cat /etc/login.defs\nid', '刷新保留关联并显示最新命令');
  await manageItem(); await profile('linux-rhel');
  const unavailable = [...dialog().querySelectorAll('button')].find(el => el.textContent.startsWith('取消失效关联：'));
  assert(unavailable, '失效关联可见'); unavailable.click(); await pause(80);
  await linkCommand('linux-rhel-identity-3'); await close();
  assert(!root.querySelector('[data-linked-command-id="linux-rhel-identity-3"]') && !!root.querySelector('[data-linked-command-id="linux-rhel-identity-2"]'), '取消关联只移除所选命令');
  await manageItem(); await profile('linux-rhel'); await linkCommand('linux-rhel-identity-3'); await close();
  root.querySelector('[aria-label="重命名检查项"]').click(); await pause(60); input(root.querySelector('input'), '临时核查名称'); root.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await pause(100);
  assert(root.querySelector('[data-linked-command-id="linux-rhel-identity-3"]'), '重命名后关联保留');
  root.querySelector('[aria-label="重命名检查项"]').click(); await pause(60); input(root.querySelector('input'), '截图核查'); root.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await pause(100);
  await click('调整顺序', document); assert(!document.querySelector('[data-item-commands]'), '排序模式不显示命令操作'); await click('完成排序', document); await expandCommands();
  assert(itemRoot().querySelector('[data-linked-command-id="linux-rhel-identity-3"]'), '排序视图返回关联仍在');
  await asset(1); await close(); await expandCommands('item-1'); assert(!itemRoot('item-1').querySelector('[data-linked-command-id]'), '切换资产不串关联'); await close();
  await asset(0); await close(); await expandCommands();
  return '检查项关联刷新保留、逐段取消和失效引用移除、重命名/排序保留及资产隔离';
}
export async function itemBindingFailures() {
  await manageItem(); await profile('linux-rhel');
  const before = localStorage.getItem(COMMAND_BINDINGS_KEY), original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) { if (key === COMMAND_BINDINGS_KEY) throw new Error('受控关联存储拒绝'); return original.call(this, key, value); };
  try { await linkCommand('linux-rhel-identity-4'); assert(dialog().textContent.includes('关联保存失败') && dialog().querySelector('[data-link-command="linux-rhel-identity-4"]').getAttribute('aria-pressed') === 'false', '关联失败不误报成功'); }
  finally { Storage.prototype.setItem = original; }
  assert(localStorage.getItem(COMMAND_BINDINGS_KEY) === before, '失败保留旧关联');
  await close(); localStorage.setItem(COMMAND_BINDINGS_KEY, 'broken-links'); window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_BINDINGS_KEY })); await pause(100);
  assert(itemRoot().textContent.includes('关联读取失败') && !itemRoot().querySelector('code'), '异常关联不显示默认内容');
  await manageItem(); assert(dialog().querySelector('[data-link-command]').disabled, '异常关联禁写'); await close();
  assert(localStorage.getItem(COMMAND_BINDINGS_KEY) === 'broken-links', '损坏关联不覆盖');
  localStorage.setItem(COMMAND_BINDINGS_KEY, before); window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_BINDINGS_KEY })); await pause(100);
  // 其他项目使用同名资产/检查项 ID 也不能串用绑定。
  assert(!readCommandBindings()[commandBindingKey({ projectId: 'other-project', assetId: 'asset-0', itemId: 'item-0' })], '项目隔离');
  await setCommandLinked({ projectId: 'other-project', assetId: 'asset-0', itemId: 'item-0' }, 'windows-identity-1', true);
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_BINDINGS_KEY })); await pause(100);
  assert(!itemRoot().querySelector('[data-linked-command-id="windows-identity-1"]'), '别的项目关联不会显示到当前检查项');
  return '关联保存拒绝、损坏读取保护、失败保留和同名检查项项目隔离';
}
export function prepareInlineCopy() {
  const selector = '[data-linked-command-id="linux-rhel-identity-3"] button';
  return { selector, expected: document.querySelector('[data-linked-command-id="linux-rhel-identity-3"] code').textContent };
}
export async function inlineCopied() { await until(() => [...itemRoot().querySelectorAll('[role="status"]')].some(el => el.textContent.startsWith('已复制：')), '检查项真实复制'); }
export async function inlineManual() {
  await until(() => itemRoot().querySelector('textarea'), '关联命令手动复制'); const textarea = itemRoot().querySelector('textarea');
  assert(textarea.value === prepareInlineCopy().expected && document.activeElement === textarea && textarea.selectionEnd === textarea.value.length, '行内复制失败后自动选中完整文本'); restoreClipboard();
  return '检查项复制失败后自动选择完整命令手动复制';
}
export async function previewInline() {
  for (const id of ['linux-rhel-identity-2', 'linux-rhel-identity-3']) {
    const original = assessmentCommandProfiles.flatMap(p => p.groups.flatMap(g => g.snippets)).find(s => s.id === id);
    await saveCommand('linux-rhel', 'linux-rhel-identity', original, resolveSnippet(id));
  }
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_STORAGE_KEY })); await pause(80);
  const root = await expandCommands();
  const toggle = root.querySelector('[aria-controls="item-commands-item-0"]'); toggle.click(); await pause(40); toggle.click(); await pause(60);
  const doorToggle = itemRoot('door-0').querySelector('[aria-controls="item-commands-door-0"]'); if (doorToggle.getAttribute('aria-expanded') === 'true') doorToggle.click();
  root.closest('main').scrollTop = 0; window.scrollTo(0, 0); await pause(60);
}
async function serverAsset(index) {
  if (dialog()) await close();
  const name = `继承测试服务器${index}`;
  let label = document.querySelector(`aside span[title="${name}"]`);
  if (!label) { document.querySelector('aside button[title="服务器"]').click(); await pause(60); label = document.querySelector(`aside span[title="${name}"]`); }
  label.closest('.group').click(); await pause(100);
}
function toggleFor(id) { return document.querySelector(`[aria-controls="item-commands-${id}"]`); }
async function configureDefault(kind) {
  const details = [...dialog().querySelectorAll('details')].find(el => el.querySelector('summary').textContent.startsWith('默认平台'));
  details.open = true; await click(kind);
}
export async function defaultInheritance() {
  if (dialog()) await close();
  const before = JSON.stringify(await db.loadProject('command-qa'));
  await serverAsset(0);
  assert(toggleFor('identity-0').textContent.trim().startsWith('命令▾') && !document.querySelector('[data-item-commands]'), '未配置平台不猜默认，默认折叠');
  await open(); assert(!dialog().querySelector('[aria-label^="编辑："]'), '查看模式不常显编辑删除');
  await profile('linux-rhel'); await configureDefault('设为分类默认'); await close();
  for (let i = 0; i < 10; i++) {
    await serverAsset(i);
    assert(toggleFor(`identity-${i}`).textContent.includes('(3)'), '同分类十台已有服务器继承当前库的身份鉴别命令');
    assert(toggleFor(`audit-${i}`).textContent.includes('(4)'), '受控别名安全审计匹配日志审计');
    for (const id of [`unknown-${i}`, `door-server-${i}`]) assert(!toggleFor(id).textContent.includes('('), '歧义名称和门禁不匹配');
    assert(!document.querySelector('[data-item-commands]'), '切换资产命令仍默认折叠');
  }
  await serverAsset(0); await open(); await profile('windows'); await configureDefault('仅用于本资产'); await close();
  await expandCommands('identity-0');
  assert([...itemRoot('identity-0').querySelectorAll('[data-linked-command-id]')].every(el => el.dataset.linkedCommandId.startsWith('windows-')), 'Windows 单台不混 Linux');
  await serverAsset(1); await expandCommands('identity-1');
  assert([...itemRoot('identity-1').querySelectorAll('[data-linked-command-id]')].every(el => el.dataset.linkedCommandId.startsWith('linux-rhel-')), '单台覆盖不影响同分类其他资产');
  await serverAsset(0); await open(); await configureDefault('恢复分类默认'); await close(); await expandCommands('identity-0');
  assert(itemRoot('identity-0').querySelector('[data-linked-command-id="linux-rhel-identity-2"]'), '恢复分类默认');
  await manageItem('identity-0');
  for (const id of ['linux-rhel-identity-2', 'linux-rhel-identity-3', 'linux-rhel-identity-4']) await linkCommand(id);
  assert(readCommandBindings()[commandBindingKey({ projectId: 'command-qa', assetId: 'server-0', itemId: 'identity-0' })]?.length === 0, '取消最后一条持久保存空覆盖');
  await close(); assert(JSON.stringify(await db.loadProject('command-qa')) === before, '默认配置与调整不改完整项目文档和图片引用');
  return '十台旧服务器继承、明确用途别名、未知/门禁拒绝、Windows 单台覆盖/恢复、空覆盖持久化与证据不变';
}
export async function defaultsAfterReload() {
  await until(() => button('测评命令', document), '刷新后的资产');
  await serverAsset(0);
  assert(!toggleFor('identity-0').textContent.includes('('), '空覆盖刷新不重新出现');
  await manageItem('identity-0'); assert(button('恢复自动默认'), '空覆盖可恢复默认');
  await click('恢复自动默认'); await close(); await expandCommands('identity-0');
  assert(itemRoot('identity-0').querySelectorAll('[data-linked-command-id]').length === 3, '恢复默认重新派生');
  await manageItem('identity-0'); await linkCommand('linux-rhel-identity-2'); await close();
  await open(); await profile('windows'); await configureDefault('设为分类默认'); await close();
  assert(itemRoot('identity-0').querySelector('[data-linked-command-id="linux-rhel-identity-3"]') && !itemRoot('identity-0').querySelector('[data-linked-command-id="windows-identity-1"]'), '更改分类默认不覆盖手动选择');
  await serverAsset(1); await expandCommands('identity-1'); assert(itemRoot('identity-1').querySelector('[data-linked-command-id="windows-identity-1"]'), '其他服务器同步新分类平台');
  const preserved = localStorage.getItem(COMMAND_DEFAULTS_KEY);
  localStorage.setItem(COMMAND_DEFAULTS_KEY, 'corrupt-defaults'); window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_DEFAULTS_KEY })); await pause(80);
  assert(!itemRoot('identity-1').querySelector('code'), '损坏配置不能猜平台');
  await open(); dialog().querySelector('details').open = true;
  assert(button('设为分类默认').disabled && dialog().textContent.includes('默认命令平台读取失败'), '损坏配置禁写和提示');
  assert(localStorage.getItem(COMMAND_DEFAULTS_KEY) === 'corrupt-defaults', '损坏配置不覆盖');
  localStorage.setItem(COMMAND_DEFAULTS_KEY, preserved); window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_DEFAULTS_KEY })); await pause(80);
  await profile('linux-rhel');
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) { if (key === COMMAND_DEFAULTS_KEY) throw new Error('受控默认配置写入失败'); return original.call(this, key, value); };
  try { await configureDefault('设为分类默认'); assert(dialog().textContent.includes('保存失败') && localStorage.getItem(COMMAND_DEFAULTS_KEY) === preserved, '配置写失败保留原值与选择'); }
  finally { Storage.prototype.setItem = original; }
  await configureDefault('设为分类默认'); await close();
  return '空覆盖刷新/恢复、手动选择优先、配置损坏禁写、保存拒绝与恢复';
}
export async function newAssetInheritance() {
  if (dialog()) await close();
  await serverAsset(1);
  const before = await snapshot();
  document.querySelector('aside button[title="添加资产"]').click(); await pause(50);
  const field = document.querySelector('aside input[placeholder^="资产名称"]'); input(field, '新建继承服务器');
  field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await until(() => document.querySelector('main h2')?.textContent === '新建继承服务器', '新资产');
  input(document.querySelector('main input[placeholder="添加自定义检查项..."]'), '身份鉴别'); await click('添加', document.querySelector('main'));
  await until(() => document.querySelector('[aria-controls^="item-commands-"]')?.textContent.includes('(3)'), '新增资产无需配置即继承当前 Linux 命令');
  const toggle = document.querySelector('[aria-controls^="item-commands-"]'); toggle.click(); await pause(80);
  assert(document.querySelector('[data-linked-command-id="linux-rhel-identity-2"]'), '新增检查项自动显示适用命令');
  await until(async () => (await db.loadProject('command-qa')).assets.some(asset => asset.name === '新建继承服务器' && asset.items.some(item => item.label === '身份鉴别')), '新资产与检查项实际落盘后再清理夹具');
  document.querySelector('aside span[title="新建继承服务器"]').closest('.group').querySelector('button[title="删除"]').click(); await pause(60);
  await click('删除资产', document.querySelector('[role="alertdialog"]') ?? document.querySelector('[role="dialog"]'));
  await until(async () => await snapshot() === before, '移除隔离新建夹具后原证据不变');
  await serverAsset(1); await expandCommands('identity-1');
  return '分类配置后实际新增资产/检查项自动继承，测试夹具清理后原证据逐字不变';
}
export async function otherFamilyInheritance(categoryId, categoryName, profileId, overrideId) {
  if (dialog()) await close();
  const before = JSON.stringify(await db.loadProject('command-qa'));
  async function selectAsset(index) {
    if (dialog()) await close();
    const name = `继承测试${categoryName}${index}`;
    let label = document.querySelector(`aside span[title="${name}"]`);
    if (!label) { document.querySelector(`aside button[title="${categoryName}"]`).click(); await pause(60); label = document.querySelector(`aside span[title="${name}"]`); }
    label.closest('.group').click(); await pause(80);
  }
  await selectAsset(0); await open(); await profile(profileId); await configureDefault('设为分类默认'); await close();
  const target = assessmentCommandProfiles.find(p => p.id === profileId);
  for (let i = 0; i < 10; i++) {
    await selectAsset(i);
    assert(!document.querySelector('[data-item-commands]'), `${categoryName}命令默认折叠`);
    for (const purpose of ['identity', 'audit']) {
      const itemId = `${categoryId}-${purpose}-${i}`;
      await expandCommands(itemId);
      const expected = target.groups.find(g => g.id === `${profileId}-${purpose}`).snippets;
      const actual = [...itemRoot(itemId).querySelectorAll('[data-linked-command-id]')];
      assert(JSON.stringify(actual.map(el => el.dataset.linkedCommandId)) === JSON.stringify(expected.map(s => s.id)), `${profileId} 十台资产均自动继承且不混平台`);
      assert(actual.every((el, n) => el.querySelector('code').textContent === expected[n].command), `${profileId} 自动命令正文与平台目录一致`);
    }
  }
  if (overrideId) {
    await selectAsset(0); await open(); await profile(overrideId); await configureDefault('仅用于本资产'); await close();
    await expandCommands(`${categoryId}-identity-0`);
    assert(itemRoot(`${categoryId}-identity-0`).querySelector(`[data-linked-command-id="${overrideId}-identity-1"]`), `${categoryName} 单台例外`);
    await selectAsset(1); await expandCommands(`${categoryId}-identity-1`);
    assert(itemRoot(`${categoryId}-identity-1`).querySelector(`[data-linked-command-id="${profileId}-identity-1"]`), `${categoryName} 其他资产保留分类平台`);
    await selectAsset(0); await open(); await configureDefault('恢复分类默认'); await close(); await expandCommands(`${categoryId}-identity-0`);
    assert(itemRoot(`${categoryId}-identity-0`).querySelector(`[data-linked-command-id="${profileId}-identity-1"]`), `${categoryName} 例外恢复分类默认`);
  }
  await serverAsset(1); await expandCommands('identity-1');
  assert(itemRoot('identity-1').querySelector('[data-linked-command-id="linux-rhel-identity-2"]'), '其他三类配置不影响服务器');
  const after = await db.loadProject('command-qa');
  const changedKeys = Object.keys(after).filter(key => JSON.stringify(after[key]) !== JSON.stringify(JSON.parse(before)[key]));
  assert(JSON.stringify(after) === before, `四类配置不改项目文档和图片引用，变化字段：${changedKeys.join(', ')}`);
  return `${categoryName} ${profileId} 十台批量继承、正文与跨分类隔离${overrideId ? '、单台例外与恢复' : ''}、项目文档不变`;
}
export async function configurationLayout(opened = true) { dialog().querySelector('details').open = opened; await pause(60); return layout(); }
export async function externalDefault() { await setCommandDefault('category', { projectId: 'command-qa', categoryId: 'cat-0', assetId: 'server-1' }, 'windows'); }
export async function observeExternalDefault() { await until(() => itemRoot('identity-1').querySelector('[data-linked-command-id="windows-identity-1"]'), '原生 storage 同步默认平台'); }

export async function prepareAlignment() {
  if (dialog()) await close();
  await setCommandLinked({ projectId: 'command-qa', assetId: 'asset-0', itemId: 'item-0' }, 'linux-rhel-identity-2', true);
  window.dispatchEvent(new StorageEvent('storage', { key: COMMAND_BINDINGS_KEY }));
  await until(() => toggleFor('item-0').textContent.includes('(1)'), '对齐测试命令加载');
  await expandCommands('item-0');
}
export function inlineLayout() {
  const panel = itemRoot().querySelector('[data-item-commands]'); panel.scrollIntoView({ block: 'start' });
  assert(panel.scrollWidth <= panel.clientWidth + 1, '行内命令不撑破卡片');
  assert(panel.querySelector('pre').scrollWidth >= panel.querySelector('pre').clientWidth, '代码内部可滚动');
  for (const el of panel.querySelectorAll('button')) assert(el.getBoundingClientRect().height >= 43, '行内按钮触控高度');
  const toggle = toggleFor('item-0');
  const label = toggle.previousElementSibling;
  const badge = itemRoot().querySelector('span[title="必填"], span[title="选填"]');
  const center = el => { const rect = el.getBoundingClientRect(); return rect.top + rect.height / 2; };
  assert(Math.abs(center(badge) - center(toggle.parentElement)) <= 1, '必填标记与标题区域垂直居中对齐');
  if (toggle.getBoundingClientRect().left >= label.getBoundingClientRect().right) assert(Math.abs(center(label) - center(toggle)) <= 1, '同一行检查项标题和命令入口垂直居中对齐');
  const actions = itemRoot().querySelector('[aria-label="删除检查项"]').parentElement;
  if (actions.getBoundingClientRect().left > toggle.getBoundingClientRect().right) assert(Math.abs(center(actions) - center(toggle)) <= 1, '同一行右侧操作与标题居中对齐');
  return '检查项命令内部滚动、按钮触控高度、标记/标题/命令及同行操作居中对齐';
}

import * as db from '../src/utils/db';
import { getPendingWriteCount } from '../src/utils/pendingWrites';
import { buildStoredImage } from '../src/utils/imageStore';
import assessmentPreset from '../presets/dengbao.json';
import { DEFAULT_PRESET } from '../src/utils/preset';
import { buildGroupSnapshot } from '../src/utils/lanGroupSnapshot';
import { exportDataPackage, exportEncryptedDataPackage, importDataPackage, importEncryptedDataPackage } from '../src/utils/exportImport';
import JSZip from 'jszip';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, label) => { if (!value) throw new Error(label); };
const equal = (actual, expected, label) => assert(JSON.stringify(actual) === JSON.stringify(expected), label);
export async function until(check, label) {
  for (let i = 0; i < 120; i++) { if (await check()) return; await pause(40); }
  throw new Error(`等待超时：${label}；${document.body.innerText.slice(-1200)}`);
}
const dialog = () => document.querySelector('[data-project-group-dialog]');
const fields = () => dialog().querySelectorAll('input:not([type=radio])');
const button = (name, root = document) => [...(root?.querySelectorAll('button') ?? [])].find(el => el.textContent.trim() === name);
const click = async (name, root = document) => { const el = button(name, root); assert(el && !el.disabled, `按钮不可用：${name}`); el.click(); await pause(60); };
function input(el, value) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
async function raw(names, action, mode = 'readwrite') {
  const connection = await new Promise((resolve, reject) => { const req = indexedDB.open('evidence-collector-db'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  try { return await new Promise((resolve, reject) => { const tx = connection.transaction(names, mode); let result; action(tx, value => { result = value; }); tx.oncomplete = () => resolve(result); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('测试事务中止')); }); }
  finally { connection.close(); }
}
async function snapshot() { return raw(['projects','projectGroups','projectSummaries','images'], (tx, set) => { const result = {}; for (const name of ['projects','projectGroups','projectSummaries','images']) { const req = tx.objectStore(name).getAll(); req.onsuccess = () => { result[name] = req.result; set(result); }; } }, 'readonly'); }
async function source(name = '原系统', preset) {
  const doc = db.createProjectDocument({ systemName: name, projectName: '转组测试', unitName: '测试单位' }, null, preset);
  doc.assets = [{ id: 'preserved-asset', categoryId: doc.categories[0].id, name: '原资产', items: [{ id: 'preserved-item', label: '原检查项', required: true, fromTemplateId: null, images: [{ id: 'inline', fileName: 'inline.png', caption: '原备注', uploadedAt: '2026-10-19', data: pixel }, { id: 'external', fileName: 'external.png', caption: '外部备注', uploadedAt: '2026-10-19' }] }] }];
  await db.saveProject(doc);
  await raw(['images'], tx => tx.objectStore('images').put(buildStoredImage(doc.id, { id: 'external', fileName: 'external.png', caption: '外部备注', uploadedAt: '2026-10-19', data: pixel })));
  return (await db.loadProject(doc.id, { migrateLegacy: false }));
}
export async function seed() {
  await db.getDefaultPreset();
  await raw(['projects','projectGroups','projectSummaries','images','settings'], tx => { for (const name of ['projects','projectGroups','projectSummaries','images','settings']) tx.objectStore(name).clear(); });
  await db.completeLegacyPresetOnboarding(null);
}
export async function storage() {
  assert(typeof db.convertIndependentSystemToGroup === 'function', '缺少保留原 ID 的原子转组入口');
  const original = await source();
  const beforeImages = (await snapshot()).images;
  const converted = await db.convertIndependentSystemToGroup(original.id, { ...original.meta, systemName: '原系统、新系统' }, original.updatedAt, await db.getDefaultPreset());
  assert(converted.length === 2 && converted[0].id === original.id, '首个系统保留原 ID');
  const current = await db.loadProject(original.id, { migrateLegacy: false });
  equal(current.assets, original.assets, '原检查项/图片/备注完整保留'); equal(current.categories, original.categories, '原分类保留'); equal(current.profile, original.profile, '原报告配置保留');
  assert(current.createdAt === original.createdAt && current.groupId, '创建时间保留且真实 groupId');
  const added = await db.loadProject(converted[1].id, { migrateLegacy: false });
  assert(added.meta.systemName === '新系统' && added.assets.length === 0 && added.groupId === current.groupId, '新增成员空白且同组');
  equal((await snapshot()).images, beforeImages, '图片 store 字节与主键不变');
  const grouped = (await db.listProjectGroups()).find(row => row.id === current.groupId);
  equal(grouped.systems.map(row => row.id).sort(), [original.id, added.id].sort(), '组/摘要/文档一致');
  assert(await db.resolveImageData(original.id, current.assets[0].items[0].images[1]) === pixel, '原 projectId 仍可读外部图片');
  assert(getPendingWriteCount() === 0, '成功释放 pendingWrites');
  return '原生 IDB 原子转组：原 ID/全部证据/图片键保留、新成员空白、组和摘要一致';
}
export async function failures() {
  for (const stage of ['put','abort','timeout','stale','grouped','archived','missing','empty','duplicate']) {
    const original = await source(`失败-${stage}`);
    if (stage === 'grouped') await raw(['projects'], tx => tx.objectStore('projects').put({ ...original, groupId: 'someone-else' }));
    if (stage === 'archived') await raw(['projects'], tx => tx.objectStore('projects').put({ ...original, archive: { archivedAt: 1 } }));
    if (stage === 'missing') await raw(['projects'], tx => tx.objectStore('projects').delete(original.id));
    const before = await snapshot(); const put = IDBObjectStore.prototype.put; const schedule = window.setTimeout;
    let expire;
    if (stage === 'timeout') window.setTimeout = function (callback, delay, ...args) { if (delay === 120000) expire = callback; return schedule(callback, delay, ...args); };
    if (['put','abort','timeout'].includes(stage)) IDBObjectStore.prototype.put = function (...args) { if (this.name === 'projectSummaries') { assert(getPendingWriteCount() > 0, '转组事务期间写入受追踪'); if (stage === 'put') throw new Error('受控转组写入失败'); if (stage === 'timeout') { assert(expire, '实际事务超时回调已安装'); expire(); } else this.transaction.abort(); } return put.apply(this, args); };
    let rejected = false;
    try { await db.convertIndependentSystemToGroup(original.id, { ...original.meta, systemName: stage === 'empty' ? '、' : stage === 'duplicate' ? '甲、甲' : '甲、乙' }, stage === 'stale' ? -1 : original.updatedAt, await db.getDefaultPreset()); }
    catch { rejected = true; }
    finally { IDBObjectStore.prototype.put = put; window.setTimeout = schedule; }
    assert(rejected, `${stage} 必须拒绝`); equal(await snapshot(), before, `${stage} 无半写或原证据变化`); assert(getPendingWriteCount() === 0, `${stage} 释放 pendingWrites`);
  }
  const repeated = await source('并发转组');
  const results = await Promise.allSettled([1,2].map(() => db.convertIndependentSystemToGroup(repeated.id, { ...repeated.meta, systemName: '并发原系统、并发新增' }, repeated.updatedAt, { version: 1, name: '测试', categories: repeated.categories, profile: repeated.profile })));
  assert(results.filter(result => result.status === 'fulfilled').length === 1, '并发重复提交仅一次成功');
  assert((await db.listProjects()).filter(row => row.meta.systemName === '并发新增').length === 1, '并发提交不重复建系统');
  return '转组写失败/abort/超时/陈旧/已转组/归档/缺失/空名/重复：原子拒绝；并发仅成功一次';
}
async function tab(kind) { document.querySelectorAll('nav[aria-label="项目分类"] button')[kind === 'groups' ? 0 : 1].click(); await pause(80); }
async function openCreate(kind) { await tab(kind); await click('新建项目'); await until(() => button('保存', dialog()) && !button('保存', dialog()).disabled, '可用新建表单'); }
const type = value => dialog().querySelector(`input[type=radio][value="${value}"]`);
export async function integrationFlow() {
  const original = await source('连续验收原系统', assessmentPreset);
  original.profile.reportTitle = '连续验收报告'; original.categories[0].defaultItems[0].label = '连续验收自定义检查项'; original.updatedAt = 5000;
  await db.saveProject(original);
  await raw(['settings'], tx => tx.objectStore('settings').clear());
  window.location.hash = `/project/${original.id}`; await until(() => button('返回项目列表'), '联合验收打开原系统'); await click('返回项目列表');
  await until(() => button('沿用最近等保模板', dialog()), '同库全等保背景引导');
  await click('沿用最近等保模板', dialog()); await until(() => !dialog(), '同库确认默认');
  const chosen = await db.getDefaultPreset(); equal(chosen.categories, original.categories, '采用当前旧库自定义分类快照'); equal(chosen.profile, original.profile, '采用同一报告配置');
  await openCreate('groups'); assert(dialog().querySelector('[value=group]').checked, '联合验收组页默认组'); input(fields()[2], '联合验收单位'); input(fields()[4], '连续单成员'); await click('保存', dialog()); await until(() => !dialog(), '联合验收单成员提交');
  const one = (await db.listProjects()).find(row => row.meta.systemName === '连续单成员'); const oneDoc = await db.loadProject(one.id, { migrateLegacy: false });
  assert(one.groupId && (await db.listProjects()).filter(row => row.groupId === one.groupId).length === 1, '选定模板创建真实单成员组'); equal(oneDoc.categories, chosen.categories, '单成员组沿用选定分类'); equal(oneDoc.profile, chosen.profile, '单成员组沿用选定配置'); assert(oneDoc.assets.length === 0, '旧证据未进入新组成员');
  await tab('independent'); await edit(original.id); input(fields()[4], '连续验收原系统、连续验收新增'); await pause(25); const beforeConvert = await db.loadProject(original.id, { migrateLegacy: false }); await click('保存', dialog()); await until(() => !dialog() && document.querySelector(`[data-system-id="${original.id}"]`)?.closest('[data-group-id]'), '联合验收带证据转组定位');
  const converted = await db.loadProject(original.id, { migrateLegacy: false }); const members = (await db.listProjects()).filter(row => row.groupId === converted.groupId); const added = await db.loadProject(members.find(row => row.id !== original.id).id, { migrateLegacy: false });
  equal(converted.assets, beforeConvert.assets, '同一原系统转组前后证据不变'); equal(converted.categories, chosen.categories, '转组保留自定义模板'); equal(added.categories, chosen.categories, '新增成员使用已确认模板'); assert(added.assets.length === 0, '新增成员无旧证据');
  const snapshot = await buildGroupSnapshot({ groupId: converted.groupId }); equal(snapshot.systems.map(system => system.projectId).sort(), members.map(row => row.id).sort(), '转换产物组级采集只包含这两个成员'); assert(snapshot.systems.find(system => system.projectId === original.id).assets[0].items[0].imageCount === 2, '采集保留原证据张数');
  let exported; let encrypted; const urls = new Map(); const createUrl = URL.createObjectURL; const clickAnchor = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = function (blob) { const url = createUrl.call(this, blob); urls.set(url, blob); return url; };
  HTMLAnchorElement.prototype.click = function () { if (this.download.endsWith('.zip')) exported = urls.get(this.href); else if (this.download.endsWith('.evidence')) encrypted = urls.get(this.href); else clickAnchor.call(this); };
  try { await exportDataPackage(converted.meta, converted.categories, converted.assets, converted.id, converted.profile); await exportEncryptedDataPackage(converted.meta, converted.categories, converted.assets, 'joint-qa-password', converted.id, converted.profile); }
  finally { URL.createObjectURL = createUrl; HTMLAnchorElement.prototype.click = clickAnchor; }
  assert(exported instanceof Blob, '同一转换产物走实际单包导出'); const zip = await JSZip.loadAsync(exported); const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  equal(manifest.profile, chosen.profile, '转组单包配置'); equal(manifest.categories.map(({ assets, ...category }) => category), converted.categories, '转组单包模板'); assert(!('groupId' in manifest), '维持旧单包不携带组归属语义');
  for (const image of manifest.categories.flatMap(category => category.assets).flatMap(asset => asset.items).flatMap(item => item.images)) assert(btoa(await zip.file(image.path).async('binarystring')) === pixel.split(',')[1], '转组导出每张图片字节相同');
  const imported = await importDataPackage(exported, 'overwrite', [], [], converted.meta); assert(imported.success, imported.message);
  assert(encrypted instanceof Blob, '同一转换产物生成实际加密包'); const encryptedImport = await importEncryptedDataPackage(encrypted, 'joint-qa-password', 'overwrite', [], [], converted.meta); assert(encryptedImport.success, encryptedImport.message); equal(encryptedImport.data, imported.data, '同一转换产物 ZIP/加密包恢复内容相同');
  const restored = { ...db.createProjectDocument(), ...imported.data }; await db.saveProjectWithImages(restored);
  const hydrated = await db.hydrateProjectImages(await db.loadProject(restored.id, { migrateLegacy: false })); const image = new Image(); image.src = hydrated.assets[0].items[0].images[0].data; await image.decode(); assert(image.naturalWidth === 1, '同一转组单包实际导入后原图可解码');
  window.location.hash = `/project/${original.id}`; await until(() => document.querySelector('aside'), '同一转组系统检查灰色示例');
  const name = await openAssetInput('物理环境'); assert(name.value === '' && name.placeholder.includes('xx机房'), '同一转换产物显示分类示例但不填实际值');
  await until(() => [...document.querySelectorAll('img')].some(img => img.complete && img.naturalWidth === 1), '同一转换产物工作台显示原图');
  await click('返回项目列表'); await until(() => document.querySelector('[aria-busy=false]'), '联合验收回列表'); await db.saveDefaultPreset(DEFAULT_PRESET);
  return '连续同库：进入列表引导→接受旧模板→单成员组→带原图转组→组采集范围→ZIP/加密包导出/导入/图片解码→灰色示例';
}
export async function typesUi() {
  await openCreate('groups');
  assert(type('group')?.checked && type('independent') && dialog().querySelectorAll('input[type=radio]').length === 2, '组列表默认系统组，提供两个原生单选');
  input(fields()[4], '组内唯一成员'); await pause(30); await click('保存', dialog()); await until(() => !dialog(), '单成员组保存');
  let created = (await db.listProjects()).find(row => row.meta.systemName === '组内唯一成员'); assert(created?.groupId, '只填一个名称也是真实组');
  assert(document.querySelector(`[data-group-id="${created.groupId}"] [data-system-id="${created.id}"]`), '单成员组自动展开定位');
  await openCreate('independent'); assert(type('independent')?.checked, '独立列表默认单系统');
  input(fields()[4], '单一甲、单一乙'); await pause(30); await click('保存', dialog());
  assert(dialog() && dialog().querySelector('[aria-invalid=true]') && fields()[4].value === '单一甲、单一乙', '单系统多名阻止提交并保留输入');
  type('group').click(); await pause(30); await click('保存', dialog()); await until(() => !dialog(), '手动切组保存');
  const rows = (await db.listProjects()).filter(row => ['单一甲','单一乙'].includes(row.meta.systemName)); assert(rows.length === 2 && rows[0].groupId && rows[0].groupId === rows[1].groupId, '显式切换后生成两成员组');
  await openCreate('groups'); type('independent').click(); input(fields()[4], '显式独立'); await pause(30); await click('保存', dialog()); await until(() => !dialog(), '组页显式独立保存');
  created = (await db.listProjects()).find(row => row.meta.systemName === '显式独立'); assert(created && !created.groupId && document.querySelector(`[data-system-id="${created.id}"]`), '组页切单系统后定位独立页');
  return '双页默认类型、单成员组、单系统多名保留输入、双向显式切换与正确落点';
}
async function edit(id) { const row = document.querySelector(`[data-system-id="${id}"]`); assert(row, '编辑源可见'); row.querySelector('summary').click(); await pause(30); await click('编辑', row); await until(() => button('保存', dialog()) && !button('保存', dialog()).disabled, '编辑表单'); }
export async function conversionUi() {
  const original = await source('界面原系统');
  window.location.hash = `/project/${original.id}`; await until(() => button('返回项目列表'), '进入源工作台'); await click('返回项目列表'); await until(() => document.querySelector('[aria-busy=false]'), '列表重读');
  const latest = await db.loadProject(original.id, { migrateLegacy: false });
  await tab('independent'); await edit(original.id); input(fields()[4], '原 系统'); await pause(30); await click('保存', dialog()); await until(() => !dialog(), '含空格名称保存');
  assert(!(await db.loadProject(original.id, { migrateLegacy: false })).groupId, '单个名称内空格不转组');
  await edit(original.id); input(fields()[4], '原 系统，界面新增'); await pause(30);
  const before = await snapshot(); const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) { if (mode === 'readwrite') throw new Error('受控转组事务失败'); return transaction.call(this, names, mode, ...args); };
  try { await click('保存', dialog()); assert(dialog() && fields()[4].value === '原 系统，界面新增', '失败保持输入'); equal(await snapshot(), before, '界面失败未改库'); }
  finally { IDBDatabase.prototype.transaction = transaction; }
  await click('保存', dialog()); await until(() => !dialog(), '转组重试成功');
  const current = await db.loadProject(original.id, { migrateLegacy: false }); assert(current.groupId, '编辑追加实际转组');
  equal(current.assets, latest.assets, '界面转组原证据保留');
  assert(document.querySelector(`[data-group-id="${current.groupId}"] [data-system-id="${original.id}"]`), '转组后展开并定位原系统');
  await edit(original.id); input(fields()[0], '组内改名'); await pause(30); await click('保存', dialog()); await until(() => !dialog(), '组内改名保存');
  assert((await db.loadProject(original.id, { migrateLegacy: false })).groupId === current.groupId, '组内编辑不造新组');
  const hydrated = await db.hydrateProjectImages(await db.loadProject(original.id, { migrateLegacy: false }));
  for (const image of hydrated.assets[0].items[0].images) { const img = new Image(); img.src = image.data; await img.decode(); assert(img.naturalWidth === 1, '转组后每张图片实际解码'); }
  return '真实编辑：空格不转组、失败保留输入与库、重试转组定位、组内改名不造组、原图片实际解码';
}
export async function refreshFailureUi() {
  const original = await source('刷新失败原系统');
  window.location.hash = `/project/${original.id}`; await until(() => button('返回项目列表'), '刷新失败源工作台'); await click('返回项目列表'); await until(() => document.querySelector('[aria-busy=false]'), '刷新失败列表');
  await tab('independent'); await edit(original.id); input(fields()[4], '刷新失败原系统、刷新失败新增'); await pause(30);
  const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (names, mode, ...args) { if ((Array.isArray(names) ? names : [names]).includes('projectGroups') && mode === 'readonly') throw new Error('转组后列表刷新失败'); return transaction.call(this, names, mode, ...args); };
  try { await click('保存', dialog()); await until(() => !dialog() && document.body.textContent.includes('转组后列表刷新失败'), '提交成功但刷新失败'); assert((await db.listProjects()).filter(row => row.meta.systemName === '刷新失败新增').length === 1, '刷新失败时转组已且仅已提交一次'); }
  finally { IDBDatabase.prototype.transaction = transaction; }
  await click('重试');
  await until(() => document.querySelector(`[data-system-id="${original.id}"]`)?.closest('[data-group-id]'), '只重读并定位组');
  assert((await db.listProjects()).filter(row => row.meta.systemName === '刷新失败新增').length === 1, '刷新重试不重复创建成员');
  return '转组实际提交后刷新失败：表单关闭、重试只定位、不重复创建';
}
async function openAssetInput(categoryName) {
  const toggle = [...document.querySelectorAll('aside button[title]')].find(el => el.title === categoryName);
  assert(toggle, `分类入口：${categoryName}`);
  const root = toggle.closest('div.border-b');
  if (!root.querySelector('input[placeholder]')) { toggle.click(); await pause(25); }
  const add = root.querySelector('button[title="添加资产"], button[title="添加材料"]');
  add.click(); await pause(25);
  if (!root.querySelector('input[placeholder]')) { toggle.click(); await pause(25); }
  const field = root.querySelector('input[placeholder]'); assert(field, '展开名称输入'); return field;
}
export async function assetExamples() {
  const doc = db.createProjectDocument({ systemName: '资产示例测试', unitName: '测试单位' }, null, assessmentPreset);
  doc.categories[0].name = '重命名机房分类';
  doc.categories.push({ id: 'unknown-category', name: '自定义补充', type: 'checklist', order: 9, defaultItems: [] });
  await db.saveProject(doc); window.assetExampleProject = doc.id;
  await db.saveDefaultPreset(DEFAULT_PRESET);
  window.location.hash = `/project/${doc.id}`; await until(() => document.querySelector('aside'), '等保资产侧栏');
  const expected = [['重命名机房分类','xx机房'],['网络设备','xx交换机'],['安全设备','xx防火墙'],['主机设备','xx服务器'],['系统管理软件','xx数据库'],['应用系统','xx应用系统'],['管理层面','xx管理制度'],['其他','xx资产']];
  for (const [name, example] of expected) {
    const field = await openAssetInput(name);
    assert(field.placeholder.includes(example), `${name} 应有 ${example} 示例，实际 ${field.placeholder}`);
    assert(field.value === '', `${name} 示例不是输入值`);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await pause(25);
    assert((await db.loadProject(doc.id, { migrateLegacy: false })).assets.length === 0, '空输入 Enter 不创建示例资产');
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause(25);
  }
  const unknown = await openAssetInput('自定义补充'); assert(!unknown.placeholder.includes('xx'), '未知分类保留原回退'); unknown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause(25);
  const blank = await openAssetInput('重命名机房分类'); blank.blur(); await pause(25); assert(!document.querySelector('aside input[placeholder]'), '空输入失焦关闭且不创建');
  const draft = await openAssetInput('重命名机房分类'); input(draft, '尚未确认的机房'); await pause(25); draft.blur(); await pause(25); assert(draft.isConnected && draft.value === '尚未确认的机房', '非空失焦保留未确认输入'); draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause(25); assert((await db.loadProject(doc.id, { migrateLegacy: false })).assets.length === 0, '取消未确认输入不生成资产');
  const field = await openAssetInput('网络设备'); input(field, '实际核心交换机'); await pause(25); field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await until(async () => (await db.loadProject(doc.id, { migrateLegacy: false })).assets.length === 1, '用户实际名称保存');
  const saved = await db.loadProject(doc.id, { migrateLegacy: false }); assert(saved.assets[0].name === '实际核心交换机' && saved.assets[0].items.length === 10, '仅创建实际名称并继承十项网络检查项');
  const generic = db.createProjectDocument({ systemName: '通用示例回退' }); await db.saveProject(generic); await db.saveDefaultPreset(assessmentPreset);
  await click('返回项目列表'); await until(() => document.querySelector('[aria-busy=false]'), '回列表切项目'); window.location.hash = `/project/${generic.id}`; await until(() => document.querySelector('aside'), '通用侧栏');
  const fallback = await openAssetInput('通用分类'); assert(!fallback.placeholder.includes('xx'), '即使全局默认是等保，通用项目不显示等保示例');
  await click('返回项目列表'); await until(() => document.querySelector('[aria-busy=false]'), '资产示例验证后回列表');
  return '八分类灰色示例、改名分类、切全局默认、未知/通用回退、空 Enter 不建资产与实际名称创建';
}
export async function prepareAssetLayout() {
  if (dialog()) await click('取消', dialog());
  window.location.hash = `/project/${window.assetExampleProject}`; await until(() => document.querySelector('aside'), '示例截图侧栏');
  await openAssetInput('重命名机房分类'); return '灰色机房示例已准备';
}
export async function finishAssetLayout() {
  assert((await db.loadProject(window.assetExampleProject, { migrateLegacy: false })).assets.length === 1, '真实 Enter 空输入不增加示例资产');
  await click('返回项目列表'); await until(() => document.querySelector('[aria-busy=false]'), '截图后返回列表');
  return '真实 Enter 空输入不创建示例资产，实际资产仍仅一条';
}
export async function assetLayout() { const toggle = button('分类导航'); if (toggle?.getClientRects().length && !document.querySelector('[data-workspace-navigation][aria-modal=true]')) { toggle.click(); await until(() => document.querySelector('[data-workspace-navigation][aria-modal=true]'), '窄屏示例导航'); } await pause(80); const field = document.querySelector('aside input[placeholder]'); assert(field?.value === '' && field.placeholder.includes('xx机房'), '截图为真实空值和灰色机房示例'); const rect = field.getBoundingClientRect(); assert(rect.left >= 0 && rect.right <= innerWidth, '名称输入框在视口内'); return '机房灰色示例可见且输入为空'; }
export async function prepareLayout() { for (const close of document.querySelectorAll('button[aria-label="关闭提示"]')) close.click(); await pause(40); if (dialog()) await click('取消', dialog()); await openCreate('groups'); input(fields()[4], '截图系统'); await pause(30); return '类型表单已准备'; }
export function layout() { assert(document.documentElement.scrollWidth <= innerWidth, '类型表单无水平溢出'); for (const radio of dialog().querySelectorAll('input[type=radio]')) assert(radio.closest('label')?.getBoundingClientRect().height >= 44, '原生类型标签触控高度'); return '类型单选表单布局与触控目标'; }
export function focusType() { type('independent').focus(); }
export function selectedType() { return dialog().querySelector('input[type=radio]:checked')?.value; }
export async function afterReload() {
  await until(() => document.querySelector('[aria-busy=false]'), '重载摘要'); await tab('groups');
  const single = (await db.listProjects()).find(row => row.meta.systemName === '组内唯一成员'); assert(single?.groupId && document.querySelector(`[data-group-id="${single.groupId}"]`), '重载后单成员组仍在组页');
  const original = (await db.listProjects()).find(row => row.meta.systemName === '组内改名'); assert(original?.groupId && document.querySelector(`[data-group-id="${original.groupId}"]`), '重载后转组持久化');
  return '真实重载后单成员组和转组归属持久化';
}

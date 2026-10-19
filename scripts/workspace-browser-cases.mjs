import * as db from '../src/utils/db';
import assessment from '../presets/dengbao.json';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
export async function until(check, label) {
  for (let n = 0; n < 120; n++) { if (await check()) return; await pause(50); }
  throw new Error(`等待超时：${label}；${document.body.innerText.slice(-1000)}`);
}
export const button = (text, root = document) => [...root.querySelectorAll('button')].find(el => el.textContent.trim() === text);
const input = (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
const picture = (() => {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 160;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 240, 160); ctx.fillStyle = '#38bdf8'; ctx.fillRect(16, 16, 208, 72); ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('QA evidence', 32, 126); return canvas.toDataURL('image/png');
})();
const longName = '业务交换机-' + 'LongUnbrokenAssetName'.repeat(5);
export async function seed() {
  await db.completeLegacyPresetOnboarding(null);
  const doc = db.createProjectDocument({ projectName: '窄屏工作台验收项目-' + 'LongProjectName'.repeat(6), unitName: '隔离测试单位', systemName: '网络系统' }, null, assessment);
  doc.id = 'workspace-qa';
  doc.assets = [
    { id: 'workspace-first', categoryId: 'cat-network', name: '核心交换机', items: [{ id: 'workspace-item', label: '设备与端口状态', required: true, images: [{ id: 'workspace-image', fileName: 'qa.png', caption: '原始图片备注', createdAt: 1, data: picture }] }] },
    { id: 'workspace-second', categoryId: 'cat-network', name: longName, items: [] },
  ];
  await db.saveProject(doc);
  const empty = db.createProjectDocument({ systemName: '空白系统' }, null, assessment); empty.id = 'workspace-empty'; await db.saveProject(empty);
  localStorage.setItem('evidence-image-migration-v5', JSON.stringify({ completed: [doc.id, empty.id], damaged: [] }));
  window.location.hash = '/project/workspace-qa';
  await until(() => document.querySelector('aside') && document.querySelector('main h2'), '工作台装配');
}
export async function geometry() {
  await pause(100);
  const width = innerWidth;
  const main = document.querySelector('main');
  const header = document.querySelector('header');
  const bounds = main.getBoundingClientRect();
  assert(width >= 1024 || bounds.width >= width - 2, `分类栏挤压正文：窗口 ${width}px，正文仅 ${bounds.width}px`);
  for (const el of [document.documentElement, document.body, main, header]) assert(el.scrollWidth <= el.clientWidth + 1, `${el.tagName} 横向溢出：${el.scrollWidth} > ${el.clientWidth}`);
  for (const el of header.querySelectorAll('button')) {
    if (!el.getClientRects().length) continue;
    const rect = el.getBoundingClientRect();
    assert(rect.left >= 0 && rect.right <= width + 1, `工具按钮越界：${el.textContent}`);
    assert(getComputedStyle(el).whiteSpace === 'nowrap', `工具按钮文字被拆行：${el.textContent}`);
    assert(width >= 1280 || rect.height >= 44, `窄屏点击区域不足：${el.textContent}`);
  }
  const customItem = main.querySelector('input[placeholder="添加自定义检查项..."]');
  if (width < 640 && customItem) assert(customItem.getBoundingClientRect().width >= main.clientWidth * 0.75, '窄屏检查项名称输入框被操作按钮挤压');
  assert(bounds.height >= 160, `正文高度不足：${bounds.height}`);
  assert((width < 1024) === !![...header.querySelectorAll('button')].find(el => el.textContent.trim() === '分类导航' && el.getClientRects().length), '分类开关与断点一致');
  return `${width}px 正文宽度 ${Math.round(bounds.width)}px，无页面/正文/工具栏横向溢出`;
}
export async function selectLongAsset() {
  const toggle = button('分类导航'); if (toggle?.getClientRects().length) toggle.click();
  await until(() => document.querySelector('aside span[title="核心交换机"]')?.getClientRects().length, '可见分类导航');
  const target = [...document.querySelectorAll('aside span[title]')].find(el => el.title === longName);
  target.closest('button')?.click();
  await until(() => document.querySelector('main h2')?.textContent === longName, '切换长名称资产');
  return '长英文资产名可完整折行';
}
export async function prepareNavigation() {
  const toggle = button('分类导航'); assert(toggle && toggle.getClientRects().length, '窄屏分类导航入口'); toggle.focus();
}
export function navigationOpen() { return !!document.querySelector('[data-workspace-navigation][aria-modal="true"]'); }
export function focusAsset() { document.querySelector('aside span[title="核心交换机"]').closest('button').focus(); }
export async function checkImage() {
  await until(() => document.querySelector('main h2')?.textContent === '核心交换机', '选择资产后正文更新');
  await until(() => [...document.querySelectorAll('main img')].some(img => img.complete && img.naturalWidth > 0), '原证据图片解码');
  assert(!navigationOpen(), '选择资产后关闭导航');
  return '选择资产回到正文，原图片正常解码';
}
export async function checkData() {
  const doc = await db.loadProject('workspace-qa');
  const item = doc.assets.find(asset => asset.id === 'workspace-first').items.find(item => item.id === 'workspace-item');
  assert(item.label === '设备与端口状态' && item.required && item.images[0].caption === '原始图片备注', '响应式切换不改原检查项/备注');
  assert(await db.resolveImageData(doc.id, item.images[0]) === picture, '响应式切换不改图片字节');
  return '原项目 ID、检查项和图片字节保持';
}
export function navigationMetrics() {
  const panel = document.querySelector('[data-workspace-navigation]'); assert(navigationOpen(), '检查可见导航');
  assert(panel.getBoundingClientRect().width <= innerWidth - 32 && panel.scrollWidth <= panel.clientWidth + 1, '导航在窄屏内且不横向溢出');
  for (const control of panel.querySelectorAll('button:not(:disabled)')) {
    if (!control.getClientRects().length) continue;
    const rect = control.getBoundingClientRect(); assert(rect.width >= 44 && rect.height >= 44, `导航触控区域不足：${control.title || control.getAttribute('aria-label') || control.textContent}`);
  }
  return '分类/资产/编辑/关闭入口均有至少 44px 点击区域';
}
export async function prepareRename() {
  const row = document.querySelector('aside span[title="核心交换机"]').closest('.group'); row.querySelector('button[title="重命名"]').click();
  await until(() => row.querySelector('input'), '资产重命名草稿'); input(row.querySelector('input'), '尚未确认的重命名'); await pause(50);
}
export async function checkRenameDraft() {
  assert(document.querySelector('aside input:not([placeholder])')?.value === '尚未确认的重命名', '跨断点不得提交或清除重命名草稿');
  await pause(550);
  assert((await db.loadProject('workspace-qa')).assets.find(asset => asset.id === 'workspace-first').name === '核心交换机', '未确认重命名不得写入数据库');
  return '重命名草稿跨断点保持焦点，不触发失焦提交';
}
export async function prepareNested(long = false) {
  const target = document.querySelector(long ? `aside span[title="${longName}"]` : 'aside span[title="核心交换机"]');
  const remove = target.closest('.group').querySelector('button[title="删除"]'); remove.focus();
}
export function confirmGeometry() {
  const modal = document.querySelector('aside [role="dialog"]');
  const panel = modal?.firstElementChild;
  const message = panel?.querySelector('p');
  assert(panel && message, '长名称删除确认已打开');
  assert(message.scrollWidth <= message.clientWidth + 1, `确认正文横向溢出 ${message.scrollWidth}/${message.clientWidth}`);
  assert(panel.scrollWidth <= panel.clientWidth + 1, '确认面板无横向溢出');
  for (const target of panel.querySelectorAll('button')) {
    const rect = target.getBoundingClientRect();
    assert(rect.left >= 0 && rect.right <= innerWidth, '确认按钮在视口内');
  }
  return `${innerWidth}px 长英文名称确认正文可折行，按钮可操作`;
}
export function renameGeometry() {
  const field = document.querySelector('aside input:not([placeholder])');
  assert(field, '重命名输入框已打开');
  const panel = document.querySelector('aside');
  const rect = field.getBoundingClientRect();
  assert(panel.scrollWidth <= panel.clientWidth + 1 && rect.left >= 0 && rect.right <= panel.getBoundingClientRect().right, '重命名编辑态无横向溢出');
  return `${innerWidth}px 重命名编辑态保持面板边界`;
}
export async function checkNested(open = true) {
  await until(() => !!document.querySelector('aside [role="dialog"]') === open, open ? '内层确认打开' : '内层确认关闭');
  assert(navigationOpen(), '内层确认不误关导航');
  assert(open ? document.activeElement.textContent.trim() === '取消' : document.activeElement.title === '删除', '内层确认初始/返回焦点');
  return '内层确认可取消并返回原焦点，不提前关闭导航';
}
export async function prepareDraft() {
  const category = [...document.querySelectorAll('aside button[title]')].find(el => el.title === '网络设备');
  const root = category.closest('div.border-b'); root.querySelector('button[title="添加资产"]').click(); await pause(60);
  const field = root.querySelector('input[placeholder]'); assert(field?.placeholder.includes('xx交换机') && field.value === '', '导航内仍显示分类灰色示例而非实际名称');
  input(field, '跨断点保留的资产输入'); await pause(60);
}
export function checkDraft() {
  assert(document.querySelector('aside input[placeholder]')?.value === '跨断点保留的资产输入', '跨断点保留未提交资产名称');
  return '同一侧栏实例保留草稿';
}
export function rememberWidth() { window.workspaceWidth = document.querySelector('aside').getBoundingClientRect().width; window.workspaceStoredWidth = localStorage.getItem('sidebar-width'); }
export function checkDesktop() {
  const width = document.querySelector('aside').getBoundingClientRect().width;
  assert(width === window.workspaceWidth && localStorage.getItem('sidebar-width') === window.workspaceStoredWidth, '窄屏不能覆盖桌面宽度偏好');
  assert(!document.querySelector('[inert]'), '宽屏不存在遗留 inert');
  assert(!navigationOpen() && !button('分类导航').getClientRects().length, '宽屏恢复常驻侧栏');
  return `桌面侧栏 ${width}px 与宽度偏好保持，背景解锁`;
}
export async function createFromDraft() {
  await until(() => document.querySelector('main h2')?.textContent === '跨断点保留的资产输入', '真实新建资产');
  await until(async () => (await db.loadProject('workspace-qa')).assets.some(asset => asset.name === '跨断点保留的资产输入'), '新增资产实际落库');
  return '草稿可继续提交真实资产，未生成示例资产';
}
let templateConfirmState;
export async function prepareTemplateConfirm() {
  button('模板管理', document.querySelector('header')).click();
  await until(() => document.querySelector('[aria-labelledby="template-dialog-title"]'), '打开模板管理');
  const modal = document.querySelector('[aria-labelledby="template-dialog-title"]');
  input(modal.querySelector('input[placeholder]'), '确认框关闭后保留的草稿');
  await pause(50);
  const remove = modal.querySelector('button[title="删除"]');
  templateConfirmState = { count: modal.querySelectorAll('button[title="删除"]').length, remove };
  assert(remove, '存在可删除的默认检查项'); remove.focus();
}
export async function checkTemplateConfirm(removed = false) {
  await until(() => !document.querySelector('[role="dialog"] [role="dialog"]'), '内层删除确认关闭');
  const modal = document.querySelector('[aria-labelledby="template-dialog-title"]');
  assert(modal, '关闭删除确认不能同时关闭模板管理');
  assert(modal.querySelector('input[placeholder]').value === '确认框关闭后保留的草稿', '保留未提交的模板输入');
  assert(modal.querySelectorAll('button[title="删除"]').length === templateConfirmState.count - (removed ? 1 : 0), removed ? '确认删除只移除一条默认项' : '取消删除不改变默认项');
  if (!removed) assert(document.activeElement === templateConfirmState.remove, '取消后焦点回到原删除按钮');
  button('取消', modal).click();
  await until(() => !document.querySelector('[role="dialog"]'), '模板管理仍可独立关闭');
  return removed ? '确认删除只移除目标默认项，模板窗口和输入保留' : '取消删除保留模板窗口、默认项、输入和触发焦点';
}
export async function toolbarDialogs() {
  for (const name of ['项目信息', '模板管理', '另存为预设']) {
    button(name, document.querySelector('header')).click();
    await until(() => document.querySelector('[role="dialog"] h2')?.textContent === name, `工作台${name}入口`);
    const modal = document.querySelector('[role="dialog"]');
    const cancel = button('取消', modal) || button('关闭', modal) || modal.querySelector('button[aria-label^="关闭"]');
    assert(cancel, `${name}可取消`); cancel.click(); await until(() => !document.querySelector('[role="dialog"]'), '关闭工作台设置');
  }
  return '项目信息、模板管理与另存预设入口保持可用';
}
export async function createItem() {
  const field = document.querySelector('main input[placeholder="添加自定义检查项..."]'); input(field, '窄屏新增检查项'); await pause(50); button('添加', document.querySelector('main')).click();
  await until(async () => (await db.loadProject('workspace-qa')).assets.find(asset => asset.id === 'workspace-first').items.some(item => item.label === '窄屏新增检查项'), '检查项新增实际落库');
  return '窄屏填写并提交新检查项，实际落库';
}
export async function emptyWorkspace() {
  window.location.hash = '/project/workspace-empty';
  await until(() => document.querySelector('main')?.textContent.includes('请从左侧'), '空工作台');
  assert(!document.querySelector('[inert]'), '切系统不遗留 inert');
  const main = document.querySelector('main'); assert(main.getBoundingClientRect().width >= innerWidth - 1 && main.scrollWidth <= main.clientWidth + 1, '空工作台正文不被侧栏挤压');
  return '空工作台导航入口可见，正文无横向溢出';
}
export { input, pause, assert };

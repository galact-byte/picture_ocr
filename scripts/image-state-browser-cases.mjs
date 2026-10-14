import { DEFAULT_PRESET } from '../src/utils/preset';
import { buildStoredImage, imageRecordKey } from '../src/utils/imageStore';
export { until } from './project-list-browser-cases.mjs';
import { until } from './project-list-browser-cases.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const projectId = 'image-state-fixture';
const ids = ['healthy', 'missing', 'read-error', 'broken', 'slow'];
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const reference = id => ({ id, fileName: `${id}.png`, mimeType: 'image/png', caption: `image-case-${id}`, uploadedAt: '2026-10-13T00:00:00Z' });
const connect = () => new Promise((resolve, reject) => { const request = indexedDB.open('evidence-collector-db'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
export async function seed() {
  const db = await connect();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'projectSummaries', 'images'], 'readwrite');
    const meta = { projectName: '', systemName: '图片状态回归', projectCode: '', unitName: '', reportDate: '' };
    const categories = [{ id: 'image-room', name: '检查分类', type: 'checklist', order: 1, defaultItems: [{ id: 'image-check', label: '状态检查', required: true }] }];
    const doc = { id: projectId, meta, profile: DEFAULT_PRESET.profile, categories, assets: [{ id: 'image-asset', categoryId: 'image-room', name: '状态测试资产', order: 1, items: [{ id: 'image-check', label: '状态检查', required: true, images: ids.map(reference) }] }], createdAt: 1, updatedAt: 1 };
    tx.objectStore('projects').put(doc);
    tx.objectStore('projectSummaries').put({ id: projectId, meta, profile: DEFAULT_PRESET.profile, assetCount: 1, createdAt: 1, updatedAt: 1 });
    for (const id of ['healthy', 'broken', 'slow']) tx.objectStore('images').put(buildStoredImage(projectId, { ...reference(id), data: id === 'broken' ? 'data:image/png;base64,broken' : png }));
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
  });
  db.close();
  localStorage.setItem('evidence_image_migration_v1', JSON.stringify({ completedIds: [projectId], damagedIds: [] }));
}
export function instrument() {
  const original = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function(key) {
    const request = original.call(this, key);
    if (this.name === 'images' && String(key) === imageRecordKey(projectId, 'read-error')) this.transaction.abort();
    if (this.name === 'images' && String(key) === imageRecordKey(projectId, 'slow')) {
      Object.defineProperty(request, 'onsuccess', { configurable: true, set: callback => request.addEventListener('success', event => setTimeout(() => callback.call(request, event), 900)) });
    }
    return request;
  };
}
const thumbnail = id => [...document.querySelectorAll('p')].find(element => element.textContent === `image-case-${id}`)?.closest('.group');
const viewer = () => document.querySelector('[aria-label="图片预览"]');
export async function desktop() {
  window.location.hash = `/project/${projectId}`;
  await until(() => thumbnail('slow'), '图片工作台');
  assert(thumbnail('slow').textContent.includes('加载中'), '真实读取未完成时保留加载状态');
  thumbnail('slow').querySelector('[title="放大查看"]').click();
  await until(() => viewer()?.textContent.includes('加载中'), '预览仍在读取');
  viewer().querySelector('[aria-label="上一张"]').click();
  await until(() => viewer()?.textContent.includes('image-case-broken') && viewer()?.textContent.includes('图片读取失败'), '读取未完成时换到损坏图片');
  await pause(1000);
  assert(viewer().textContent.includes('image-case-broken') && viewer().textContent.includes('图片读取失败') && !viewer().querySelector('img'), '上一张迟到的读取不得覆盖当前图片状态');
  viewer().querySelector('[aria-label="关闭图片预览"]').click();
  await until(() => thumbnail('missing')?.textContent.includes('图片缺失') && thumbnail('read-error')?.textContent.includes('读取失败') && thumbnail('broken')?.textContent.includes('读取失败'), '缩略图缺失、读取异常和解码失败');
  await until(() => thumbnail('healthy')?.querySelector('img')?.naturalWidth > 0 && thumbnail('slow')?.querySelector('img')?.naturalWidth > 0, '健康图片与慢读取图片真实解码');
  thumbnail('missing').querySelector('[title="放大查看"]').click();
  await until(() => viewer()?.textContent.includes('图片缺失'), '预览缺失');
  viewer().querySelector('[aria-label="下一张"]').click();
  await until(() => viewer()?.textContent.includes('图片读取失败'), '预览读取失败');
  viewer().querySelector('[aria-label="下一张"]').click();
  await until(() => viewer()?.textContent.includes('image-case-broken') && viewer()?.textContent.includes('图片读取失败'), '预览解码失败');
  for (let n = 0; n < 3; n++) {
    viewer().querySelector('[aria-label="上一张"]').click();
    await pause(100);
  }
  await until(() => viewer()?.querySelector('img[alt="healthy.png"]')?.naturalWidth > 0, '快速换图后正确健康图片');
  viewer().querySelector('[aria-label="关闭图片预览"]').click();
  return '真实工作台缩略图与预览：加载/缺失/读取失败/解码失败、健康图片与快速换图';
}
export async function mobile() {
  window.location.hash = `/mobile/${projectId}`;
  await until(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('状态测试资产')), '手机资产');
  [...document.querySelectorAll('button')].find(button => button.textContent.includes('状态测试资产')).click();
  await until(() => document.querySelector('img[alt="healthy.png"]')?.naturalWidth > 0, '手机健康图片');
  await until(() => document.body.textContent.includes('图片缺失') && document.body.textContent.includes('读取失败'), '手机明确缺失与读取失败');
  await pause(1100);
  assert(!document.body.textContent.includes('加载中'), '手机终态不永久加载');
  assert([...document.images].every(image => image.naturalWidth > 0), '手机不残留无法解码的 img');
  return '真实手机页：健康图片解码、缺失与读取/解码失败终态';
}

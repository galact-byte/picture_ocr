import { createDataPackageBlob, importDataPackage, importEncryptedDataPackage } from '../src/utils/exportImport';
import { createProjectDocument, loadProject, resolveImageData, saveProjectWithImages } from '../src/utils/db';
import { encryptEvidenceBlob } from '../src/utils/evidencePackage';

const check = (value, message) => { if (!value) throw new Error(message); };
const equal = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected), message);
const imagesOf = doc => doc.assets[0].items[0].images;
const payload = data => data?.slice(data.indexOf(',') + 1);
function pixel(color) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
  const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 2, 2);
  return canvas.toDataURL('image/png');
}
const image = (id, data) => ({ id, fileName: `${id}.png`, data, caption: `本地备注 ${id}`, uploadedAt: '2026-01-01T00:00:00Z' });
const seed = (id, images) => ({
  ...createProjectDocument({ systemName: id, unitName: '隔离回归' }), id,
  categories: [{ id: 'host', name: '服务器', type: 'checklist', order: 1, defaultItems: [] }],
  assets: [{ id: 'server', name: '原服务器', categoryId: 'host', items: [{ id: 'screen', label: '本地检查项', required: false, images }] }],
});
async function decode(projectId, ref) {
  const data = await resolveImageData(projectId, ref);
  check(data, `缺少图片字节：${ref.id}`);
  const img = new Image(); img.src = data; await img.decode();
  check(img.naturalWidth === 2, `图片无法解码：${ref.id}`);
  return data;
}
export async function run() {
  const results = [];
  const test = async (name, runCase) => {
    try { await runCase(); results.push({ name, ok: true }); }
    catch (error) { results.push({ name: `${name}: ${error.message}`, ok: false }); }
  };
  const original = pixel('red'); const incoming = pixel('blue');
  for (const encrypted of [false, true]) {
    await test(`${encrypted ? '加密包' : 'ZIP'}：缺字节同 ID 补齐、已有图片保留、重复导入不增图、重新连接后解码`, async () => {
      const doc = seed(`merge-${encrypted}`, [image('missing', undefined), image('empty', ''), image('stored', original), image('local-only', original)]);
      await saveProjectWithImages(doc);
      const loaded = await loadProject(doc.id);
      const before = JSON.stringify(loaded);
      const imported = seed('source', ['missing', 'empty', 'stored', 'new'].map(id => image(id, incoming)));
      imported.assets[0].items[0].label = '外部检查项'; imported.assets[0].items[0].required = true;
      for (const ref of imagesOf(imported)) ref.caption = '外部备注';
      const zip = await createDataPackageBlob(imported.meta, imported.categories, imported.assets, imported.profile);
      const file = new File([encrypted ? await encryptEvidenceBlob(zip, 'merge-test') : zip], encrypted ? 'merge.evidence' : 'merge.zip');
      const merge = target => encrypted
        ? importEncryptedDataPackage(file, 'merge-test', 'merge', target.assets, target.categories, target.meta, target.profile, target.id)
        : importDataPackage(file, 'merge', target.assets, target.categories, target.meta, target.profile, target.id);
      const result = await merge(loaded);
      check(result.success && result.data, result.message);
      equal(JSON.stringify(loaded), before, '合并不得修改传入的项目快照');
      const merged = { ...loaded, ...result.data };
      equal(imagesOf(merged).map(ref => ref.id), ['missing', 'empty', 'stored', 'local-only', 'new'], '引用位置与数量必须保留');
      equal(payload(imagesOf(merged)[0].data), payload(incoming), '同 ID 空引用必须补入图片字节');
      equal(imagesOf(merged)[0].caption, '本地备注 missing', '补图不能覆盖本地备注');
      check(merged.assets[0].items[0].label === '本地检查项' && !merged.assets[0].items[0].required, '保留检查项设置');
      await saveProjectWithImages(merged);
      let saved = await loadProject(doc.id);
      for (const ref of imagesOf(saved)) equal(payload(await decode(doc.id, ref)), payload(['stored', 'local-only'].includes(ref.id) ? original : incoming), '必须保留已有字节并补入缺图');
      const repeated = await merge(saved);
      check(repeated.success, repeated.message);
      await saveProjectWithImages({ ...saved, ...repeated.data });
      saved = await loadProject(doc.id);
      check(imagesOf(saved).length === 5, '重复导入不增加重复图片');
      for (const ref of imagesOf(saved)) await decode(doc.id, ref);
    });
  }
  await test('内联图片：有字节的同 ID 不覆盖，缺字节的同 ID 补齐', async () => {
    const target = seed('inline', [image('valid', original), image('missing', undefined)]);
    const imported = seed('source', [image('valid', incoming), image('missing', incoming)]);
    const zip = await createDataPackageBlob(imported.meta, imported.categories, imported.assets);
    const result = await importDataPackage(zip, 'merge', target.assets, target.categories, target.meta);
    check(result.success, result.message);
    equal(imagesOf(result.data).map(ref => payload(ref.data)), [payload(original), payload(incoming)], '只补没有字节的引用');
    equal(imagesOf(target)[1].data, undefined, '不修改输入');
  });
  await test('独立图片表读取失败：导入失败且目标库保持不变', async () => {
    const target = seed('read-failure', [image('missing', undefined)]);
    await saveProjectWithImages(target);
    const imported = seed('source', [image('missing', incoming)]);
    const zip = await createDataPackageBlob(imported.meta, imported.categories, imported.assets);
    const originalTransaction = IDBDatabase.prototype.transaction;
    let result;
    IDBDatabase.prototype.transaction = function(names, ...args) {
      if ([].concat(names).includes('images')) throw new Error('受控图片读取失败');
      return originalTransaction.call(this, names, ...args);
    };
    try { result = await importDataPackage(zip, 'merge', target.assets, target.categories, target.meta, target.profile, target.id); }
    finally { IDBDatabase.prototype.transaction = originalTransaction; }
    check(!result.success && result.message.includes('受控图片读取失败'), '读取失败不能当作图片缺失处理');
    check(!(await resolveImageData(target.id, imagesOf(await loadProject(target.id))[0])), '导入失败不得写库');
  });
  return { results };
}

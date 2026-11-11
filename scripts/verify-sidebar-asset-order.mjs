import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import vm from 'node:vm';

const bundle = buildSync({ entryPoints: ['src/context/appReducer.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const sandbox = { exports: {}, module: { exports: {} }, require() { throw new Error('Unexpected import'); }, crypto: { randomUUID: () => 'test-id' } };
vm.runInNewContext(bundle.outputFiles[0].text, sandbox);
const { appReducer, createInitialState } = sandbox.module.exports;
const assets = [
  { id: 'a', categoryId: 'network', name: 'A', items: [{ id: 'photo', images: [{ id: 'image', data: 'unchanged' }] }] },
  { id: 'material', categoryId: 'materials', name: 'M', items: [] },
  { id: 'b', categoryId: 'network', name: 'B', items: [] },
  { id: 'c', categoryId: 'network', name: 'C', items: [] },
];
const state = { ...createInitialState(), assets, categories: [{ id: 'network' }, { id: 'materials' }], activeCategoryId: 'network', activeAssetId: 'a' };
const reorder = (assetIds, categoryId = 'network') => appReducer(state, { type: 'REORDER_ASSETS', payload: { categoryId, assetIds } });
const next = reorder(['c', 'a', 'b']);
assert.deepEqual(Array.from(next.assets, asset => asset.id), ['c', 'material', 'a', 'b'], '分类内排序保持其他分类位置');
assert.equal(next.assets[2], assets[0], '检查项和图片对象不变');
assert.equal(next.assets[1], assets[1], '其他分类资产不变');
assert.equal(next.activeAssetId, 'a', '当前选择不变');
assert.equal(next.activeCategoryId, 'network');
assert.deepEqual(assets.map(asset => asset.id), ['a', 'material', 'b', 'c'], '不修改输入');
assert.equal(reorder(['a', 'b', 'c']), state, '顺序不变时不触发保存');
for (const ids of [['a', 'b'], ['a', 'a', 'c'], ['a', 'b', 'unknown'], ['a', 'b', 'material'], ['a', 'b', 'c', 'material'], []]) {
  assert.equal(reorder(ids), state, `拒绝无效或过期排列：${ids}`);
}
assert.equal(reorder(['material'], 'unknown'), state, '拒绝未知分类');
assert.equal(reorder(['material'], 'materials'), state, '单条材料不需要更新');
console.log('PASS 资产排序：完整排列、跨分类保护、过期输入、不可变性、当前选择及图片引用');

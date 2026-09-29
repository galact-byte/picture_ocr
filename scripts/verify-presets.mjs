import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export * from './src/utils/db'; export * from './src/context/appReducer'; export * from './src/utils/preset'; export { buildReportFileName } from './src/utils/wordExport';`, resolveDir: process.cwd() }, bundle: true, loader: { '.png': 'dataurl' }, write: false, format: 'esm', platform: 'node' });
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let failed = 0;
function test(name, fn) { try { fn(); console.log('PASS', name); } catch(e) { failed++; console.error('FAIL', name, e.message); } }
const preset = { version: 1, name: '巡检', categories: [{ id: 'room', name: '场所', type: 'checklist', order: 1, defaultItems: [{ id: 'photo', label: '照片', required: false }] }], profile: { reportTitle: '巡检报告', exportFilePrefix: '巡检', unitFieldLabel: '客户', unitFieldRequired: false } };
test('全新项目无示例资产且单位可选', () => { const d=api.createProjectDocument(); assert.equal(d.assets.length,0); assert.equal(d.profile?.unitFieldRequired,false); });
test('新项目采用传入预设且快照深拷贝', () => { const p=structuredClone(preset); const d=api.createProjectDocument({},null,p); p.categories[0].defaultItems[0].label='改变'; p.profile.reportTitle='改变'; assert.equal(d.categories[0].defaultItems[0].label,'照片'); assert.equal(d.profile.reportTitle,'巡检报告'); });
test('旧项目固定必填且明确空分类不回填', () => {const d=api.normalizeProjectDocument({categories:[],assets:[]}); assert.equal(d.profile?.unitFieldRequired,true); assert.equal(d.categories.length,0);});
test('加载、分类新增改名保留资产引用及模板', () => { let s=api.appReducer(api.createInitialState(),{type:'LOAD_PROJECT',payload:api.createProjectDocument({},null,preset)}); s=api.appReducer(s,{type:'ADD_ASSET',payload:{categoryId:'room',assetName:'房间'}}); const id=s.assets[0].id; s=api.appReducer(s,{type:'RENAME_CATEGORY',payload:{categoryId:'room',name:'楼层'}}); assert.equal(s.categories[0].name,'楼层'); assert.equal(s.assets[0].id,id); assert.equal(s.assets[0].categoryId,'room'); assert.equal(s.assets[0].items[0].label,'照片'); s=api.appReducer(s,{type:'ADD_CATEGORY',payload:{name:'新增',categoryType:'freestyle'}}); assert.equal(s.categories.length,2); assert.equal(s.categories[1].type,'freestyle'); const same=api.appReducer(s,{type:'ADD_CATEGORY',payload:{name:' ',categoryType:'checklist'}}); assert.equal(same,s); assert.equal(s.profile.reportTitle,'巡检报告'); });
test('旧文档直接加载仍使用固定兼容配置', () => { const doc=api.createProjectDocument(); delete doc.profile; assert.deepEqual(api.appReducer(api.createInitialState(),{type:'LOAD_PROJECT',payload:doc}).profile,api.LEGACY_PROFILE); });
test('Word 缺配置使用通用前缀，所有命名统一净化', () => { assert.equal(api.buildReportFileName({projectName:'',systemName:'系统'}),'系统_证据采集.docx'); assert.equal(api.sanitizeFileNamePart('CON.txt','回退'),'_CON.txt'); assert.equal(api.sanitizeFileNamePart(' ../a:*?  ','回退'),' .._a___'.trim()); });
test('预设校验拒绝错误版本、类型、顺序与重复 ID', () => { assert.deepEqual(api.parsePreset(preset),preset); for(const change of [p=>p.version=2,p=>p.profile.unitFieldRequired='false',p=>p.categories[0].type='other',p=>p.categories[0].order=0,p=>p.categories.push({...p.categories[0],order:2}),p=>p.categories[0].defaultItems.push({...p.categories[0].defaultItems[0]})]) {const p=structuredClone(preset);change(p);assert.throws(()=>api.parsePreset(p),/预设格式错误/);} assert.throws(()=>api.parsePreset(preset,1048577),/1 MiB/); });
test('序列化只输出模板白名单且拷贝不共享', () => {const p={...structuredClone(preset),assets:[{name:'秘密资产'}],meta:{unitName:'秘密单位'}};p.categories[0].secret='秘密';const text=api.serializePreset(p);assert(!text.includes('秘密'));assert.deepEqual(api.parsePreset(JSON.parse(text)),preset);});
test('预设拒绝超长名称/ID与跨分类重复模板 ID', () => {
  for (const change of [p=>p.name='x'.repeat(501),p=>p.categories[0].id='x'.repeat(501),p=>p.categories[0].defaultItems[0].id='x'.repeat(501),p=>p.categories.push({...structuredClone(p.categories[0]),id:'second',order:2})]) {
    const copy=structuredClone(preset);change(copy);assert.throws(()=>api.parsePreset(copy),/预设格式错误/);
  }
});
process.exitCode=failed?1:0;

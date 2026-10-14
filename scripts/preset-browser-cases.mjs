import * as db from '../src/utils/db';
import { DEFAULT_PRESET, LEGACY_PROFILE } from '../src/utils/preset';
import { buildDataPackageZip, importDataPackage, importEncryptedDataPackage, exportDataPackage, exportEncryptedDataPackage } from '../src/utils/exportImport';
import { encryptEvidenceBlob } from '../src/utils/evidencePackage';
import { createWordReportBlob } from '../src/utils/wordDocument';
import JSZip from 'jszip';
export { until } from './project-list-browser-cases.mjs';
import { until } from './project-list-browser-cases.mjs';
const pause = ms => new Promise(r => setTimeout(r, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const equal = (a,b,message) => assert(JSON.stringify(a) === JSON.stringify(b), message);
const button = (text, root = document) => [...root.querySelectorAll('button')].find(el => el.textContent.trim() === text);
const click = async (text, root = document) => { const el=button(text,root); assert(el && !el.disabled, `按钮不可用：${text}`); el.click(); await pause(100); };
const dialog = () => document.querySelector('[role="dialog"]');
const input = (el,value) => { assert(el,'输入框存在'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); };
const fixture = { version:1, name:'巡检模板', categories:[{id:'room',name:'场所',type:'checklist',order:1,defaultItems:[{id:'photo',label:'现场照片',required:false}]}], profile:{reportTitle:'巡检报告',exportFilePrefix:'巡检',unitFieldLabel:'客户',unitFieldRequired:true} };
let groupId;
export async function storage() {
  await db.saveDefaultPreset(fixture);
  equal(await db.getDefaultPreset(),fixture,'默认预设跨连接保存');
  const systems=await db.createProjectGroupWithSystems({unitName:'测试客户',projectName:'测试组',projectCode:'',reportDate:''},['甲','乙'],fixture);
  groupId=systems[0].groupId;
  const group=await db.loadProjectGroup(groupId);
  const next={...structuredClone(fixture),categories:[{...fixture.categories[0],id:'site',name:'地点'}],profile:{...fixture.profile,unitFieldRequired:false}};
  await db.saveDefaultPreset(next);
  const added=await db.createSystemForGroup(group,'丙');
  equal(added.categories,next.categories,'组内新增系统必须采用当前默认分类');
  equal(added.profile,fixture.profile,'组内新增系统必须保留组配置');
  equal((await db.loadProject(systems[0].id)).categories,fixture.categories,'切换预设不改变已有系统');
  const optionalGroup={...group,profile:{...fixture.profile,unitFieldRequired:false}};
  let rejected=false;
  try { await db.updateProjectGroupAndSystems({...optionalGroup,unitName:''}); } catch { rejected=true; }
  assert(rejected,'组更新不能绕过成员系统的单位必填');
  assert((await db.loadProjectGroup(groupId)).unitName==='测试客户','拒绝时组记录不能先写入');
  const original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite' && [].concat(names).includes('settings')) throw Error('受控预设写入失败');return original.call(this,names,mode,...args);};
  try { await db.saveDefaultPreset(fixture).then(()=>{throw Error('不应成功');},()=>{}); } finally { IDBDatabase.prototype.transaction=original; }
  equal(await db.getDefaultPreset(),next,'保存失败保持原默认');
  await db.saveDefaultPreset(DEFAULT_PRESET);
  return '原生 IDB：预设持久化、切换隔离、组内创建、成员必填与失败原子性';
}
export async function exports() {
  const meta={projectCode:'',projectName:'项目',systemName:'系统',unitName:'',reportDate:''};
  const {zip}=buildDataPackageZip(meta,fixture.categories,[],fixture.profile);
  const blob=await zip.generateAsync({type:'blob'});
  for(const file of [new File([blob],'test.zip'),new File([await encryptEvidenceBlob(blob,'qa-password')],'test.evidence')]) {
    const result=file.name.endsWith('.evidence') ? await importEncryptedDataPackage(file,'qa-password','overwrite',[],[],meta) : await importDataPackage(file,'overwrite',[],[],meta);
    assert(result.success,result.message); equal(result.data.profile,fixture.profile,'包往返配置');
    const merged=await importDataPackage(blob,'merge',[],[],meta,DEFAULT_PRESET.profile);
    equal(merged.data.profile,DEFAULT_PRESET.profile,'合并不能覆盖目标配置');
  }
  const manifest=JSON.parse(await zip.file('manifest.json').async('string')); delete manifest.profile; zip.file('manifest.json',JSON.stringify(manifest));
  const legacy=await importDataPackage(new File([await zip.generateAsync({type:'blob'})],'legacy.zip'),'overwrite',[],[],meta);
  equal(legacy.data.profile,LEGACY_PROFILE,'旧包固定兼容');
  const word=await JSZip.loadAsync(await (await createWordReportBlob(meta,fixture.categories,[],{...fixture.profile,unitFieldRequired:false})).arrayBuffer());
  assert((await word.file('word/document.xml').async('string')).includes('巡检报告'),'Word 封面标题');
  assert((await word.file('docProps/core.xml').async('string')).includes('巡检报告'),'Word 文档属性');
  assert(!(await word.file('word/document.xml').async('string')).includes('请填写'),'可选空单位无占位');
  const names=[];const original=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){names.push(this.download);};
  try { const bad={...meta,unitName:'客/户:*?',systemName:'系/统:*?'};await exportDataPackage(bad,[],[],'none',fixture.profile);await exportEncryptedDataPackage(bad,[],[],'qa-password','none',fixture.profile); }
  finally {HTMLAnchorElement.prototype.click=original;}
  assert(names.length===2 && names.every(n=>!/[\\/:*?"<>|]/.test(n)),'ZIP 和加密包元数据参与命名时必须净化');
  return '真实 ZIP/加密包往返、旧包与合并兼容、DOCX XML 及文件名';
}
async function upload(value) {
  const el=dialog().querySelector('input[type="file"]'); const dt=new DataTransfer();dt.items.add(new File([typeof value==='string'?value:JSON.stringify(value)],'preset.json',{type:'application/json'}));el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));await pause(250);
}
export async function ui() {
  window.location.hash='';await until(()=>button('新建项目'),'列表');
  await click('新建项目');const fields=dialog().querySelectorAll('input');input(fields[4],'通用空单位');await click('保存',dialog());await until(()=>!dialog(),'通用单位可选创建');
  await click('模板预设');await upload(fixture);await until(()=>!dialog(),'导入预设完成');
  await click('新建项目');input(dialog().querySelectorAll('input')[4],'预设系统');await click('保存',dialog());assert(dialog().textContent.includes('请填写客户'),'预设必填标签与校验');input(dialog().querySelectorAll('input')[2],'客户甲');await click('保存',dialog());await until(()=>!dialog(),'预设创建');
  const systems=await db.listProjects();const created=systems.find(d=>d.meta.systemName==='预设系统');assert(created,'项目创建成功');
  equal((await db.loadProject(created.id)).categories,fixture.categories,'界面使用预设快照');
  window.location.hash=`/project/${created.id}`;await until(()=>button('模板管理'),'工作台');
  assert(button('另存为预设'),'项目另存入口');
  document.querySelector('[aria-label="新增分类"]').click();await pause(80);
  input([...document.querySelectorAll('aside input')].find(el=>el.closest('label')?.textContent.includes('分类名称')),'附件');await click('确定',document.querySelector('aside'));
  document.querySelector('[aria-label="重命名分类 附件"]').click();await pause(80);
  input([...document.querySelectorAll('aside input')].find(el=>el.closest('label')?.textContent.includes('分类名称')),'附图');await click('确定',document.querySelector('aside'));
  await until(async()=> (await db.loadProject(created.id)).categories.some(c=>c.name==='附图'),'分类改名持久化');
  await click('另存为预设');input(dialog().querySelector('input'),'我的模板');
  let download;const anchorClick=HTMLAnchorElement.prototype.click;const createUrl=URL.createObjectURL;
  HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=function(blob){download=blob;return createUrl.call(this,blob);};
  try {await click('导出预设',dialog());} finally {HTMLAnchorElement.prototype.click=anchorClick;URL.createObjectURL=createUrl;}
  const exported=JSON.parse(await download.text());assert(exported.name==='我的模板' && exported.categories.some(c=>c.name==='附图'),'另存导出编辑值和模板');
  assert(!('assets' in exported)&&!('meta' in exported),'另存没有项目数据');await click('关闭',dialog());
  await click('项目信息');const reportInput=[...dialog().querySelectorAll('label')].find(el=>el.textContent==='报告标题').querySelector('input');input(reportInput,'自定义报告');
  const originalTransaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite'&&[].concat(names).includes('projects'))throw Error('受控项目保存失败');return originalTransaction.call(this,names,mode,...args);};
  try {await click('保存',dialog());assert(dialog(),'写入失败不能关闭设置');}
  finally {IDBDatabase.prototype.transaction=originalTransaction;}
  assert((await db.loadProject(created.id)).profile.reportTitle==='巡检报告','保存失败配置不变');
  await click('保存',dialog());await until(()=>!dialog(),'项目配置保存');
  assert((await db.loadProject(created.id)).profile.reportTitle==='自定义报告','成功关闭之前已落库');
  await click('返回项目列表');await until(()=>button('模板预设'),'返回');
  const file = new File([JSON.stringify(exported)],'copy.json');await click('模板预设');await upload(JSON.parse(await file.text()));await until(()=>!dialog(),'另存预设可重新导入');
  window.location.hash=`/project/${created.id}`;await until(()=>button('另存为预设'),'重开项目');await click('项目信息');assert([...dialog().querySelectorAll('input')].some(el=>el.value==='自定义报告'),'重开配置不变');await click('取消',dialog());await click('返回项目列表');await until(()=>button('模板预设'),'返回');
  return '真实界面：预设创建、分类增改、另存再导入、配置保存失败/重试/重开';
}
export async function failures() {
  await click('模板预设');const before=await db.getDefaultPreset();await upload({...fixture,version:2});equal(await db.getDefaultPreset(),before,'非法预设不覆盖默认');
  const original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...args){if([].concat(names).includes('settings'))throw Error('受控预设读取失败');return original.call(this,names,mode,...args);};
  try {
    await upload(fixture);assert(document.body.textContent.includes('受控预设读取失败'),'导入写库失败显示错误');
    await click('关闭',dialog());
    // 重新挂载列表触发真实加载失败。
    const sample=(await db.listProjects())[0];window.location.hash=`/project/${sample.id}`;await until(()=>button('返回项目列表'),'工作台');await click('返回项目列表');await until(()=>button('新建项目'),'列表');await pause(200);
    await click('新建项目');assert(button('保存',dialog()).disabled,'默认预设读取失败时禁止创建');
  } finally {IDBDatabase.prototype.transaction=original;}
  await click('重试',dialog());await until(()=>!button('保存',dialog()).disabled,'重试加载');await click('取消',dialog());
  return '非法输入/存储失败保留原默认，加载失败禁止创建且可重试';
}
const legacyCategories = ['physical','network','security','host','system-mgmt','app','management','other'].map((id,index)=>({id:`cat-${id}`,name:`历史分类 ${index+1}`,type:id==='management'?'freestyle':'checklist',order:index+1,defaultItems:[{id:`legacy-item-${index}`,label:`历史检查项 ${index+1}`,required:true}]}));
const legacyDoc = {id:'legacy-onboarding',groupId:null,meta:{projectCode:'',projectName:'旧项目',unitName:'原单位',reportDate:'',systemName:'旧系统'},categories:legacyCategories,assets:[{id:'old-asset',categoryId:'cat-physical',name:'原资产',items:[{id:'old-item',label:'原检查项',required:true,images:[{id:'old-image',data:'data:image/png;base64,b2xk'}]}]}],createdAt:1,updatedAt:1};
async function rawStore(action) {
  const connection = await new Promise((resolve,reject)=>{const req=indexedDB.open('evidence-collector-db');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  try { return await new Promise((resolve,reject)=>{const tx=connection.transaction(['projects','projectSummaries','projectGroups','settings','images'],'readwrite');action(tx);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);}); }
  finally {connection.close();}
}
export async function seedOnboarding(kind='legacy') {
  await rawStore(tx=>{
    for(const name of ['projects','projectSummaries','projectGroups','settings','images']) tx.objectStore(name).clear();
    const docs=kind==='new' ? [] : [structuredClone(legacyDoc)];
    if(kind==='mixed') docs.push({...structuredClone(legacyDoc),id:'generic',categories:DEFAULT_PRESET.categories,profile:DEFAULT_PRESET.profile});
    if(kind==='different') docs.push({...structuredClone(legacyDoc),id:'different',categories:legacyCategories.map((c,i)=>i===0?{...c,name:'不同模板'}:c)});
    for(const doc of docs) {tx.objectStore('projects').put(doc);tx.objectStore('projectSummaries').put({id:doc.id,groupId:null,meta:doc.meta,profile:doc.profile,assetCount:1,createdAt:1,updatedAt:1});}
    if(kind==='default') tx.objectStore('settings').put({id:'defaultPreset',preset:DEFAULT_PRESET});
  });
  localStorage.setItem('evidence-image-migration-v5',JSON.stringify({completedIds:['legacy-onboarding','generic','different'],damagedIds:[]}));
}
export async function onboardingStorage() {
  assert(typeof db.getLegacyPresetCandidate==='function' && typeof db.completeLegacyPresetOnboarding==='function','引导公共存储接口存在');
  for(const kind of ['new','mixed','different','default']) {await seedOnboarding(kind);assert(await db.getLegacyPresetCandidate()===null,`${kind} 不误触发`);}
  await seedOnboarding();
  const before = await db.loadProject(legacyDoc.id,{migrateLegacy:false});
  const calls=[];const get=IDBObjectStore.prototype.get;const transaction=IDBDatabase.prototype.transaction;
  IDBObjectStore.prototype.get=function(...args){calls.push(this.name);return get.apply(this,args);};
  IDBDatabase.prototype.transaction=function(names,mode,...args){assert(mode!=='readwrite','检测不能打开写事务');return transaction.call(this,names,mode,...args);};
  let candidate;
  try {candidate=await db.getLegacyPresetCandidate();} finally {IDBObjectStore.prototype.get=get;IDBDatabase.prototype.transaction=transaction;}
  assert(candidate && candidate.categories.length===8,'无 profile 旧等保被识别');assert(!calls.includes('images'),'检测不读取图片');
  IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite'&&[].concat(names).includes('settings'))throw Error('受控引导保存失败');return transaction.call(this,names,mode,...args);};
  try {await db.completeLegacyPresetOnboarding(candidate).then(()=>{throw Error('失败不应成功');},e=>assert(e.message.includes('受控'),'保存失败可见'));} finally {IDBDatabase.prototype.transaction=transaction;}
  assert(await db.getLegacyPresetCandidate(),'失败不记录完成');
  const adopted=await db.completeLegacyPresetOnboarding(candidate);equal(adopted,candidate,'沿用事务完成返回选择');assert(await db.getLegacyPresetCandidate()===null,'沿用持久化不再提示');
  equal(await db.loadProject(legacyDoc.id,{migrateLegacy:false}),before,'不改原项目/图片');assert(!JSON.stringify(adopted).includes('原单位')&&!JSON.stringify(adopted).includes('原资产'),'模板不含身份或实例');
  await seedOnboarding();await db.completeLegacyPresetOnboarding(null);assert(await db.getLegacyPresetCandidate()===null,'通用选择持久化');equal(await db.getDefaultPreset(),DEFAULT_PRESET,'通用默认保持');
  await seedOnboarding();candidate=await db.getLegacyPresetCandidate();await db.saveDefaultPreset(fixture);equal(await db.completeLegacyPresetOnboarding(candidate),fixture,'其他窗口默认不能被覆盖');
  await seedOnboarding();
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,...args){if(this.name==='settings'&&value.id==='legacyPresetOnboarding') throw Error('受控事务中止');return put.call(this,value,...args);};
  try {await db.completeLegacyPresetOnboarding(candidate).then(()=>{throw Error('中止不能成功');},e=>assert(e.message.includes('受控'),'中止有错误'));} finally {IDBObjectStore.prototype.put=put;}
  equal(await db.getDefaultPreset(),DEFAULT_PRESET,'标记写失败时默认预设同事务回滚');assert(await db.getLegacyPresetCandidate(),'中止不记录完成');
  await seedOnboarding();
  await rawStore(tx=>tx.objectStore('projects').put({...legacyDoc,categories:null}));assert(await db.getLegacyPresetCandidate()===null,'损坏文档不推荐');
  await seedOnboarding();
  return '旧模板引导存储：识别边界、只读检测、失败重试、持久选择、原文档不变与并发默认保护';
}
export function instrumentOnboarding() {
  const reads={documents:0,images:0};const original=IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get=function(...args){if(this.name==='projects')reads.documents++;if(this.name==='images')reads.images++;return original.apply(this,args);};
  return reads;
}
export async function onboardingLifecycle() {
  const get=IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get=function(...args){if(this.name==='projects')throw Error('受控旧模板读取失败');return get.apply(this,args);};
  try {
    await click('新建项目');await until(()=>dialog()?.querySelector('[role="alert"]'),'模板读取失败提示');
    assert(button('保存',dialog()).disabled,'旧模板读取失败禁止创建');
  } finally {IDBObjectStore.prototype.get=get;}
  await click('重试',dialog());await until(()=>button('沿用旧项目模板作为默认',dialog()),'旧模板读取重试');
  dialog().click();await until(()=>!dialog(),'关闭引导');
  const open=indexedDB.open;
  indexedDB.open=function(...args){
    const request=open.apply(this,args);
    Object.defineProperty(request,'onsuccess',{set(callback){request.addEventListener('success',event=>setTimeout(()=>callback.call(request,event),500));}});
    return request;
  };
  try {
    await click('新建项目');assert(button('保存',dialog()).disabled,'读取中禁止保存');
    await click('取消',dialog());await pause(1000);assert(!dialog(),'关闭后过期初始化不重开引导');
    await click('新建项目');window.location.hash=`/project/${legacyDoc.id}`;
    await until(()=>button('返回项目列表'),'初始化期间卸载列表');await pause(1000);assert(!dialog(),'卸载后过期初始化不显示引导');
  } finally {indexedDB.open=open;}
  await click('返回项目列表');await until(()=>button('新建项目'),'重新挂载列表');
  await openOnboarding();
  const transaction=IDBDatabase.prototype.transaction;let commits=0;
  IDBDatabase.prototype.transaction=function(names,mode,...args){
    const tx=transaction.call(this,names,mode,...args);
    if(mode==='readwrite'&&[].concat(names).includes('settings')){
      commits++;
      Object.defineProperty(tx,'oncomplete',{set(callback){tx.addEventListener('complete',event=>setTimeout(()=>callback.call(tx,event),400));}});
    }
    return tx;
  };
  try {
    const adopt=button('沿用旧项目模板作为默认',dialog());adopt.click();adopt.click();await pause(100);
    assert([...dialog().querySelectorAll('button')].every(el=>el.disabled),'保存中按钮全部锁定');
    dialog().click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(dialog(),'保存中背景和 Escape 不关闭');
    await until(()=>dialog()?.querySelectorAll('input').length===5,'真实提交后进入表单');assert(commits===1,'连续点击只提交一次');
  } finally {IDBDatabase.prototype.transaction=transaction;}
  await click('取消',dialog());
  await seedOnboarding();
  return '旧模板读取失败重试、关闭/卸载拒绝迟到初始化、同步防重入及保存中关闭保护';
}
export async function openOnboarding() {
  await until(()=>button('新建项目'),'列表');button('新建项目').focus();await click('新建项目');await until(()=>button('沿用旧项目模板作为默认',dialog()),'旧模板引导');
  assert(dialog().getAttribute('aria-labelledby'),'引导有命名');
}
export async function onboardingUi() {
  const before=await db.loadProject(legacyDoc.id,{migrateLegacy:false});
  const original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite'&&[].concat(names).includes('settings'))throw Error('受控引导保存失败');return original.call(this,names,mode,...args);};
  try {await click('沿用旧项目模板作为默认',dialog());assert(dialog().textContent.includes('受控引导保存失败'),'失败显示且保留引导');} finally {IDBDatabase.prototype.transaction=original;}
  await click('沿用旧项目模板作为默认',dialog());await until(()=>dialog()?.querySelectorAll('input').length===5,'进入新建表单');
  input(dialog().querySelectorAll('input')[2],'新单位');input(dialog().querySelectorAll('input')[4],'继承模板系统');await click('保存',dialog());await until(()=>!dialog(),'完成创建');
  const created=(await db.listProjects()).find(p=>p.meta.systemName==='继承模板系统');assert(created,'新系统在列表');const doc=await db.loadProject(created.id,{migrateLegacy:false});
  equal(doc.categories,legacyCategories,'沿用分类与检查项');equal(doc.profile,LEGACY_PROFILE,'沿用旧配置');assert(doc.assets.length===0,'不复制原资产或图片');
  equal(await db.loadProject(legacyDoc.id,{migrateLegacy:false}),before,'原项目保持');
  await click('新建项目');await until(()=>button('保存',dialog()),'再次创建');assert(!button('沿用旧项目模板作为默认',dialog()),'新建不重复提示');await click('取消',dialog());
  return '真实引导界面：保存失败保留、重试沿用、新建快照、无原资产图片、原项目不变与再次打开';
}
export async function onboardingForm(expected='generic') {
  await until(()=>dialog()?.querySelectorAll('input').length===5 && !button('保存',dialog()).disabled,'新建表单可用');
  assert(!button('沿用旧项目模板作为默认',dialog()),'不重复显示引导');
  equal(await db.getDefaultPreset(),expected==='legacy'?{version:1,name:'旧项目等保模板',categories:legacyCategories,profile:LEGACY_PROFILE}:DEFAULT_PRESET,'重开保持模板选择');
  await click('取消',dialog());
}
export async function onboardingGeneric() {
  await until(()=>dialog()?.querySelectorAll('input').length===5 && !button('保存',dialog()).disabled,'通用新建表单');
  input(dialog().querySelectorAll('input')[4],'通用选择系统');await click('保存',dialog());await until(()=>!dialog(),'通用可空单位创建');
  const created=(await db.listProjects()).find(p=>p.meta.systemName==='通用选择系统');
  equal((await db.loadProject(created.id,{migrateLegacy:false})).categories,DEFAULT_PRESET.categories,'通用选择创建通用分类');
}
export async function onboardingLayout() {
  assert(document.documentElement.scrollWidth<=innerWidth,'引导不横向溢出');
  for(const el of dialog().querySelectorAll('button')) {const r=el.getBoundingClientRect();assert(r.height>=44 && r.left>=0 && r.right<=innerWidth,'引导按钮完整且可触控');}
  return '旧模板引导无溢出且按钮完整';
}
export async function layout() {
  for (const close of document.querySelectorAll('[aria-label="关闭提示"]')) close.click();
  if(!dialog()) await click('模板预设');await pause(80);
  assert(document.documentElement.scrollWidth<=innerWidth,'界面不横向溢出');
  assert(!dialog().textContent.includes('预设只包含')&&!dialog().textContent.includes('导入后只影响'),'不增加解释性小字');
  return '预设界面无横向溢出及多余说明';
}

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
export async function layout() {
  for (const close of document.querySelectorAll('[aria-label="关闭提示"]')) close.click();
  if(!dialog()) await click('模板预设');await pause(80);
  assert(document.documentElement.scrollWidth<=innerWidth,'界面不横向溢出');
  assert(!dialog().textContent.includes('预设只包含')&&!dialog().textContent.includes('导入后只影响'),'不增加解释性小字');
  return '预设界面无横向溢出及多余说明';
}

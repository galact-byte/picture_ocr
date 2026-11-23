// 校验客户端报错采集：errorLog 模块 API、全局 handler 安装、db 超时接入、诊断导出走 <a download>。
// 读源码做断言，先归一化 CRLF（Windows 工作区源码为 CRLF）。
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

const errorLog = read('src/utils/errorLog.ts');
const main = read('src/main.tsx');
const app = read('src/App.tsx');
const db = read('src/utils/db.ts');
const settings = read('src/components/StorageSettingsDialog.tsx');

const checks = [
  ['errorLog 导出 recordError', /export function recordError\(/.test(errorLog)],
  ['errorLog 导出 getErrorLog', /export function getErrorLog\(/.test(errorLog)],
  ['errorLog 导出 clearErrorLog', /export function clearErrorLog\(/.test(errorLog)],
  ['errorLog 导出 installGlobalErrorHandlers', /export function installGlobalErrorHandlers\(/.test(errorLog)],
  ['errorLog 导出 setErrorNotifier', /export function setErrorNotifier\(/.test(errorLog)],
  ['errorLog 导出 buildDiagnosticsReport', /export async function buildDiagnosticsReport\(/.test(errorLog)],
  ['errorLog 导出 downloadDiagnostics', /export async function downloadDiagnostics\(/.test(errorLog)],
  ['localStorage 环形缓冲键', /evidence-error-log/.test(errorLog)],
  ['环形缓冲有上限截断', /slice\(0,\s*MAX_ENTRIES\)/.test(errorLog)],
  ['捕获 window error', /addEventListener\('error'/.test(errorLog)],
  ['捕获 unhandledrejection', /addEventListener\('unhandledrejection'/.test(errorLog)],
  ['诊断包含版本/环境/计数/错误', /app:\s*appVersion\(\)/.test(errorLog) && /userAgent:/.test(errorLog) && /counts/.test(errorLog) && /errors:\s*getErrorLog\(\)/.test(errorLog)],
  ['导出走 <a download>', /createElement\('a'\)/.test(errorLog) && /\.download\s*=/.test(errorLog)],
  ['导出不使用 showSaveFilePicker', !/showSaveFilePicker/.test(errorLog)],

  ['main.tsx 安装全局 handler', /installGlobalErrorHandlers\(\)/.test(main)],
  ['App.tsx 接线 setErrorNotifier', /setErrorNotifier\(/.test(app)],

  ['db.ts 引入 recordError', /import \{ recordError \} from '\.\/errorLog'/.test(db)],
  ['db.ts 超时/失败记入日志', /recordError\(\{\s*type:\s*'manual'/.test(db)],

  ['存储设置有导出诊断入口', /downloadDiagnostics/.test(settings) && /导出诊断包/.test(settings)],
];

// 在隔离存储中执行真实日志模块；仅替代与日志隔离无关的存储统计依赖。
const compiled = ts.transpileModule(errorLog, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function loadLog(version = '0.12.2', build = 'build-current', storage = new Map()) {
  const context = {
    exports: {}, __APP_VERSION__: version, __APP_BUILD_ID__: build,
    Date, console,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    require: name => {
      if (name === './db') return {
        listDiagnosticProjectGroups: async () => [],
        getStoreDiagnostics: async () => ({ projects: 0, summaries: 0, groups: 0, legacy: 0, images: 0, legacyStranded: false }),
        getLastSummaryRepairReport: () => null,
        getDamagedProjectDiagnostics: async () => [],
      };
      if (name === './storageEstimate') return { getStorageEstimate: async () => ({ supported: false }) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(compiled, context);
  return { log: context.exports, storage, context };
}
const check = (name, ok) => checks.push([name, !!ok]);
const key = 'evidence-error-log';
const legacy = { time: '2026-11-10T00:00:00.000Z', type: 'error', message: '历史白屏' };
const old = { ...legacy, version: '0.12.1', build: 'build-old' };
const current = { ...legacy, message: '当前异常', version: '0.12.2', build: 'build-current' };
{
  const { log, storage } = loadLog();
  storage.set(key, JSON.stringify([legacy, old, { ...old, version: '0.12.2' }, { ...current, version: '0.12.1' }, current]));
  check('当前错误排除无版本、旧版本和同版本旧构建', JSON.stringify(log.getErrorLog().map(e => e.message)) === '["当前异常"]');
  const report = await log.buildDiagnosticsReport();
  check('诊断导出与当前错误计数使用同一范围', report.errors.length === 1 && report.errors[0].message === '当前异常');
  check('诊断报告携带当前版本和构建', report.app === '0.12.2' && report.build === 'build-current');
  check('读取诊断不删除原有历史记录', JSON.parse(storage.get(key)).length === 5);
  log.recordError({ type: 'manual', message: '保存失败' });
  const entry = log.getErrorLog()[0];
  check('新错误保存发生时的版本、构建和时间', entry.message === '保存失败' && entry.version === '0.12.2' && entry.build === 'build-current' && Number.isFinite(Date.parse(entry.time)));
  const afterReload = loadLog('0.12.2', 'build-current', storage).log;
  check('刷新和重启保留当前构建错误', afterReload.getErrorLog().length === 2);
  check('同版本新构建重新统计错误', loadLog('0.12.2', 'build-next', storage).log.getErrorLog().length === 0);
  check('新版本不混入旧构建的错误', loadLog('0.12.3', 'build-current', storage).log.getErrorLog().length === 0);
  check('写新错误仍保留缓冲区内的历史证据', JSON.parse(storage.get(key)).some(e => e.message === '历史白屏' && !e.version));
  log.clearErrorLog();
  log.recordError({ type: 'manual', message: '保存失败' });
  check('清空后同一异常再次发生仍会记录', log.getErrorLog().length === 1);
}
{
  const { log, storage, context } = loadLog();
  for (const value of ['{broken', '{}', 'null', JSON.stringify([null, 42, {}, { ...current, message: null }, current])]) {
    storage.set(key, value);
    try {
      const rows = log.getErrorLog();
      check(`损坏日志安全读取 ${value.slice(0, 20)}`, rows.every(e => typeof e.message === 'string') && rows.length === (value.startsWith('[') ? 1 : 0));
    } catch { check(`损坏日志安全读取 ${value.slice(0, 20)}`, false); }
  }
  context.localStorage.getItem = () => { throw new Error('拒绝访问'); };
  try { check('存储拒绝访问不会使设置页崩溃', log.getErrorLog().length === 0); }
  catch { check('存储拒绝访问不会使设置页崩溃', false); }
}
{
  const { log } = loadLog();
  log.recordError({ type: 'error', message: '重复异常' });
  log.recordError({ type: 'error', message: '重复异常' });
  check('同一异常短时间内仍去重', log.getErrorLog().length === 1);
  for (let i = 0; i < 55; i++) log.recordError({ type: 'manual', message: `异常 ${i}` });
  check('环形缓冲仍限制为最近50条', log.getErrorLog().length === 50 && log.getErrorLog()[0].message === '异常 54');
}

// 执行真实 Vite 配置的指纹逻辑，文件变化只发生在本次创建的隔离夹具中。
const fixture = mkdtempSync(path.join(root, '.trellis/.runtime/error-build-'));
try {
  for (const directory of ['src', 'public']) mkdirSync(path.join(fixture, directory));
  for (const file of ['index.html', 'package-lock.json', 'tsconfig.json', 'postcss.config.js', 'tailwind.config.js']) writeFileSync(path.join(fixture, file), '{}');
  writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ version: '0.12.2' }));
  writeFileSync(path.join(fixture, 'src/main.ts'), 'export const value = 1;');
  writeFileSync(path.join(fixture, 'public/icon.svg'), '<svg/>');
  writeFileSync(path.join(fixture, 'vite.config.ts'), read('vite.config.ts'));
  const configCode = ts.transpileModule(read('vite.config.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText.replaceAll('import.meta.url', 'configUrl');
  const require = createRequire(import.meta.url);
  const buildId = () => {
    const context = { exports: {}, URL, configUrl: pathToFileURL(path.join(fixture, 'vite.config.ts')).href, require: name => name === 'vite' ? { defineConfig: config => config } : name === '@vitejs/plugin-react' ? { default: () => ({ name: 'test-react' }) } : require(name) };
    vm.runInNewContext(configCode, context);
    return JSON.parse(context.exports.default.define.__APP_BUILD_ID__ ?? 'null');
  };
  const first = buildId();
  check('相同源码重复构建保持同一错误范围', typeof first === 'string' && first.length > 0 && buildId() === first);
  writeFileSync(path.join(fixture, 'src/main.ts'), 'export const value = 2;');
  const changed = buildId();
  check('同版本更新源码会更换构建标识', changed !== first);
  writeFileSync(path.join(fixture, 'CHANGES.md'), '只更新说明');
  check('只更新变更说明不清空当前错误范围', buildId() === changed);
  writeFileSync(path.join(fixture, 'public/icon.svg'), '<svg>new</svg>');
  check('静态资源更新会更换构建标识', buildId() !== changed);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);

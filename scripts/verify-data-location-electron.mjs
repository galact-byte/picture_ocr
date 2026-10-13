import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, renameSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = mkdtempSync(path.join(tmpdir(), 'picture-location-qa-'));
const output = path.resolve('.trellis/.runtime/data-location-qa');
mkdirSync(output, { recursive: true });
const bundle = path.join(root, 'api.js');
await build({ stdin: { contents: "export {createProjectDocument,saveProjectWithImages,loadProject,listProjects,resolveImageData} from './src/utils/db';", resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'iife', globalName: 'locationApi', outfile: bundle });
const defaultDir = path.join(root, 'default');
const original = path.join(root, 'original');
const renamed = path.join(root, 'renamed');
mkdirSync(defaultDir); mkdirSync(original);
const configPath = path.join(defaultDir, 'data-location.json');
const config = value => writeFileSync(configPath, JSON.stringify(value));
const reports = [];
async function run(mode, chosen = renamed) {
  const reportFile = path.join(root, `${reports.length}-${mode}.json`);
  const env = { ...process.env, LOCATION_QA_MODE: mode, LOCATION_QA_PROFILE: defaultDir, LOCATION_QA_CHOSEN: chosen, LOCATION_QA_BUNDLE: bundle, LOCATION_QA_REPORT: reportFile, LOCATION_QA_SCREENSHOT: path.join(output, `${reports.length}-${mode}.png`) };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), ['scripts/data-location-electron.cjs'], { env, stdio: 'pipe' });
  let stderr = ''; child.stderr.on('data', value => { stderr += value; }); child.stdout.resume();
  const timer = setTimeout(() => child.kill(), 40000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.ok(existsSync(reportFile), `无报告 ${mode}: ${stderr.slice(-2000)}`);
    const report = JSON.parse(readFileSync(reportFile));
    assert.equal(code, 0, report.error || stderr.slice(-2000));
    assert.ok(!report.error, report.error);
    reports.push({ mode, report });
    return report;
  } finally { clearTimeout(timer); }
}
const assertData = (report, rendered = true) => {
  assert.equal(report.project.id, 'location-qa-system');
  assert.equal(report.project.assets[0].items[0].images.length, 1);
  assert.equal(report.summaries.length, 1);
  assert.ok(report.data.startsWith('data:image/png;base64,'));
  assert.equal(report.windowCount, 1);
  if (rendered) {
    assert.equal(report.visibleSystem, true, '重连后的列表必须显示原系统');
    assert.equal(report.renderedImage, true, '打开原系统后图片必须实际显示');
  }
};
try {
  // 在真正的 file:// origin 中种库，退出后才重命名，避免占用文件复制。
  config({});
  assertData(await run('seed'), false);
  renameSync(path.join(defaultDir, 'IndexedDB'), path.join(original, 'IndexedDB'));
  renameSync(original, renamed);
  config({ dataDir: original });
  const canceled = await run('cancel');
  assert.equal(canceled.windowCount, 0); assert.ok(canceled.exitedBeforeWindow);
  assert.ok(!existsSync(original));
  console.log('PASS 真实客户端取消定位不打开工作台、不重建旧路径');
  const invalid = await run('read', path.join(root, 'invalid'));
  assert.equal(invalid.windowCount, 0);
  assert.equal(JSON.parse(readFileSync(configPath)).dataDir, original);
  console.log('PASS 无效目录不更新指针、不打开空库');
  const recovered = await run('read'); assertData(recovered);
  assert.equal(recovered.location.current, renamed);
  assert.ok(recovered.events.every(event => event.windowCount === 0));
  assert.ok(!existsSync(original));
  console.log('PASS 真实重命名恢复：正式 main/preload 读取原项目、摘要和图片并解码');
  const normal = await run('read'); assertData(normal); assert.equal(normal.events.length, 0);
  assert.deepEqual(normal.project, recovered.project); assert.equal(normal.data, recovered.data);
  console.log('PASS 再次启动使用持久指针，数据内容保持一致');
  // 模拟旧版已创建有效但空的数据库目录：从存储设置 IPC 选择真实目录。
  config({});
  const selected = await run('choose');
  assert.equal(selected.project, null); assert.equal(selected.selection.mode, 'connect');
  const connected = await run('read'); assertData(connected);
  assert.deepEqual(connected.project, recovered.project); assert.equal(connected.data, recovered.data);
  assert.equal(connected.location.current, renamed);
  assert.ok(!existsSync(path.join(renamed, '证据采集数据')));
  console.log('PASS 已建空库通过正式 IPC 重连原目录，不合并、不创建嵌套目录');
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
} finally { rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }

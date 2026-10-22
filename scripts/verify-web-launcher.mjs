import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

assert.equal(process.platform, 'win32', '此验证需要 Windows CMD 和 PowerShell。');
const temp = mkdtempSync(join(tmpdir(), 'picture-ocr-launcher-'));
let checks = 0;
function put(root, file, value = 'fixture') {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}
function lines(root, file) {
  return existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8').trim().split(/\r?\n/).filter(Boolean).length : 0;
}
function fixture(name, source) {
  const root = join(temp, name);
  mkdirSync(root, { recursive: true });
  copyFileSync(resolve('启动证据采集工具.bat'), join(root, 'launch.bat'));
  put(root, 'dist/index.html', 'fresh');
  put(root, 'dist/service-worker.js');
  put(root, 'start-server.ps1', "if ((Get-Content -LiteralPath (Join-Path $PSScriptRoot 'dist/index.html')).Trim() -ne 'fresh') { exit 9 }; Add-Content -LiteralPath (Join-Path $PSScriptRoot 'server.log') -Value 'started'\n");
  put(root, 'bin/npm.cmd', '@echo off\r\nif not "%~1"=="run" exit /b 5\r\nif not "%~2"=="build" exit /b 5\r\necho %*>>build.log\r\nif exist fail-build exit /b 7\r\nif not exist dist mkdir dist\r\necho fresh>dist\\index.html\r\necho worker>dist\\service-worker.js\r\nexit /b 0\r\n');
  if (source) {
    put(root, 'dist/index.html', 'stale');
    for (const file of ['src/main.tsx', 'public/icon.svg', 'presets/example.json', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'scripts/generate-pwa-icons.mjs', 'scripts/generate-service-worker.mjs', 'node_modules/.bin/tsc.cmd', 'node_modules/.bin/vite.cmd']) put(root, file);
  }
  return root;
}
function launch(root, { builds = 0, status = 0, starts = 1, npmAvailable = true } = {}) {
  const beforeBuilds = lines(root, 'build.log');
  const beforeStarts = lines(root, 'server.log');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
  env.PATH = npmAvailable
    ? `${join(root, 'bin')};${process.env.PATH ?? process.env.Path}`
    : `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0`;
  const result = spawnSync('call "launch.bat"', { cwd: root, env, shell: process.env.ComSpec ?? 'cmd.exe', input: '\n', encoding: 'utf8', timeout: 20000, windowsHide: true });
  assert.ifError(result.error);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, status, output);
  assert.equal(lines(root, 'build.log') - beforeBuilds, builds, `构建次数不符：${output}`);
  assert.equal(lines(root, 'server.log') - beforeStarts, starts, `服务启动次数不符：${output}`);
  checks++;
}
try {
  launch(fixture('发布包 无需 Node', false), { npmAvailable: false });
  const root = fixture('源码 & 空格目录', true);
  launch(root, { builds: 1 });
  launch(root);
  const file = join(root, 'src/main.tsx');
  const originalTime = statSync(file);
  utimesSync(file, new Date(), new Date(Date.now() + 60000));
  launch(root);
  put(root, 'src/main.tsx', 'changed with preserved timestamp');
  utimesSync(file, originalTime.atime, originalTime.mtime);
  launch(root, { builds: 1 });
  put(root, 'src/added.ts');
  launch(root, { builds: 1 });
  rmSync(join(root, 'src/added.ts'));
  launch(root, { builds: 1 });
  for (const file of ['public/icon.svg', 'presets/example.json', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', '.env', '.env.local', '.env.production', '.env.production.local', 'scripts/generate-pwa-icons.mjs', 'scripts/generate-service-worker.mjs']) {
    put(root, file, 'changed');
    launch(root, { builds: 1 });
  }
  put(root, 'README.md', 'documentation only');
  put(root, 'node_modules/.cache/unrelated.tmp');
  launch(root);
  rmSync(join(root, 'dist'), { recursive: true });
  launch(root, { builds: 1 });
  put(root, 'fail-build');
  put(root, 'src/main.tsx', 'must rebuild');
  launch(root, { builds: 1, status: 7, starts: 0 });
  rmSync(join(root, 'fail-build'));
  launch(root, { builds: 1 });
  launch(root);
  rmSync(join(root, 'dist/service-worker.js'));
  launch(root, { builds: 1 });
  rmSync(join(root, 'src/main.tsx'));
  launch(root, { builds: 1 });
  put(root, 'src/main.tsx', 'npm unavailable');
  launch(root, { status: 1, starts: 0, npmAvailable: false });
  rmSync(join(root, 'node_modules/.bin/tsc.cmd'));
  put(root, 'src/main.tsx', 'dependency unavailable');
  launch(root, { status: 1, starts: 0 });
  console.log(`Web 启动器 ${checks} 个用例通过：内容更新、新增/删除、无变化、构建失败与重试、依赖缺失、空格及特殊字符路径、发布包兼容。`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

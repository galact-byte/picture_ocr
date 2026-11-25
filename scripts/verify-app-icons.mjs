import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const script = path.resolve('scripts/generate-pwa-icons.mjs');

function withFixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), 'picture-icons-qa-'));
  try {
    cpSync('public', path.join(root, 'public'), { recursive: true });
    mkdirSync(path.join(root, 'electron'));
    cpSync('electron/icon.ico', path.join(root, 'electron/icon.ico'));
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

function execute(root, args = [], env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 5000,
  });
}

test('committed icons pass the production build check', () => withFixture(root => {
  const result = execute(root);
  assert.equal(result.status, 0, result.stderr);
}));

test('a truncated ICO frame is rejected before packaging', () => withFixture(root => {
  const target = path.join(root, 'electron/icon.ico');
  writeFileSync(target, readFileSync(target).subarray(0, 22));
  const result = execute(root);
  assert.notEqual(result.status, 0, 'truncated ICO incorrectly passed');
}));

test('browser spawn failure reports a controlled error', () => withFixture(root => {
  const result = execute(root, ['--regenerate'], { CHROME_PATH: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /无法启动图标渲染浏览器/);
  assert.doesNotMatch(result.stderr, /Unhandled 'error' event/);
}));

test('browser exit without a result fails promptly rather than timing out', () => withFixture(root => {
  const result = execute(root, ['--regenerate'], { CHROME_PATH: process.execPath });
  assert.equal(result.error, undefined, 'browser exit left the generator waiting');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /图标渲染浏览器已退出/);
}));

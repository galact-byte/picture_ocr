import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(file, instance = '') {
  const result = await build({ entryPoints: [file], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${instance}`);
}
const data = await load('src/data/assessmentCommands.ts');
const commands = await load('src/utils/assessmentCommands.ts');
const store = await load('src/utils/assessmentCommandStore.ts');

// 模拟浏览器跨连接 readwrite 排队；不替代真实浏览器的 IndexedDB 验证。
let activeTransaction = null;
const transactions = [];
let lockReads = 0;
let abortNextLock = false;
function pump() {
  if (activeTransaction || !transactions.length) return;
  const tx = activeTransaction = transactions.shift();
  setImmediate(() => {
    if (tx.aborted) return;
    if (abortNextLock) { abortNextLock = false; tx.abort(); return; }
    tx.request.onsuccess?.();
    setImmediate(() => {
      if (tx.aborted) return;
      tx.oncomplete?.(); activeTransaction = null; pump();
    });
  });
}
globalThis.indexedDB = {
  open(name, version) {
    assert.equal(name, 'evidence-command-write-lock'); assert.equal(version, 1);
    const request = {};
    const connection = {
      close() {}, objectStoreNames: { contains: () => true },
      transaction(storeName, mode) {
        assert.equal(storeName, 'mutex'); assert.equal(mode, 'readwrite');
        const tx = { request: {}, aborted: false,
          objectStore: () => ({ get: () => { lockReads++; return tx.request; } }),
          abort() {
            tx.aborted = true;
            const index = transactions.indexOf(tx); if (index >= 0) transactions.splice(index, 1);
            setImmediate(() => { tx.onabort?.(); if (activeTransaction === tx) activeTransaction = null; pump(); });
          },
        };
        transactions.push(tx); pump(); return tx;
      },
    };
    setImmediate(() => { request.result = connection; request.onsuccess?.(); });
    return request;
  },
};
const profiles = data.assessmentCommandProfiles;
assert.deepEqual([...new Set(profiles.map(p => p.family))].sort(), ['database', 'network', 'security', 'server']);
assert.equal(profiles.length, 12);
const ids = new Set();
for (const p of profiles) {
  assert(p.groups.length && p.source);
  for (const g of p.groups) {
    assert(g.title && g.environment);
    for (const s of g.snippets) {
      assert(s.title.trim() && s.command.trim());
      assert(!ids.has(s.id), `重复 ID: ${s.id}`); ids.add(s.id);
      assert(!/[\u4e00-\u9fff]/.test(s.command), `说明混入命令: ${s.id}`);
      if (g.environment === '数据库 SQL') assert(s.command.trim().endsWith(';'), `缺少分号: ${s.id}`);
    }
    assert.equal(commands.getCommandGroupText(g), g.snippets.map(s => s.command).join('\n\n'));
  }
}
assert.equal(commands.inferCommandFamily('网络设备'), 'network');
assert.equal(commands.inferCommandFamily('安全设备'), 'security');
assert.equal(commands.inferCommandFamily('服务器'), 'server');
assert.equal(commands.inferCommandFamily('数据库'), 'database');
assert.equal(commands.inferCommandFamily(''), 'network');
assert.equal(commands.inferCommandFamily('自定义分类'), 'network');
const linux = profiles.find(p => p.id === 'linux-rhel');
assert(commands.filterCommandGroups(linux.groups, 'SYSTEM-AUTH').some(g => g.title === '身份鉴别'));
assert.deepEqual(commands.filterCommandGroups(linux.groups, 'getent passwd')[0].snippets.map(s => s.command), ['getent passwd'], '正文搜索只显示匹配段');
assert.equal(commands.filterCommandGroups(linux.groups, '身份鉴别')[0].snippets.length, linux.groups[0].snippets.length);
assert.equal(commands.filterCommandGroups(linux.groups, '不存在的命令').length, 0);
assert.equal(commands.filterCommandGroups(linux.groups, '  ').length, linux.groups.length);
const highgo4 = profiles.find(p => p.id === 'highgo-46');
const highgo9 = profiles.find(p => p.id === 'highgo-9');
assert(!JSON.stringify(highgo4).includes('credcheck.max_auth_failure'));
assert(!JSON.stringify(highgo9).includes('show_secure_param'));
const huawei = profiles.find(p => p.id === 'huawei');
const h3c = profiles.find(p => p.id === 'h3c');
assert(!JSON.stringify(huawei).includes('screen-length disable'));
assert(!JSON.stringify(h3c).includes('screen-length 0 temporary'));
console.log(`PASS 内置目录：${profiles.length} 平台、${ids.size} 命令；来源、环境、搜索、分类与版本隔离`);

let raw = null;
const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
const profile = linux, group = profile.groups[0], builtIn = group.snippets[0];
const list = () => store.resolveCommandProfiles(store.readCommandChanges(storage));
const currentGroup = () => list().find(p => p.id === profile.id).groups.find(g => g.id === group.id);
assert.deepEqual(list(), profiles);
const custom = { id: 'custom-test', title: '自定义核查', command: "printf '%s\\n' 'a | b'\nwhoami", note: '说明单独保存' };
const firstWrite = store.saveCommand(profile.id, group.id, custom, undefined, storage);
assert.equal(raw, null, '取得跨窗口锁之前不得读取或写入库');
assert(firstWrite instanceof Promise, '生产写入入口必须异步等待锁');
await firstWrite;
assert.deepEqual(currentGroup().snippets.at(-1), custom);
assert(!commands.getCommandGroupText(currentGroup()).includes(custom.note));
const changed = { ...custom, title: '已修改', command: 'id\nwhoami' };
await store.saveCommand(profile.id, group.id, changed, custom, storage);
assert.equal(currentGroup().snippets.at(-1).command, changed.command);
await assert.rejects(() => store.saveCommand(profile.id, group.id, custom, custom, storage), /已被修改/);
await store.deleteCommand(profile.id, group.id, changed, storage);
assert(!currentGroup().snippets.some(s => s.id === custom.id));
const override = { ...builtIn, title: '调整后的内置命令', command: 'getent passwd\nid' };
await store.saveCommand(profile.id, group.id, override, builtIn, storage);
assert.deepEqual(currentGroup().snippets[0], override);
await store.deleteCommand(profile.id, group.id, override, storage);
assert(!currentGroup().snippets.some(s => s.id === builtIn.id));
assert.equal(linux.groups[0].snippets[0], builtIn, '原始目录不可变');
const beforeInvalid = raw;
for (const invalid of [{ ...custom, title: ' ' }, { ...custom, command: '' }, { ...custom, command: 'x'.repeat(32769) }]) {
  await assert.rejects(() => store.saveCommand(profile.id, group.id, invalid, undefined, storage));
  assert.equal(raw, beforeInvalid);
}
await assert.rejects(() => store.saveCommand('missing', group.id, custom, undefined, storage));
await assert.rejects(() => store.saveCommand(profile.id, 'missing', custom, undefined, storage));
await assert.rejects(() => store.saveCommand(profile.id, group.id, { ...custom, id: 'h3c-version-1' }, undefined, storage));
const rejecting = { getItem: () => raw, setItem: () => { throw new Error('受控存储已满'); } };
await assert.rejects(() => store.saveCommand(profile.id, group.id, custom, undefined, rejecting), /受控存储已满/);
assert.equal(raw, beforeInvalid);
for (const corrupt of ['broken', '{"version":2,"changes":[]}', '{"version":1,"changes":[{}]}', JSON.stringify({ version: 1, changes: [{ profileId: profile.id, groupId: group.id, id: builtIn.id, snippet: { ...builtIn, command: 1 } }] })]) {
  raw = corrupt;
  assert.throws(() => store.readCommandChanges(storage));
  await assert.rejects(() => store.saveCommand(profile.id, group.id, custom, undefined, storage));
  assert.equal(raw, corrupt, '不得覆盖损坏库');
}
console.log('PASS 命令增删改查、刷新持久化、内置覆盖/隐藏、并发冲突、输入/存储异常和失败保留');

const links = await load('src/utils/assessmentCommandBindings.ts');
let linkRaw = null;
const linkStorage = { getItem: () => linkRaw, setItem: (_key, value) => { linkRaw = value; } };
const target = { projectId: 'project', assetId: 'asset', itemId: 'identity' };
await links.setCommandLinked(target, builtIn.id, true, linkStorage);
await links.setCommandLinked(target, custom.id, true, linkStorage);
assert.deepEqual(links.readCommandBindings(linkStorage)[links.commandBindingKey(target)], [builtIn.id, custom.id]);
for (const other of [{ ...target, projectId: 'other' }, { ...target, assetId: 'other' }, { ...target, itemId: 'other' }]) {
  assert.equal(links.readCommandBindings(linkStorage)[links.commandBindingKey(other)], undefined);
}
await links.setCommandLinked(target, builtIn.id, false, linkStorage);
assert.deepEqual(links.readCommandBindings(linkStorage)[links.commandBindingKey(target)], [custom.id]);
await links.setCommandLinked({ ...target, itemId: 'another' }, builtIn.id, true, linkStorage);
const linkBefore = linkRaw;
await assert.rejects(() => links.setCommandLinked(target, 'invalid id', true, linkStorage));
await assert.rejects(() => links.setCommandLinked({ ...target, itemId: '' }, builtIn.id, true, linkStorage));
const failingLinks = { getItem: () => linkRaw, setItem: () => { throw new Error('关联存储拒绝'); } };
await assert.rejects(() => links.setCommandLinked(target, builtIn.id, true, failingLinks), /关联存储拒绝/);
assert.equal(linkRaw, linkBefore);
for (const corrupt of ['invalid', '{"version":2,"bindings":{}}', '{"version":1,"bindings":{"bad":["x"]}}']) {
  linkRaw = corrupt;
  assert.throws(() => links.readCommandBindings(linkStorage));
  await assert.rejects(() => links.setCommandLinked(target, builtIn.id, true, linkStorage));
  assert.equal(linkRaw, corrupt);
}
console.log('PASS 检查项关联、逐项移除、命令 ID 引用、项目/资产/检查项隔离和失败保留');

// 两个独立模块实例共享 origin 的锁；在第一个窗口读后、写前派发第二个窗口。
const otherStore = await load('src/utils/assessmentCommandStore.ts', 'second-window');
const otherLinks = await load('src/utils/assessmentCommandBindings.ts', 'second-window');
assert.notEqual(store.saveCommand, otherStore.saveCommand);
raw = null;
let competingWrite;
let interleave = true;
const racingStorage = {
  getItem() {
    const snapshot = raw;
    if (interleave) {
      interleave = false;
      competingWrite = otherStore.saveCommand(profile.id, group.id, { ...custom, id: 'custom-second' }, undefined, racingStorage);
    }
    return snapshot;
  },
  setItem(_key, value) { raw = value; },
};
await store.saveCommand(profile.id, group.id, custom, undefined, racingStorage);
await competingWrite;
assert.deepEqual(store.readCommandChanges(storage).map(c => c.id).sort(), ['custom-second', 'custom-test']);
const outcomes = await Promise.allSettled([
  store.saveCommand(profile.id, group.id, { ...custom, title: '窗口一' }, custom, storage),
  otherStore.saveCommand(profile.id, group.id, { ...custom, title: '窗口二' }, custom, storage),
]);
assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
assert.match(outcomes.find(o => o.status === 'rejected').reason.message, /已被修改/);
assert(store.readCommandChanges(storage).some(c => c.id === 'custom-second'), '同命令冲突不得丢掉其他命令');
linkRaw = null; interleave = true;
const racingLinks = {
  getItem() {
    const snapshot = linkRaw;
    if (interleave) {
      interleave = false;
      competingWrite = otherLinks.setCommandLinked({ ...target, itemId: 'second' }, custom.id, true, racingLinks);
    }
    return snapshot;
  },
  setItem(_key, value) { linkRaw = value; },
};
await links.setCommandLinked(target, builtIn.id, true, racingLinks);
await competingWrite;
assert.equal(Object.keys(links.readCommandBindings(linkStorage)).length, 2, '不同检查项并发关联不得整库覆盖');
await Promise.all([
  links.setCommandLinked(target, custom.id, true, linkStorage),
  otherLinks.setCommandLinked(target, 'custom-third', true, linkStorage),
]);
assert.deepEqual(links.readCommandBindings(linkStorage)[links.commandBindingKey(target)], [builtIn.id, custom.id, 'custom-third']);
const factory = globalThis.indexedDB;
const preserved = [raw, linkRaw];
abortNextLock = true;
await assert.rejects(() => links.setCommandLinked(target, builtIn.id, false, linkStorage), /锁已中止/);
assert.deepEqual([raw, linkRaw], preserved, '锁中止时未执行 localStorage 写入');
const failedOpen = { open() {
  const request = {};
  setImmediate(() => request.onerror?.());
  return request;
} };
globalThis.indexedDB = failedOpen;
await assert.rejects(() => store.saveCommand(profile.id, group.id, { ...custom, id: 'custom-open-failed' }, undefined, storage), /无法打开/);
assert.deepEqual([raw, linkRaw], preserved);
let lateConnectionClosed = false;
globalThis.indexedDB = { open() {
  const request = {};
  setImmediate(() => {
    request.onblocked?.();
    request.result = { close() { lateConnectionClosed = true; }, transaction() { throw new Error('迟到打开不得开始写入'); } };
    request.onsuccess?.();
  });
  return request;
} };
await assert.rejects(() => links.setCommandLinked(target, builtIn.id, false, linkStorage), /锁被占用/);
assert(lateConnectionClosed);
assert.deepEqual([raw, linkRaw], preserved, '打开阻塞后迟到结果不能写入');
globalThis.indexedDB = undefined;
try {
  await assert.rejects(() => store.deleteCommand(profile.id, group.id, { ...custom, title: '窗口一' }, storage), /锁不可用/);
  await assert.rejects(() => links.setCommandLinked(target, builtIn.id, false, linkStorage), /锁不可用/);
  assert.deepEqual([raw, linkRaw], preserved, '无法取得锁不能退化成无锁写入');
} finally { globalThis.indexedDB = factory; }
const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
let expire;
globalThis.setTimeout = (callback, ms) => { assert.equal(ms, 10000); expire = callback; return 0; };
globalThis.clearTimeout = () => {};
try {
  const pending = links.setCommandLinked(target, builtIn.id, false, linkStorage);
  expire();
  await assert.rejects(() => pending, /锁超时/);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([raw, linkRaw], preserved, '超时后的迟到打开不执行写入');
} finally { globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout; }
await links.setCommandLinked(target, 'custom-after-failure', true, linkStorage);
assert(links.readCommandBindings(linkStorage)[links.commandBindingKey(target)].includes('custom-after-failure'), '失败释放后其他写入仍可完成');
assert(lockReads > 0, '实际写入必须通过 readwrite 请求取得锁');
assert.deepEqual(store.commandFieldErrors({ ...custom, title: ' ', command: '', note: 'x'.repeat(4001) }), {
  title: '请填写非空标题，最多 120 字。', command: '请填写非空命令，最多 32768 字。', note: '说明最多 4000 字。',
});
assert.deepEqual(store.commandFieldErrors(custom), {});
console.log('PASS 跨独立连接读改写串行、不同命令/检查项无丢失、同命令冲突拒绝、锁不可用保护与逐字段校验');

const defaults = await load('src/utils/assessmentCommandDefaults.ts');
const values = new Map();
const auxiliary = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const scope = { projectId: 'legacy-project', categoryId: 'servers', assetId: 'server-0' };
const itemTarget = { ...scope, itemId: 'old-item' };
const resolve = (asset = scope, label = '身份鉴别', bindings = {}) => defaults.resolveItemCommandIds(profiles, defaults.readCommandDefaults(auxiliary), bindings, { ...asset, itemId: 'old-item' }, label);
assert.deepEqual(resolve(), [], '未选择平台不得猜操作系统');
await defaults.setCommandDefault('category', scope, 'linux-rhel', auxiliary);
const inherited = linux.groups[0].snippets.map(s => s.id);
for (const platform of profiles) {
  const platformScope = { projectId: 'all-families', categoryId: platform.family, assetId: 'existing-0' };
  await defaults.setCommandDefault('category', platformScope, platform.id, auxiliary);
  for (let i = 0; i < 11; i++) {
    const target = { ...platformScope, assetId: `existing-${i}`, itemId: 'identity' };
    for (const [label, purpose] of [['身份鉴别', 'identity'], ['安全审计', 'audit'], ['访问控制', 'access'], ['版本', 'version']]) {
      const expected = platform.groups.find(g => g.id === `${platform.id}-${purpose}`)?.snippets.map(s => s.id) ?? [];
      assert.deepEqual(defaults.resolveItemCommandIds(profiles, defaults.readCommandDefaults(auxiliary), {}, target, label), expected, `${platform.id} 十台已有及新增资产继承 ${label}，无对应组时保持为空`);
    }
    assert.deepEqual(defaults.resolveItemCommandIds(profiles, defaults.readCommandDefaults(auxiliary), {}, { ...target, categoryId: 'unconfigured' }, '身份鉴别'), [], '分类配置隔离');
  }
}
for (let i = 0; i < 11; i++) assert.deepEqual(resolve({ ...scope, assetId: `server-${i}` }), inherited, '已有十台与新增资产一致继承');
for (const label of ['身份鉴别', ' 1. 身份鉴别 ', '（一）身份鉴别：']) assert.deepEqual(resolve(scope, label), inherited);
for (const label of ['门禁', '截图', '身份鉴别与访问控制', '未知身份鉴别', '安全审计/访问控制']) assert.deepEqual(resolve(scope, label), []);
assert(resolve(scope, '安全审计').every(id => id.startsWith('linux-rhel-audit-')));
await defaults.setCommandDefault('asset', scope, 'windows', auxiliary);
assert(resolve().every(id => id.startsWith('windows-')));
assert.deepEqual(resolve({ ...scope, assetId: 'server-1' }), inherited);
await defaults.setCommandDefault('asset', scope, null, auxiliary);
assert.deepEqual(resolve(), inherited);
assert.deepEqual(resolve({ ...scope, projectId: 'other' }), []);
const old = { [links.commandBindingKey(itemTarget)]: [custom.id] };
assert.deepEqual(resolve(scope, '身份鉴别', old), [custom.id], '旧手动关联优先');
await links.setCommandLinked(itemTarget, inherited[0], false, auxiliary, () => inherited);
assert.deepEqual(resolve(scope, '身份鉴别', links.readCommandBindings(auxiliary)), inherited.slice(1));
for (const id of inherited.slice(1)) await links.setCommandLinked(itemTarget, id, false, auxiliary, () => inherited);
assert.deepEqual(links.readCommandBindings(auxiliary)[links.commandBindingKey(itemTarget)], [], '空覆盖必须持久化');
assert.deepEqual(resolve(scope, '身份鉴别', links.readCommandBindings(auxiliary)), []);
await links.resetCommandBinding(itemTarget, auxiliary);
assert.deepEqual(resolve(scope, '身份鉴别', links.readCommandBindings(auxiliary)), inherited);
await Promise.all([defaults.setCommandDefault('asset', scope, 'windows', auxiliary), defaults.setCommandDefault('asset', { ...scope, assetId: 'server-1' }, 'linux-debian', auxiliary)]);
assert.equal(Object.keys(defaults.readCommandDefaults(auxiliary).assets).length, 2);
const preservedDefaults = auxiliary.getItem(defaults.COMMAND_DEFAULTS_KEY);
await assert.rejects(() => defaults.setCommandDefault('category', scope, 'bad-profile', auxiliary));
await assert.rejects(() => defaults.setCommandDefault('category', scope, 'windows', { ...auxiliary, setItem() { throw new Error('拒绝写入'); } }), /拒绝/);
assert.equal(auxiliary.getItem(defaults.COMMAND_DEFAULTS_KEY), preservedDefaults);
for (const raw of ['broken', '{"version":2}', '{"version":1,"categories":{},"assets":{"bad":"windows"}}']) {
  auxiliary.setItem(defaults.COMMAND_DEFAULTS_KEY, raw);
  assert.throws(() => defaults.readCommandDefaults(auxiliary));
  await assert.rejects(() => defaults.setCommandDefault('category', scope, 'windows', auxiliary));
  assert.equal(auxiliary.getItem(defaults.COMMAND_DEFAULTS_KEY), raw);
}
console.log('PASS 四类12平台默认继承、受控名称、十台/新增资产、单台覆盖、手动/空覆盖/恢复、存储保护和串行写入');

// 验证桌面数据目录迁移与重连：迁移复制、缓存跳过、指针和备份、
// 路径失效时阻止空库启动、重新定位与防覆盖。使用模拟 Electron 和临时目录。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evd-dataloc-'));
const appData = path.join(tmpRoot, 'AppData', 'Roaming');
// 打包后的 package.json 没有 productName，应用名取 name，故默认 userData 是 %APPDATA%\picture_ocr。
const APP_NAME = 'picture_ocr';
const defaultUserData = path.join(appData, APP_NAME);

let userDataPath = defaultUserData;
let dialogResult = { canceled: true, filePaths: [] };

const mockElectron = {
  app: {
    getPath: (key) => (key === 'appData' ? appData : userDataPath),
    getName: () => APP_NAME,
    setPath: (key, value) => { if (key === 'userData') userDataPath = value; },
    relaunch: () => {},
    exit: () => {},
  },
  dialog: {
    showMessageBox: async () => ({ response: dialogResult.messageResponse ?? 0 }),
    showOpenDialog: async () => dialogResult,
  },
};

// 拦截 require('electron')
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return mockElectron;
  return origLoad.apply(this, arguments);
};

function freshModule() {
  delete require.cache[require.resolve('../electron/dataLocation.cjs')];
  return require('../electron/dataLocation.cjs');
}

const results = [];
function check(name, cond) {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

function seedDefaultUserData() {
  fs.rmSync(defaultUserData, { recursive: true, force: true });
  fs.mkdirSync(path.join(defaultUserData, 'IndexedDB', 'https_x'), { recursive: true });
  fs.writeFileSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb'), 'dbdata');
  fs.mkdirSync(path.join(defaultUserData, 'Local Storage'), { recursive: true });
  fs.writeFileSync(path.join(defaultUserData, 'Local Storage', 'leveldb.log'), 'ls');
  fs.mkdirSync(path.join(defaultUserData, 'GPUCache'), { recursive: true });
  fs.writeFileSync(path.join(defaultUserData, 'GPUCache', 'cache'), 'junk');
}

(async () => {
  check('新数据子目录不再带测评字样', freshModule().DATA_SUBDIR === '证据采集数据');

  // 场景1：默认位置、无配置 → init 不改位置
  seedDefaultUserData();
  userDataPath = defaultUserData;
  let dl = freshModule();
  dl.init();
  check('无配置时保持默认 userData', userDataPath === defaultUserData);
  check('无配置时 isDefault=true', dl.getLocationInfo().isDefault === true);

  // 场景2：选择新目录 → 写迁移标记（此时不复制）
  const chosenParent = path.join(tmpRoot, 'D_drive');
  const target = path.join(chosenParent, dl.DATA_SUBDIR);
  dialogResult = { canceled: false, filePaths: [chosenParent] };
  const chooseRes = await dl.chooseLocation({});
  check('chooseLocation 返回 needRestart', chooseRes.changed === true && chooseRes.needRestart === true);
  check('choose 后目标尚未有数据（复制留待重启）', !fs.existsSync(path.join(target, 'IndexedDB')));
  const cfgPath = path.join(defaultUserData, 'data-location.json');
  check('choose 写入 migration 标记', JSON.parse(fs.readFileSync(cfgPath, 'utf8')).migration != null);

  // 场景3：模拟重启 → init 处理迁移标记：复制到新目录、切换、记备份
  userDataPath = defaultUserData; // 重启初态回到默认，由 init 决定
  dl = freshModule();
  dl.init();
  check('重启后 userData 切到目标', userDataPath === target);
  check('目标含 IndexedDB 数据', fs.readFileSync(path.join(target, 'IndexedDB', 'https_x', '000001.ldb'), 'utf8') === 'dbdata');
  check('目标含 Local Storage', fs.existsSync(path.join(target, 'Local Storage', 'leveldb.log')));
  check('缓存目录 GPUCache 被跳过', !fs.existsSync(path.join(target, 'GPUCache')));
  check('指针未被复制到目标', !fs.existsSync(path.join(target, 'data-location.json')));
  const info3 = dl.getLocationInfo();
  check('迁移后 isDefault=false', info3.isDefault === false);
  check('迁移后有备份记录', info3.backup && info3.backup.dir === defaultUserData);
  check('备份剩余天数约 7', info3.backup.remainingDays >= 6 && info3.backup.remainingDays <= 7);
  check('原默认目录仍保留数据（备份）', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));

  // 场景4：备份未过期 → cleanup 不删
  dl.cleanupExpiredBackup();
  check('未过期备份不被清理', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));

  // 场景5：把备份 createdAt 改为 8 天前 → cleanup 删除旧 store 但保留指针
  {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.backup.createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  }
  dl.cleanupExpiredBackup();
  check('过期备份的旧 store 被清理', !fs.existsSync(path.join(defaultUserData, 'IndexedDB')));
  check('过期清理保留指针文件', fs.existsSync(cfgPath));
  check('清理后 backup 字段移除', dl.getLocationInfo().backup === undefined);

  // 场景6：恢复默认 → 迁移标记 → 重启复制回默认
  const infoBefore = dl.getLocationInfo();
  check('恢复前当前为自定义', infoBefore.isDefault === false);
  const resetRes = dl.resetLocation();
  check('resetLocation 返回 needRestart', resetRes.changed === true && resetRes.needRestart === true);
  userDataPath = defaultUserData; // 真实重启：新进程 userData 总从 OS 默认位置起步（setPath 尚未执行）
  dl = freshModule();
  dl.init();
  check('恢复默认后 userData 回到默认', userDataPath === defaultUserData);
  check('默认目录重新含数据', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));
  check('恢复后 isDefault=true', dl.getLocationInfo().isDefault === true);
  check('恢复后备份指向旧自定义目录', dl.getLocationInfo().backup && dl.getLocationInfo().backup.dir === target);

  // 场景7：手动立即删除备份（自定义目录整删）
  const delRes = dl.deleteBackup();
  check('deleteBackup 成功', delRes.deleted === true);
  check('自定义备份目录被删除', !fs.existsSync(target));
  check('删除后 backup 字段移除', dl.getLocationInfo().backup === undefined);

  // 场景7b：旧版本创建的自定义备份子目录名仍允许删除。
  {
    const legacyBackup = path.join(tmpRoot, 'old_drive', '测评证据采集数据');
    fs.mkdirSync(legacyBackup, { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify({ version: 1, backup: { dir: legacyBackup, createdAt: Date.now(), isDefaultRoot: false } }));
    check('旧名自定义备份可删除', dl.deleteBackup().deleted === true && !fs.existsSync(legacyBackup));
  }

  // 场景8：路径不可用时要求定位，尚未切换路径但不允许打开默认库。
  {
    // 父路径是文件，目录检查必须失败而不能尝试创建。
    const badBase = path.join(tmpRoot, 'bad');
    fs.writeFileSync(badBase, 'not a dir');
    const badDir = path.join(badBase, 'sub'); // 父是文件 → mkdir 必失败
    fs.writeFileSync(cfgPath, JSON.stringify({ version: 1, dataDir: badDir }));
    userDataPath = defaultUserData;
    dl = freshModule();
    dl.init();
    check('不可用路径在定位前不切换 userData', userDataPath === defaultUserData);
    check('不可用路径必须阻止工作台启动', dl.needsLocationRecovery() === true);
    check('不可用目录时给出启动告警', typeof dl.getLocationInfo().startupWarning === 'string');
  }

  // 场景9：用户手动重命名目录，启动不得重新创建旧路径或打开空库。
  {
    seedDefaultUserData();
    const original = path.join(tmpRoot, 'rename-test', 'old');
    const renamed = path.join(tmpRoot, 'rename-test', 'renamed');
    fs.mkdirSync(path.join(original, 'IndexedDB', 'file__0.indexeddb.leveldb'), { recursive: true });
    fs.writeFileSync(path.join(original, 'IndexedDB', 'file__0.indexeddb.leveldb', 'CURRENT'), 'original database');
    fs.renameSync(original, renamed);
    fs.writeFileSync(cfgPath, JSON.stringify({ dataDir: original }));
    userDataPath = defaultUserData;
    dl = freshModule();
    dl.init();
    check('目录改名后启动不重建旧路径', !fs.existsSync(original));
    check('目录改名后启动阻塞工作台', dl.needsLocationRecovery?.() === true);
    if (dl.recoverMissingLocation) {
      dialogResult = { canceled: true, filePaths: [] };
      check('取消目录定位不允许进入工作台', await dl.recoverMissingLocation() === false);
      check('取消保留原指针', JSON.parse(fs.readFileSync(cfgPath)).dataDir === original);
      dialogResult = { canceled: false, filePaths: [renamed] };
      check('选择改名后的原目录可重新连接', await dl.recoverMissingLocation() === true);
      check('重连直接使用原目录', userDataPath === renamed);
      check('重连不创建嵌套目录', !fs.existsSync(path.join(renamed, dl.DATA_SUBDIR)));
      check('重连后指针写为原目录新路径', JSON.parse(fs.readFileSync(cfgPath)).dataDir === renamed);
      check('重连不复制或修改数据库文件', fs.readFileSync(path.join(renamed, 'IndexedDB', 'file__0.indexeddb.leveldb', 'CURRENT'), 'utf8') === 'original database');
    } else check('提供启动目录定位入口', false);

    // 已启动在被重建的库里，存储设置仍可直接切换到原目录。
    dialogResult = { canceled: false, filePaths: [renamed] };
    const connect = await dl.chooseLocation({});
    check('当前目录选择自身不重复连接', connect.changed === false);
    userDataPath = defaultUserData;
    dl = freshModule();
    fs.writeFileSync(cfgPath, '{}');
    dl.init();
    const selection = await dl.chooseLocation({});
    check('选择已有数据目录返回直连模式', selection.changed === true && selection.mode === 'connect' && selection.dataDir === renamed);
    check('直连选择不复制空库覆盖原库', fs.readFileSync(path.join(renamed, 'IndexedDB', 'file__0.indexeddb.leveldb', 'CURRENT'), 'utf8') === 'original database');
    userDataPath = defaultUserData;
    dl = freshModule();
    dl.init();
    check('直连重启使用所选目录本身', userDataPath === renamed);
  }

  // 场景10：迁移冲突、源消失与嵌套不能产生数据库合并。
  {
    seedDefaultUserData();
    userDataPath = defaultUserData;
    const conflict = path.join(tmpRoot, 'conflict');
    fs.mkdirSync(path.join(conflict, 'IndexedDB'), { recursive: true });
    fs.writeFileSync(path.join(conflict, 'IndexedDB', 'original.ldb'), 'keep');
    fs.writeFileSync(cfgPath, JSON.stringify({ migration: { from: defaultUserData, to: conflict } }));
    dl = freshModule();
    dl.init();
    check('目标数据库已存在时拒绝迁移', userDataPath === defaultUserData && typeof dl.getLocationInfo().startupWarning === 'string');
    check('冲突时目标不混入源文件', !fs.existsSync(path.join(conflict, 'IndexedDB', 'https_x')));
    check('冲突时保留目标内容', fs.readFileSync(path.join(conflict, 'IndexedDB', 'original.ldb'), 'utf8') === 'keep');
    const occupiedParent = path.join(tmpRoot, 'occupied-parent');
    const occupiedChild = path.join(occupiedParent, dl.DATA_SUBDIR);
    fs.mkdirSync(path.join(occupiedChild, 'IndexedDB'), { recursive: true });
    fs.writeFileSync(path.join(occupiedChild, 'IndexedDB', 'keep.ldb'), 'target');
    const originalPointer = fs.readFileSync(cfgPath, 'utf8');
    dialogResult = { canceled: false, filePaths: [occupiedParent] };
    const parentSelection = await dl.chooseLocation({});
    check('选择含已有库的父目录时拒绝迁移，不猜测连接子目录', parentSelection.changed === false && typeof parentSelection.error === 'string');
    check('父目录冲突不修改指针或目标数据', fs.readFileSync(cfgPath, 'utf8') === originalPointer && fs.readFileSync(path.join(occupiedChild, 'IndexedDB', 'keep.ldb'), 'utf8') === 'target');
    fs.writeFileSync(cfgPath, originalPointer);
    const absentSource = path.join(tmpRoot, 'missing-source');
    const absentTarget = path.join(tmpRoot, 'missing-target');
    fs.writeFileSync(cfgPath, JSON.stringify({ dataDir: absentSource, migration: { from: absentSource, to: absentTarget } }));
    userDataPath = defaultUserData;
    dl = freshModule();
    dl.init();
    check('源消失不切换到空目标', !fs.existsSync(absentTarget) && dl.needsLocationRecovery?.() === true);
    check('源消失不标记迁移成功', !JSON.parse(fs.readFileSync(cfgPath)).backup);
    fs.writeFileSync(cfgPath, JSON.stringify({ migration: { from: defaultUserData, to: path.join(defaultUserData, 'nested') } }));
    userDataPath = defaultUserData;
    dl = freshModule();
    dl.init();
    check('迁移拒绝源目标嵌套', !fs.existsSync(path.join(defaultUserData, 'nested')));
  }

  // 场景11：损坏配置、无效定位及旧版重建的空目录均不能静默打开工作台。
  {
    seedDefaultUserData();
    for (const content of ['{broken', 'null', '[]', '{"dataDir":"relative"}']) {
      fs.writeFileSync(cfgPath, content);
      userDataPath = defaultUserData;
      dl = freshModule();
      dl.init();
      check(`配置无效时要求定位：${content}`, dl.needsLocationRecovery() === true);
      dialogResult = { messageResponse: 1, canceled: false, filePaths: [defaultUserData] };
      check('退出定位不修改损坏配置', await dl.recoverMissingLocation() === false && fs.readFileSync(cfgPath, 'utf8') === content);
    }
    dialogResult = { canceled: false, filePaths: [defaultUserData] };
    check('明确选择默认位置的有效库可修复配置', await dl.recoverMissingLocation() === true && !JSON.parse(fs.readFileSync(cfgPath)).dataDir);
    const empty = path.join(tmpRoot, 'recreated-empty');
    fs.mkdirSync(empty);
    fs.writeFileSync(cfgPath, JSON.stringify({ dataDir: empty }));
    userDataPath = defaultUserData;
    dl = freshModule(); dl.init();
    check('旧版重建的无数据目录仍要求定位', dl.needsLocationRecovery() === true);
    dialogResult = { canceled: false, filePaths: [empty] };
    check('无 IndexedDB 的选择失败且保留原指针', await dl.recoverMissingLocation() === false && JSON.parse(fs.readFileSync(cfgPath)).dataDir === empty);
    check('无效选择不创建 IndexedDB', !fs.existsSync(path.join(empty, 'IndexedDB')));
    const access = fs.accessSync;
    fs.accessSync = dir => { if (dir === defaultUserData) throw Object.assign(new Error('access denied'), { code: 'EACCES' }); return access(dir); };
    try {
      dialogResult = { canceled: false, filePaths: [defaultUserData] };
      check('权限错误阻止定位并保持恢复状态', await dl.recoverMissingLocation() === false && dl.needsLocationRecovery() === true);
    } finally { fs.accessSync = access; }
    const rename = fs.renameSync;
    const previousConfig = fs.readFileSync(cfgPath, 'utf8');
    fs.renameSync = (from, to) => { if (to === cfgPath) throw new Error('config write denied'); return rename(from, to); };
    try {
      let failed = false;
      try { await dl.recoverMissingLocation(); } catch { failed = true; }
      check('配置保存失败不解除启动阻塞', failed && dl.needsLocationRecovery() === true && fs.readFileSync(cfgPath, 'utf8') === previousConfig);
    } finally { fs.renameSync = rename; }
  }

  // 场景12：已选择目录在重启前失效，以及历史备份保护。
  {
    seedDefaultUserData();
    userDataPath = defaultUserData;
    const lost = path.join(tmpRoot, 'selected-then-lost');
    fs.writeFileSync(cfgPath, JSON.stringify({ migration: { mode: 'connect', from: defaultUserData, to: lost } }));
    dl = freshModule(); dl.init();
    check('待直连目录消失不回落到默认工作台', dl.needsLocationRecovery() === true && !fs.existsSync(lost));
    const historical = path.join(tmpRoot, 'historical', '证据采集数据');
    fs.mkdirSync(historical, { recursive: true });
    fs.writeFileSync(path.join(historical, 'keep'), 'backup');
    fs.writeFileSync(cfgPath, JSON.stringify({ dataDir: lost, backup: { dir: historical, createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000 } }));
    userDataPath = defaultUserData;
    dl = freshModule(); dl.init();
    dialogResult = { canceled: false, filePaths: [defaultUserData] };
    await dl.recoverMissingLocation();
    dl.cleanupExpiredBackup();
    check('重连后过期历史备份不自动清理', fs.existsSync(path.join(historical, 'keep')) && dl.getLocationInfo().backup.preserve === true);
    // 备份路径包含当前数据目录时，手动删除同样必须保护正在使用的库。
    fs.writeFileSync(cfgPath, JSON.stringify({ backup: { dir: path.dirname(defaultUserData), isDefaultRoot: true } }));
    dl.deleteBackup();
    check('备份位于当前数据目录祖先时不删除当前库', fs.existsSync(path.join(defaultUserData, 'IndexedDB', 'https_x', '000001.ldb')));
  }

  // 清理临时目录
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.error('FAILED:', failed.map((f) => f.name).join('; ')); process.exit(1); }
})();

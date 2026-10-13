// 桌面版数据目录迁移：指针 / 数据本体分离。
// C 盘（%APPDATA%\<应用名>）只保留几 KB 指针 data-location.json，
// 真正占地方的 IndexedDB / Local Storage 落在用户自选目录。
//
// 关键：实际的目录复制在“下次启动、Electron 尚未打开任何 store 之前”进行，
// 而不是在应用运行中复制——因为运行期 IndexedDB(leveldb) 的 LOCK/.ldb 文件在
// Windows 上处于占用状态，复制会失败或得到不一致快照。运行中的“更改目录/恢复默认”
// 只写一个 migration 标记并重启，重启早期再完成复制。
const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = 'data-location.json';
const DATA_SUBDIR = '证据采集数据';
// 改名前迁移到自定义位置的数据仍在旧子目录名下，备份清理必须仍能识别。
const LEGACY_DATA_SUBDIRS = ['测评证据采集数据'];
const BACKUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 备份保留 7 天
const DAY_MS = 24 * 60 * 60 * 1000;
// 复制时跳过的无关/易锁定缓存目录，以及指针本体（指针只应存在于默认位置）。
const COPY_SKIP = new Set(['GPUCache', 'Code Cache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'logs', CONFIG_FILE]);

let defaultUserData = null; // 默认 userData（%APPDATA%\<应用名>），启动早期捕获，后续不变
let startupWarning = null;
let recoveryRequired = false;

function samePath(a, b) {
  if (!a || !b) return false;
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function setDataPath(dir) {
  app.setPath('userData', dir);
  // ready 后重新定位时，Chromium 的 sessionData 默认值可能已取过旧路径。
  app.setPath('sessionData', dir);
}

function configPath() {
  // 指针永远放默认 userData 下，不随数据目录迁移而移动。
  return path.join(defaultUserData || app.getPath('userData'), CONFIG_FILE);
}

function readConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error('配置必须为对象。');
    if (cfg.dataDir !== undefined && (typeof cfg.dataDir !== 'string' || !path.isAbsolute(cfg.dataDir))) throw new Error('数据目录路径无效。');
    if (cfg.migration && (typeof cfg.migration.from !== 'string' || !path.isAbsolute(cfg.migration.from)
      || typeof cfg.migration.to !== 'string' || !path.isAbsolute(cfg.migration.to)
      || ![undefined, 'migrate', 'connect'].includes(cfg.migration.mode))) throw new Error('待处理的数据目录操作无效。');
    return cfg;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`无法读取数据目录配置：${err.message}`);
  }
}

function writeConfig(cfg) {
  const target = configPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

function isDirWritable(dir) {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// 目录名不代表归属；只认可实际包含 IndexedDB 的数据目录。
function isDataDirectory(dir) {
  try {
    const databaseDir = path.join(dir, 'IndexedDB');
    return fs.statSync(databaseDir).isDirectory() && fs.readdirSync(databaseDir).length > 0;
  } catch {
    return false;
  }
}

function containsPath(parent, child) {
  const relative = path.relative(path.resolve(parent).toLowerCase(), path.resolve(child).toLowerCase());
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function validateMigration(src, dst) {
  if (containsPath(src, dst) || containsPath(dst, src)) throw new Error('源目录和目标目录不能相同或互相包含。');
  if (!isDirWritable(src) || !isDataDirectory(src)) throw new Error('原数据目录不存在或不可读，请重新定位原数据目录。');
  if (fs.existsSync(dst)) {
    if (!isDirWritable(dst)) throw new Error('目标目录不可写。');
    const occupied = fs.readdirSync(dst).filter((name) => !COPY_SKIP.has(name));
    if (occupied.length > 0) throw new Error('目标目录已有文件，不能合并或覆盖数据库。若要读取已有数据，请直接选择包含 IndexedDB 的数据目录。');
  }
}

// 复制目录内容：跳过缓存/指针；复制而非移动，从不删除源。
function copyDir(src, dst) {
  validateMigration(src, dst);
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (COPY_SKIP.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(from, to, { recursive: true });
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

// 删除一份备份。defaultRoot 备份保留指针文件；自定义备份整目录删除。
// 安全护栏：绝不删除当前正在使用的 userData。
function deleteBackupDir(backup) {
  if (!backup || !backup.dir) return;
  if (containsPath(backup.dir, app.getPath('userData'))) return;
  if (backup.isDefaultRoot) {
    for (const name of fs.readdirSync(backup.dir)) {
      if (name === CONFIG_FILE) continue;
      fs.rmSync(path.join(backup.dir, name), { recursive: true, force: true });
    }
  } else {
    // 自定义备份必是本工具建的数据子目录，避免误删用户放同目录的其它文件。
    if (![DATA_SUBDIR, ...LEGACY_DATA_SUBDIRS].includes(path.basename(backup.dir))) return;
    fs.rmSync(backup.dir, { recursive: true, force: true });
  }
}

// 启动早期调用（app ready 之前）：处理待迁移标记 + 应用指针。
function init() {
  try {
    defaultUserData = app.getPath('userData');
    let cfg = readConfig();

    // 1) 处理上一次运行遗留的迁移标记：此刻 store 尚未打开，复制安全。
    if (cfg.migration && cfg.migration.from && cfg.migration.to) {
      const { from, to, mode } = cfg.migration;
      const next = { ...cfg };
      try {
        if (cfg.migration.mode === 'connect') {
          if (!isDirWritable(to) || !isDataDirectory(to)) throw new Error('所选原数据目录不存在或不可用。');
          // 重新连接不搬运任何数据库文件，也不自动清理历史备份。
          if (cfg.backup) next.backup = { ...cfg.backup, preserve: true };
        } else {
          copyDir(from, to);
          next.backup = { dir: from, createdAt: Date.now(), isDefaultRoot: samePath(from, defaultUserData) };
        }
        if (samePath(to, defaultUserData)) delete next.dataDir;
        else next.dataDir = to;
        delete next.migration;
        writeConfig(next);
        cfg = next;
      } catch (err) {
        startupWarning = `数据目录操作失败：${err && err.message ? err.message : err}`;
        // 直连失败或原目录已消失时不能回落到默认空库。
        if (mode === 'connect' || !isDataDirectory(from)) recoveryRequired = true;
        delete cfg.migration;
        try { writeConfig(cfg); } catch {}
      }
    }

    // 2) 应用指针
    if (cfg.dataDir !== undefined) {
      if (typeof cfg.dataDir === 'string' && isDirWritable(cfg.dataDir) && isDataDirectory(cfg.dataDir)) {
        setDataPath(cfg.dataDir);
      } else {
        recoveryRequired = true;
        startupWarning = `原数据目录不存在或不可用，可能已被重命名、移动或磁盘未连接：${cfg.dataDir}`;
      }
    }
  } catch (err) {
    recoveryRequired = true;
    startupWarning = `数据目录配置读取失败：${err && err.message ? err.message : err}`;
  }
}

function needsLocationRecovery() {
  return recoveryRequired;
}

// 必须在 app ready 后、创建任何工作台窗口前调用，避免 Chromium 先打开默认空库。
async function recoverMissingLocation() {
  if (!recoveryRequired) return true;
  const confirmation = await dialog.showMessageBox({
    type: 'warning',
    title: '请重新定位原数据目录',
    message: startupWarning,
    detail: '请选择重命名或移动后的原数据目录本身（内含 IndexedDB）。取消将退出客户端，不会新建空数据库。',
    buttons: ['选择原数据目录', '退出'],
    defaultId: 0,
    cancelId: 1,
  });
  if (confirmation.response !== 0) return false;
  const result = await dialog.showOpenDialog({
    title: '选择原数据目录（包含 IndexedDB）',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return false;
  const chosen = result.filePaths[0];
  if (!isDirWritable(chosen) || !isDataDirectory(chosen)) {
    await dialog.showMessageBox({ type: 'error', title: '无法连接数据目录', message: '所选目录未包含 IndexedDB 数据或不可访问，请选择原数据目录本身。' });
    return false;
  }
  let cfg;
  try { cfg = readConfig(); } catch { cfg = {}; }
  cfg.dataDir = chosen;
  if (samePath(chosen, defaultUserData)) delete cfg.dataDir;
  delete cfg.migration;
  if (cfg.backup) cfg.backup.preserve = true;
  writeConfig(cfg);
  setDataPath(chosen);
  recoveryRequired = false;
  startupWarning = '已重新连接原数据目录。';
  return true;
}

function backupInfo(cfg) {
  if (!cfg.backup || !cfg.backup.dir) return undefined;
  const age = Date.now() - (cfg.backup.createdAt || 0);
  const remainingDays = Math.max(0, Math.ceil((BACKUP_RETENTION_MS - age) / DAY_MS));
  return { dir: cfg.backup.dir, createdAt: cfg.backup.createdAt || 0, remainingDays, preserve: !!cfg.backup.preserve };
}

function getLocationInfo() {
  const current = app.getPath('userData');
  const cfg = readConfig();
  return {
    current,
    isDefault: samePath(current, defaultUserData),
    defaultDir: defaultUserData,
    startupWarning: startupWarning || undefined,
    backup: backupInfo(cfg),
  };
}

// 运行中：弹目录选择框，写迁移标记（复制留待重启后进行）。
async function chooseLocation(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: '选择数据存储位置',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) return { changed: false };
  const chosen = result.filePaths[0];
  const mode = isDataDirectory(chosen) ? 'connect' : 'migrate';
  const target = mode === 'connect' ? chosen : path.join(chosen, DATA_SUBDIR);
  const current = app.getPath('userData');
  if (samePath(target, current)) return { changed: false, reason: '所选目录与当前位置相同。' };
  try {
    if (mode === 'connect') {
      if (!isDirWritable(target)) throw new Error('原数据目录不可访问。');
    } else {
      validateMigration(current, target);
    }
  } catch (err) {
    return { changed: false, error: err.message };
  }

  const cfg = readConfig();
  cfg.migration = { mode, from: current, to: target, createdAt: Date.now() };
  writeConfig(cfg);
  return { changed: true, dataDir: target, needRestart: true, mode };
}

// 运行中：恢复默认位置，写迁移标记（复制留待重启后进行）。
function resetLocation() {
  const current = app.getPath('userData');
  if (samePath(current, defaultUserData)) return { changed: false, reason: '当前已是默认位置。' };
  try { validateMigration(current, defaultUserData); }
  catch (err) { return { changed: false, error: err.message }; }
  const cfg = readConfig();
  cfg.migration = { from: current, to: defaultUserData, createdAt: Date.now() };
  writeConfig(cfg);
  return { changed: true, needRestart: true };
}

function deleteBackup() {
  const cfg = readConfig();
  if (!cfg.backup) return { deleted: false };
  try {
    deleteBackupDir(cfg.backup);
    delete cfg.backup;
    writeConfig(cfg);
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: err && err.message ? err.message : String(err) };
  }
}

// app ready 之后后台调用：备份过期则清理。删除失败仅忽略，下次启动再试。
function cleanupExpiredBackup() {
  try {
    const cfg = readConfig();
    if (!cfg.backup || !cfg.backup.dir || cfg.backup.preserve) return;
    const age = Date.now() - (cfg.backup.createdAt || 0);
    if (age < BACKUP_RETENTION_MS) return;
    deleteBackupDir(cfg.backup);
    delete cfg.backup;
    writeConfig(cfg);
  } catch {
    // 忽略：不影响使用
  }
}

module.exports = {
  DATA_SUBDIR,
  BACKUP_RETENTION_MS,
  init,
  needsLocationRecovery,
  recoverMissingLocation,
  getLocationInfo,
  chooseLocation,
  resetLocation,
  deleteBackup,
  cleanupExpiredBackup,
};

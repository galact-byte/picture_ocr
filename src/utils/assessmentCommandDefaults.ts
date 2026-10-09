import { assessmentCommandProfiles } from '../data/assessmentCommands';
import type { CommandProfile } from '../data/assessmentCommands';
import { commandBindingKey } from './assessmentCommandBindings';
import type { CommandBindings, CommandTarget } from './assessmentCommandBindings';
import { withCommandWriteLock } from './commandWriteLock';

export const COMMAND_DEFAULTS_KEY = 'evidence-assessment-command-defaults-v1';
export interface CommandScope { projectId: string; categoryId?: string; assetId: string }
export interface CommandDefaults { categories: Record<string, string>; assets: Record<string, string> }
type CommandStorage = Pick<Storage, 'getItem' | 'setItem'>;
const validPart = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 300;
function scopeKey(projectId: string, id: string): string {
  if (!validPart(projectId) || !validPart(id)) throw new Error('默认命令平台的作用范围无效。');
  return JSON.stringify([projectId, id]);
}
function readProfiles(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('默认命令平台格式异常。');
  const result: Record<string, string> = {};
  for (const [key, id] of Object.entries(value)) {
    const parts: unknown = JSON.parse(key);
    if (!Array.isArray(parts) || parts.length !== 2 || !parts.every(validPart) || JSON.stringify(parts) !== key
      || typeof id !== 'string' || !assessmentCommandProfiles.some(p => p.id === id)) throw new Error('默认命令平台记录异常。');
    result[key] = id;
  }
  return result;
}
function serialize(defaults: CommandDefaults): string {
  const text = JSON.stringify({ version: 1, ...defaults });
  if (Object.keys(defaults.categories).length + Object.keys(defaults.assets).length > 5000 || text.length > 2 * 1024 * 1024) throw new Error('默认命令平台配置超过容量上限。');
  return text;
}
export function readCommandDefaults(storage: CommandStorage = localStorage): CommandDefaults {
  const raw = storage.getItem(COMMAND_DEFAULTS_KEY);
  if (raw === null) return { categories: {}, assets: {} };
  if (raw.length > 2 * 1024 * 1024) throw new Error('默认命令平台配置超过容量上限。');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('categories' in value) || !('assets' in value)) throw new Error('默认命令平台格式异常。');
  const result = { categories: readProfiles(value.categories), assets: readProfiles(value.assets) };
  serialize(result);
  return result;
}
export async function setCommandDefault(kind: 'category' | 'asset', scope: CommandScope, profileId: string | null, storage: CommandStorage = localStorage): Promise<CommandDefaults> {
  return withCommandWriteLock(() => {
    if (kind !== 'category' && kind !== 'asset') throw new Error('默认命令平台的作用范围无效。');
    const key = scopeKey(scope.projectId, kind === 'category' ? scope.categoryId ?? '' : scope.assetId);
    if (profileId !== null && !assessmentCommandProfiles.some(p => p.id === profileId)) throw new Error('命令平台无效。');
    const defaults = readCommandDefaults(storage);
    const records = kind === 'category' ? defaults.categories : defaults.assets;
    if (profileId === null) delete records[key]; else records[key] = profileId;
    storage.setItem(COMMAND_DEFAULTS_KEY, serialize(defaults));
    return defaults;
  });
}
export function effectiveCommandProfile(defaults: CommandDefaults, scope: CommandScope): string | undefined {
  return defaults.assets[scopeKey(scope.projectId, scope.assetId)]
    ?? (scope.categoryId ? defaults.categories[scopeKey(scope.projectId, scope.categoryId)] : undefined);
}
export function hasAssetCommandOverride(defaults: CommandDefaults, scope: CommandScope): boolean {
  return Object.prototype.hasOwnProperty.call(defaults.assets, scopeKey(scope.projectId, scope.assetId));
}
// 精确白名单：组合名称不拆分，避免把歧义检查项挂到不相关的命令组。
const purposes: Record<string, string[]> = {
  identity: ['身份鉴别', '身份认证'], access: ['访问控制'], audit: ['安全审计', '日志审计', '审计日志'],
  failures: ['登录失败', '登录失败处理', '登录失败与超时'], remote: ['远程管理', '远程管理与登录'],
  version: ['版本', '系统版本', '数据库版本', '设备版本', '版本与运行状态', '版本与网络'],
};
export function matchCommandPurpose(label: string): string | undefined {
  const name = label.trim().replace(/^(?:[（(][一二三四五六七八九十\d]+[）)]|(?:\d+(?:\.\d+)*|[一二三四五六七八九十]+)[、.．)）])\s*/, '').replace(/\s+/g, '').replace(/[：:。．.]+$/, '');
  return Object.entries(purposes).find(([, aliases]) => aliases.includes(name))?.[0];
}
export function resolveItemCommandIds(profiles: CommandProfile[], defaults: CommandDefaults, bindings: CommandBindings, target: CommandTarget & CommandScope, label: string): string[] {
  const key = commandBindingKey(target);
  if (Object.prototype.hasOwnProperty.call(bindings, key)) return bindings[key];
  const profileId = effectiveCommandProfile(defaults, target);
  const purpose = matchCommandPurpose(label);
  if (!profileId || !purpose) return [];
  return profiles.find(p => p.id === profileId)?.groups.find(g => g.id === `${profileId}-${purpose}`)?.snippets.map(s => s.id) ?? [];
}

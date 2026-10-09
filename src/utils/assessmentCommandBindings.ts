import { withCommandWriteLock } from './commandWriteLock';

export const COMMAND_BINDINGS_KEY = 'evidence-assessment-command-bindings-v1';
export interface CommandTarget { projectId: string; assetId: string; itemId: string }
export type CommandBindings = Record<string, string[]>;
type CommandStorage = Pick<Storage, 'getItem' | 'setItem'>;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(value);
const validTargetPart = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 300;
export function commandBindingKey(target: CommandTarget): string {
  if (![target.projectId, target.assetId, target.itemId].every(validTargetPart)) throw new Error('检查项关联目标无效。');
  return JSON.stringify([target.projectId, target.assetId, target.itemId]);
}
export function readCommandBindings(storage: CommandStorage = localStorage): CommandBindings {
  const raw = storage.getItem(COMMAND_BINDINGS_KEY);
  if (raw === null) return {};
  if (raw.length > 2 * 1024 * 1024) throw new Error('检查项命令关联超过容量上限。');
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1 || !('bindings' in value)
    || typeof value.bindings !== 'object' || value.bindings === null || Array.isArray(value.bindings)) throw new Error('检查项命令关联格式异常，原内容已保留。');
  const entries = Object.entries(value.bindings);
  if (entries.length > 5000) throw new Error('检查项命令关联数量超过上限。');
  for (const [key, ids] of entries) {
    const target: unknown = JSON.parse(key);
    if (!Array.isArray(target) || target.length !== 3 || !target.every(validTargetPart) || JSON.stringify(target) !== key
      || !Array.isArray(ids) || ids.length > 100 || !ids.every(validId) || new Set(ids).size !== ids.length) {
      throw new Error('检查项命令关联记录异常，原内容已保留。');
    }
  }
  return Object.fromEntries(entries);
}
export async function setCommandLinked(target: CommandTarget, id: string, linked: boolean, storage: CommandStorage = localStorage, getDefaultIds: () => string[] = () => []): Promise<CommandBindings> {
  return withCommandWriteLock(() => {
    const key = commandBindingKey(target);
    if (!validId(id)) throw new Error('关联命令编号无效。');
    const bindings = readCommandBindings(storage);
    const current = bindings[key] ?? getDefaultIds();
    if (!Array.isArray(current) || !current.every(validId)) throw new Error('默认关联命令编号无效。');
    const ids = linked ? [...new Set([...current, id])] : current.filter(existing => existing !== id);
    if (ids.length > 100) throw new Error('一个检查项最多关联 100 段命令。');
    bindings[key] = ids;
    const serialized = JSON.stringify({ version: 1, bindings });
    if (Object.keys(bindings).length > 5000 || serialized.length > 2 * 1024 * 1024) throw new Error('检查项命令关联超过容量上限。');
    storage.setItem(COMMAND_BINDINGS_KEY, serialized);
    return bindings;
  });
}
export async function resetCommandBinding(target: CommandTarget, storage: CommandStorage = localStorage): Promise<CommandBindings> {
  return withCommandWriteLock(() => {
    const key = commandBindingKey(target);
    const bindings = readCommandBindings(storage);
    delete bindings[key];
    storage.setItem(COMMAND_BINDINGS_KEY, JSON.stringify({ version: 1, bindings }));
    return bindings;
  });
}

import { withCommandWriteLock } from './commandWriteLock';
import { assessmentCommandProfiles } from '../data/assessmentCommands';
import type { CommandProfile, CommandSnippet } from '../data/assessmentCommands';

export const COMMAND_STORAGE_KEY = 'evidence-assessment-command-changes-v1';
export interface CommandChange {
  profileId: string;
  groupId: string;
  id: string;
  snippet: CommandSnippet | null;
}
type CommandStorage = Pick<Storage, 'getItem' | 'setItem'>;
const MAX_CHANGES = 1000;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && value.length <= max && (!required || !!value.trim());
}
export function commandFieldErrors(value: CommandSnippet): Partial<Record<'title' | 'command' | 'note', string>> {
  return {
    ...(!text(value.title, 120) ? { title: '请填写非空标题，最多 120 字。' } : {}),
    ...(!text(value.command, 32768) ? { command: '请填写非空命令，最多 32768 字。' } : {}),
    ...(value.note !== undefined && !text(value.note, 4000, false) ? { note: '说明最多 4000 字。' } : {}),
  };
}
function validSnippet(value: unknown): value is CommandSnippet {
  return record(value) && text(value.id, 150) && text(value.title, 120) && text(value.command, 32768)
    && (value.note === undefined || text(value.note, 4000, false));
}
function location(profileId: string, groupId: string) {
  const profile = assessmentCommandProfiles.find(p => p.id === profileId);
  const group = profile?.groups.find(g => g.id === groupId);
  if (!group) throw new Error('命令所属的平台或分组不存在。');
  return group;
}
function validateId(id: string, profileId: string, groupId: string) {
  const group = location(profileId, groupId);
  if (!group.snippets.some(s => s.id === id) && !/^custom-[a-zA-Z0-9-]{1,100}$/.test(id)) {
    throw new Error('命令编号与所属分组不匹配。');
  }
}
export function readCommandChanges(storage: CommandStorage = localStorage): CommandChange[] {
  const raw = storage.getItem(COMMAND_STORAGE_KEY);
  if (raw === null) return [];
  if (raw.length > 2 * 1024 * 1024) throw new Error('命令库过大，未覆盖已有内容。');
  const parsed: unknown = JSON.parse(raw);
  if (!record(parsed) || parsed.version !== 1 || !Array.isArray(parsed.changes) || parsed.changes.length > MAX_CHANGES) {
    throw new Error('命令库格式异常，未覆盖已有内容。');
  }
  const changes: CommandChange[] = [];
  const ids = new Set<string>();
  for (const value of parsed.changes) {
    if (!record(value) || !text(value.profileId, 100) || !text(value.groupId, 150) || !text(value.id, 150)
      || !(value.snippet === null || validSnippet(value.snippet)) || (value.snippet !== null && value.snippet.id !== value.id) || ids.has(value.id)) {
      throw new Error('命令库记录异常，未覆盖已有内容。');
    }
    validateId(value.id, value.profileId, value.groupId);
    ids.add(value.id);
    changes.push({ profileId: value.profileId, groupId: value.groupId, id: value.id, snippet: value.snippet });
  }
  return changes;
}
export function resolveCommandProfiles(changes: CommandChange[]): CommandProfile[] {
  const byId = new Map(changes.map(change => [change.id, change]));
  return assessmentCommandProfiles.map(profile => ({ ...profile, groups: profile.groups.map(group => {
    const builtInIds = new Set(group.snippets.map(s => s.id));
    return { ...group, snippets: [
      ...group.snippets.flatMap(snippet => {
        const change = byId.get(snippet.id);
        return change ? (change.snippet ? [change.snippet] : []) : [snippet];
      }),
      ...changes.filter(c => c.profileId === profile.id && c.groupId === group.id && !builtInIds.has(c.id) && c.snippet !== null)
        .flatMap(c => c.snippet ? [c.snippet] : []),
    ] };
  }) }));
}
function currentSnippet(changes: CommandChange[], profileId: string, groupId: string, id: string) {
  return resolveCommandProfiles(changes).find(p => p.id === profileId)?.groups.find(g => g.id === groupId)?.snippets.find(s => s.id === id);
}
function checkExpected(current: CommandSnippet | undefined, expected: CommandSnippet | undefined) {
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('此命令已被修改或删除，请取消编辑后重新打开。');
}
function persist(changes: CommandChange[], storage: CommandStorage) {
  if (changes.length > MAX_CHANGES) throw new Error('命令修改数量已达上限（1000 条）。');
  const serialized = JSON.stringify({ version: 1, changes });
  if (serialized.length > 2 * 1024 * 1024) throw new Error('命令库已达容量上限，请精简命令内容。');
  storage.setItem(COMMAND_STORAGE_KEY, serialized);
  return changes;
}
export async function saveCommand(profileId: string, groupId: string, snippet: CommandSnippet, expected?: CommandSnippet, storage: CommandStorage = localStorage): Promise<CommandChange[]> {
  return withCommandWriteLock(() => {
    if (!validSnippet(snippet)) throw new Error('请填写标题和命令：标题最多 120 字，命令最多 32768 字，说明最多 4000 字。');
    validateId(snippet.id, profileId, groupId);
    const changes = readCommandChanges(storage);
    checkExpected(currentSnippet(changes, profileId, groupId, snippet.id), expected);
    if (changes.some(c => c.id === snippet.id && (c.profileId !== profileId || c.groupId !== groupId))) throw new Error('命令编号重复。');
    return persist([...changes.filter(c => c.id !== snippet.id), { profileId, groupId, id: snippet.id, snippet }], storage);
  });
}
export async function deleteCommand(profileId: string, groupId: string, expected: CommandSnippet, storage: CommandStorage = localStorage): Promise<CommandChange[]> {
  return withCommandWriteLock(() => {
    validateId(expected.id, profileId, groupId);
    const changes = readCommandChanges(storage);
    checkExpected(currentSnippet(changes, profileId, groupId, expected.id), expected);
    const next = changes.filter(c => c.id !== expected.id);
    if (location(profileId, groupId).snippets.some(s => s.id === expected.id)) next.push({ profileId, groupId, id: expected.id, snippet: null });
    return persist(next, storage);
  });
}

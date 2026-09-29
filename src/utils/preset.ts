import type { Category, CheckItemTemplate, ProjectPreset, ProjectProfile } from '../types';
import defaultCategories from '../data/defaults';

export const GENERIC_PROFILE: ProjectProfile = {
  reportTitle: '证据采集报告',
  exportFilePrefix: '证据采集',
  unitFieldLabel: '单位名称',
  unitFieldRequired: false,
};

export const LEGACY_PROFILE: ProjectProfile = {
  reportTitle: '证据采集报告',
  exportFilePrefix: '证据采集',
  unitFieldLabel: '单位名称',
  unitFieldRequired: true,
};

export const DEFAULT_PRESET: ProjectPreset = {
  version: 1,
  name: '通用模板',
  categories: defaultCategories,
  profile: GENERIC_PROFILE,
};

const MAX_PRESET_BYTES = 1024 * 1024;
const MAX_CATEGORIES = 100;
const MAX_ITEMS = 200;
const MAX_TEXT = 500;

export function cloneProfile(profile: ProjectProfile): ProjectProfile {
  return { reportTitle: profile.reportTitle, exportFilePrefix: profile.exportFilePrefix, unitFieldLabel: profile.unitFieldLabel, unitFieldRequired: profile.unitFieldRequired };
}

export function clonePreset(preset: ProjectPreset): ProjectPreset {
  return { version: 1, name: preset.name, categories: cloneCategories(preset.categories), profile: cloneProfile(preset.profile) };
}

export function cloneCategories(categories: Category[]): Category[] {
  return categories.map(({ id, name, type, order, defaultItems }) => ({ id, name, type, order,
    defaultItems: defaultItems.map(({ id, label, required }) => ({ id, label, required })),
  }));
}

export function normalizeProfile(value: unknown, fallback: ProjectProfile = LEGACY_PROFILE): ProjectProfile {
  if (!value || typeof value !== 'object') return cloneProfile(fallback);
  const raw = value as Record<string, unknown>;
  const text = (key: string, fallbackValue: string) => typeof raw[key] === 'string' && raw[key].trim() ? raw[key].trim() : fallbackValue;
  return {
    reportTitle: text('reportTitle', fallback.reportTitle),
    exportFilePrefix: text('exportFilePrefix', fallback.exportFilePrefix),
    unitFieldLabel: text('unitFieldLabel', fallback.unitFieldLabel),
    unitFieldRequired: typeof raw.unitFieldRequired === 'boolean' ? raw.unitFieldRequired : fallback.unitFieldRequired,
  };
}

function invalid(message: string): never { throw new Error(`预设格式错误：${message}`); }

export function parsePreset(value: unknown, byteLength?: number): ProjectPreset {
  if (byteLength !== undefined && byteLength > MAX_PRESET_BYTES) invalid('文件不能超过 1 MiB');
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('顶层必须是对象');
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) invalid('只支持 version=1');
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > MAX_TEXT) invalid('name 必须是非空字符串且不超过 500 字符');
  if (!Array.isArray(raw.categories) || raw.categories.length > MAX_CATEGORIES) invalid('categories 数量无效');
  const categoryIds = new Set<string>();
  const itemIds = new Set<string>();
  const categories = raw.categories.map((entry, index) => parseCategory(entry, index, categoryIds, itemIds));
  categories.forEach((category, index) => {
    if (category.order !== index + 1) invalid('categories.order 必须从 1 开始连续递增');
  });
  const profile = parseProfile(raw.profile);
  return { version: 1, name: raw.name.trim(), categories, profile };
}

export function parseProfile(value: unknown): ProjectProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('profile 必须是对象');
  const raw = value as Record<string, unknown>;
  for (const key of ['reportTitle', 'exportFilePrefix', 'unitFieldLabel']) {
    if (typeof raw[key] !== 'string' || !raw[key].trim() || raw[key].length > MAX_TEXT) invalid(`profile.${key} 无效`);
  }
  if (typeof raw.unitFieldRequired !== 'boolean') invalid('profile.unitFieldRequired 必须是布尔值');
  return normalizeProfile(raw, GENERIC_PROFILE);
}

function parseCategory(value: unknown, index: number, ids: Set<string>, itemIds: Set<string>): Category {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`categories[${index}] 必须是对象`);
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > MAX_TEXT) invalid(`categories[${index}].id 无效`);
  if (ids.has(raw.id)) invalid(`分类 ID 重复：${raw.id}`);
  ids.add(raw.id);
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > MAX_TEXT) invalid(`分类 ${raw.id} 名称无效`);
  if (raw.type !== 'checklist' && raw.type !== 'freestyle') invalid(`分类 ${raw.id} type 无效`);
  if (typeof raw.order !== 'number' || !Number.isInteger(raw.order) || raw.order < 1) invalid(`分类 ${raw.id} order 无效`);
  if (!Array.isArray(raw.defaultItems) || raw.defaultItems.length > MAX_ITEMS) invalid(`分类 ${raw.id} 检查项无效`);
  const defaultItems = raw.defaultItems.map((item, itemIndex) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid(`检查项 ${raw.id}[${itemIndex}] 无效`);
    const current = item as Record<string, unknown>;
    if (typeof current.id !== 'string' || !current.id.trim() || current.id.length > MAX_TEXT || itemIds.has(current.id)) invalid(`检查项 ID 重复或无效：${String(current.id)}`);
    itemIds.add(current.id);
    if (typeof current.label !== 'string' || !current.label.trim() || current.label.length > MAX_TEXT) invalid(`检查项 ${current.id} 文本无效`);
    if (typeof current.required !== 'boolean') invalid(`检查项 ${current.id} required 必须是布尔值`);
    return { id: current.id, label: current.label.trim(), required: current.required } satisfies CheckItemTemplate;
  });
  return { id: raw.id, name: raw.name.trim(), type: raw.type, order: raw.order, defaultItems };
}

export function serializePreset(preset: ProjectPreset): string { return `${JSON.stringify(clonePreset(preset), null, 2)}\n`; }

export function sanitizeFileNamePart(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim();
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned) ? `_${cleaned}` : cleaned || fallback;
}

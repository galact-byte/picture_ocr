import type { Category, Asset } from '../types';

const defaultCategories: Category[] = [{
  id: 'cat-general', name: '通用分类', type: 'checklist', order: 1,
  defaultItems: [{ id: 'tpl-screenshot', label: '截图', required: false }],
}];

/** 新项目不注入示例资产；保留工厂入口供已有创建链路使用。 */
export function createPresetAssets(_categories: Category[]): Asset[] { return []; }

export default defaultCategories;

export function createDefaultMeta() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { projectCode: '', projectName: '', unitName: '', systemName: '', reportDate: `${year}-${month}-${day}` };
}

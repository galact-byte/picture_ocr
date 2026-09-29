import type { Asset, Category, ProjectMeta, ProjectProfile } from '../types';
import { hydrateAssets } from './db';
import { normalizeProfile, sanitizeFileNamePart } from './preset';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ==================== Validation ====================

export interface ValidationMissing {
  categoryName: string;
  assetName: string;
  itemLabel: string;
}

export function validateRequired(
  categories: Category[],
  assets: Asset[]
): ValidationMissing[] {
  const missing: ValidationMissing[] = [];
  for (const asset of assets) {
    const categoryName = categories.find((category) => category.id === asset.categoryId)?.name || '未知分类';
    for (const item of asset.items) {
      if (item.required && item.images.length === 0) {
        missing.push({ categoryName, assetName: asset.name, itemLabel: item.label });
      }
    }
  }
  return missing;
}

export function buildReportFileName(meta: ProjectMeta, profile?: ProjectProfile): string {
  const systemName = sanitizeFileNamePart(meta.systemName, '未命名系统');
  // 填了项目名：项目名_系统名；没填项目名：直接用系统名，不加多余前缀。
  const projectName = meta.projectName?.trim()
    ? sanitizeFileNamePart(meta.projectName, '')
    : '';
  const prefix = projectName ? `${projectName}_` : '';
  return `${prefix}${systemName}_${sanitizeFileNamePart(profile?.exportFilePrefix ?? '证据采集', '证据采集')}.docx`;
}

/**
 * DOCX 生成器和封面图片仅在用户确认导出时才加载，避免拖慢 Electron 首屏。
 * 动态模块仍在同一浏览器上下文中运行，因此 file:// Electron 打包模式保持可用。
 */
export async function exportWordReport(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[],
  projectId: string,
  profile?: ProjectProfile
): Promise<void> {
  // 图片字节存在独立 store，导出前先按需补齐，保证报告内嵌的是完整分辨率原图。
  const hydratedAssets = await hydrateAssets(projectId, assets);
  let createWordReportBlob: (typeof import('./wordDocument'))['createWordReportBlob'];
  try {
    ({ createWordReportBlob } = await import('./wordDocument'));
  } catch {
    throw new Error('无法加载 Word 导出组件，请确认应用文件完整后重试。');
  }
  const effectiveProfile = normalizeProfile(profile);
  const blob = await createWordReportBlob(meta, categories, hydratedAssets, effectiveProfile);
  downloadBlob(blob, buildReportFileName(meta, effectiveProfile));
}

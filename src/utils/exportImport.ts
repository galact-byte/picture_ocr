import JSZip from 'jszip';
import { decryptEvidenceBlob, encryptEvidenceBlob } from './evidencePackage';
import { blobToDataUrl, compressImageBlob, dataUrlToBlob } from './imageCompression';
import { hydrateAssets, loadProject, resolveImageData } from './db';
import { LEGACY_PROFILE, normalizeProfile, parseProfile, sanitizeFileNamePart } from './preset';
import type {
  ProjectMeta,
  Category,
  Asset,
  CheckItem,
  ImageData,
  ExportPackage,
  AssetExport,
  ProjectProfile,
} from '../types';

// ==================== Export ====================

function buildExportAssets(
  categoryId: string,
  assets: Asset[]
): AssetExport[] {
  return assets
    .filter((a) => a.categoryId === categoryId)
    .map((a) => ({
      id: a.id,
      name: a.name,
      items: a.items.map((item) => ({
        id: item.id,
        label: item.label,
        required: item.required,
        fromTemplateId: item.fromTemplateId,
        images: item.images.map((img) => ({
          id: img.id,
          path: `images/${img.fileName}`,
          caption: img.caption,
          uploadedAt: img.uploadedAt,
        })),
      })),
    }));
}

export async function createDataPackageBlob(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[],
  profile?: ProjectProfile
): Promise<Blob> {
  return buildDataPackageZip(meta, categories, assets, profile).zip.generateAsync({ type: 'blob' });
}

/**
 * 组装数据包 ZIP（manifest.json + images/），返回 JSZip 实例与 manifest，
 * 供归档在同一结构上追加 archive.json，保证归档文件可被普通「导入数据包」识别。
 */
export function buildDataPackageZip(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[],
  profile?: ProjectProfile
): { zip: JSZip; manifest: ExportPackage } {
  const zip = new JSZip();
  const imageFolder = zip.folder('images');

  // Build manifest
  const exportPackage: ExportPackage = {
    meta,
    profile: normalizeProfile(profile),
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      order: cat.order,
      defaultItems: cat.defaultItems.map((item) => ({ ...item })),
      assets: buildExportAssets(cat.id, assets),
    })),
  };

  const imageNameSet = new Set<string>();

  for (const asset of assets) {
    for (const item of asset.items) {
      for (const img of item.images) {
        // Make sure filename is unique
        let fileName = img.fileName;
        if (imageNameSet.has(fileName)) {
          const ext = fileName.split('.').pop() || 'png';
          fileName = `${img.id}.${ext}`;
        }
        imageNameSet.add(fileName);

        // Update the path in the manifest data
        const catExport = exportPackage.categories.find(
          (c) => c.id === asset.categoryId
        );
        const assetExport = catExport?.assets.find((a) => a.id === asset.id);
        const itemExport = assetExport?.items.find((i) => i.id === item.id);
        const ref = itemExport?.images.find((r) => r.id === img.id);
        if (ref) {
          ref.path = `images/${fileName}`;
        }

        if (img.data) imageFolder?.file(fileName, dataUrlToBlob(img.data));
      }
    }
  }

  // Add manifest
  zip.file('manifest.json', JSON.stringify(exportPackage, null, 2));

  return { zip, manifest: exportPackage };
}

export async function exportDataPackage(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[],
  projectId: string,
  profile?: ProjectProfile
): Promise<void> {
  // 字节已拆到独立 store，导出前补齐，否则数据包里只有图片元数据。
  const content = await createDataPackageBlob(meta, categories, await hydrateAssets(projectId, assets), profile);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBlob(content, `${sanitizeFileNamePart(profile?.exportFilePrefix ?? '证据采集', '证据采集')}_${sanitizeFileNamePart(meta.unitName, '未命名')}_${dateStr}.zip`);
}

export interface BatchExportTarget {
  id: string;
  name: string;
  archived: boolean;
}

/** 总包只在所有系统读取、补图和打包完成后下载；不写回源文档。 */
export async function exportBatchDataPackage(
  targets: readonly BatchExportTarget[],
  onProgress: (message: string) => void,
  signal?: AbortSignal
): Promise<void> {
  signal?.throwIfAborted();
  const systems = [...new Map(targets.map(target => [target.id, target])).values()];
  if (systems.length === 0) throw new Error('请先勾选要导出的系统');
  const archived = systems.find(system => system.archived);
  if (archived) throw new Error(`系统“${archived.name}”已归档，请先恢复`);
  const zip = new JSZip();
  const fileNames = new Set<string>();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let index = 0; index < systems.length; index++) {
    signal?.throwIfAborted();
    const system = systems[index];
    onProgress(`正在生成 ${index + 1}/${systems.length}：${system.name}`);
    signal?.throwIfAborted();
    try {
      const document = await loadProject(system.id, { migrateLegacy: false });
      if (!document) throw new Error('系统不存在或已被删除');
      if (document.archive) throw new Error('该系统已归档，请先恢复');
      signal?.throwIfAborted();
      const assets = await hydrateAssets(document.id, document.assets);
      for (const asset of assets) {
        for (const item of asset.items) {
          const missing = item.images.find(image => typeof image.data !== 'string' || image.data.length === 0);
          if (missing) throw new Error(`缺少图片“${missing.fileName}”，请检查源数据后重试`);
        }
      }
      const content = await createDataPackageBlob(document.meta, document.categories, assets, document.profile);
      signal?.throwIfAborted();
      const prefix = sanitizeFileNamePart(document.profile?.exportFilePrefix ?? '证据采集', '证据采集');
      const projectName = sanitizeFileNamePart(document.meta.projectName, '未命名项目');
      const systemName = sanitizeFileNamePart(document.meta.systemName || document.meta.projectName, '未命名系统');
      const base = [prefix, projectName, systemName].map(part => part.slice(0, 60).replace(/[\uD800-\uDBFF]$/, '')).join('_') + `_${date}`;
      let fileName = `${base}.zip`;
      let suffix = 2;
      while (fileNames.has(fileName.toLowerCase())) fileName = `${base}_${suffix++}.zip`;
      fileNames.add(fileName.toLowerCase());
      zip.file(fileName, content);
    } catch (error) {
      throw new Error(`系统“${system.name}”导出失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  onProgress(`正在汇总 ${systems.length} 个系统的数据包…`);
  const content = await zip.generateAsync({ type: 'blob' });
  signal?.throwIfAborted();
  downloadBlob(content, `批量数据包_${date}.zip`);
}

export async function exportEncryptedDataPackage(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[],
  password: string,
  projectId: string,
  profile?: ProjectProfile
): Promise<void> {
  const zip = await createDataPackageBlob(meta, categories, await hydrateAssets(projectId, assets), profile);
  const encryptedPackage = await encryptEvidenceBlob(zip, password);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBlob(encryptedPackage, `${sanitizeFileNamePart(profile?.exportFilePrefix ?? '证据采集', '证据采集')}_${sanitizeFileNamePart(meta.systemName || meta.projectName, '未命名系统')}_${dateStr}.evidence`);
}

// ==================== Import ====================

export interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    meta: ProjectMeta;
    categories: Category[];
    assets: Asset[];
    profile: ProjectProfile;
  };
}

export async function importDataPackage(
  file: Blob,
  mode: 'overwrite' | 'merge',
  existingAssets: Asset[],
  existingCategories: Category[],
  existingMeta: ProjectMeta,
  existingProfile?: ProjectProfile,
  existingProjectId?: string
): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(file);

    // Parse manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return { success: false, message: '无效的数据包：缺少 manifest.json' };
    }

    const manifestText = await manifestFile.async('string');
    let exportPkg: ExportPackage;
    try {
      exportPkg = JSON.parse(manifestText);
    } catch {
      return { success: false, message: '无效的数据包：manifest.json 解析失败' };
    }

    // Extract categories, preserving the difference between a new package with
    // an intentionally empty template and a legacy package that lacks the
    // defaultItems field entirely.
    const newCategories: Category[] = exportPkg.categories.map((cat) => {
      const fallbackCategory = existingCategories.find((existing) => existing.id === cat.id);
      const defaultItems = cat.defaultItems !== undefined
        ? cat.defaultItems
        : fallbackCategory?.defaultItems ?? [];

      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        order: cat.order,
        defaultItems: defaultItems.map((item) => ({ ...item })),
      };
    });

    // Extract images from zip and build assets
    const newAssets: Asset[] = [];

    for (const catExport of exportPkg.categories) {
      for (const assetExport of catExport.assets) {
        const items: CheckItem[] = [];
        for (const itemExport of assetExport.items) {
          const images: ImageData[] = [];
          for (const ref of itemExport.images) {
            const imageFile = zip.file(ref.path);
            if (!imageFile) continue;
            const blob = await imageFile.async('blob');
            // 导入是入库入口之一，必须压缩；失败时 compressImageBlob 会退回原图。
            const compressed = await compressImageBlob(blob);
            const dataUrl = await blobToDataUrl(compressed.blob);
            images.push({
              id: ref.id,
              fileName: ref.path.split('/').pop() || 'image.png',
              data: dataUrl,
              caption: ref.caption,
              uploadedAt: ref.uploadedAt,
            });
          }
          items.push({
            id: itemExport.id,
            label: itemExport.label,
            required: itemExport.required,
            fromTemplateId: itemExport.fromTemplateId,
            images,
          });
        }

        newAssets.push({
          id: assetExport.id,
          name: assetExport.name,
          categoryId: catExport.id,
          items,
        });
      }
    }

    if (mode === 'overwrite') {
      return {
        success: true,
        message: `导入成功：${newCategories.length} 个分类，${newAssets.length} 个资产`,
        data: {
          meta: normalizeImportedMeta(exportPkg.meta),
          categories: newCategories,
          assets: newAssets,
          profile: exportPkg.profile === undefined ? { ...LEGACY_PROFILE } : parseProfile(exportPkg.profile),
        },
      };
    }

    // Merge mode: import assets by id without overwriting current project
    // metadata or templates. Existing items keep their local label/required
    // settings; imported screenshots are unioned by image id so old packages do
    // not accidentally delete newer local screenshots.
    if (mode === 'merge') {
      const mergedAssets = await mergeAssets(existingAssets, newAssets, existingProjectId);
      const mergedCategories = mergeCategories(existingCategories, newCategories);

      return {
        success: true,
        message: `合并导入成功：共 ${mergedAssets.length} 个资产`,
        data: {
          meta: existingMeta,
          categories: mergedCategories,
          assets: mergedAssets,
          profile: normalizeProfile(existingProfile),
        },
      };
    }

    return { success: false, message: '未知的导入模式' };
  } catch (err) {
    return {
      success: false,
      message: `导入失败：${err instanceof Error ? err.message : '未知错误'}`,
    };
  }
}

/** 解密后继续走既有 ZIP 导入和合并逻辑，绝不把失败的加密包降级成明文处理。 */
export async function importEncryptedDataPackage(
  file: File,
  password: string,
  mode: 'overwrite' | 'merge',
  existingAssets: Asset[],
  existingCategories: Category[],
  existingMeta: ProjectMeta,
  existingProfile?: ProjectProfile,
  existingProjectId?: string
): Promise<ImportResult> {
  try {
    const zipBlob = await decryptEvidenceBlob(file, password);
    return importDataPackage(zipBlob, mode, existingAssets, existingCategories, existingMeta, existingProfile, existingProjectId);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : '加密采集包导入失败。',
    };
  }
}

// ==================== Helpers ====================

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function mergeCategories(
  existingCategories: Category[],
  importedCategories: Category[]
): Category[] {
  const merged = existingCategories.map((cat) => ({
    ...cat,
    defaultItems: cat.defaultItems.map((item) => ({ ...item })),
  }));

  for (const importedCategory of importedCategories) {
    if (!merged.some((cat) => cat.id === importedCategory.id)) {
      merged.push({
        ...importedCategory,
        defaultItems: importedCategory.defaultItems.map((item) => ({ ...item })),
      });
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}

async function mergeAssets(existingAssets: Asset[], importedAssets: Asset[], projectId?: string): Promise<Asset[]> {
  const merged = existingAssets.map(cloneAsset);

  for (const importedAsset of importedAssets) {
    const existingAsset = findMatchingAsset(merged, importedAsset);
    if (!existingAsset) {
      merged.push(cloneAsset(importedAsset));
      continue;
    }

    for (const importedItem of importedAsset.items) {
      const existingItem = findMatchingItem(existingAsset.items, importedItem);
      if (!existingItem) {
        existingAsset.items.push({
          ...importedItem,
          images: importedItem.images.map((image) => ({ ...image })),
        });
        continue;
      }

      await mergeImages(existingItem.images, importedItem.images, projectId);
    }
  }

  return merged;
}

function normalizeImportedMeta(meta: Partial<ProjectMeta> | undefined): ProjectMeta {
  return {
    projectCode: meta?.projectCode ?? '',
    projectName: meta?.projectName ?? '',
    unitName: meta?.unitName ?? '',
    systemName: meta?.systemName ?? '',
    reportDate: meta?.reportDate ?? '',
  };
}

function findMatchingAsset(assets: Asset[], importedAsset: Asset): Asset | undefined {
  return assets.find((asset) => asset.id === importedAsset.id)
    ?? assets.find(
      (asset) =>
        asset.categoryId === importedAsset.categoryId &&
        normalizeName(asset.name) === normalizeName(importedAsset.name)
    );
}

function findMatchingItem(items: CheckItem[], importedItem: CheckItem): CheckItem | undefined {
  return items.find((item) => item.id === importedItem.id)
    ?? items.find(
      (item) =>
        !!item.fromTemplateId &&
        item.fromTemplateId === importedItem.fromTemplateId
    )
    ?? items.find((item) => normalizeName(item.label) === normalizeName(importedItem.label));
}

async function mergeImages(existingImages: ImageData[], importedImages: ImageData[], projectId?: string): Promise<void> {
  const imageKeys = new Set(existingImages.flatMap((image) => getImageDedupKeys(image)));
  const imagesById = new Map(existingImages.map((image) => [image.id, image]));
  for (const importedImage of importedImages) {
    const existingImage = imagesById.get(importedImage.id);
    if (existingImage) {
      // 引用形态不代表缺图；先查独立图片表，只补缺失的字节，保留本地元数据。
      const data = existingImage.data || (projectId ? await resolveImageData(projectId, existingImage) : null);
      if (!data && importedImage.data) {
        existingImage.data = importedImage.data;
        getImageDedupKeys(existingImage).forEach((key) => imageKeys.add(key));
      }
      continue;
    }
    const importedKeys = getImageDedupKeys(importedImage);
    if (importedKeys.some((key) => imageKeys.has(key))) continue;
    const added = { ...importedImage };
    existingImages.push(added);
    imagesById.set(added.id, added);
    importedKeys.forEach((key) => imageKeys.add(key));
  }
}

function getImageDedupKeys(image: ImageData): string[] {
  const keys = [`id:${image.id}`];
  // 文件名+时间戳只是补充启发式：同一毫秒批量粘贴的多张剪贴板图常常同名同时间戳，
  // 因此再带上数据长度作为区分，避免把内容不同的截图误判成重复而在合并导入时丢弃。
  if (image.fileName && image.uploadedAt) {
    keys.push(`file-time:${image.fileName}::${image.uploadedAt}::${(image.data ?? '').length}`);
  }
  return keys;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cloneAsset(asset: Asset): Asset {
  return {
    ...asset,
    items: asset.items.map((item) => ({
      ...item,
      images: item.images.map((image) => ({ ...image })),
    })),
  };
}

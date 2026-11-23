import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Category, ImageData, ProjectDocument } from '../types';
import { importEncryptedDataPackage, exportEncryptedDataPackage } from '../utils/exportImport';
import { isEvidencePackageFile } from '../utils/evidencePackage';
import { readImageFiles } from '../utils/imageFiles';
import { loadProject, saveProjectWithImages, addImageToProject, removeImageFromProject } from '../utils/db';
import { stripInlineImageData } from '../utils/imageStore';
import { invalidateImage, primeImageCache } from '../utils/imageCache';
import { useImageSrc } from '../hooks/useImageSrc';
import { useDialogEscape } from '../hooks/useDialogEscape';
import { useConfirmDialog } from './ConfirmDialog';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from './dialogStyles';
import EncryptedExportDialog from './EncryptedExportDialog';
import PwaReadinessCard from './PwaReadinessCard';

interface MobileCollectorProps {
  projectId: string;
  onBack: () => void;
}

function projectName(document: ProjectDocument): string {
  return document.meta.systemName.trim() || document.meta.projectName.trim() || '未命名采集项目';
}

/** 手机端缩略图：字节在独立 store，按需取，避免把整份采集包的 Base64 常驻手机内存。 */
const MobileImage: React.FC<{ projectId: string; image: ImageData; className: string }> = ({ projectId, image, className }) => {
  const state = useImageSrc(projectId, image);
  if (!state.src) {
    const placeholder = state.status === 'loading' ? '加载中…' : state.status === 'missing' ? '图片缺失' : '读取失败';
    return <div className={`${className} flex items-center justify-center text-xs ${state.status === 'error' ? 'bg-red-50 text-red-700' : state.status === 'missing' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>{placeholder}</div>;
  }
  return <img src={state.src} onError={state.onError} alt={image.fileName} className={className} />;
};

const MobileCollector: React.FC<MobileCollectorProps> = ({ projectId, onBack }) => {
  const [document, setDocument] = useState<ProjectDocument | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<ImageData | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmDialog();
  useDialogEscape(Boolean(viewingImage), () => setViewingImage(null));

  const activeAsset = useMemo(() => document?.assets.find((asset) => asset.id === activeAssetId) ?? null, [document, activeAssetId]);
  const visibleAssets = useMemo(() => document?.assets.filter((asset) => asset.categoryId === activeCategoryId) ?? [], [document, activeCategoryId]);

  useEffect(() => {
    loadProject(projectId).then((loaded) => {
      if (!loaded) {
        setMessage('项目不存在或已被删除。');
        return;
      }
      if (loaded.archive) {
        setMessage('该系统已归档，需在电脑端恢复后才能继续采集。');
        return;
      }
      setDocument(loaded);
      setActiveCategoryId(loaded.assets[0]?.categoryId ?? loaded.categories[0]?.id ?? null);
      setActiveAssetId(loaded.assets[0]?.id ?? null);
    }).catch((err) => setMessage(`加载项目失败：${err instanceof Error ? err.message : '未知错误'}`));
  }, [projectId]);

  /** 整份替换的保存（导入采集包）：写入时拆字节，内存态只留引用。 */
  const persist = async (nextDocument: ProjectDocument) => {
    const next = { ...nextDocument, updatedAt: Date.now() };
    await saveProjectWithImages(next);
    const inlineIds = new Set<string>();
    for (const asset of next.assets) {
      for (const item of asset.items) {
        for (const image of item.images) {
          if (typeof image.data === 'string' && image.data.length > 0) inlineIds.add(image.id);
        }
      }
    }
    setDocument(stripInlineImageData(next, inlineIds) as ProjectDocument);
  };

  const handleImages = async (asset: Asset, itemId: string, files: FileList | null) => {
    if (!document || !files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return setMessage('请选择图片文件。');
    try {
      const images = await readImageFiles(imageFiles);
      // 逐张入库（同事务写字节+引用）：拍一张写一张，不再把整份文档重写一遍。
      const references: ImageData[] = [];
      for (const image of images) {
        await addImageToProject(projectId, asset.id, itemId, image);
        if (image.data) primeImageCache(projectId, new Map([[image.id, image.data]]));
        const { data: _inline, ...reference } = image;
        references.push(reference as ImageData);
      }
      setDocument((current) => current && ({
        ...current,
        updatedAt: Date.now(),
        assets: current.assets.map((candidate) => candidate.id !== asset.id ? candidate : {
          ...candidate,
          items: candidate.items.map((item) => item.id === itemId ? { ...item, images: [...item.images, ...references] } : item),
        }),
      }));
      setMessage(`已归档 ${images.length} 张图片。`);
    } catch (err) {
      setMessage(`读取图片失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const removeImage = async (assetId: string, itemId: string, imageId: string) => {
    if (!document) return;
    const confirmed = await confirm({
      title: '删除图片',
      message: '确定删除这张图片吗？此操作不可撤销。',
      confirmText: '删除图片',
      tone: 'danger',
    });
    if (!confirmed) return;
    await removeImageFromProject(projectId, assetId, itemId, imageId);
    invalidateImage(projectId, imageId);
    setDocument((current) => current && ({
      ...current,
      updatedAt: Date.now(),
      assets: current.assets.map((asset) => asset.id !== assetId ? asset : {
        ...asset,
        items: asset.items.map((item) => item.id !== itemId ? item : { ...item, images: item.images.filter((image) => image.id !== imageId) }),
      }),
    }));
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || !document || importing) return;
    if (!isEvidencePackageFile(file)) return setMessage('手机采集端仅接受 .evidence 加密采集包。');
    if (!importPassword) return setMessage('导入加密采集包前请输入密码。');
    setImporting(true);
    try {
      const result = await importEncryptedDataPackage(file, importPassword, 'merge', document.assets, document.categories, document.meta, document.profile, document.id);
      if (!result.success || !result.data) return setMessage(result.message);
      await persist({ ...document, ...result.data });
      setImportPassword('');
      setMessage(result.message);
    } catch (err) {
      setMessage(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleExport = async (password: string) => {
    if (!document) return;
    await exportEncryptedDataPackage(document.meta, document.categories, document.assets, password, document.id, document.profile);
    setMessage('已生成加密采集包。请通过浏览器下载列表保存文件，再用 USB 回传电脑。');
  };

  if (!document) return <main className="craft-canvas min-h-screen p-5 text-sm text-[#647084]"><div className="mx-auto max-w-xl rounded-[16px] border border-[#e3e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{message || '正在加载采集项目...'}</div></main>;

  return (
    <main className="craft-canvas min-h-screen pb-8 text-[#1c2230]">
      <header className="sticky top-0 z-10 border-b border-[#e3e7ef] bg-white/90 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#bde6e0] bg-[#e6f6f4] text-[#0d7c73] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]" aria-hidden="true">
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" strokeWidth={2} />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-[-0.01em] text-[#1c2230] sm:text-lg">{projectName(document)}</h1>
              <p className="truncate text-xs text-[#647084]">手机离线采集模式</p>
            </div>
          </div>
          <button type="button" onClick={onBack} className={`${BUTTON_SECONDARY} min-h-11 shrink-0`}>项目列表</button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-3.5 px-4 pt-4">
        <PwaReadinessCard />
        <section className="rounded-[16px] border border-[#e3e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setExportOpen(true)} className={`${BUTTON_PRIMARY} min-h-11`}>导出加密采集包</button>
            <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className={`${BUTTON_SECONDARY} min-h-11`}>合并导入采集包</button>
          </div>
          <input ref={importInputRef} type="file" accept=".evidence" onChange={(event) => void handleImportFile(event.target.files?.[0])} className="hidden" />
          <label className="mt-3 block text-sm font-medium text-[#3b4454]">加密包导入密码<input type="password" value={importPassword} onChange={(event) => setImportPassword(event.target.value)} className={FIELD_INPUT} /></label>
          {message && <p role="status" className="mt-3 rounded-[10px] border border-[#bde6e0] bg-[#eef9f7] px-3 py-2 text-sm text-[#0b665f]">{message}</p>}
        </section>
        <section className="flex gap-2 overflow-x-auto pb-1">{document.categories.map((category: Category) => <button key={category.id} type="button" onClick={() => { setActiveCategoryId(category.id); setActiveAssetId(document.assets.find((asset) => asset.categoryId === category.id)?.id ?? null); }} className={`min-h-11 shrink-0 rounded-[10px] border px-3.5 text-sm font-medium transition-all ${category.id === activeCategoryId ? 'border-[#96dcd4] bg-[#e2f5f2] font-semibold text-[#0b665f] shadow-[0_1px_2px_rgba(13,148,136,0.08)]' : 'border-[#e3e7ef] bg-white text-[#556072] hover:bg-[#f6f8fb]'}`}>{category.name}</button>)}</section>
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{visibleAssets.map((asset) => {
          const hasMissing = asset.items.some((i) => i.required && i.images.length === 0);
          const hasRequired = asset.items.some((i) => i.required);
          return (
            <button key={asset.id} type="button" onClick={() => setActiveAssetId(asset.id)} className={`min-h-16 rounded-[14px] border p-3 text-left text-sm transition-all ${asset.id === activeAsset?.id ? 'border-[#78cfc5] bg-[#f3fbf9] font-semibold text-[#0b665f] shadow-[0_0_0_2px_rgba(13,148,136,0.10),0_4px_12px_rgba(15,23,42,0.04)]' : 'border-[#e3e7ef] bg-white text-[#1c2230] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#cfd6e2]'}`}>
              <span className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${hasMissing ? 'bg-[#ef4444]' : hasRequired ? 'bg-[#10b981]' : 'bg-[#cbd3df]'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words">{asset.name}</span>
              </span>
              <span className="mt-1.5 block pl-4 text-xs font-normal text-[#8a94a6] tabular-nums">{asset.items.length} 项</span>
            </button>
          );
        })}</section>
        {activeAsset ? <section className="space-y-3">{activeAsset.items.length === 0 ? <p className="rounded-[16px] border border-[#e3e7ef] bg-white p-5 text-sm text-[#647084] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">此资产暂无检查项，请在桌面工作台添加后再采集。</p> : activeAsset.items.map((item) => <article key={item.id} className="rounded-[16px] border border-[#e3e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${item.required ? (item.images.length > 0 ? 'bg-[#10b981] shadow-[0_0_0_2.5px_rgba(16,185,129,0.14)]' : 'bg-[#ef4444] shadow-[0_0_0_2.5px_rgba(239,68,68,0.13)]') : 'bg-[#cbd3df]'}`} aria-hidden="true" /><h2 className="text-[15px] font-semibold text-[#1c2230]">{item.label}</h2></div>{item.required && <span className={`shrink-0 rounded-[7px] border px-2 py-0.5 text-xs font-semibold ${item.images.length > 0 ? 'border-[#c4eae5] bg-[#eef9f7] text-[#0b665f]' : 'border-[#f5c6ca] bg-[#fff5f5] text-[#c53030]'}`}>必填</span>}</div><div className="mt-3 grid grid-cols-3 gap-2.5">{item.images.map((image) => <div key={image.id} className="relative aspect-square overflow-hidden rounded-[12px] border border-[#e3e7ef] bg-white p-1 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"><button type="button" onClick={() => setViewingImage(image)} className="h-full w-full overflow-hidden rounded-[8px]"><MobileImage projectId={projectId} image={image} className="h-full w-full object-cover" /></button><button type="button" onClick={() => void removeImage(activeAsset.id, item.id, image.id)} className="absolute right-2 top-2 rounded-md border border-[#f5c6ca] bg-white/95 px-1.5 py-0.5 text-xs font-medium text-[#c53030] shadow-sm">删除</button></div>)}<label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-[#96dcd4] bg-[#f2fbf9] p-2 text-center text-sm font-medium text-[#0b665f] transition-colors active:bg-[#dff4f1]"><span>拍照/选图</span><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => { void handleImages(activeAsset, item.id, event.target.files); event.currentTarget.value = ''; }} className="hidden" /></label></div></article>)}</section> : <p className="rounded-[16px] border border-[#e3e7ef] bg-white p-5 text-sm text-[#647084] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">请选择资产。</p>}
      </div>
      <EncryptedExportDialog open={exportOpen} title="导出手机加密采集包" onClose={() => setExportOpen(false)} onExport={handleExport} />
      {viewingImage && <div role="dialog" aria-modal="true" aria-label="图片预览" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-[2px]" onClick={() => setViewingImage(null)}><button type="button" onClick={() => setViewingImage(null)} aria-label="关闭预览" className="fixed right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#1c2230] shadow-md"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" /></svg></button><MobileImage projectId={projectId} image={viewingImage} className="max-h-full max-w-full rounded-[12px] object-contain" /></div>}
      {dialog}
    </main>
  );
};

export default MobileCollector;

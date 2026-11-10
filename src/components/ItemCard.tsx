import React, { useState, useCallback } from 'react';
import type { CheckItem, ImageData } from '../types';
import { readImageFiles } from '../utils/imageFiles';
import UploadZone from './UploadZone';
import ImageThumbnail from './ImageThumbnail';
import ImageViewer from './ImageViewer';
import { useConfirmDialog } from './ConfirmDialog';

interface ItemCardProps {
  item: CheckItem;
  commandPanel?: React.ReactNode;
  commandCount?: number;
  onManageCommands?: () => void;
  assetId: string;
  sortIndex?: number;
  onRename: (itemId: string, newLabel: string) => void;
  onRemove: (itemId: string) => void;
  onToggleRequired: (itemId: string) => void;
  onAddImage: (assetId: string, itemId: string, image: ImageData) => void;
  onRemoveImage: (assetId: string, itemId: string, imageId: string) => void;
  onUpdateCaption: (assetId: string, itemId: string, imageId: string, caption: string) => void;
  onReorderImages: (assetId: string, itemId: string, imageIds: string[]) => void;
  isPasteTarget?: boolean;
  onSelectPasteTarget?: (itemId: string) => void;
  isSorting?: boolean;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  isDropAfter?: boolean;
  onSortHandlePointerDown?: (event: React.PointerEvent<HTMLButtonElement>, itemId: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = (props) => {
  if (props.isSorting) {
    return <SortingItemCard {...props} />;
  }

  return <NormalItemCard {...props} />;
};

const SortingItemCard: React.FC<ItemCardProps> = ({
  item,
  sortIndex,
  isDragSource = false,
  onSortHandlePointerDown,
}) => (
  <div
    data-item-id={item.id}
    className={`flex items-center gap-4 rounded-lg border bg-white px-4 py-3 select-none touch-manipulation shadow-2xs ${
      isDragSource ? 'border-dashed border-slate-300 bg-slate-50 opacity-35' : 'border-slate-200/95'
    }`}
  >
    <span className="w-8 text-center text-sm font-semibold text-slate-500 tabular-nums" aria-label={`第 ${sortIndex ?? 0} 项`}>
      {sortIndex}
    </span>
    <span className="min-w-0 flex-1 text-base font-bold leading-6 text-slate-950">{item.label}</span>
    <button
      type="button"
      onPointerDown={(event) => onSortHandlePointerDown?.(event, item.id)}
      style={{ touchAction: 'none' }}
      className="min-h-11 min-w-11 cursor-grab touch-none rounded-md border border-slate-300 bg-slate-50 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:cursor-grabbing"
      aria-label={`拖动“${item.label}”调整检查项顺序`}
      title="按住并拖动以调整顺序"
    >
      <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
      </svg>
    </button>
  </div>
);

const NormalItemCard: React.FC<ItemCardProps> = ({
  item,
  assetId,
  onRename,
  onRemove,
  onToggleRequired,
  onAddImage,
  onRemoveImage,
  onUpdateCaption,
  onReorderImages,
  isPasteTarget = false,
  onSelectPasteTarget,
  commandPanel,
  commandCount = 0,
  onManageCommands,
}) => {
  const [commandsExpanded, setCommandsExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [dragImageId, setDragImageId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDialog();

  const handleStartEdit = () => {
    setEditValue(item.label);
    setEditing(true);
  };

  const handleFinishEdit = () => {
    if (editValue.trim() && editValue.trim() !== item.label) {
      onRename(item.id, editValue.trim());
    }
    setEditing(false);
  };

  const handleImageFiles = useCallback(
    async (files: File[]) => {
      const images = await readImageFiles(files);
      images.forEach((image) => onAddImage(assetId, item.id, image));
    },
    [assetId, item.id, onAddImage]
  );

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragImageId || dragImageId === targetId) return;
      const ids = item.images.map((img) => img.id);
      const fromIdx = ids.indexOf(dragImageId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, dragImageId);
      onReorderImages(assetId, item.id, ids);
      setDragImageId(null);
    },
    [dragImageId, item.images, assetId, item.id, onReorderImages]
  );

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors ${
        isPasteTarget
          ? 'border-blue-400 ring-2 ring-blue-100'
          : 'border-slate-200/95 hover:border-slate-300'
      }`}
      onClick={() => onSelectPasteTarget?.(item.id)}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1.5 ${
          item.required
            ? item.images.length > 0
              ? 'bg-emerald-500'
              : 'bg-red-500'
            : 'bg-slate-300'
        }`}
        title={item.required ? (item.images.length > 0 ? '必填项（已上传截图）' : '必填项（待上传截图）') : '选填项'}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-[#f1f5f9]/85 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2.5 sm:basis-auto">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                type="text"
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleFinishEdit();
                  if (event.key === 'Escape') setEditing(false);
                }}
                className="w-full rounded-md border border-blue-400 bg-white px-2.5 py-1 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-base font-bold leading-6 text-slate-950">{item.label}</span>
                {commandPanel && <button type="button" aria-expanded={commandsExpanded} aria-controls={`item-commands-${item.id}`} onClick={event => { event.stopPropagation(); event.currentTarget.focus(); if (!commandCount) onManageCommands?.(); else setCommandsExpanded(expanded => !expanded); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-normal text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                  <span>命令{commandCount > 0 ? ` (${commandCount})` : ''}</span><span aria-hidden="true">{commandsExpanded ? '▴' : '▾'}</span>
                </button>}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleRequired(item.id);
            }}
            className={`inline-flex min-h-11 items-center rounded-md border px-3 py-1 text-sm transition-colors ${
              item.required
                ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
            }`}
            title={item.required ? '点击设为选填' : '点击设为必填'}
            aria-pressed={item.required}
          >
            {item.required ? '必填' : '选填'}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleStartEdit();
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="重命名"
            aria-label="重命名检查项"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={async (event) => {
              event.stopPropagation();
              const confirmed = await confirm({
                title: '删除检查项',
                message: `确定要删除“${item.label}”吗？\n\n该检查项下的截图也会被删除，此操作不可撤销。`,
                confirmText: '删除检查项',
                tone: 'danger',
              });
              if (confirmed) onRemove(item.id);
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            title="删除"
            aria-label="删除检查项"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {commandPanel && <div id={`item-commands-${item.id}`} hidden={!commandsExpanded}>{commandsExpanded && commandPanel}</div>}
      <div className="px-4 py-5 sm:px-6">
        {isPasteTarget && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            当前粘贴目标：按 Ctrl+V 可直接粘贴截图到此检查项
          </div>
        )}
        <div className="flex flex-wrap items-start gap-4">
          {item.images.map((img) => (
            <ImageThumbnail
              key={img.id}
              image={img}
              onRemove={(imageId) => onRemoveImage(assetId, item.id, imageId)}
              onClick={(imageId) => {
                const index = item.images.findIndex((candidate) => candidate.id === imageId);
                if (index >= 0) setViewerIndex(index);
              }}
              onUpdateCaption={(imageId, caption) => onUpdateCaption(assetId, item.id, imageId, caption)}
              onDragStart={(_, imageId) => setDragImageId(imageId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(_, targetId) => handleDrop(targetId)}
            />
          ))}
          <UploadZone onImageFiles={(files) => void handleImageFiles(files)} />
        </div>
      </div>

      {dialog}
      {viewerIndex !== null && (
        <ImageViewer
          images={item.images}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={(index) => setViewerIndex(index)}
        />
      )}
    </div>
  );
};

export default ItemCard;

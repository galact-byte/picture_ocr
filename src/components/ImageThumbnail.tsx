import React, { useState } from 'react';
import type { ImageData } from '../types';
import { useConfirmDialog } from './ConfirmDialog';
import { useAppContext } from '../context/AppContext';
import { useImageSrc } from '../hooks/useImageSrc';

interface ImageThumbnailProps {
  image: ImageData;
  compact?: boolean;
  onRemove: (imageId: string) => void;
  onClick: (imageId: string) => void;
  onUpdateCaption: (imageId: string, caption: string) => void;
  onDragStart?: (e: React.DragEvent, imageId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, imageId: string) => void;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  image,
  compact = false,
  onRemove,
  onClick,
  onUpdateCaption,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionValue, setCaptionValue] = useState(image.caption);
  const { confirm, dialog } = useConfirmDialog();
  const { projectId } = useAppContext();
  // 图片字节存在独立 store，按需取；未迁移的老项目会直接命中内联字节。
  const imageState = useImageSrc(projectId, image);
  const placeholder = imageState.status === 'loading' ? '加载中…'
    : imageState.status === 'missing' ? '图片缺失' : '读取失败';

  const handleFinishCaption = () => {
    if (captionValue.trim() !== image.caption) {
      onUpdateCaption(image.id, captionValue.trim());
    }
    setEditingCaption(false);
  };

  return (
    <div
      className="relative group"
      draggable
      onDragStart={(e) => onDragStart?.(e, image.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, image.id);
      }}
    >
      {/* Thumbnail */}
      <div
        className={`relative overflow-hidden rounded-[12px] border border-[#e3e7ef] bg-white p-1.5 shadow-[0_2px_6px_rgba(15,23,42,0.06)] cursor-pointer transition-colors hover:border-[#cfd6e2] ${compact ? 'h-40 w-40 xl:h-[132px] xl:w-[132px]' : 'h-40 w-40'}`}
        onClick={() => onClick(image.id)}
      >
        {imageState.status === 'loaded' && imageState.src ? (
          <img
            src={imageState.src}
            onError={imageState.onError}
            alt={image.fileName}
            className="h-full w-full rounded-[8px] object-cover"
            draggable={false}
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center rounded-[8px] text-xs ${imageState.status === 'error' ? 'bg-[#fff5f5] text-[#c53030]' : imageState.status === 'missing' ? 'bg-[#fefaf0] text-[#9a5b08]' : 'bg-[#f4f6fa] text-[#98a2b3]'}`}>{placeholder}</div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 group-focus-within:bg-slate-900/20 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick(image.id);
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center p-1.5 bg-white/95 rounded-[9px] shadow-sm hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
            title="放大查看"
            aria-label="放大查看"
          >
            <svg className="w-4 h-4 text-[#1c2230]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const confirmed = await confirm({
                title: '删除图片',
                message: `确定要删除这张图片吗？\n\n文件：${image.fileName || '未命名图片'}\n此操作不可撤销。`,
                confirmText: '删除图片',
                tone: 'danger',
              });
              if (confirmed) {
                onRemove(image.id);
              }
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center p-1.5 bg-white/95 rounded-[9px] shadow-sm hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#c53030]"
            title="删除"
            aria-label="删除图片"
          >
            <svg className="w-4 h-4 text-[#c53030]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Image extension badge */}
        {image.fileName && image.fileName.includes('.') && (
          <span className="absolute top-2 right-2 rounded border border-[#e3e7ef] bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-[#475266] shadow-sm backdrop-blur-sm">
            {image.fileName.split('.').pop()?.toUpperCase()}
          </span>
        )}
      </div>

      {dialog}

      {/* Caption */}
      <div className={`mt-2 ${compact ? 'max-w-40 xl:max-w-[132px]' : 'max-w-40'}`}>
        {editingCaption ? (
          <input
            type="text"
            value={captionValue}
            onChange={(e) => setCaptionValue(e.target.value)}
            onBlur={handleFinishCaption}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishCaption();
              if (e.key === 'Escape') setEditingCaption(false);
            }}
            className="w-full rounded-[8px] border border-[#0d9488] px-2 py-1 text-xs text-[#1c2230] focus:outline-none focus:ring-2 focus:ring-[#0d9488]/15"
            autoFocus
            placeholder="添加备注..."
          />
        ) : (
          <button
            type="button"
            className={`block w-full truncate rounded px-0.5 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488] ${
              image.caption ? 'text-[#475266] hover:text-[#1c2230]' : 'text-[#98a2b3] hover:text-[#556072]'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setCaptionValue(image.caption);
              setEditingCaption(true);
            }}
            title={image.caption || '点击添加备注'}
          >
            {image.caption || '添加备注...'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageThumbnail;

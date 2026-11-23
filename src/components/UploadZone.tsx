import React, { useRef, useState, useCallback } from 'react';
import { getImageFilesFromClipboard } from '../utils/imageFiles';

interface UploadZoneProps {
  compact?: boolean;
  onImageFiles: (files: File[]) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ compact = false, onImageFiles }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length > 0) {
        onImageFiles(imageFiles);
      }
    },
    [onImageFiles]
  );

  // Click to select
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Clipboard paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles = getImageFilesFromClipboard(e);
      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onImageFiles(imageFiles);
      }
    },
    [onImageFiles]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      role="button"
      tabIndex={0}
      aria-label="上传截图"
      className={`
        flex flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-[12px] border-[1.5px] border-dashed p-3 text-center
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:ring-offset-2
        ${compact ? 'h-40 w-40 xl:h-[132px] xl:w-[132px]' : 'h-40 w-40'}
        ${isDragOver
          ? 'border-[#0d9488] bg-[#edf9f7] shadow-sm'
          : 'border-[#d3dae6] bg-[#f7f9fc] hover:border-[#78cfc5] hover:bg-[#f2fbf9]'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <svg
        className={`mb-2 h-8 w-8 transition-colors ${
          isDragOver ? 'text-[#0d7c73]' : 'text-[#98a2b3]'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="text-sm font-semibold text-[#3b4454]">
        {isDragOver ? '松开鼠标上传' : '点击选择截图'}
      </p>
      {!isDragOver && (
        <p className="mt-1.5 text-xs text-[#8a94a6]">
          拖拽或 <kbd className="rounded border border-[#d8dee8] border-b-2 bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#556072]">Ctrl+V</kbd>
        </p>
      )}
    </div>
  );
};

export default UploadZone;

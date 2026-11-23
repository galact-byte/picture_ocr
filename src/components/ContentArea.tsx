import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppContext, useAppState, useDispatch } from '../context/AppContext';
import { reportCriticalError } from '../utils/errorLog';
import { getAssetById } from '../context/appReducer';
import { getImageFilesFromClipboard, readImageFiles } from '../utils/imageFiles';
import ItemCard from './ItemCard';
import AssessmentCommandDialog from './AssessmentCommandDialog';
import ItemCommandPanel from './ItemCommandPanel';
import { useAssessmentCommandLibrary } from '../hooks/useAssessmentCommandLibrary';
import { commandBindingKey, resetCommandBinding, setCommandLinked } from '../utils/assessmentCommandBindings';
import { effectiveCommandProfile, hasAssetCommandOverride, readCommandDefaults, resolveItemCommandIds, setCommandDefault } from '../utils/assessmentCommandDefaults';
import { readCommandChanges, resolveCommandProfiles } from '../utils/assessmentCommandStore';

interface DragOverlayState {
  label: string;
  sortIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ItemDragState {
  pointerId: number;
  sourceItemId: string;
  startX: number;
  startY: number;
  handle: HTMLButtonElement;
  hasDragged: boolean;
  previewItemIds: string[] | null;
  overlayOffsetX: number;
  overlayOffsetY: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface AddItemBarProps {
  onAddItem: (label: string) => void;
  draftRef: React.MutableRefObject<string>;
}

const AddItemBar: React.FC<AddItemBarProps> = React.memo(({ onAddItem, draftRef }) => {
  const [label, setLabel] = useState(draftRef.current);

  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAddItem(trimmed);
    draftRef.current = '';
    setLabel('');
  };

  return (
    <>
      <input
        type="text"
        value={label}
        onChange={(event) => {
          draftRef.current = event.target.value;
          setLabel(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleAdd();
        }}
        placeholder="添加自定义检查项..."
        className="min-h-11 min-w-0 flex-1 basis-full rounded-[10px] border border-[#e3e7ef] bg-[#f4f6fa] px-3.5 text-base text-[#1c2230] placeholder:text-[#98a2b3] transition-all focus:border-[#0d9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d9488]/15 sm:basis-0"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={!label.trim()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-[#96dcd4] bg-[#e2f5f2] px-5 text-base font-semibold text-[#0b665f] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(13,148,136,0.08)] transition-all hover:border-[#78cfc5] hover:bg-[#d1efe9] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488] disabled:cursor-not-allowed disabled:border-[#e3e7ef] disabled:bg-[#f4f6fa] disabled:text-[#98a2b3] disabled:shadow-none"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加
      </button>
    </>
  );
});

const ITEM_AUTO_SCROLL_EDGE_PX = 80;
const ITEM_AUTO_SCROLL_MAX_SPEED_PX = 18;

function isTextEditingElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

const ContentArea: React.FC = () => {
  const { assets, activeAssetId, categories } = useAppState();
  const dispatch = useDispatch();
  const { addImageAndSave, removeImageAndSave, projectId } = useAppContext();
  const commandLibrary = useAssessmentCommandLibrary();
  const [commandItemId, setCommandItemId] = useState<string | null>(null);
  const [commandAssetId, setCommandAssetId] = useState<string | null>(null);
  const [pasteTargetItemId, setPasteTargetItemId] = useState<string | null>(null);
  const [isSortingItems, setIsSortingItems] = useState(false);
  const [boardCols, setBoardCols] = useState<1 | 2>(2);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [previewItemIds, setPreviewItemIds] = useState<string[] | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const addItemDraftRef = useRef('');
  const dragStateRef = useRef<ItemDragState | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const previewItemIdsRef = useRef<string[] | null>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const itemListRef = useRef<HTMLDivElement>(null);
  const itemRectsRef = useRef(new Map<string, DOMRect>());
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollPointerRef = useRef<PointerPosition | null>(null);
  const isSortingItemsRef = useRef(isSortingItems);
  isSortingItemsRef.current = isSortingItems;

  const activeAsset = activeAssetId ? getAssetById(assets, activeAssetId) : undefined;
  const activeAssetRef = useRef(activeAsset);
  activeAssetRef.current = activeAsset;
  const activeCategory = activeAsset
    ? categories.find((category) => category.id === activeAsset.categoryId)
    : undefined;

  const commandScope = { projectId, assetId: activeAsset?.id ?? '', categoryId: activeCategory?.id };
  const commandError = commandLibrary.libraryError || commandLibrary.bindingsError || commandLibrary.defaultsError;
  const itemCommandIds = (itemId: string) => {
    const item = activeAsset?.items.find(item => item.id === itemId);
    return item && !commandError ? resolveItemCommandIds(commandLibrary.profiles, commandLibrary.defaults, commandLibrary.bindings, { ...commandScope, itemId }, item.label) : [];
  };

  const captureItemRects = useCallback(() => {
    const nextRects = new Map<string, DOMRect>();
    itemListRef.current?.querySelectorAll<HTMLElement>('[data-item-id]').forEach((element) => {
      const itemId = element.dataset.itemId;
      if (itemId) nextRects.set(itemId, element.getBoundingClientRect());
    });
    itemRectsRef.current = nextRects;
  }, []);

  const setPreviewOrder = useCallback((nextItemIds: string[] | null) => {
    captureItemRects();
    previewItemIdsRef.current = nextItemIds;
    setPreviewItemIds(nextItemIds);
  }, [captureItemRects]);

  const updateSortPreviewForPointer = useCallback((currentDrag: ItemDragState, clientX: number, clientY: number) => {
    const currentAsset = activeAssetRef.current;
    if (!currentAsset) return;

    const target = Array.from(itemListRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [])
      .find((candidate) => {
        if (candidate.dataset.itemId === currentDrag.sourceItemId) return false;
        const bounds = candidate.getBoundingClientRect();
        return clientX >= bounds.left
          && clientX <= bounds.right
          && clientY >= bounds.top
          && clientY <= bounds.bottom;
      });
    const targetItemId = target?.dataset.itemId;
    if (!target || !targetItemId) return;

    const targetBounds = target.getBoundingClientRect();
    const placeAfter = clientY > targetBounds.top + targetBounds.height / 2;
    const nextItemIds = currentAsset.items
      .map((item) => item.id)
      .filter((currentItemId) => currentItemId !== currentDrag.sourceItemId);
    const targetIndex = nextItemIds.indexOf(targetItemId);
    if (targetIndex < 0) return;

    nextItemIds.splice(targetIndex + (placeAfter ? 1 : 0), 0, currentDrag.sourceItemId);
    if (!currentDrag.previewItemIds || nextItemIds.some((id, index) => id !== currentDrag.previewItemIds?.[index])) {
      currentDrag.previewItemIds = nextItemIds;
      setPreviewOrder(nextItemIds);
    }
  }, [setPreviewOrder]);

  const stopItemAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollPointerRef.current = null;
  }, []);

  const getItemAutoScrollSpeed = useCallback((pointer: PointerPosition): number => {
    const main = mainContentRef.current;
    if (!main) return 0;

    const bounds = main.getBoundingClientRect();
    if (pointer.x < bounds.left || pointer.x > bounds.right) return 0;
    const edgeSize = Math.min(ITEM_AUTO_SCROLL_EDGE_PX, bounds.height / 3);
    if (edgeSize <= 0) return 0;

    if (pointer.y >= bounds.top && pointer.y < bounds.top + edgeSize) {
      const intensity = 1 - (pointer.y - bounds.top) / edgeSize;
      return -Math.max(2, Math.round(ITEM_AUTO_SCROLL_MAX_SPEED_PX * intensity));
    }
    if (pointer.y <= bounds.bottom && pointer.y > bounds.bottom - edgeSize) {
      const intensity = 1 - (bounds.bottom - pointer.y) / edgeSize;
      return Math.max(2, Math.round(ITEM_AUTO_SCROLL_MAX_SPEED_PX * intensity));
    }
    return 0;
  }, []);

  const updateItemAutoScroll = useCallback((pointer: PointerPosition) => {
    autoScrollPointerRef.current = pointer;
    if (getItemAutoScrollSpeed(pointer) === 0) {
      stopItemAutoScroll();
      return;
    }
    if (autoScrollFrameRef.current !== null) return;

    const continueScrolling = () => {
      autoScrollFrameRef.current = null;
      const currentDrag = dragStateRef.current;
      const currentPointer = autoScrollPointerRef.current;
      const main = mainContentRef.current;
      if (!currentDrag?.hasDragged || !currentPointer || !main || !isSortingItemsRef.current) {
        stopItemAutoScroll();
        return;
      }

      const speed = getItemAutoScrollSpeed(currentPointer);
      const maximumScrollTop = Math.max(0, main.scrollHeight - main.clientHeight);
      const nextScrollTop = Math.min(maximumScrollTop, Math.max(0, main.scrollTop + speed));
      if (speed === 0 || nextScrollTop === main.scrollTop) {
        stopItemAutoScroll();
        return;
      }

      main.scrollTop = nextScrollTop;
      updateSortPreviewForPointer(currentDrag, currentPointer.x, currentPointer.y);
      autoScrollFrameRef.current = window.requestAnimationFrame(continueScrolling);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(continueScrolling);
  }, [getItemAutoScrollSpeed, stopItemAutoScroll, updateSortPreviewForPointer]);

  const clearItemDrag = useCallback(() => {
    stopItemAutoScroll();
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    dragStateRef.current = null;
    setDragItemId(null);
    setDragOverlay(null);
    setPreviewOrder(null);
  }, [setPreviewOrder, stopItemAutoScroll]);

  useEffect(() => {
    setPasteTargetItemId(null);
    setCommandAssetId(null);
    setCommandItemId(null);
    setIsSortingItems(false);
    clearItemDrag();
    return clearItemDrag;
  }, [activeAsset?.id, clearItemDrag]);

  useEffect(() => {
    if (commandItemId && !activeAsset?.items.some(item => item.id === commandItemId)) { setCommandAssetId(null); setCommandItemId(null); }
    if (pasteTargetItemId && !activeAsset?.items.some((item) => item.id === pasteTargetItemId)) {
      setPasteTargetItemId(null);
    }
    if (dragItemId && !activeAsset?.items.some((item) => item.id === dragItemId)) {
      clearItemDrag();
    }
  }, [activeAsset?.items, clearItemDrag, commandItemId, dragItemId, pasteTargetItemId]);

  useLayoutEffect(() => {
    const previousRects = itemRectsRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    itemListRef.current?.querySelectorAll<HTMLElement>('[data-item-id]').forEach((element) => {
      const itemId = element.dataset.itemId;
      const previousRect = itemId ? previousRects.get(itemId) : undefined;
      const nextRect = element.getBoundingClientRect();
      if (!previousRect || reduceMotion) return;

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (deltaX === 0 && deltaY === 0) return;
      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
      );
    });
  }, [previewItemIds]);

  useEffect(() => {
    if (isSortingItems) return;

    const handleWindowPaste = async (event: ClipboardEvent) => {
      const currentAsset = activeAssetRef.current;
      if (!currentAsset || !pasteTargetItemId) return;
      if (isTextEditingElement(document.activeElement)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const imageFiles = getImageFilesFromClipboard(event);
      if (imageFiles.length === 0) return;

      const targetItem = currentAsset.items.find((item) => item.id === pasteTargetItemId);
      if (!targetItem) return;

      event.preventDefault();
      const images = await readImageFiles(imageFiles);
      if (isSortingItemsRef.current) return;

      images.forEach((image) => {
        dispatch({
          type: 'ADD_IMAGE',
          payload: { assetId: currentAsset.id, itemId: targetItem.id, image },
        });
      });
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [dispatch, isSortingItems, pasteTargetItemId]);

  const handleSortHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, itemId: string) => {
    if (!isSortingItems || !event.isPrimary || event.button !== 0) return;

    if (dragStateRef.current) clearItemDrag();
    event.preventDefault();
    const handle = event.currentTarget;
    const sourceCard = handle.closest<HTMLElement>('[data-item-id]');
    const sourceBounds = sourceCard?.getBoundingClientRect();
    if (!sourceBounds) return;

    const dragState: ItemDragState = {
      pointerId: event.pointerId,
      sourceItemId: itemId,
      startX: event.clientX,
      startY: event.clientY,
      handle,
      hasDragged: false,
      previewItemIds: null,
      overlayOffsetX: event.clientX - sourceBounds.left,
      overlayOffsetY: event.clientY - sourceBounds.top,
    };
    dragStateRef.current = dragState;

    const finishDrag = (shouldCommit: boolean) => {
      stopItemAutoScroll();
      const currentDrag = dragStateRef.current;
      if (currentDrag && currentDrag.pointerId === event.pointerId) {
        const currentAsset = activeAssetRef.current;
        const previewIds = currentDrag.previewItemIds;
        if (
          shouldCommit
          && currentDrag.hasDragged
          && currentAsset
          && previewIds
          && previewIds.some((itemId, index) => itemId !== currentAsset.items[index]?.id)
        ) {
          dispatch({
            type: 'REORDER_ITEMS',
            payload: { assetId: currentAsset.id, itemIds: previewIds },
          });
        }
        dragStateRef.current = null;
      }

      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      dragCleanupRef.current = null;
      setDragItemId(null);
      setDragOverlay(null);
      setPreviewOrder(null);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag || currentDrag.pointerId !== moveEvent.pointerId) return;

      const movedDistance = Math.hypot(
        moveEvent.clientX - currentDrag.startX,
        moveEvent.clientY - currentDrag.startY
      );
      if (movedDistance < 8) return;

      const currentAsset = activeAssetRef.current;
      const sourceItem = currentAsset?.items.find((item) => item.id === currentDrag.sourceItemId);
      if (!currentAsset || !sourceItem) return;
      if (!currentDrag.hasDragged) {
        currentDrag.hasDragged = true;
        currentDrag.handle.setPointerCapture(currentDrag.pointerId);
      }

      setDragItemId(currentDrag.sourceItemId);
      setDragOverlay({
        label: sourceItem.label,
        sortIndex: currentAsset.items.findIndex((item) => item.id === sourceItem.id) + 1,
        x: moveEvent.clientX - currentDrag.overlayOffsetX,
        y: moveEvent.clientY - currentDrag.overlayOffsetY,
        width: sourceBounds.width,
        height: sourceBounds.height,
      });
      updateSortPreviewForPointer(currentDrag, moveEvent.clientX, moveEvent.clientY);
      updateItemAutoScroll({ x: moveEvent.clientX, y: moveEvent.clientY });
      moveEvent.preventDefault();
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === event.pointerId) finishDrag(true);
    };

    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === event.pointerId) finishDrag(false);
    };

    dragCleanupRef.current = () => finishDrag(false);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  };

  const handleAddItem = useCallback((label: string) => {
    const currentAsset = activeAssetRef.current;
    if (!currentAsset) return;
    dispatch({
      type: 'ADD_ITEM',
      payload: { assetId: currentAsset.id, label },
    });
  }, [dispatch]);

  if (!activeAssetId || !activeAsset) {
    return (
      <main tabIndex={-1} aria-label="证据工作区" className="flex min-h-0 min-w-0 flex-1 items-center justify-center focus:outline-none">
        <div className="rounded-[18px] border border-[#e3e7ef] bg-white/90 px-8 py-10 text-center text-[#8a94a6] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.035)]">
          <svg className="mx-auto mb-3 h-14 w-14 text-[#cfd6e2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-base">请从左侧选择一个资产查看检查项</p>
        </div>
      </main>
    );
  }

  const enterSortingMode = () => {
    setPasteTargetItemId(null);
    clearItemDrag();
    setIsSortingItems(true);
  };

  const exitSortingMode = () => {
    clearItemDrag();
    setIsSortingItems(false);
  };

  const visibleItems = previewItemIds
    ? previewItemIds
      .map((itemId) => activeAsset.items.find((item) => item.id === itemId))
      .filter((item): item is (typeof activeAsset.items)[number] => !!item)
    : activeAsset.items;

  const requiredItems = activeAsset.items.filter((item) => item.required);
  const missingRequiredCount = requiredItems.filter((item) => item.images.length === 0).length;
  const completedRequiredCount = requiredItems.length - missingRequiredCount;
  const requiredProgressPercent = requiredItems.length > 0 ? Math.round((completedRequiredCount / requiredItems.length) * 100) : 100;

  return (
    <main ref={mainContentRef} tabIndex={-1} aria-label="证据工作区" className="min-h-0 min-w-0 flex-1 overflow-y-auto [overflow-wrap:anywhere] focus:outline-none">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:py-3.5">
        <div className="mb-4 rounded-[18px] border border-[#e3e7ef] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {activeCategory && (
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#8a94a6]">
                  <span>{activeCategory.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">共 {activeAsset.items.length} 项检查</span>
                </div>
              )}
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#1c2230] sm:text-2xl">{activeAsset.name}</h2>
            </div>
            {requiredItems.length > 0 && (
              <div
                className={`inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  missingRequiredCount === 0
                    ? 'border-[#c4eae5] bg-[#eef9f7] text-[#0b665f]'
                    : 'border-[#e3e7ef] bg-[#f6f8fb] text-[#556072]'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    missingRequiredCount === 0
                      ? 'bg-[#10b981] shadow-[0_0_0_3px_rgba(16,185,129,0.14)]'
                      : 'bg-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.13)]'
                  }`}
                  aria-hidden="true"
                />
                <span>必填进度</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e3e7ef]">
                  <span
                    className={`block h-full rounded-full transition-all duration-300 ${
                      missingRequiredCount === 0 ? 'bg-[#10b981]' : 'bg-[#0d9488]'
                    }`}
                    style={{ width: `${requiredProgressPercent}%` }}
                  />
                </span>
                <span className="font-semibold text-[#1c2230] tabular-nums">
                  {completedRequiredCount}/{requiredItems.length}
                </span>
                <span className={missingRequiredCount === 0 ? 'text-[#0b665f]' : 'text-[#b45309] tabular-nums'}>
                  {missingRequiredCount === 0 ? '已齐' : `待补 ${missingRequiredCount} 项`}
                </span>
              </div>
            )}
          </div>
          {!isSortingItems && !pasteTargetItemId && (
            <p className="mt-2 text-xs text-[#8a94a6]">点击下方任意检查项设为粘贴目标后，可直接按 Ctrl+V 粘贴截图。</p>
          )}
        </div>

        <div className="sticky top-0 z-10 mb-4 rounded-[14px] border border-[#e3e7ef] bg-white/95 p-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] backdrop-blur-md">
          {isSortingItems ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h3 className="text-base font-semibold text-[#1c2230]">检查项排序</h3>
                <p className="text-sm text-[#647084]" role="status" aria-live="polite">
                  按住右侧六点手柄，移至另一项后再松开；普通编辑、上传和粘贴操作已暂时关闭。
                </p>
              </div>
              <button
                type="button"
                onClick={exitSortingMode}
                className="min-h-11 rounded-[10px] border border-[#96dcd4] bg-[#e2f5f2] px-5 text-base font-semibold text-[#0b665f] transition-all hover:bg-[#d1efe9] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:ring-offset-2"
              >
                完成排序
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <AddItemBar onAddItem={handleAddItem} draftRef={addItemDraftRef} />
              <button
                type="button"
                onClick={enterSortingMode}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-transparent bg-transparent px-3 text-sm font-medium text-[#556072] transition-all hover:bg-[#edf1f6] hover:text-[#1c2230] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                <svg aria-hidden="true" className="h-4 w-4 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                调整顺序
              </button>
              <button
                type="button"
                onClick={(event) => { event.currentTarget.focus(); setCommandItemId(null); setCommandAssetId(activeAsset.id); }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-transparent bg-transparent px-3 text-sm font-medium text-[#556072] transition-all hover:bg-[#edf1f6] hover:text-[#1c2230] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                <svg aria-hidden="true" className="h-4 w-4 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4 6 6 6-6 6m10 0h6" />
                </svg>
                测评命令
              </button>
              <div className="hidden items-center rounded-[10px] border border-[#e3e7ef] bg-[#eef1f6] p-0.5 xl:inline-flex" role="group" aria-label="检查项画板列数">
                <button
                  type="button"
                  aria-pressed={boardCols === 2}
                  onClick={() => setBoardCols(2)}
                  className={`h-9 rounded-[8px] px-2.5 text-xs font-medium transition-all ${boardCols === 2 ? 'bg-white font-semibold text-[#1c2230] shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-[#647084] hover:text-[#1c2230]'}`}
                >
                  双列画板
                </button>
                <button
                  type="button"
                  aria-pressed={boardCols === 1}
                  onClick={() => setBoardCols(1)}
                  className={`h-9 rounded-[8px] px-2.5 text-xs font-medium transition-all ${boardCols === 1 ? 'bg-white font-semibold text-[#1c2230] shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-[#647084] hover:text-[#1c2230]'}`}
                >
                  单列大图
                </button>
              </div>
            </div>
          )}
        </div>

        <AssessmentCommandDialog
          key={activeAsset.id}
          isOpen={commandAssetId === activeAsset.id}
          assetName={activeAsset.name}
          categoryName={activeCategory?.name ?? ''}
          itemId={commandItemId ?? undefined}
          itemLabel={activeAsset.items.find(item => item.id === commandItemId)?.label}
          linkedIds={commandItemId ? itemCommandIds(commandItemId) : []}
          bindingError={commandError}
          configuredProfileId={effectiveCommandProfile(commandLibrary.defaults, commandScope)}
          hasAssetOverride={hasAssetCommandOverride(commandLibrary.defaults, commandScope)}
          defaultsError={commandLibrary.defaultsError}
          canSetCategory={!!activeCategory}
          onSetDefault={async (kind, profileId) => { await setCommandDefault(kind, commandScope, profileId); commandLibrary.refresh(); }}
          hasManualBinding={!!commandItemId && Object.prototype.hasOwnProperty.call(commandLibrary.bindings, commandBindingKey({ ...commandScope, itemId: commandItemId }))}
          onResetBinding={async () => { if (commandItemId) { await resetCommandBinding({ ...commandScope, itemId: commandItemId }); commandLibrary.refresh(); } }}
          onToggleLink={async (id, linked) => {
            if (!commandItemId) return;
            const target = { ...commandScope, itemId: commandItemId };
            const label = activeAsset.items.find(item => item.id === commandItemId)?.label ?? '';
            await setCommandLinked(target, id, linked, localStorage, () => resolveItemCommandIds(resolveCommandProfiles(readCommandChanges()), readCommandDefaults(), {}, target, label));
            commandLibrary.refresh();
          }}
          onLibraryChange={commandLibrary.refresh}
          onClose={() => setCommandAssetId(null)}
        />

        {activeAsset.items.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#d8dee8] bg-white/75 py-12 text-center text-[#8a94a6]">
            <p className="text-sm">暂无检查项，请在上方添加</p>
          </div>
        ) : (
          <div
            ref={itemListRef}
            className={
              isSortingItems
                ? 'space-y-3 touch-manipulation'
                : boardCols === 2
                  ? 'grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2'
                  : 'space-y-5'
            }
          >
            {visibleItems.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                compactGrid={!isSortingItems && boardCols === 2}
                sortIndex={index + 1}
                assetId={activeAsset.id}
                commandCount={itemCommandIds(item.id).length}
                onManageCommands={() => { setCommandItemId(item.id); setCommandAssetId(activeAsset.id); }}
                commandPanel={<ItemCommandPanel
                  profiles={commandLibrary.profiles}
                  ids={itemCommandIds(item.id)}
                  error={commandError}
                  onManage={() => { setCommandItemId(item.id); setCommandAssetId(activeAsset.id); }}
                />}
                isSorting={isSortingItems}
                isDragSource={item.id === dragItemId}
                onSortHandlePointerDown={handleSortHandlePointerDown}
                isPasteTarget={!isSortingItems && item.id === pasteTargetItemId}
                onSelectPasteTarget={isSortingItems ? undefined : setPasteTargetItemId}
                onRename={(itemId, newLabel) =>
                  dispatch({
                    type: 'RENAME_ITEM',
                    payload: { assetId: activeAsset.id, itemId, newLabel },
                  })
                }
                onRemove={(itemId) =>
                  dispatch({
                    type: 'REMOVE_ITEM',
                    payload: { assetId: activeAsset.id, itemId },
                  })
                }
                onToggleRequired={(itemId) =>
                  dispatch({
                    type: 'TOGGLE_REQUIRED',
                    payload: { assetId: activeAsset.id, itemId },
                  })
                }
                onAddImage={(assetId, itemId, image) => {
                  // 字节先入库再进入界面：写失败会弹提示，不会出现「界面有图、库里没图」。
                  void addImageAndSave({ assetId, itemId, image }).catch((err) =>
                    reportCriticalError({
                      type: 'manual',
                      message: `图片保存失败，请重试：${err instanceof Error ? err.message : String(err)}`,
                      stack: err instanceof Error ? err.stack : undefined,
                      context: 'ui:addImage',
                    })
                  );
                }}
                onRemoveImage={(assetId, itemId, imageId) => {
                  void removeImageAndSave(assetId, itemId, imageId).catch((err) =>
                    reportCriticalError({
                      type: 'manual',
                      message: `图片删除失败，请重试：${err instanceof Error ? err.message : String(err)}`,
                      stack: err instanceof Error ? err.stack : undefined,
                      context: 'ui:removeImage',
                    })
                  );
                }}
                onUpdateCaption={(assetId, itemId, imageId, caption) =>
                  dispatch({
                    type: 'UPDATE_IMAGE_CAPTION',
                    payload: { assetId, itemId, imageId, caption },
                  })
                }
                onReorderImages={(assetId, itemId, imageIds) =>
                  dispatch({
                    type: 'REORDER_IMAGES',
                    payload: { assetId, itemId, imageIds },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
      {dragOverlay && (
        <div
          data-drag-overlay
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex items-center gap-4 rounded-[14px] border border-[#78cfc5] bg-white px-4 py-3 text-[#1c2230] shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
          style={{
            left: dragOverlay.x,
            top: dragOverlay.y,
            width: dragOverlay.width,
            height: dragOverlay.height,
            transform: 'rotate(1deg)',
          }}
        >
          <span className="w-8 text-center text-sm font-semibold text-[#8a94a6] tabular-nums">{dragOverlay.sortIndex}</span>
          <span className="min-w-0 flex-1 text-base font-semibold leading-6">{dragOverlay.label}</span>
          <span className="flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-[#e3e7ef] bg-[#f8fafc] text-[#556072]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
            </svg>
          </span>
        </div>
      )}
    </main>
  );
};

export default ContentArea;

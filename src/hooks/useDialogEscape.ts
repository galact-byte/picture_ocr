import { useEffect, useRef } from 'react';

/**
 * 统一普通弹窗的 Escape 关闭行为：存在禁用态（如保存中或内层确认框打开）时不触发。
 */
export function useDialogEscape(open: boolean, onClose: () => void, disabled = false): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || disabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, disabled]);
}

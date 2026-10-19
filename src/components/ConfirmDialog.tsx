import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BUTTON_DANGER_SOLID, BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_TITLE } from './dialogStyles';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'default';
}

interface PendingConfirm {
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

export function useConfirmDialog() {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConfirm({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      if (!pendingConfirm) return;
      pendingConfirm.resolve(confirmed);
      setPendingConfirm(null);
    },
    [pendingConfirm]
  );

  const dialog = pendingConfirm ? (
    <ConfirmDialog
      options={pendingConfirm.options}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, dialog };
}

interface ConfirmDialogProps {
  options: ConfirmDialogOptions;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ options, onCancel, onConfirm }) => {
  const isDanger = options.tone !== 'default';
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    first?.focus();
    const focusin = (event: FocusEvent) => {
      if (event.target instanceof Node && !container.contains(event.target)) first?.focus();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || !first || !last) return;
      if (!container.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('focusin', focusin);
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('focusin', focusin);
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected && previous.getClientRects().length) previous.focus();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4"
      onClick={(event) => { event.stopPropagation(); onCancel(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
      }}
    >
      <div className="w-full max-w-md border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-5">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center border ${isDanger ? 'border-red-200 bg-red-50 text-red-600' : 'border-blue-200 bg-blue-50 text-blue-600'}`}>
            {isDanger ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 4.3L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.2 9a4 4 0 117.1 2.5c-.9.6-1.3 1.1-1.3 2.5M12 18h.01" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className={DIALOG_TITLE}>{options.title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{options.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4">
          <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
            {options.cancelText || '取消'}
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className={isDanger ? BUTTON_DANGER_SOLID : BUTTON_PRIMARY}
          >
            {options.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

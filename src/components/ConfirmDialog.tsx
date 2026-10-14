import React, { useCallback, useState } from 'react';
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4"
      onClick={onCancel}
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
            <h2 className={DIALOG_TITLE}>{options.title}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{options.message}</p>
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

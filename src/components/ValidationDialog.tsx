import React from 'react';
import type { ValidationMissing } from '../utils/wordExport';
import { BUTTON_SECONDARY, BUTTON_WARNING, DIALOG_BODY, DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL, DIALOG_TITLE } from './dialogStyles';

interface ValidationDialogProps {
  isOpen: boolean;
  missing: ValidationMissing[];
  onContinue: () => void;
  onCancel: () => void;
}

const ValidationDialog: React.FC<ValidationDialogProps> = ({
  isOpen,
  missing,
  onContinue,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="validation-dialog-title" className={DIALOG_OVERLAY}>
      <div className={`${DIALOG_PANEL} max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className={DIALOG_HEADER}>
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
            <h2 id="validation-dialog-title" className={DIALOG_TITLE}>必填项缺失提醒</h2>
            <p className={DIALOG_DESCRIPTION}>以下 {missing.length} 个必填检查项尚未上传截图，请确认是否继续导出。</p>
            </div>
          </div>
        </div>

        <div className={DIALOG_BODY}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 font-medium">分类</th>
                <th className="pb-2 font-medium">资产</th>
                <th className="pb-2 font-medium">检查项</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">{item.categoryName}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.assetName}</td>
                  <td className="py-2 text-red-600">{item.itemLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={DIALOG_FOOTER}>
          <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>返回补充</button>
          <button type="button" onClick={onContinue} className={BUTTON_WARNING}>继续导出</button>
        </div>
      </div>
    </div>
  );
};

export default ValidationDialog;

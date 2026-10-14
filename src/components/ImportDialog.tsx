import React, { useEffect, useState, useRef } from 'react';
import { isEvidencePackageFile } from '../utils/evidencePackage';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_BODY, DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL, DIALOG_TITLE, FIELD_INPUT, FIELD_LABEL } from './dialogStyles';

interface ImportResultInfo {
  success: boolean;
  message: string;
}

interface ImportDialogProps {
  isOpen: boolean;
  targetProjectName: string;
  onClose: () => void;
  onImportOverwrite: (file: File, password: string) => Promise<ImportResultInfo>;
  onImportMerge: (file: File, password: string) => Promise<ImportResultInfo>;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  targetProjectName,
  onClose,
  onImportOverwrite,
  onImportMerge,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResultInfo | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPassword('');
      setImporting(false);
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async (mode: 'overwrite' | 'merge') => {
    if (!selectedFile || importing) return;
    setImporting(true);
    setResult(null);
    try {
      const info = mode === 'overwrite'
        ? await onImportOverwrite(selectedFile, password)
        : await onImportMerge(selectedFile, password);
      setResult(info);
    } catch (err) {
      setResult({ success: false, message: `导入失败：${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setImporting(false);
    }
  };

  const isEncrypted = selectedFile ? isEvidencePackageFile(selectedFile) : false;
  const disableActions = !selectedFile || (isEncrypted && !password) || importing;
  const showSuccess = result?.success === true;

  const modeButton = 'flex min-h-16 flex-col items-start justify-center rounded-[2px] border px-4 py-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" className={DIALOG_OVERLAY} onClick={() => { if (!importing) onClose(); }}>
      <div className={`${DIALOG_PANEL} max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className={DIALOG_HEADER}>
          <div className="min-w-0">
            <h2 id="import-dialog-title" className={DIALOG_TITLE}>导入数据包</h2>
            <p className={DIALOG_DESCRIPTION}>目标项目：<span className="font-medium text-slate-900">{targetProjectName}</span></p>
          </div>
        </div>

        {showSuccess ? (
          <>
            <div className={DIALOG_BODY}>
              <div role="status" className="flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs text-white">✓</span>
                <div>
                  <div className="font-semibold">导入完成</div>
                  <div className="mt-1 leading-6">{result?.message}</div>
                </div>
              </div>
            </div>
            <div className={DIALOG_FOOTER}>
              <button type="button" onClick={onClose} className={BUTTON_PRIMARY}>完成</button>
            </div>
          </>
        ) : (
          <>
            <div className={`${DIALOG_BODY} space-y-4`}>
              <label className={FIELD_LABEL}>
                数据包文件（.zip 或 .evidence）
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.evidence"
                  onChange={handleFileChange}
                  disabled={importing}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:min-h-9 file:rounded-[2px] file:border file:border-blue-200 file:bg-blue-50 file:px-3 file:text-sm file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              {selectedFile && (
                <div className="truncate border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  已选择：{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}

              {selectedFile && isEncrypted && (
                <label className={FIELD_LABEL}>加密采集包密码
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={importing} className={FIELD_INPUT} />
                </label>
              )}

              {result && !result.success && (
                <div role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
                  {result.message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => handleImport('overwrite')} disabled={disableActions} className={`${modeButton} border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100`}>
                  <span className="font-semibold">覆盖导入</span>
                  <span className="mt-1 text-xs text-orange-600">替换当前全部数据</span>
                </button>
                <button type="button" onClick={() => handleImport('merge')} disabled={disableActions} className={`${modeButton} border-green-200 bg-green-50 text-green-700 hover:bg-green-100`}>
                  <span className="font-semibold">合并导入</span>
                  <span className="mt-1 text-xs text-green-600">按资产合并去重</span>
                </button>
              </div>

              {importing && (
                <div role="status" aria-live="polite">
                  <div className="mb-2 text-sm text-slate-600">正在导入数据，请稍候...</div>
                  <div className="relative h-1.5 w-full overflow-hidden bg-blue-100 text-blue-500 progress-indeterminate" />
                </div>
              )}
            </div>
            <div className={DIALOG_FOOTER}>
              <button type="button" onClick={onClose} disabled={importing} className={BUTTON_SECONDARY}>取消</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportDialog;

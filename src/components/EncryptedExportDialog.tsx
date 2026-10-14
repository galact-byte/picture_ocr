import React, { useEffect, useState } from 'react';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_PANEL, DIALOG_TITLE, FIELD_INPUT, FIELD_LABEL } from './dialogStyles';

interface EncryptedExportDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onExport: (password: string) => Promise<void>;
}

const EncryptedExportDialog: React.FC<EncryptedExportDialogProps> = ({ open, title = '导出加密采集包', onClose, onExport }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmation('');
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleExport = async () => {
    if (!password) return setError('请输入加密密码。');
    if (password !== confirmation) return setError('两次输入的密码不一致。');
    setSubmitting(true);
    setError('');
    try {
      await onExport(password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出加密采集包失败。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="encrypted-export-title" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4" onClick={() => { if (!submitting) onClose(); }}>
      <div className={`${DIALOG_PANEL} max-w-md`} onClick={(event) => event.stopPropagation()}>
        <div className={DIALOG_HEADER}><h2 id="encrypted-export-title" className={DIALOG_TITLE}>{title}</h2></div>
        <div className={`${DIALOG_BODY} space-y-4`}>
          <label className={FIELD_LABEL}>设置密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" disabled={submitting} className={FIELD_INPUT} />
          </label>
          <label className={FIELD_LABEL}>确认密码
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={submitting} className={FIELD_INPUT} />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <div className={DIALOG_FOOTER}>
          <button onClick={onClose} disabled={submitting} className={BUTTON_SECONDARY}>取消</button>
          <button onClick={() => void handleExport()} disabled={submitting} className={BUTTON_PRIMARY}>{submitting ? '正在加密...' : '导出 .evidence'}</button>
        </div>
      </div>
    </div>
  );
};

export default EncryptedExportDialog;

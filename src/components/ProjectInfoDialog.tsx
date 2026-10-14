import React, { useState, useEffect } from 'react';
import type { ProjectMeta, ProjectProfile } from '../types';
import { useAppContext, useAppState } from '../context/AppContext';
import { parseProfile } from '../utils/preset';
import { useToast } from './Toast';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL, DIALOG_TITLE, FIELD_ERROR, FIELD_INPUT, FIELD_INPUT_ERROR, FIELD_LABEL } from './dialogStyles';

interface ProjectInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

const ProjectInfoDialog: React.FC<ProjectInfoDialogProps> = ({ open, onClose }) => {
  const { meta, profile } = useAppState();
  const { updateProjectMeta } = useAppContext();
  const showToast = useToast();
  const [form, setForm] = useState<ProjectMeta>({ ...meta });
  const [profileForm, setProfileForm] = useState<ProjectProfile>({ ...profile });
  const [errors, setErrors] = useState<{ unitName?: string; systemName?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...meta });
      setProfileForm({ ...profile });
      setErrors({});
    }
  }, [open, meta, profile]);

  if (!open) return null;

  const handleSave = async () => {
    if (saving) return;
    const unitName = form.unitName.trim();
    const systemName = form.systemName.trim();
    const nextErrors = {
      unitName: profileForm.unitFieldRequired && !unitName ? `请填写${profileForm.unitFieldLabel}` : undefined,
      systemName: systemName ? undefined : '请填写系统名称',
    };
    setErrors(nextErrors);
    if (nextErrors.unitName || nextErrors.systemName) return;

    if (!profileForm.reportTitle.trim() || !profileForm.exportFilePrefix.trim() || !profileForm.unitFieldLabel.trim()) {
      showToast('报告配置不能为空。', 'error');
      return;
    }
    setSaving(true);
    try {
      const nextProfile = parseProfile(profileForm);
      await updateProjectMeta({
        ...form,
        projectCode: form.projectCode.trim(),
        projectName: form.projectName.trim(),
        unitName,
        systemName,
      }, nextProfile);
      onClose();
    } catch (err) {
      showToast(`保存项目信息失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (invalid: boolean) => (invalid ? FIELD_INPUT_ERROR : FIELD_INPUT);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="project-info-title" className={DIALOG_OVERLAY} onClick={() => { if (!saving) onClose(); }}>
      <div className={`${DIALOG_PANEL} max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className={DIALOG_HEADER}>
          <h2 id="project-info-title" className={DIALOG_TITLE}>项目信息</h2>
        </div>
        <div className={`${DIALOG_BODY} space-y-4`}>
          <label className={FIELD_LABEL}>项目编号（选填）
            <input type="text" value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} className={FIELD_INPUT} placeholder="例：HJ-2026-001" />
          </label>
          <label className={FIELD_LABEL}>项目名称（选填）
            <input type="text" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className={FIELD_INPUT} placeholder="例：设备巡检项目" />
          </label>
          <div>
            <label className={FIELD_LABEL}>{profileForm.unitFieldLabel} {profileForm.unitFieldRequired && <span className="text-red-600">*</span>}
              <input
                type="text"
                value={form.unitName}
                onChange={(e) => { setErrors((current) => ({ ...current, unitName: undefined })); setForm({ ...form, unitName: e.target.value }); }}
                className={fieldClass(!!errors.unitName)}
                placeholder="例：XX科技有限公司"
                aria-invalid={!!errors.unitName}
              />
            </label>
            {errors.unitName && <p className={FIELD_ERROR}>{errors.unitName}</p>}
          </div>
          <div>
            <label className={FIELD_LABEL}>系统名称 <span className="text-red-600">*</span>
              <input
                type="text"
                value={form.systemName}
                onChange={(e) => { setErrors((current) => ({ ...current, systemName: undefined })); setForm({ ...form, systemName: e.target.value }); }}
                className={fieldClass(!!errors.systemName)}
                placeholder="例：XX业务系统"
                aria-invalid={!!errors.systemName}
              />
            </label>
            {errors.systemName && <p className={FIELD_ERROR}>{errors.systemName}</p>}
          </div>
          <label className={FIELD_LABEL}>日期（选填）
            <input type="date" value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} className={FIELD_INPUT} />
          </label>
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900">报告配置</p>
            <label className={FIELD_LABEL}>报告标题<input className={FIELD_INPUT} value={profileForm.reportTitle} onChange={(e) => setProfileForm({ ...profileForm, reportTitle: e.target.value })} /></label>
            <label className={FIELD_LABEL}>导出文件名前缀<input className={FIELD_INPUT} value={profileForm.exportFilePrefix} onChange={(e) => setProfileForm({ ...profileForm, exportFilePrefix: e.target.value })} /></label>
            <label className={FIELD_LABEL}>单位字段名称<input className={FIELD_INPUT} value={profileForm.unitFieldLabel} onChange={(e) => setProfileForm({ ...profileForm, unitFieldLabel: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4" checked={profileForm.unitFieldRequired} onChange={(e) => setProfileForm({ ...profileForm, unitFieldRequired: e.target.checked })} />单位字段必填</label>
          </div>
        </div>
        <div className={DIALOG_FOOTER}>
          <button type="button" onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>取消</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className={BUTTON_PRIMARY}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectInfoDialog;

import React, { useState, useEffect } from 'react';
import type { ProjectMeta, ProjectProfile } from '../types';
import { useAppContext, useAppState } from '../context/AppContext';
import { parseProfile } from '../utils/preset';
import { useToast } from './Toast';

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

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="project-info-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!saving) onClose(); }}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 id="project-info-title" className="text-lg font-semibold text-gray-800">项目信息</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目编号（选填）</label>
            <input
              type="text"
              value={form.projectCode}
              onChange={(e) => setForm({ ...form, projectCode: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：HJ-2026-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目名称（选填）</label>
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：设备巡检项目"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{profileForm.unitFieldLabel} {profileForm.unitFieldRequired && <span className="text-red-600">*</span>}</label>
            <input
              type="text"
              value={form.unitName}
              onChange={(e) => { setErrors((current) => ({ ...current, unitName: undefined })); setForm({ ...form, unitName: e.target.value }); }}
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${errors.unitName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              placeholder="例：XX科技有限公司"
              aria-invalid={!!errors.unitName}
            />
            {errors.unitName && <p className="mt-1 text-xs text-red-600">{errors.unitName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系统名称 <span className="text-red-600">*</span></label>
            <input
              type="text"
              value={form.systemName}
              onChange={(e) => { setErrors((current) => ({ ...current, systemName: undefined })); setForm({ ...form, systemName: e.target.value }); }}
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${errors.systemName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              placeholder="例：XX业务系统"
              aria-invalid={!!errors.systemName}
            />
            {errors.systemName && <p className="mt-1 text-xs text-red-600">{errors.systemName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期（选填）</label>
            <input
              type="date"
              value={form.reportDate}
              onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">报告配置</p>
            <label className="block text-sm text-gray-700">报告标题<input className="mt-1 w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={profileForm.reportTitle} onChange={(e) => setProfileForm({ ...profileForm, reportTitle: e.target.value })} /></label>
            <label className="block text-sm text-gray-700">导出文件名前缀<input className="mt-1 w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={profileForm.exportFilePrefix} onChange={(e) => setProfileForm({ ...profileForm, exportFilePrefix: e.target.value })} /></label>
            <label className="block text-sm text-gray-700">单位字段名称<input className="mt-1 w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={profileForm.unitFieldLabel} onChange={(e) => setProfileForm({ ...profileForm, unitFieldLabel: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={profileForm.unitFieldRequired} onChange={(e) => setProfileForm({ ...profileForm, unitFieldRequired: e.target.checked })} />单位字段必填</label>
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectInfoDialog;

import React, { useEffect, useRef, useState } from 'react';
import type { ProjectGroup, ProjectMeta } from '../../types';
import { createDefaultMeta } from '../../data/defaults';
import { splitSystemNames } from '../../utils/db';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_FOOTER, DIALOG_TITLE, FIELD_CONTROL } from '../dialogStyles';

export type ProjectGroupDialogMode = 'create-group' | 'add-system' | 'edit-group' | 'edit-system';
export type ProjectCreationType = 'independent' | 'group';
export interface ProjectGroupDialogValues {
  projectCode: string;
  projectName: string;
  unitName: string;
  reportDate: string;
  systemName: string;
  creationType: ProjectCreationType;
}

interface ProjectGroupDialogProps {
  open: boolean;
  mode: ProjectGroupDialogMode;
  group: ProjectGroup | null;
  system: ProjectMeta | null;
  onClose: () => void;
  onSave: (values: ProjectGroupDialogValues) => Promise<boolean>;
  initialCreationType?: ProjectCreationType;
  legacyOnboarding?: boolean;
  onboardingSaving?: boolean;
  onboardingError?: string;
  onChooseLegacyPreset?: (adopt: boolean) => Promise<void>;
  unitFieldLabel: string;
  unitFieldRequired: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}

type FormValues = Omit<ProjectGroupDialogValues, 'creationType'>;

const inputClass = FIELD_CONTROL;

function createForm(group: ProjectGroup | null, system: ProjectMeta | null): FormValues {
  return {
    projectCode: group?.projectCode ?? system?.projectCode ?? '',
    projectName: group?.projectName ?? system?.projectName ?? '',
    unitName: group?.unitName ?? system?.unitName ?? '',
    reportDate: group?.reportDate ?? system?.reportDate ?? createDefaultMeta().reportDate,
    systemName: system?.systemName ?? '',
  };
}

const ProjectGroupDialog: React.FC<ProjectGroupDialogProps> = ({ open, mode, group, system, onClose, onSave, unitFieldLabel, unitFieldRequired, loading = false, loadError = '', onRetry, legacyOnboarding = false, onboardingSaving = false, onboardingError = '', onChooseLegacyPreset, initialCreationType = 'independent' }) => {
  const [form, setForm] = useState<FormValues>(() => createForm(group, system));
  const [creationType, setCreationType] = useState<ProjectCreationType>(initialCreationType);
  const [errors, setErrors] = useState<{ unitName?: string; systemName?: string }>({});
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const busy = saving || onboardingSaving;
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...(containerRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)') ?? [])]
      .filter(control => !(control instanceof HTMLInputElement && control.type === 'radio' && !control.checked));
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busyRef.current) closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open, legacyOnboarding]);

  useEffect(() => {
    if (open) {
      setForm(createForm(group, system));
      setCreationType(initialCreationType);
      setErrors({});
      setSaving(false);
    }
  }, [open, group, system, initialCreationType]);

  if (!open) return null;

  const isAddingSystem = mode === 'add-system';
  const isEditingGroup = mode === 'edit-group';
  const isGroupedSystemOnly = mode === 'edit-system' && !!group;
  const isSystemOnly = isAddingSystem || isGroupedSystemOnly;
  const title = legacyOnboarding ? '沿用旧项目模板' : mode === 'create-group' ? '新建项目' : isAddingSystem ? '添加系统' : isEditingGroup ? '编辑项目组信息' : '编辑系统信息';

  const handleSave = async () => {
    if (saving || loading || loadError) return;
    const unitName = form.unitName.trim();
    const systemName = form.systemName.trim();
    const nextErrors = {
      unitName: !isSystemOnly && unitFieldRequired && !unitName ? `请填写${unitFieldLabel}` : undefined,
      systemName: !isEditingGroup && !systemName ? '请填写系统名称'
        : mode === 'create-group' && creationType === 'independent' && splitSystemNames(systemName).length !== 1 ? '多个系统名称请选择系统组' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.unitName || nextErrors.systemName) return;

    setSaving(true);
    try {
      const saved = await onSave({
        ...form,
        creationType,
        projectCode: form.projectCode.trim(),
        projectName: form.projectName.trim(),
        unitName,
        systemName,
      });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" data-project-group-dialog aria-modal="true" aria-labelledby="group-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" onClick={() => { if (!busy) onClose(); }}>
      <div ref={containerRef} className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="group-dialog-title" className={DIALOG_TITLE}>{title}</h2>
        </div>
        {legacyOnboarding ? <>
          <div className="space-y-4 px-6 py-5">
            <p className="text-sm text-slate-700">已有项目均使用等保模板。请选择以后新建项目沿用最近修改的等保模板，或继续使用通用模板。</p>
            {onboardingError && <p role="alert" className="text-sm text-red-700">{onboardingError}</p>}
            {onboardingSaving && <p role="status" className="text-sm text-slate-600">正在保存模板选择…</p>}
          </div>
          <div className={`${DIALOG_FOOTER} flex-wrap`}>
            <button type="button" onClick={() => void onChooseLegacyPreset?.(false)} disabled={busy} className={`${BUTTON_SECONDARY} !min-h-11`}>继续使用通用模板</button>
            <button type="button" onClick={() => void onChooseLegacyPreset?.(true)} disabled={busy} className={`${BUTTON_PRIMARY} !min-h-11`}>沿用最近等保模板</button>
          </div>
        </> : <>
        <div className="space-y-4 px-6 py-5">
          {loading && <p role="status">正在读取预设…</p>}
          {loadError && <div role="alert" className="text-sm text-red-700">{loadError}<button type="button" onClick={onRetry} className="ml-3 min-h-11 underline">重试</button></div>}
          {mode === 'create-group' && <fieldset disabled={busy}>
            <legend className="mb-1 text-sm font-medium text-slate-700">创建类型</legend>
            <div className="flex gap-5">
              {([['independent', '单系统'], ['group', '系统组']] as const).map(([value, label]) => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="creationType" value={value} checked={creationType === value} onChange={() => { setCreationType(value); setErrors(current => ({ ...current, systemName: undefined })); }} />{label}
              </label>)}
            </div>
          </fieldset>}
          {!isSystemOnly && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">项目编号（选填）</label>
                <input className={inputClass} value={form.projectCode} onChange={(event) => setForm({ ...form, projectCode: event.target.value })} placeholder="例：HJ-2026-001" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">项目名称（选填）</label>
                <input className={inputClass} value={form.projectName} onChange={(event) => setForm({ ...form, projectName: event.target.value })} placeholder="例：设备巡检项目" />
              </div>
              <div>
                <label htmlFor="group-dialog-unit" className="mb-1 block text-sm font-medium text-slate-700">{unitFieldLabel} {unitFieldRequired && <span className="text-red-600">*</span>}</label>
                <input id="group-dialog-unit" aria-describedby={errors.unitName ? 'group-dialog-unit-error' : undefined} className={`${inputClass} ${errors.unitName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`} value={form.unitName} onChange={(event) => { setErrors((current) => ({ ...current, unitName: undefined })); setForm({ ...form, unitName: event.target.value }); }} aria-invalid={!!errors.unitName} />
                {errors.unitName && <p id="group-dialog-unit-error" role="alert" className="mt-1 text-xs text-red-600">{errors.unitName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">日期（选填）</label>
                <input type="date" className={inputClass} value={form.reportDate} onChange={(event) => setForm({ ...form, reportDate: event.target.value })} />
              </div>
            </>
          )}
          {!isEditingGroup && <div>
            <label htmlFor="group-dialog-system" className="mb-1 block text-sm font-medium text-slate-700">{(mode === 'create-group' && creationType === 'group') || (mode === 'edit-system' && !group) ? '系统名称（可填写多个）' : '系统名称'} <span className="text-red-600">*</span></label>
            <input id="group-dialog-system" aria-describedby={errors.systemName ? 'group-dialog-system-error' : undefined} className={`${inputClass} ${errors.systemName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`} value={form.systemName} onChange={(event) => { setErrors((current) => ({ ...current, systemName: undefined })); setForm({ ...form, systemName: event.target.value }); }} placeholder={(mode === 'create-group' && creationType === 'group') || (mode === 'edit-system' && !group) ? '例：生产调度系统、安全监控系统、人员定位系统' : '例：生产调度系统'} aria-invalid={!!errors.systemName} />
            {errors.systemName && <p id="group-dialog-system-error" role="alert" className="mt-1 text-xs text-red-600">{errors.systemName}</p>}
          </div>}
        </div>
        <div className={DIALOG_FOOTER}>
          <button onClick={onClose} disabled={saving} className={BUTTON_SECONDARY}>取消</button>
          <button onClick={() => void handleSave()} disabled={saving || loading || !!loadError} className={BUTTON_PRIMARY}>{saving ? '保存中...' : '保存'}</button>
        </div>
        </>}
      </div>
    </div>
  );
};

export default ProjectGroupDialog;

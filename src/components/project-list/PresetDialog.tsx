import React, { useEffect, useRef, useState } from 'react';
import type { ProjectPreset } from '../../types';
import { parsePreset, serializePreset, DEFAULT_PRESET, sanitizeFileNamePart } from '../../utils/preset';
import { saveDefaultPreset } from '../../utils/db';

interface PresetDialogProps {
  open: boolean;
  preset: ProjectPreset;
  projectMode?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
  onSaved: (preset: ProjectPreset) => void;
  onError: (message: string) => void;
}

const buttonClass = 'min-h-11 border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const PresetDialog: React.FC<PresetDialogProps> = ({ open, preset, projectMode = false, loading = false, error = '', onRetry, onClose, onSaved, onError }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(preset);
  useEffect(() => { if (open) setDraft(preset); }, [open, preset]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panelRef.current?.querySelector<HTMLElement>('input:not([type=file]), button')?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);
  if (!open) return null;

  const saveDefault = async (next: ProjectPreset) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try { await saveDefaultPreset(next); onSaved(next); }
    catch (cause) { onError(cause instanceof Error ? cause.message : '保存预设失败'); }
    finally { busyRef.current = false; setSaving(false); }
  };
  const importPreset = async (file: File | undefined) => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('预设文件不能超过 1 MiB');
      let value: unknown;
      try { value = JSON.parse(await file.text()); } catch { throw new Error('预设文件不是有效的 JSON'); }
      const imported = parsePreset(value, file.size);
      await saveDefaultPreset(imported);
      onSaved(imported);
    } catch (cause) { onError(cause instanceof Error ? cause.message : '预设导入失败'); }
    finally { busyRef.current = false; setSaving(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const downloadPreset = () => {
    try {
      const next = parsePreset(projectMode ? draft : preset);
      const url = URL.createObjectURL(new Blob([serializePreset(next)], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${sanitizeFileNamePart(next.name, '项目模板')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) { onError(cause instanceof Error ? cause.message : '导出预设失败'); }
  };
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !busyRef.current) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type=file])') ?? []);
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="preset-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" onKeyDown={keyboard} onClick={() => { if (!saving) onClose(); }}>
      <div ref={panelRef} className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-slate-200 bg-white shadow-lg" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-5"><h2 id="preset-dialog-title" className="text-lg font-semibold text-slate-900">{projectMode ? '另存为预设' : '模板预设'}</h2></div>
        <div className="space-y-4 px-6 py-5">
          {projectMode ? <>
            <label className="block text-sm text-slate-700">预设名称<input autoFocus maxLength={500} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 min-h-11 w-full border border-slate-300 px-3" /></label>
            {(['reportTitle', 'exportFilePrefix', 'unitFieldLabel'] as const).map((key, index) => <label key={key} className="block text-sm text-slate-700">{['报告标题', '导出文件名前缀', '单位字段名称'][index]}<input maxLength={500} value={draft.profile[key]} onChange={(e) => setDraft({ ...draft, profile: { ...draft.profile, [key]: e.target.value } })} className="mt-1 min-h-11 w-full border border-slate-300 px-3" /></label>)}
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.profile.unitFieldRequired} onChange={(e) => setDraft({ ...draft, profile: { ...draft.profile, unitFieldRequired: e.target.checked } })} />单位字段必填</label>
          </> : loading ? <p role="status">正在读取预设…</p> : error ? <div role="alert" className="text-sm text-red-700">{error}<button type="button" onClick={onRetry} className="ml-3 min-h-11 underline">重试</button></div> : <p className="text-sm text-slate-900">当前预设：{preset.name}</p>}
          <div className="flex flex-wrap gap-2">
            {projectMode ? <button type="button" disabled={saving} onClick={() => void saveDefault(draft)} className={buttonClass}>设为新建默认</button> : <>
              <button type="button" disabled={saving} onClick={() => inputRef.current?.click()} className={buttonClass}>导入预设</button>
              <button type="button" disabled={saving} onClick={() => void saveDefault(DEFAULT_PRESET)} className={buttonClass}>恢复通用模板</button>
            </>}
            <button type="button" disabled={saving || loading || !!error} onClick={downloadPreset} className={buttonClass}>{projectMode ? '导出预设' : '导出当前预设'}</button>
          </div>
          {saving && <p role="status">正在保存…</p>}
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importPreset(event.target.files?.[0])} />
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><button type="button" onClick={onClose} disabled={saving} className={buttonClass}>关闭</button></div>
      </div>
    </div>
  );
};
export default PresetDialog;

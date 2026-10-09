import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { assessmentCommandProfiles, commandFamilies } from '../data/assessmentCommands';
import type { CommandFamily, CommandSnippet } from '../data/assessmentCommands';
import { copyCommandText, filterCommandGroups, getCommandGroupText, inferCommandFamily } from '../utils/assessmentCommands';
import { COMMAND_STORAGE_KEY, commandFieldErrors, deleteCommand, readCommandChanges, resolveCommandProfiles, saveCommand } from '../utils/assessmentCommandStore';
import type { CommandChange } from '../utils/assessmentCommandStore';
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_CLOSE, DIALOG_DESCRIPTION, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL, DIALOG_TITLE, FIELD_INPUT, FIELD_LABEL } from './dialogStyles';

interface AssessmentCommandDialogProps {
  isOpen: boolean;
  assetName: string;
  categoryName: string;
  configuredProfileId?: string;
  hasAssetOverride?: boolean;
  canSetCategory?: boolean;
  defaultsError?: string;
  hasManualBinding?: boolean;
  onSetDefault?: (kind: 'category' | 'asset', profileId: string | null) => Promise<void>;
  onResetBinding?: () => Promise<void>;
  itemId?: string;
  itemLabel?: string;
  linkedIds?: string[];
  bindingError?: string;
  onToggleLink?: (id: string, linked: boolean) => Promise<void>;
  onLibraryChange?: () => void;
  onClose: () => void;
}
interface LibraryState { changes: CommandChange[]; error: string }
interface EditorState { profileId: string; groupId: string; original?: CommandSnippet; value: CommandSnippet }
interface Confirmation { title: string; message: string; run: () => void | Promise<void> }
function errorText(error: unknown) { return error instanceof Error ? error.message : String(error); }
function loadLibrary(): LibraryState {
  try { return { changes: readCommandChanges(), error: '' }; }
  catch (error) { return { changes: [], error: `自定义命令库读取失败，暂时显示内置命令并暂停编辑：${errorText(error)}` }; }
}
const ACTION = '!min-h-11';

const AssessmentCommandDialog: React.FC<AssessmentCommandDialogProps> = ({ isOpen, assetName, categoryName, itemId, itemLabel, linkedIds = [], bindingError, onToggleLink, onLibraryChange, onClose, configuredProfileId, hasAssetOverride, canSetCategory, defaultsError, hasManualBinding, onSetDefault, onResetBinding }) => {
  const [library, setLibrary] = useState(loadLibrary);
  const [family, setFamily] = useState<CommandFamily>(() => inferCommandFamily(categoryName));
  const [profileId, setProfileId] = useState(() => assessmentCommandProfiles.find(p => p.family === inferCommandFamily(categoryName))?.id ?? 'huawei');
  const [groupId, setGroupId] = useState('');
  const [managing, setManaging] = useState(false);
  const [copyId, setCopyId] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [formError, setFormError] = useState('');
  const [validated, setValidated] = useState(false);
  const [writing, setWriting] = useState(false);
  const writePending = useRef(false);
  const writeRevision = useRef(0);
  const fieldErrors = validated && editor ? commandFieldErrors(editor.value) : {};
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const [manualText, setManualText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const copyRevision = useRef(0);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  const profiles = useMemo(() => resolveCommandProfiles(library.changes), [library.changes]);
  const profile = profiles.find(p => p.id === profileId) ?? profiles[0];
  const visibleGroups = filterCommandGroups(profile.groups, query);
  const selectedGroup = visibleGroups.find(g => g.id === groupId) ?? visibleGroups[0];
  const editorProfile = editor ? profiles.find(p => p.id === editor.profileId) : undefined;
  const editorGroup = editorProfile?.groups.find(g => g.id === editor?.groupId);
  const unavailableIds = linkedIds.filter(id => !profiles.some(p => p.groups.some(g => g.snippets.some(s => s.id === id))));
  const dirty = editor !== null && JSON.stringify(editor.value) !== JSON.stringify(editor.original ?? { id: editor.value.id, title: '', command: '', note: '' });

  function clearCopy() {
    copyRevision.current++;
    setStatus(''); setCopyId(''); setCopying(false); setManualText('');
  }
  function leaveEditor() { setEditor(null); setFormError(''); setValidated(false); clearCopy(); }
  function requestClose() {
    if (writePending.current) return;
    if (confirmation) { setConfirmation(null); return; }
    const close = () => { setConfirmation(null); leaveEditor(); onClose(); };
    if (dirty) setConfirmation({ title: '放弃未保存的命令？', message: '编辑内容尚未保存，关闭后将丢弃这些修改。', run: close });
    else close();
  }
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === COMMAND_STORAGE_KEY || event.key === null) { setLibrary(loadLibrary()); clearCopy(); } };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    setLibrary(loadLibrary()); setQuery(''); clearCopy();
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    if (root) root.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => typeRef.current?.focus());
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const scope = panelRef.current?.querySelector<HTMLElement>('[data-command-confirm]') ?? panelRef.current;
      const focusable = [...(scope?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (!scope?.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', keyboard, true);
    return () => {
      copyRevision.current++;
      writeRevision.current++;
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keyboard, true);
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = previousInert ?? false;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen, itemId]);
  useEffect(() => {
    if (!isOpen) { setManaging(false); return; }
    // 外部默认平台变更不能改变正在编辑或确认删除的对象及其环境提示。
    if (editor || confirmation) return;
    const configured = assessmentCommandProfiles.find(p => p.id === configuredProfileId);
    if (configured) { setFamily(configured.family); setProfileId(configured.id); setGroupId(''); setQuery(''); clearCopy(); }
  }, [isOpen, configuredProfileId]);
  const editing = !!editor, confirming = !!confirmation;
  useEffect(() => {
    if (!isOpen) return;
    if (confirming) cancelRef.current?.focus();
    else if (editing) titleRef.current?.focus();
    else typeRef.current?.focus();
  }, [editing, confirming, isOpen]);

  useEffect(() => {
    if (manualText) { manualRef.current?.focus(); manualRef.current?.select(); }
  }, [manualText]);

  async function copy(text: string, label: string, id: string) {
    setCopyId(id);
    const revision = ++copyRevision.current;
    setCopying(true); setManualText(''); setStatus('正在复制…');
    const success = await copyCommandText(text);
    if (!openRef.current || revision !== copyRevision.current) return;
    setCopying(false);
    setStatus(success ? `已复制：${label}` : '自动复制失败，请选中下方文本，按 Ctrl+C（Mac 使用 ⌘C）手动复制。');
    if (!success) setManualText(text);
  }
  function beginEditor(original?: CommandSnippet, targetGroupId = selectedGroup?.id) {
    if (!targetGroupId || writePending.current) return;
    setGroupId(targetGroupId);
    clearCopy(); setFormError(''); setValidated(false);
    setEditor({ profileId: profile.id, groupId: targetGroupId, original,
      value: original ? { ...original } : { id: `custom-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, title: '', command: '', note: '' } });
  }
  async function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || writePending.current) return;
    setValidated(true);
    const invalid = Object.keys(commandFieldErrors(editor.value))[0];
    if (invalid) {
      setFormError('保存失败：请检查标记的字段。');
      event.currentTarget.querySelector<HTMLElement>(`[name="${invalid}"]`)?.focus();
      return;
    }
    writePending.current = true; setWriting(true); setFormError('');
    const revision = writeRevision.current;
    try {
      await saveCommand(editor.profileId, editor.groupId, editor.value, editor.original);
      if (!openRef.current || revision !== writeRevision.current) return;
      setLibrary(loadLibrary()); onLibraryChange?.(); setGroupId(editor.groupId); setQuery(''); leaveEditor(); setStatus('命令已保存。');
    } catch (error) {
      if (openRef.current && revision === writeRevision.current) setFormError(`保存失败：${errorText(error)}`);
    } finally { writePending.current = false; setWriting(false); }
  }
  function requestDelete(snippet: CommandSnippet, currentGroupId: string) {
    if (writePending.current) return;
    setConfirmation({ title: '删除命令？', message: `确定删除“${snippet.title}”？此操作只影响本机命令库。`, run: async () => {
      if (writePending.current) return;
      writePending.current = true; setWriting(true);
      const revision = writeRevision.current;
      try {
        await deleteCommand(profile.id, currentGroupId, snippet);
        if (!openRef.current || revision !== writeRevision.current) return;
        setLibrary(loadLibrary()); onLibraryChange?.();
        setConfirmation(null); clearCopy(); setStatus('命令已删除。');
      } catch (error) {
        if (openRef.current && revision === writeRevision.current) { setConfirmation(null); setStatus(`删除失败：${errorText(error)}`); }
      } finally { writePending.current = false; setWriting(false); }
    } });
  }
  async function toggleLink(id: string, linked: boolean) {
    if (!onToggleLink || writePending.current) return;
    clearCopy(); writePending.current = true; setWriting(true);
    const revision = writeRevision.current;
    try {
      await onToggleLink(id, linked);
      if (openRef.current && revision === writeRevision.current) setStatus(linked ? '已关联到当前检查项。' : '已取消此检查项的关联。');
    } catch (error) {
      if (openRef.current && revision === writeRevision.current) setStatus(`关联保存失败：${errorText(error)}`);
    } finally { writePending.current = false; setWriting(false); }
  }
  async function saveAuxiliary(action: () => Promise<void>, message: string) {
    if (writePending.current) return;
    clearCopy(); writePending.current = true; setWriting(true);
    const revision = writeRevision.current;
    try {
      await action();
      if (openRef.current && revision === writeRevision.current) setStatus(message);
    } catch (error) {
      if (openRef.current && revision === writeRevision.current) setStatus(`保存失败：${errorText(error)}`);
    } finally { writePending.current = false; setWriting(false); }
  }
  if (!isOpen) return null;

  return createPortal(
    <div className={DIALOG_OVERLAY} onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={panelRef} role="dialog" aria-busy={writing} aria-modal="true" aria-labelledby="assessment-command-title" className={`${DIALOG_PANEL} max-w-5xl`}>
        <div className={`${DIALOG_HEADER} !px-4 sm:!px-6`}>
          <div className="min-w-0">
            <h2 id="assessment-command-title" className={DIALOG_TITLE}>测评命令</h2>
            <p className={`${DIALOG_DESCRIPTION} break-words`}>当前资产：{assetName}{itemLabel ? ` · 检查项：${itemLabel}` : ''}</p>
          </div>
          <button type="button" aria-label="关闭测评命令" disabled={writing} onClick={requestClose} className={`${DIALOG_CLOSE} !h-11 !w-11`}><span aria-hidden className="text-2xl">×</span></button>
        </div>
        {library.error && <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{library.error}</p>}
        {itemId && bindingError && <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{bindingError}</p>}
        {itemId && !editor && !confirmation && <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800 sm:px-6">
          {hasManualBinding ? '手动选择' : '自动默认'} · 已关联 {linkedIds.length} 段。
          {hasManualBinding && onResetBinding && <button type="button" disabled={writing || !!bindingError} className={`${BUTTON_SECONDARY} ${ACTION} ml-2`} onClick={() => void saveAuxiliary(onResetBinding, '已恢复检查项自动默认。')}>恢复自动默认</button>}
          {!!unavailableIds.length && <div className="mt-2">{unavailableIds.length} 段命令已删除。
            {unavailableIds.map(id => <button key={id} type="button" disabled={writing || !!bindingError || !!library.error} onClick={() => toggleLink(id, false)} className={`${BUTTON_SECONDARY} ${ACTION} ml-2 mt-1`}>取消失效关联：{id}</button>)}
          </div>}
        </div>}
        {confirmation ? (
          <div data-command-confirm className="overflow-y-auto px-4 py-6 sm:px-6">
            <h3 className="font-semibold text-slate-950">{confirmation.title}</h3>
            <p className="mt-3 break-words text-sm leading-6 text-slate-600">{confirmation.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} type="button" disabled={writing} className={`${BUTTON_SECONDARY} ${ACTION}`} onClick={() => setConfirmation(null)}>取消</button>
              <button type="button" disabled={writing} className={`${BUTTON_DANGER} ${ACTION}`} onClick={() => void confirmation.run()}>确认</button>
            </div>
          </div>
        ) : editor ? (
          <form noValidate aria-busy={writing} onSubmit={submitEditor} className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
            <h3 className="font-semibold text-slate-950">{editor.original ? '编辑命令' : '新增命令'}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{editorProfile?.label} / {editorGroup?.title} · {editorGroup?.environment}</p>
            <label className={`${FIELD_LABEL} mt-4`}>命令标题
              <input ref={titleRef} name="title" aria-invalid={!!fieldErrors.title} aria-describedby={fieldErrors.title ? 'command-title-error' : undefined} disabled={writing} required maxLength={120} value={editor.value.title} onChange={e => { setFormError(''); setEditor({ ...editor, value: { ...editor.value, title: e.target.value } }); }} className={`${FIELD_INPUT} min-h-11`} />
            </label>
            {fieldErrors.title && <p id="command-title-error" className="mt-1 text-sm text-red-700">{fieldErrors.title}</p>}
            <label className={`${FIELD_LABEL} mt-4`}>命令内容
              <textarea name="command" aria-invalid={!!fieldErrors.command} aria-describedby={fieldErrors.command ? 'command-content-error' : undefined} disabled={writing} required spellCheck={false} rows={8} maxLength={32768} value={editor.value.command} onChange={e => { setFormError(''); setEditor({ ...editor, value: { ...editor.value, command: e.target.value } }); }} className={`${FIELD_INPUT} font-mono leading-6`} placeholder="只填写需要复制的命令，说明写在下方。" />
            </label>
            {fieldErrors.command && <p id="command-content-error" className="mt-1 text-sm text-red-700">{fieldErrors.command}</p>}
            <label className={`${FIELD_LABEL} mt-4`}>说明（可选，不参与复制）
              <textarea name="note" aria-invalid={!!fieldErrors.note} aria-describedby={fieldErrors.note ? 'command-note-error' : undefined} disabled={writing} rows={3} maxLength={4000} value={editor.value.note ?? ''} onChange={e => { setFormError(''); setEditor({ ...editor, value: { ...editor.value, note: e.target.value } }); }} className={FIELD_INPUT} placeholder="执行权限、版本、需要替换的参数等。" />
            </label>
            {fieldErrors.note && <p id="command-note-error" className="mt-1 text-sm text-red-700">{fieldErrors.note}</p>}
            {formError && <p role="alert" className="mt-3 break-words text-sm text-red-700">{formError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={writing} className={`${BUTTON_SECONDARY} ${ACTION}`} onClick={() => dirty ? setConfirmation({ title: '放弃未保存的命令？', message: '编辑内容尚未保存，返回后将丢弃这些修改。', run: () => { setConfirmation(null); leaveEditor(); } }) : leaveEditor()}>取消</button>
              <button type="submit" disabled={writing || !!library.error} className={`${BUTTON_PRIMARY} ${ACTION}`}>{writing ? '正在保存…' : '保存命令'}</button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-[1fr_1.7fr_2fr] sm:px-6">
              <label className={FIELD_LABEL}>设备类型
                <select ref={typeRef} disabled={writing} value={family} className={`${FIELD_INPUT} min-h-11`} onChange={e => {
                  const next = commandFamilies.find(f => f.id === e.target.value);
                  if (!next) return;
                  setFamily(next.id); setProfileId(profiles.find(p => p.family === next.id)?.id ?? 'huawei'); setGroupId(''); setQuery(''); clearCopy();
                }}>{commandFamilies.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
              </label>
              <label className={FIELD_LABEL}>平台
                <select disabled={writing} value={profileId} className={`${FIELD_INPUT} min-h-11`} onChange={e => { setProfileId(e.target.value); setGroupId(''); setQuery(''); clearCopy(); }}>
                  {profiles.filter(p => p.family === family).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className={`${FIELD_LABEL} col-span-2 sm:col-span-1`}>查找命令
                <input type="search" disabled={writing} value={query} placeholder="搜索检查项或命令" className={`${FIELD_INPUT} min-h-11`} onChange={e => { setQuery(e.target.value); setGroupId(''); clearCopy(); }} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-4 py-1 text-sm sm:px-6">
              <details className="min-w-0 flex-1 open:basis-full sm:open:basis-auto">
                <summary className="min-h-11 cursor-pointer py-3 text-slate-600">默认平台：{configuredProfileId ? profiles.find(p => p.id === configuredProfileId)?.label : '未设置'}{hasAssetOverride ? '（仅本资产）' : configuredProfileId ? '（分类默认）' : ''}</summary>
                <p className="mb-2 text-xs leading-5 text-slate-600">将当前所选平台用于明确用途的检查项。分类默认影响本分类已有和新增资产，不覆盖单台设置或手动关联。配置仅保存在本机。</p>
                {defaultsError && <p role="alert" className="text-red-700">{defaultsError}</p>}
                <div className="mb-2 flex flex-wrap gap-2">
                  {canSetCategory && onSetDefault && <button type="button" disabled={writing || !!defaultsError} className={`${BUTTON_SECONDARY} ${ACTION}`} onClick={() => void saveAuxiliary(() => onSetDefault('category', profileId), '已设置分类默认平台。')}>设为分类默认</button>}
                  {onSetDefault && <button type="button" disabled={writing || !!defaultsError} className={`${BUTTON_SECONDARY} ${ACTION}`} onClick={() => void saveAuxiliary(() => onSetDefault('asset', profileId), '已设置本资产平台。')}>仅用于本资产</button>}
                  {hasAssetOverride && onSetDefault && <button type="button" disabled={writing || !!defaultsError} className={`${BUTTON_SECONDARY} ${ACTION}`} onClick={() => void saveAuxiliary(() => onSetDefault('asset', null), '已恢复分类默认。')}>恢复分类默认</button>}
                </div>
              </details>
              <button type="button" disabled={writing} className={`${BUTTON_SECONDARY} ${ACTION}`} onClick={() => { setManaging(value => !value); clearCopy(); }}>{managing ? '退出管理' : '管理命令库'}</button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row sm:overflow-hidden">
              <nav aria-label="命令检查用途" className="hidden w-48 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3 sm:block">
                <p className="px-3 pb-2 text-xs text-slate-500">检查用途</p>
                {visibleGroups.map(g => <button key={g.id} type="button" disabled={writing} aria-current={selectedGroup?.id === g.id ? 'true' : undefined} onClick={() => { setGroupId(g.id); clearCopy(); }} className={`mb-1 min-h-11 w-full border-l-2 px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${selectedGroup?.id === g.id ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'border-transparent text-slate-700 hover:bg-slate-100'}`}>{g.title}</button>)}
              </nav>
              <section className="min-w-0 flex-1 px-4 py-4 sm:overflow-y-auto sm:px-6">
                <label className={`${FIELD_LABEL} mb-4 sm:hidden`}>检查用途
                  <select value={selectedGroup?.id ?? ''} disabled={writing || !selectedGroup} className={`${FIELD_INPUT} min-h-11`} onChange={e => { setGroupId(e.target.value); clearCopy(); }}>
                    {visibleGroups.length ? visibleGroups.map(g => <option key={g.id} value={g.id}>{g.title}</option>) : <option value="">无匹配分组</option>}
                  </select>
                </label>
                {(query.trim() ? visibleGroups : selectedGroup ? [selectedGroup] : []).map(selectedGroup => <div key={selectedGroup.id} data-command-group={selectedGroup.id}>
                  <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-950">{selectedGroup.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">执行环境：{selectedGroup.environment}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {managing && <button type="button" className={`${BUTTON_SECONDARY} ${ACTION}`} disabled={writing || !!library.error} onClick={() => beginEditor(undefined, selectedGroup.id)}>新增命令</button>}
                      {!query.trim() && !!selectedGroup.snippets.length && <button type="button" className={`${BUTTON_SECONDARY} ${ACTION}`} disabled={copying} onClick={() => void copy(getCommandGroupText(selectedGroup), `${selectedGroup.title}（整个分组）`, selectedGroup.id)}>复制本组</button>}
                      {copyId === selectedGroup.id && <span role="status" aria-live="polite" className="self-center text-sm text-blue-700">{status}</span>}
                    </div>
                  </div>
                  {selectedGroup.note && <p className="mt-3 text-sm leading-6 text-slate-600">{selectedGroup.note}</p>}
                  {selectedGroup.snippets.map(snippet => <article key={snippet.id} data-command-id={snippet.id} className="mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <h4 className="min-w-0 break-words text-sm font-semibold text-slate-900">{snippet.title}{snippet.id.startsWith('custom-') && <span className="ml-2 text-xs font-normal text-slate-500">自定义</span>}</h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {copyId === snippet.id && <span role="status" aria-live="polite" className="text-sm text-blue-700">{status}</span>}
                        {managing && <><button type="button" aria-label={`编辑：${snippet.title}`} disabled={writing || !!library.error} onClick={() => beginEditor(snippet, selectedGroup.id)} className={`${BUTTON_SECONDARY} ${ACTION} !px-3`}>编辑</button>
                        <button type="button" aria-label={`删除：${snippet.title}`} disabled={writing || !!library.error} onClick={() => requestDelete(snippet, selectedGroup.id)} className={`${BUTTON_SECONDARY} ${ACTION} !px-3 hover:!border-red-300 hover:!text-red-700`}>删除</button></>}
                        <button type="button" aria-label={`复制：${snippet.title}`} disabled={copying} onClick={() => void copy(snippet.command, snippet.title, snippet.id)} className="min-h-11 px-3 text-sm text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">复制</button>
                      </div>
                    </div>
                    <pre className="overflow-x-auto border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900" tabIndex={0} aria-label={`${snippet.title}命令`}><code>{snippet.command}</code></pre>
                    {snippet.note && <p className="mt-2 text-sm leading-6 text-slate-600">{snippet.note}</p>}
                    {itemId && onToggleLink && <button type="button" data-link-command={snippet.id} aria-pressed={linkedIds.includes(snippet.id)} disabled={writing || !!library.error || !!bindingError} onClick={() => toggleLink(snippet.id, !linkedIds.includes(snippet.id))} className={`${BUTTON_SECONDARY} ${ACTION} mt-2 ${linkedIds.includes(snippet.id) ? '!border-blue-300 !bg-blue-50 !text-blue-700' : ''}`}>
                      {linkedIds.includes(snippet.id) ? '已关联 · 取消关联' : '关联到检查项'}
                    </button>}
                  </article>)}
                  {!selectedGroup.snippets.length && <p className="py-6 text-sm text-slate-500">本组暂无命令，可在管理模式下新增。</p>}
                  {selectedGroup.viewingSteps?.length && <div className="mt-4 border border-slate-200 px-3 py-3"><h4 className="text-sm font-semibold text-slate-900">图形界面查看</h4><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">{selectedGroup.viewingSteps.map(step => <li key={step}>{step}</li>)}</ul></div>}
                </div>)}
                {!selectedGroup && <div className="py-8 text-center"><p className="text-sm text-slate-600">没有找到匹配的命令。</p><button type="button" onClick={() => { setQuery(''); setGroupId(''); clearCopy(); }} className={`${BUTTON_SECONDARY} ${ACTION} mt-4`}>清空搜索</button></div>}
              </section>
            </div>
          </>
        )}
        <div className="border-t border-slate-200 px-4 py-3 sm:px-6">
          <p role="status" aria-live="polite" className={`break-words text-sm ${manualText || status.includes('失败') ? 'text-red-700' : 'text-blue-700'}`}>{writing ? '正在保存，请稍候…' : (copyId ? '' : status) || '命令库在本机保存，所有资产共用；说明文字不参与复制。'}</p>
          {manualText && <div className="mt-2"><textarea ref={manualRef} readOnly value={manualText} aria-label="手动复制文本" rows={3} className={`${FIELD_INPUT} font-mono`} /><button type="button" className={`${BUTTON_SECONDARY} ${ACTION} mt-2`} onClick={() => { manualRef.current?.focus(); manualRef.current?.select(); }}>选中全部命令</button></div>}
          {!editor && !confirmation && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer py-1">内置命令来源</summary><p className="mt-1 break-words leading-5">{profile.source}</p></details>}
        </div>
      </div>
    </div>, document.body,
  );
};

export default AssessmentCommandDialog;

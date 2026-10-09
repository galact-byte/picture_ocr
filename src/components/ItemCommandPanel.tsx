import React, { useEffect, useRef, useState } from 'react';
import type { CommandProfile } from '../data/assessmentCommands';
import { copyCommandText } from '../utils/assessmentCommands';
interface ItemCommandPanelProps {
  profiles: CommandProfile[];
  ids: string[];
  error: string;
  onManage: () => void;
}
const ItemCommandPanel: React.FC<ItemCommandPanelProps> = ({ profiles, ids, error, onManage }) => {
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyId, setCopyId] = useState('');
  const [manualText, setManualText] = useState('');
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++; setStatus(''); setCopying(false); setManualText('');
    return () => { revision.current++; };
  }, [profiles, ids]);
  useEffect(() => { if (manualText) { manualRef.current?.focus(); manualRef.current?.select(); } }, [manualText]);
  const all = profiles.flatMap(profile => profile.groups.flatMap(group => group.snippets.map(snippet => ({ profile, group, snippet }))));
  const commands = ids.flatMap(id => { const command = all.find(entry => entry.snippet.id === id); return command ? [command] : []; });
  const missing = ids.length - commands.length;
  async function copy(command: string, title: string, id: string) {
    setCopyId(id);
    const current = ++revision.current;
    setCopying(true); setStatus('正在复制…'); setManualText('');
    const success = await copyCommandText(command);
    if (revision.current !== current) return;
    setCopying(false); setStatus(success ? `已复制：${title}` : '自动复制失败，请按 Ctrl+C（Mac 使用 ⌘C）手动复制下方已选文本。');
    if (!success) setManualText(command);
  }
  return <section data-item-commands aria-label="检查项关联命令" className="min-w-0 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-8" onClick={e => e.stopPropagation()}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={event => { event.currentTarget.focus(); onManage(); }} className="min-h-11 border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">管理关联</button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : <>
      {!!missing && <p role="status" className="mt-3 text-sm text-amber-800">{missing} 段关联命令已从命令库删除，可在“管理关联”中取消失效关联。</p>}
      {commands.map(({ profile, group, snippet }, index) => <article key={snippet.id} data-linked-command-id={snippet.id} className="mt-2 min-w-0">
        {(index === 0 || commands[index - 1].group.id !== group.id) && <div className="break-words border-t border-slate-200 pt-2 text-xs leading-5 text-slate-600"><p>{profile.label} · {group.title} · {group.environment}</p>{group.note && <p>{group.note}</p>}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="min-w-0 break-words text-sm font-semibold text-slate-950">{snippet.title}</h4>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><span role="status" aria-live="polite" className="min-w-0 break-words text-sm text-blue-700">{copyId === snippet.id ? status : ''}</span>
          <button type="button" aria-label={`复制关联命令：${snippet.title}`} disabled={copying} onClick={() => void copy(snippet.command, snippet.title, snippet.id)} className="min-h-11 shrink-0 px-3 text-sm text-blue-700 hover:border-blue-400 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">复制</button></div>
        </div>
        <pre tabIndex={0} aria-label={`${snippet.title}关联命令`} className="max-w-full overflow-x-auto border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900"><code>{snippet.command}</code></pre>
        {snippet.note && <p className="mt-2 break-words text-sm leading-6 text-slate-600">{snippet.note}</p>}
      </article>)}
    </>}
    {manualText && <textarea ref={manualRef} readOnly value={manualText} aria-label="关联命令手动复制文本" rows={4} className="mt-2 w-full min-w-0 border border-slate-300 bg-white p-3 font-mono text-sm" />}
  </section>;
};
export default ItemCommandPanel;

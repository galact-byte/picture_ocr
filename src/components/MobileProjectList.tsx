import React, { useEffect, useState } from 'react';
import type { ProjectSummary } from '../types';
import { createProjectDocument, listProjectGroups, saveProject } from '../utils/db';
import { importEncryptedDataPackage } from '../utils/exportImport';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from './dialogStyles';
import PwaReadinessCard from './PwaReadinessCard';

interface MobileProjectListProps {
  onOpen: (projectId: string) => void;
  onOpenDesktop: () => void;
}

const MobileProjectList: React.FC<MobileProjectListProps> = ({ onOpen, onOpenDesktop }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [message, setMessage] = useState('正在加载本机项目...');
  const [importPassword, setImportPassword] = useState('');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    listProjectGroups().then((groups) => {
      setProjects(groups.flatMap((group) => group.systems).filter((system) => !system.archive));
      setMessage('');
    }).catch((err) => setMessage(`加载项目失败：${err instanceof Error ? err.message : '未知错误'}`));
  }, []);

  const handleInitialize = async (file: File | undefined) => {
    if (!file || initializing) return;
    if (!file.name.toLowerCase().endsWith('.evidence')) return setMessage('初始化仅接受 .evidence 加密采集包。');
    if (!importPassword) return setMessage('请输入初始化加密采集包密码。');
    setInitializing(true);
    try {
      const target = createProjectDocument();
      const result = await importEncryptedDataPackage(file, importPassword, 'overwrite', target.assets, target.categories, target.meta);
      if (!result.success || !result.data) return setMessage(result.message);
      const initialized = { ...target, ...result.data, updatedAt: Date.now() };
      await saveProject(initialized);
      onOpen(initialized.id);
    } catch (err) {
      setMessage(`初始化失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setInitializing(false);
    }
  };

  return (
    <main className="craft-canvas min-h-screen px-4 py-5 text-[#1c2230]">
      <div className="mx-auto max-w-xl">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-[16px] border border-[#e3e7ef] bg-white/90 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.035)] backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#bde6e0] bg-[#e6f6f4] text-[#0d7c73] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]" aria-hidden="true">
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zm3 15h2" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-[-0.01em] text-[#1c2230]">手机采集</h1>
              <p className="truncate text-xs text-[#647084]">选择已保存的系统项目后拍照归档</p>
            </div>
          </div>
          <button type="button" onClick={onOpenDesktop} className={`${BUTTON_SECONDARY} min-h-11 shrink-0`}>桌面工作台</button>
        </header>
        <PwaReadinessCard />
        <section className="mb-4 rounded-[16px] border border-[#e3e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.03)]">
          <h2 className="text-sm font-semibold text-[#1c2230]">从加密初始化包新建采集项目</h2>
          <label className="mt-3 block text-sm font-medium text-[#3b4454]">密码<input type="password" value={importPassword} onChange={(event) => setImportPassword(event.target.value)} className={FIELD_INPUT} /></label>
          <label className={`${BUTTON_PRIMARY} mt-3 min-h-11 cursor-pointer`}>{initializing ? '正在解密并创建...' : '选择 .evidence 初始化包'}<input type="file" accept=".evidence" disabled={initializing} onChange={(event) => { void handleInitialize(event.target.files?.[0]); event.currentTarget.value = ''; }} className="hidden" /></label>
        </section>
        {message && <p role="status" className="mb-4 rounded-[14px] border border-[#e3e7ef] bg-white p-4 text-sm text-[#556072] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{message}</p>}
        {projects.length > 0 && <div className="space-y-3">{projects.map((project) => <button key={project.id} type="button" onClick={() => onOpen(project.id)} className="flex w-full items-center gap-3 rounded-[16px] border border-[#e3e7ef] bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.03)] transition-all active:bg-[#f2fbf9]">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border ${project.assetCount > 0 ? 'border-[#c4eae5] bg-[#e8f7f5] text-[#0d7c73]' : 'border-[#e6eaf1] bg-[#f4f6fa] text-[#8a94a6]'}`} aria-hidden="true">
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.85} d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words font-semibold text-[#1c2230]">{project.meta.systemName || project.meta.projectName || '未命名系统'}</span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#647084] tabular-nums">
              <span>{project.meta.unitName || '未填写单位'}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${project.assetCount > 0 ? 'bg-[#10b981]' : 'bg-[#cbd3df]'}`} />{project.assetCount} 个资产</span>
            </span>
          </span>
        </button>)}</div>}
      </div>
    </main>
  );
};

export default MobileProjectList;

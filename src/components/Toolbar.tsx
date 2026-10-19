import React from 'react';
import { useAppState } from '../context/AppContext';

export interface ToolbarProps {
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
  onBackToProjects: () => void;
  onOpenProjectInfo: () => void;
  onExportWord: () => void;
  onManageTemplates: () => void;
  onSavePreset: () => void;
  onOpenLanCollector?: () => void;
  lanSessionRunning: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onBackToProjects,
  onOpenNavigation,
  navigationOpen = false,
  onOpenProjectInfo,
  onExportWord,
  onManageTemplates,
  onSavePreset,
  onOpenLanCollector,
  lanSessionRunning,
}) => {
  const { meta } = useAppState();
  const projectTitle = meta.projectName.trim() || meta.systemName.trim() || '未命名项目';

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-4 gap-y-2 xl:basis-auto">
        <button
          onClick={onBackToProjects}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 xl:min-h-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7M8 12h13" />
          </svg>
          返回项目列表
        </button>
        {onOpenNavigation && <button type="button" onClick={onOpenNavigation} aria-expanded={navigationOpen} aria-controls="workspace-navigation" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 lg:hidden">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth={2} /></svg>
          分类导航
        </button>}
        <div className="hidden h-7 w-px bg-slate-200 xl:block" />
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-3 gap-y-1 xl:basis-auto">
          <h1 className="shrink-0 whitespace-nowrap text-lg font-bold text-slate-950">证据采集平台</h1>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <span className="min-w-0 text-sm text-slate-600 [overflow-wrap:anywhere]">项目：{projectTitle}</span>
        </div>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
        {onOpenLanCollector && <button
          onClick={onOpenLanCollector}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border px-3 py-1.5 text-sm transition-colors xl:min-h-0 ${lanSessionRunning ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-100' : 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'}`}
        >
          {lanSessionRunning ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" /> : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zm3 15h2" />
          </svg>}
          {lanSessionRunning ? '采集中' : '手机局域网采集'}
        </button>}
        <button
          onClick={onManageTemplates}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 xl:min-h-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          模板管理
        </button>
        <button
          onClick={onSavePreset}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 xl:min-h-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h11l3 3v15H5V3zm3 0v6h8V3M8 21v-7h8v7" />
          </svg>
          另存为预设
        </button>
        <button
          onClick={onExportWord}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 xl:min-h-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          报告
        </button>
        <button
          onClick={onOpenProjectInfo}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 transition-colors hover:bg-amber-100 xl:min-h-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
          </svg>
          项目信息
        </button>
      </div>
    </header>
  );
};

export default Toolbar;

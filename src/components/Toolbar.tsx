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
  const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488]';
  const ghostButton = `inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-transparent bg-transparent px-3 py-1.5 text-sm font-medium text-[#556072] transition-all hover:bg-[#edf1f6] hover:text-[#1c2230] active:translate-y-px xl:min-h-9 ${focusRing}`;

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[#e3e7ef] bg-white/90 px-4 py-2.5 backdrop-blur-md sm:px-5 lg:mx-3 lg:mt-3 lg:rounded-[16px] lg:border lg:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.035)]">
      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2.5 gap-y-1.5 xl:basis-auto">
        <button
          type="button"
          onClick={onBackToProjects}
          className={ghostButton}
        >
          <svg className="h-4 w-4 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7M8 12h13" />
          </svg>
          返回项目列表
        </button>
        {onOpenNavigation && <button type="button" onClick={onOpenNavigation} aria-expanded={navigationOpen} aria-controls="workspace-navigation" className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#d8dee8] bg-white px-3 text-sm font-medium text-[#3b4454] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#f6f8fb] lg:hidden ${focusRing}`}>
          <svg className="h-4 w-4 shrink-0 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth={2} /></svg>
          分类导航
        </button>}
        <div className="hidden h-5 w-px bg-[#e3e7ef] xl:block" />
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-1 xl:basis-auto">
          <h1 className="shrink-0 whitespace-nowrap text-base font-bold tracking-[-0.01em] text-[#1c2230] lg:hidden">证据采集平台</h1>
          <span className="hidden text-[#cfd6e2] sm:inline lg:hidden">/</span>
          <span className="min-w-0 text-sm font-medium text-[#556072] [overflow-wrap:anywhere]">项目：{projectTitle}</span>
        </div>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 xl:w-auto">
        {onOpenLanCollector && <button
          type="button"
          onClick={onOpenLanCollector}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 py-1.5 text-sm font-medium transition-all active:translate-y-px xl:min-h-9 ${focusRing} ${lanSessionRunning ? 'border-[#b8e6e0] bg-[#edf9f7] text-[#0b665f] hover:bg-[#dbf3ef]' : 'border-[#d8dee8] bg-white text-[#475266] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#f6f8fb]'}`}
        >
          {lanSessionRunning ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981] shadow-[0_0_0_3px_rgba(16,185,129,0.16)]" aria-hidden="true" /> : <svg className="h-4 w-4 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zm3 15h2" />
          </svg>}
          {lanSessionRunning ? '采集中' : '手机局域网采集'}
        </button>}
        <button
          type="button"
          onClick={onManageTemplates}
          className={ghostButton}
        >
          <svg className="h-4 w-4 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          模板管理
        </button>
        <button
          type="button"
          onClick={onSavePreset}
          className={ghostButton}
        >
          <svg className="h-4 w-4 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h11l3 3v15H5V3zm3 0v6h8V3M8 21v-7h8v7" />
          </svg>
          另存为预设
        </button>
        <button
          type="button"
          onClick={onOpenProjectInfo}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-transparent bg-transparent px-3 py-1.5 text-sm font-medium text-[#556072] transition-all hover:bg-[#fefaf0] hover:text-[#9a5b08] active:translate-y-px xl:min-h-9 ${focusRing}`}
        >
          <svg className="h-4 w-4 text-[#d97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
          </svg>
          项目信息
        </button>
        <button
          type="button"
          onClick={onExportWord}
          className={`ml-0.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#96dcd4] bg-[#e2f5f2] px-4 py-1.5 text-sm font-semibold text-[#0b665f] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(13,148,136,0.10)] transition-all hover:border-[#78cfc5] hover:bg-[#d1efe9] active:translate-y-px xl:min-h-9 ${focusRing}`}
        >
          <svg className="h-4 w-4 text-[#0d7c73]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          报告
        </button>
      </div>
    </header>
  );
};

export default Toolbar;

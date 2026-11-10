import React from 'react';
import { LIST_ACTION_CLASS } from './projectListUi';

interface ProjectListHeaderProps {
  search: string;
  searchLabel: string;
  showSelection: boolean;
  selectedCount: number;
  exportDisabled: boolean;
  onExportSelected: () => void;
  onSearchChange: (value: string) => void;
  onDeleteSelected: () => void;
  onCreateProject: () => void;
  onOpenStorageSettings: () => void;
  onOpenPresetSettings: () => void;
}

const ProjectListHeader: React.FC<ProjectListHeaderProps> = ({
  search,
  searchLabel,
  showSelection,
  selectedCount,
  exportDisabled,
  onExportSelected,
  onSearchChange,
  onDeleteSelected,
  onCreateProject,
  onOpenStorageSettings,
  onOpenPresetSettings,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="flex items-center gap-2.5">
          <svg className="h-6 w-6 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">证据采集平台</h1>
            <p className="text-xs text-slate-500">证据采集工具</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5 xl:flex-wrap">
          <label className="flex h-11 min-w-0 basis-full items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-slate-500 transition-colors focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/15 sm:basis-[16rem] sm:flex-1 xl:w-[320px] xl:flex-none">
            <svg className="mr-2.5 h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.2-5.2M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          {showSelection && <button type="button"
            onClick={onExportSelected}
            disabled={selectedCount === 0 || exportDisabled}
            className={`${LIST_ACTION_CLASS} border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100`}
            title="批量 ZIP，解压后可逐个导入"
          >导出选中{selectedCount > 0 ? ` ${selectedCount}` : ''}</button>}
          {showSelection && <button
            type="button"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="inline-flex h-11 min-w-[108px] items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            title="勾选系统后批量删除"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.8 12.1A2 2 0 0116.2 21H7.8a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
            </svg>
            删除选中{selectedCount > 0 ? ` ${selectedCount}` : ''}
          </button>}
          <button
            type="button"
            onClick={onOpenStorageSettings}
            className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            title="存储设置"
            aria-label="存储设置"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.61.74 1.05 1.38 1.15" />
            </svg>
            <span className="hidden sm:inline">存储设置</span>
          </button>
          <button
            type="button"
            onClick={onOpenPresetSettings}
            className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            title="模板预设"
          >模板预设</button>
          <button
            type="button"
            onClick={onCreateProject}
            className="inline-flex h-11 min-w-[112px] items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建项目
          </button>
        </div>
      </div>
      {showSelection && selectedCount > 0 && <p className="mx-auto mt-2 max-w-[1280px] text-right text-xs text-slate-600">解压后可逐个导入</p>}
    </header>
  );
};

export default ProjectListHeader;

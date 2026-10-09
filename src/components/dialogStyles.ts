// 普通弹窗共用的外观，跟随工作台工具栏的直角、slate 灰与蓝色主操作；图片查看器等全屏界面不使用。
export const DIALOG_OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4';
export const DIALOG_PANEL = 'flex max-h-[90vh] w-full flex-col border border-slate-200 bg-white shadow-2xl';
export const DIALOG_HEADER = 'flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4';
export const DIALOG_TITLE = 'text-base font-semibold text-slate-950';
export const DIALOG_DESCRIPTION = 'mt-1 text-sm leading-6 text-slate-600';
export const DIALOG_BODY = 'min-h-0 flex-1 overflow-y-auto px-6 py-5';
export const DIALOG_FOOTER = 'flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-6 py-4';
export const DIALOG_CLOSE = 'inline-flex h-9 w-9 shrink-0 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40';

const BUTTON_BASE = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[2px] border px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
export const BUTTON_PRIMARY = `${BUTTON_BASE} border-blue-600 bg-blue-600 font-semibold text-white hover:bg-blue-700`;
export const BUTTON_SECONDARY = `${BUTTON_BASE} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const BUTTON_DANGER_SOLID = `${BUTTON_BASE} border-red-600 bg-red-600 font-semibold text-white hover:bg-red-700`;
export const BUTTON_WARNING = `${BUTTON_BASE} border-amber-500 bg-amber-500 font-semibold text-white hover:bg-amber-600`;
export const BUTTON_DANGER = `${BUTTON_BASE} border-red-700 bg-white font-semibold text-red-700 hover:bg-red-50`;

export const FIELD_LABEL = 'block text-sm font-medium text-slate-700';
export const FIELD_CONTROL = 'w-full rounded-[2px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100';
export const FIELD_INPUT = `mt-1 ${FIELD_CONTROL}`;
export const FIELD_INPUT_ERROR = 'mt-1 w-full rounded-[2px] border border-red-500 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100';
export const FIELD_ERROR = 'mt-1 text-xs text-red-600';

// 普通弹窗共用的淡雅小工具外观：纯白浮窗、细腻浅灰边框、清淡薄荷青主按钮；图片查看器等全屏界面不使用。
export const DIALOG_OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 px-4 backdrop-blur-[3px]';
export const DIALOG_PANEL = 'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[18px] border border-[#e3e7ef] bg-white shadow-[0_16px_44px_rgba(15,23,42,0.12)]';
export const DIALOG_HEADER = 'flex items-start justify-between gap-4 border-b border-[#edf0f5] bg-[#f8fafc] px-6 py-4';
export const DIALOG_TITLE = 'text-base font-semibold tracking-[-0.01em] text-[#1c2230]';
export const DIALOG_DESCRIPTION = 'mt-1 text-sm leading-6 text-[#647084]';
export const DIALOG_BODY = 'min-h-0 flex-1 overflow-y-auto px-6 py-5';
export const DIALOG_FOOTER = 'flex flex-wrap items-center justify-end gap-2 border-t border-[#edf0f5] bg-[#f8fafc] px-6 py-4';
export const DIALOG_CLOSE = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#8a94a6] transition-colors hover:bg-[#edf0f5] hover:text-[#1c2230] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488] disabled:cursor-not-allowed disabled:opacity-40';

const BUTTON_BASE = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] border px-4 text-sm font-medium transition-all active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0';
export const BUTTON_PRIMARY = `${BUTTON_BASE} border-[#96dcd4] bg-[#e2f5f2] font-semibold text-[#0b665f] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(13,148,136,0.10)] hover:border-[#78cfc5] hover:bg-[#d1efe9]`;
export const BUTTON_SECONDARY = `${BUTTON_BASE} border-[#d8dee8] bg-white text-[#3b4454] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#f6f8fb]`;
export const BUTTON_DANGER_SOLID = `${BUTTON_BASE} border-[#f3b4b8] bg-[#fdecec] font-semibold text-[#c53030] hover:border-[#eba0a5] hover:bg-[#fbdada]`;
export const BUTTON_WARNING = `${BUTTON_BASE} border-[#f2d08b] bg-[#fef6e4] font-semibold text-[#9a5b08] hover:bg-[#fdecc8]`;
export const BUTTON_DANGER = `${BUTTON_BASE} border-[#f5c6ca] bg-white font-semibold text-[#c53030] hover:bg-[#fff5f5]`;

export const FIELD_LABEL = 'block text-sm font-medium text-[#3b4454]';
export const FIELD_CONTROL = 'w-full rounded-[10px] border border-[#d8dee8] bg-white px-3 py-2 text-sm text-[#1c2230] placeholder:text-[#98a2b3] focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#0d9488]/15 disabled:cursor-not-allowed disabled:bg-[#f6f8fb]';
export const FIELD_INPUT = `mt-1 ${FIELD_CONTROL}`;
export const FIELD_INPUT_ERROR = 'mt-1 w-full rounded-[10px] border border-[#e57373] bg-white px-3 py-2 text-sm text-[#1c2230] focus:border-[#dc2626] focus:outline-none focus:ring-2 focus:ring-red-100';
export const FIELD_ERROR = 'mt-1 text-xs text-[#c53030]';

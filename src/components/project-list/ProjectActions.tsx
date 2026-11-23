import React, { useEffect, useRef, useState } from 'react';
import { CARD_ACTION_CLASS } from './projectListUi';

export interface ProjectListAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
  /** 禁用时说明原因（悬停提示）。 */
  title?: string;
}
interface ProjectActionsProps {
  label: string;
  actions: ProjectListAction[];
}

// 原生 disclosure 内使用普通按钮和 Tab 顺序，不声明需要方向键协议的 ARIA menu。
const ProjectActions: React.FC<ProjectActionsProps> = ({ label, actions }) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const close = (restoreFocus = false) => {
    const details = detailsRef.current;
    if (!details?.open) return;
    details.open = false;
    if (restoreFocus) details.querySelector('summary')?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        event.preventDefault();
        close(true);
      }
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !detailsRef.current?.contains(event.target)) close();
    };
    const resize = () => close();
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  return (
    <details ref={detailsRef} name="project-list-actions" className="relative" onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close();
    }} onToggle={event => {
      const details = event.currentTarget;
      setOpen(details.open);
      if (!details.open) return;
      const rect = details.querySelector('summary')?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(208, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const showBelow = below >= Math.min(actions.length * 44 + 8, 320) || below >= above;
      setPosition({ position: 'fixed', width, left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        top: showBelow ? rect.bottom + 4 : undefined, bottom: showBelow ? undefined : window.innerHeight - rect.top + 4,
        maxHeight: Math.max(44, showBelow ? below : above) });
    }}>
      <summary aria-label={label} className={`${CARD_ACTION_CLASS} cursor-pointer list-none border-transparent bg-transparent text-[#7b8496] hover:bg-[#edf1f6] hover:text-[#1c2230]`}>更多</summary>
      <div style={position} className="z-30 overflow-y-auto rounded-[12px] border border-[#e3e7ef] bg-white p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.11)]">
        {actions.map(action => <button key={action.label} type="button" disabled={action.disabled} title={action.title}
          className={`min-h-11 w-full rounded-[8px] px-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488] disabled:cursor-not-allowed disabled:opacity-45 ${action.danger ? 'mt-0.5 border-t border-[#f0f3f8] text-[#c53030] hover:bg-[#fff5f5]' : 'text-[#3b4454] hover:bg-[#f4f6fa]'} ${action.className ?? ''}`}
          onClick={() => { close(true); action.onClick(); }}>{action.label}</button>)}
      </div>
    </details>
  );
};

export default ProjectActions;

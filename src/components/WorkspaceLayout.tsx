import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import Toolbar, { type ToolbarProps } from './Toolbar';

interface WorkspaceLayoutProps {
  toolbar: Omit<ToolbarProps, 'onOpenNavigation' | 'navigationOpen'>;
  children: React.ReactNode;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ toolbar, children }) => {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusContentRef = useRef(false);
  const modalOpen = !desktop && navigationOpen;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      const focusedInside = panelRef.current?.contains(document.activeElement) ?? false;
      setDesktop(media.matches);
      setNavigationOpen(!media.matches && focusedInside);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!modalOpen || !panelRef.current || !contentRef.current) return;
    const panel = panelRef.current;
    const content = contentRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousInert = content.inert;
    const controls = (scope: HTMLElement) => [...scope.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    content.inert = true;
    if (!panel.contains(document.activeElement)) controls(panel)[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || panel.querySelector('[role="dialog"]')) return;
      if (event.key === 'Escape') {
        // 内层确认和行内输入先处理自己的取消，不同时关闭导航。
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        setNavigationOpen(false);
      }
      if (event.key !== 'Tab') return;
      const focusable = controls(panel);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (!panel.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      content.inert = previousInert;
      const active = document.activeElement;
      if (window.matchMedia('(min-width: 1024px)').matches && active instanceof HTMLElement && panel.contains(active) && active.getClientRects().length) return;
      if (!focusContentRef.current && previous?.isConnected && previous.getClientRects().length) previous.focus();
      else content.querySelector<HTMLElement>('main')?.focus();
      focusContentRef.current = false;
    };
  }, [modalOpen]);

  return (
    <div data-workspace className="flex h-dvh min-w-0 bg-slate-100">
      <div className={desktop ? 'relative block shrink-0' : modalOpen ? 'fixed inset-0 z-40' : 'hidden'}>
        {modalOpen && <button type="button" tabIndex={-1} aria-label="关闭分类导航遮罩" className="absolute inset-0 bg-slate-950/55" onClick={() => setNavigationOpen(false)} />}
        <div ref={panelRef} id="workspace-navigation" data-workspace-navigation role={modalOpen ? 'dialog' : undefined} aria-modal={modalOpen ? true : undefined} aria-label={modalOpen ? '分类导航' : undefined} className="relative h-full w-80 max-w-[calc(100vw-2rem)] lg:w-auto lg:max-w-none">
          <Sidebar compact={!desktop} onClose={() => setNavigationOpen(false)} onSelectAsset={() => {
            if (!desktop) { focusContentRef.current = true; setNavigationOpen(false); }
          }} />
        </div>
      </div>
      <div ref={contentRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Toolbar {...toolbar} onOpenNavigation={() => setNavigationOpen(true)} navigationOpen={modalOpen} />
        {children}
      </div>
    </div>
  );
};

export default WorkspaceLayout;

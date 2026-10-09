import type { CommandFamily, CommandGroup } from '../data/assessmentCommands';

export function inferCommandFamily(category: string): CommandFamily {
  const name = category.trim();
  if (/安全设备|防火墙|入侵检测|入侵防御/.test(name)) return 'security';
  if (/数据库/.test(name)) return 'database';
  if (/服务器|操作系统/.test(name)) return 'server';
  return 'network';
}

export function filterCommandGroups(groups: CommandGroup[], query: string): CommandGroup[] {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return groups;
  return groups.flatMap(g => {
    if (g.title.toLocaleLowerCase().includes(keyword)) return [g];
    const snippets = g.snippets.filter(s => [s.title, s.command, s.note].some(text => text?.toLocaleLowerCase().includes(keyword)));
    return snippets.length ? [{ ...g, snippets }] : [];
  });
}

export function getCommandGroupText(group: CommandGroup): string {
  return group.snippets.map(s => s.command).join('\n\n');
}

function legacyCopy(text: string): boolean {
  const focus = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const inputSelection = focus instanceof HTMLInputElement || focus instanceof HTMLTextAreaElement
    ? { start: focus.selectionStart, end: focus.selectionEnd, direction: focus.selectionDirection } : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('aria-label', '临时复制文本');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true });
    if (inputSelection && (focus instanceof HTMLInputElement || focus instanceof HTMLTextAreaElement) && inputSelection.start !== null && inputSelection.end !== null) {
      focus.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction ?? undefined);
    } else if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}

export async function copyCommandText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 权限拒绝或 API 异常时继续尝试传统复制。 */ }
  // HTTP 局域网没有 Clipboard API 时，在当前点击内同步执行回退。
  try { return legacyCopy(text); } catch { return false; }
}

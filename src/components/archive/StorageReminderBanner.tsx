import React from 'react';
import type { ReminderReason, ReminderResult } from '../../utils/storageReminder';
import { formatBytes } from '../../utils/storageEstimate';
import { LIST_ACTION_CLASS } from '../project-list/projectListUi';

interface StorageReminderBannerProps {
  result: ReminderResult;
  onArchive: () => void;
  onSnooze: () => void;
}

function describe(reason: ReminderReason): string {
  switch (reason.kind) {
    case 'usage':
      return `本工具已占用 ${formatBytes(reason.usageBytes)}，超过提醒线 ${formatBytes(reason.limitBytes)}。`;
    case 'disk-low':
      return `数据所在的 ${reason.drive || '磁盘'} 只剩 ${formatBytes(reason.freeBytes)}，低于提醒线 ${formatBytes(reason.minBytes)}。`;
    case 'disk-urgent':
      return `数据所在的 ${reason.drive || '磁盘'} 只剩 ${formatBytes(reason.freeBytes)}，已低于紧急线 ${formatBytes(reason.minBytes)}。磁盘写满后新拍的图片可能保存失败。`;
    case 'stale':
      return `有 ${reason.count} 个系统超过 ${reason.staleDays} 天没有修改，图片约 ${formatBytes(reason.bytes)}，可以归档到其它盘。`;
  }
}

const StorageReminderBanner: React.FC<StorageReminderBannerProps> = ({ result, onArchive, onSnooze }) => {
  const urgent = result.level === 'urgent';
  return (
    <div role={urgent ? 'alert' : 'status'} data-storage-reminder={result.level} className={`mb-4 flex flex-col gap-3 rounded-[16px] border p-4 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center ${urgent ? 'border-[#f5c6ca] bg-[#fff5f5] text-[#b91c1c]' : 'border-[#f2d9a0] bg-[#fefaf0] text-[#854d0e]'}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{urgent ? '磁盘空间严重不足' : '存储空间提醒'}</p>
        {result.reasons.map((reason) => <p key={reason.kind} className="leading-6">{describe(reason)}</p>)}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onArchive} className={`${LIST_ACTION_CLASS} ${urgent ? 'border-[#f3b4b8] bg-[#fdecec] font-semibold text-[#c53030] hover:bg-[#fbdada]' : 'border-[#96dcd4] bg-[#e2f5f2] font-semibold text-[#0b665f] hover:bg-[#d1efe9]'}`}>去归档</button>
        {!urgent && <button type="button" onClick={onSnooze} className={`${LIST_ACTION_CLASS} border-[#d8dee8] bg-white text-[#3b4454] hover:bg-[#f6f8fb]`}>稍后提醒</button>}
      </div>
    </div>
  );
};

export default StorageReminderBanner;

import React, { useEffect, useState } from 'react';
import {
  getPwaReadiness,
  requestPwaInstall,
  subscribePwaReadiness,
  type PwaReadiness,
  type ReadinessState,
} from '../utils/pwa';

function statusText(state: ReadinessState): string {
  if (state === 'ready') return '可用';
  if (state === 'unavailable') return '不可用';
  return '检查中';
}

function statusClass(state: ReadinessState): string {
  if (state === 'ready') return 'text-[#0b665f] font-medium';
  if (state === 'unavailable') return 'text-[#9a5b08] font-medium';
  return 'text-[#8a94a6]';
}

const PwaReadinessCard: React.FC = () => {
  const [readiness, setReadiness] = useState<PwaReadiness>(() => getPwaReadiness());

  useEffect(() => subscribePwaReadiness(setReadiness), []);

  const canInstall = readiness.installState === 'installable';
  const installLabel = readiness.installState === 'installed'
    ? '已安装'
    : readiness.installState === 'manual'
      ? '请用浏览器分享菜单“添加到主屏幕”'
      : canInstall
        ? '可安装'
        : '暂不可安装';

  return (
    <section className="mb-4 rounded-[16px] border border-[#e3e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.03)]" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#1c2230]">现场离线准备</h2>
        {canInstall && <button type="button" onClick={() => void requestPwaInstall()} className="rounded-[9px] border border-[#96dcd4] bg-[#e2f5f2] px-3 py-1.5 text-sm font-semibold text-[#0b665f] transition-colors hover:bg-[#d1efe9]">安装到设备</button>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-[#8a94a6]">安全上下文</dt><dd className={readiness.secureContext ? 'font-medium text-[#0b665f]' : 'font-medium text-[#9a5b08]'}>{readiness.secureContext ? 'HTTPS / localhost' : '不可用'}</dd></div>
        <div><dt className="text-xs text-[#8a94a6]">Web Crypto</dt><dd className={readiness.webCrypto ? 'font-medium text-[#0b665f]' : 'font-medium text-[#9a5b08]'}>{readiness.webCrypto ? '可用' : '不可用'}</dd></div>
        <div><dt className="text-xs text-[#8a94a6]">IndexedDB</dt><dd className={statusClass(readiness.indexedDb)}>{statusText(readiness.indexedDb)}</dd></div>
        <div><dt className="text-xs text-[#8a94a6]">SW 缓存</dt><dd className={statusClass(readiness.serviceWorker)}>{statusText(readiness.serviceWorker)}</dd></div>
        <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-[#8a94a6]">安装状态</dt><dd className={readiness.installState === 'installed' || readiness.installState === 'installable' ? 'font-medium text-[#0b665f]' : 'text-[#647084]'}>{installLabel}</dd></div>
      </dl>
      {readiness.offlineReason && <p className="mt-3 rounded-[10px] border border-[#f2d9a0] bg-[#fefaf0] px-3 py-2 text-xs leading-5 text-[#854d0e]">{readiness.offlineReason}</p>}
    </section>
  );
};

export default PwaReadinessCard;

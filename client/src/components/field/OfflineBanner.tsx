import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { LanguageCode } from '../../types/fieldWorker';
import { TRANSLATIONS } from '../../lib/translations';

interface OfflineBannerProps {
  isOffline: boolean;
  pendingCount: number;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  language?: LanguageCode;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  pendingCount,
  onSyncNow,
  isSyncing = false,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Offline Mode Notification"
      className="w-full bg-[#FEF3C7] border-2 border-[#B45309] text-[#78350F] p-3 sm:p-4 rounded-2xl shadow-[0_3px_0_0_#B45309] flex items-center justify-between gap-3 animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0">
          <WifiOff className="w-5 h-5" />
        </div>
        <div className="text-xs">
          <span className="font-extrabold uppercase tracking-wide block font-['Space_Grotesk'] text-sm text-[#92400E]">
            {isOffline ? 'OFFLINE MODE ACTIVE' : 'PENDING OFFLINE SYNC'}
          </span>
          <p className="font-medium text-[#78350F] mt-0.5">
            {pendingCount > 0
              ? `Saved ${pendingCount} attendance record locally. Will upload when online.`
              : 'Network weak/offline. All punches are saved securely on phone.'}
          </p>
        </div>
      </div>

      {!isOffline && pendingCount > 0 && onSyncNow && (
        <button
          type="button"
          onClick={onSyncNow}
          disabled={isSyncing}
          className="px-3 py-2 bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {t.syncNow}
        </button>
      )}
    </aside>
  );
};

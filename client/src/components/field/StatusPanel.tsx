import React, { useState, useEffect } from 'react';
import { WorkerStatus, LanguageCode } from '../../types/fieldWorker';
import { TRANSLATIONS } from '../../lib/translations';
import { Clock, CheckCircle2, AlertCircle, PlayCircle, ShieldCheck } from 'lucide-react';

interface StatusPanelProps {
  status: WorkerStatus;
  clockInTime: string | null;
  clockOutTime?: string | null;
  shiftDurationStr?: string;
  language?: LanguageCode;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  status,
  clockInTime,
  clockOutTime,
  shiftDurationStr,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Live tabular timer calculation when WORKING
  useEffect(() => {
    if (status !== 'WORKING' || !clockInTime) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      // Parse clockInTime which might be ISO string or time string e.g. "09:02"
      let startTime = new Date(clockInTime).getTime();
      if (isNaN(startTime)) {
        // If it's a "HH:MM" string, anchor to today
        const [hours, minutes] = clockInTime.split(':').map(Number);
        const now = new Date();
        now.setHours(hours || 0, minutes || 0, 0, 0);
        startTime = now.getTime();
      }
      const nowTime = Date.now();
      const diffSec = Math.max(0, Math.floor((nowTime - startTime) / 1000));
      setElapsedSeconds(diffSec);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [status, clockInTime]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatDisplayTime = (isoOrTimeStr?: string | null) => {
    if (!isoOrTimeStr) return '--:--';
    const date = new Date(isoOrTimeStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return isoOrTimeStr;
  };

  // 1. NOT CLOCKED IN STATE: Warm solid charcoal block with high-contrast label
  if (status === 'NOT_CLOCKED_IN') {
    return (
      <section
        aria-label="Attendance Status: Not Clocked In"
        className="w-full bg-[#181A20] text-white p-5 sm:p-6 rounded-2xl border-2 border-[#181A20] shadow-[0_4px_0_0_#0D0E11] transition-all"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              {t.notClockedIn}
            </span>
          </div>
          <AlertCircle className="w-6 h-6 text-amber-400" />
        </div>

        <div className="mt-3">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-['Space_Grotesk'] text-white">
            00:00:00
          </div>
          <p className="text-sm font-medium text-slate-300 mt-1">
            Tap the button below to start your shift.
          </p>
        </div>
      </section>
    );
  }

  // 2. WORKING STATE: Deep Solid Tool Green with prominent Live Timer
  if (status === 'WORKING') {
    return (
      <section
        aria-label="Attendance Status: Clocked In and Working"
        className="w-full bg-[#14532D] text-white p-5 sm:p-6 rounded-2xl border-2 border-[#166534] shadow-[0_4px_0_0_#0F3E22] transition-all"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-400/20 border border-emerald-300/40 rounded-lg">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              {t.workingSince} {formatDisplayTime(clockInTime)}
            </span>
          </div>
          <PlayCircle className="w-6 h-6 text-emerald-300" />
        </div>

        <div className="mt-3">
          <div className="text-3xl sm:text-5xl font-black tracking-tight tabular-nums font-['Space_Grotesk'] text-emerald-50">
            {formatTimer(elapsedSeconds)}
          </div>
          <p className="text-sm font-semibold text-emerald-200 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            Attendance actively recorded
          </p>
        </div>
      </section>
    );
  }

  // 3. SHIFT DONE STATE: Solid dark slate block with total shift summary
  return (
    <section
      aria-label="Attendance Status: Shift Complete"
      className="w-full bg-[#1E293B] text-white p-5 sm:p-6 rounded-2xl border-2 border-[#0F172A] shadow-[0_4px_0_0_#0F172A] transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/60 border border-slate-600 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {t.shiftDone}
          </span>
        </div>
        <Clock className="w-6 h-6 text-slate-400" />
      </div>

      <div className="mt-3">
        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums font-['Space_Grotesk'] text-white">
          {shiftDurationStr || '8h 15m'}
        </div>
        <p className="text-sm font-medium text-slate-300 mt-1">
          In: {formatDisplayTime(clockInTime)} • Out: {formatDisplayTime(clockOutTime)}
        </p>
      </div>
    </section>
  );
};

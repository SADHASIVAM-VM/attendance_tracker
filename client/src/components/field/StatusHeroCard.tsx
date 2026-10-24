import React, { useState, useEffect } from 'react';
import { WorkerStatus, LanguageCode, Worksite } from '../../types/fieldWorker';
import { TRANSLATIONS } from '../../lib/translations';
import { Clock, ShieldCheck, PlayCircle, MapPin, CheckCircle2 } from 'lucide-react';

interface StatusHeroCardProps {
  status: WorkerStatus;
  /** Pre-formatted "HH:MM" display string (for header label only) */
  clockInTime: string | null;
  clockOutTime?: string | null;
  shiftDurationStr?: string;
  worksite: Worksite | null;
  language?: LanguageCode;
  /** Raw ISO string or full timestamp – used for accurate elapsed calculation */
  rawClockInTime?: string | null;
  /** Raw ISO string for clock-out – used to compute total worked hours */
  rawClockOutTime?: string | null;
}

/** Parse any ISO/time string into a Date timestamp in ms. Returns NaN on failure. */
const parseToMs = (timeStr: string): number => {
  // Try direct ISO parse first
  const d = new Date(timeStr);
  if (!isNaN(d.getTime())) return d.getTime();

  // Try HH:MM or HH:MM AM/PM format (fallback for display-only strings)
  const match = timeStr.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const now = new Date();
    now.setHours(hours, minutes, 0, 0);
    return now.getTime();
  }
  return NaN;
};

/** Format total seconds as HH:MM:SS */
const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/** Format total seconds as "X hr Y min" human label */
const formatWorkedHours = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
};

export const StatusHeroCard: React.FC<StatusHeroCardProps> = ({
  status,
  clockInTime,
  clockOutTime,
  shiftDurationStr,
  worksite,
  language = 'en',
  rawClockInTime,
  rawClockOutTime,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  /** Live elapsed seconds when WORKING */
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // ─── Live timer: recalculate from authoritative rawClockInTime every second ─
  useEffect(() => {
    if (status !== 'WORKING' || (!rawClockInTime && !clockInTime)) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = rawClockInTime
      ? parseToMs(rawClockInTime)
      : clockInTime
      ? parseToMs(clockInTime)
      : NaN;

    if (isNaN(startMs)) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSeconds(diff);
    };

    tick(); // immediate first render
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, clockInTime, rawClockInTime]);

  // ─── Worked hours calculation for SHIFT_DONE ──────────────────────────────
  const workedSeconds: number | null = (() => {
    if (status !== 'SHIFT_DONE') return null;

    const inMs = rawClockInTime
      ? parseToMs(rawClockInTime)
      : clockInTime
      ? parseToMs(clockInTime)
      : NaN;

    const outMs = rawClockOutTime
      ? parseToMs(rawClockOutTime)
      : clockOutTime
      ? parseToMs(clockOutTime)
      : NaN;

    if (isNaN(inMs) || isNaN(outMs) || outMs <= inMs) return null;
    return Math.floor((outMs - inMs) / 1000);
  })();

  const isWorking = status === 'WORKING';
  const isShiftDone = status === 'SHIFT_DONE';

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#12A66A] to-[#0E8F5B] text-white p-6 rounded-[22px] shadow-[0_12px_28px_-6px_rgba(18,166,106,0.4)] space-y-4">
      {/* Decorative SVG background curve */}
      <div className="absolute right-0 bottom-0 pointer-events-none opacity-20">
        <svg width="220" height="120" viewBox="0 0 220 120" fill="none">
          <path
            d="M0 80 C 40 80, 60 20, 110 50 C 160 80, 180 10, 220 30 L 220 120 L 0 120 Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {/* ── Top Row: status label + date badge ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
            {isWorking ? (
              <PlayCircle className="w-5 h-5 text-white" />
            ) : isShiftDone ? (
              <ShieldCheck className="w-5 h-5 text-white" />
            ) : (
              <Clock className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/90 block leading-tight">
              {isWorking
                ? `Working since ${clockInTime || '--:--'}`
                : isShiftDone
                ? 'Shift Completed Today'
                : 'Not Clocked In'}
            </span>
            <span className="text-[11px] text-white/75 block">
              {isWorking
                ? 'Live running shift timer'
                : isShiftDone
                ? 'Attendance recorded successfully'
                : 'Ready to verify & punch'}
            </span>
          </div>
        </div>

        <div className="h-7 rounded-full bg-white/20 flex items-center justify-center text-white">
          <span className="text-xs font-semibold text-[#12A66A] bg-[#E6F7EF] px-3.5 py-2 rounded-2xl border border-[#12A66A]/20">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ── Middle: Timer / Worked Hours Display ── */}
      <div>
        <div className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-white drop-shadow-sm">
          {isWorking
            ? formatDuration(elapsedSeconds)
            : isShiftDone && workedSeconds !== null
            ? formatDuration(workedSeconds)
            : isShiftDone && shiftDurationStr
            ? shiftDurationStr
            : '00:00:00'}
        </div>

        {/* Sub-label */}
        {isWorking && (
          <span className="text-[11px] text-white/80 font-medium mt-1 block">
            ✓ Verified on-site GPS coordinates active
          </span>
        )}

        {/* SHIFT_DONE: show worked hours breakdown */}
        {isShiftDone && (
          <div className="mt-2 flex flex-wrap gap-2">
            {workedSeconds !== null && (
              <span className="text-[11px] bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {formatWorkedHours(workedSeconds)} worked
              </span>
            )}
            {clockInTime && (
              <span className="text-[11px] bg-white/15 px-2.5 py-1 rounded-full font-medium">
                In: {clockInTime}
              </span>
            )}
            {clockOutTime && (
              <span className="text-[11px] bg-white/15 px-2.5 py-1 rounded-full font-medium">
                Out: {clockOutTime}
              </span>
            )}
          </div>
        )}

        {!isWorking && !isShiftDone && (
          <span className="text-[11px] text-white/80 font-medium mt-1 block">
            Punch will record selfie & geofence stamp
          </span>
        )}
      </div>

      {/* ── Bottom: Location strip ── */}
      <div className="pt-3 border-t border-white/20 flex items-start gap-2 text-xs">
        <MapPin className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block">
            {worksite ? worksite.name : 'No Location Assigned Today'}
          </span>
          <span className="text-[11px] text-white/75 block line-clamp-1">
            {worksite ? worksite.address : 'PLEASE CONTACT ADMIN OR SUPERVISOR'}
          </span>
        </div>
      </div>
    </div>
  );
};

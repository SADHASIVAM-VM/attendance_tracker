import React, { useState, useMemo } from 'react';
import { SpendDaySummary } from '../../types/supervisor';
import { ActivityIcon, CalenderIcon } from '@astraicons/react/linear';
import { CalendarIcon } from 'lucide-react';

interface SpendBarChartProps {
  data: SpendDaySummary[];
  currencySymbol?: string;
  onSelectDay?: (day: SpendDaySummary) => void;
  selectedDate?: string;
}

/**
 * Format expense amounts cleanly for compact bar marks.
 * e.g., 0 -> ₹0, 850 -> ₹850, 4200 -> ₹4.2k, 250000 -> ₹2.5L
 */
function formatExpenseMark(amount: number, currency: string): string {
  if (amount === 0) return `${currency}0`;
  if (amount >= 100000) return `${currency}${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) {
    const kVal = amount / 1000;
    return `${currency}${kVal % 1 === 0 ? kVal.toFixed(0) : kVal.toFixed(1)}k`;
  }
  return `${currency}${amount.toLocaleString()}`;
}

export const SpendBarChart: React.FC<SpendBarChartProps> = ({
  data,
  currencySymbol = '₹',
  onSelectDay,
  selectedDate,
}) => {
  // Ensure we always have exactly 7 days for the current week (Monday to Sunday)
  const weekDays = useMemo<SpendDaySummary[]>(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    // Monday as start of week (1), Sunday as end (7)
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Map provided data by date for quick lookup
    const providedMap = new Map<string, SpendDaySummary>();
    if (Array.isArray(data)) {
      data.forEach((d) => providedMap.set(d.date, d));
    }

    const result: SpendDaySummary[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dt}`;

      const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
      const dayFull = d.toLocaleDateString('en-US', { weekday: 'long' });   // "Monday"
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' }); // "Oct"
      const dayNum = d.getDate(); // 19

      const existing = providedMap.get(dateStr);
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      result.push({
        date: dateStr,
        dayLabel: dayShort,
        dateLabel: `${dayNum} ${monthShort}`,
        dayName: dayFull,
        dayOfWeek: dayShort,
        dayNumber: dayNum,
        monthShort,
        amount: existing ? existing.amount : 0,
        entriesCount: existing ? existing.entriesCount : 0,
        isToday,
        isFuture,
      });
    }

    return result;
  }, [data]);

  const [hoveredDay, setHoveredDay] = useState<SpendDaySummary | null>(null);

  // Default active day: hovered, selected, today, or the first day
  const activeDay = useMemo(() => {
    if (hoveredDay) return hoveredDay;
    if (selectedDate) {
      const match = weekDays.find((d) => d.date === selectedDate);
      if (match) return match;
    }
    const todayMatch = weekDays.find((d) => d.isToday);
    return todayMatch || weekDays[0];
  }, [hoveredDay, selectedDate, weekDays]);

  const totalWeekAmount = useMemo(() => {
    return weekDays.reduce((acc, curr) => acc + curr.amount, 0);
  }, [weekDays]);

  const maxAmount = useMemo(() => {
    return Math.max(...weekDays.map((d) => d.amount), 1);
  }, [weekDays]);

  const highestDay = useMemo(() => {
    const withSpend = weekDays.filter((d) => d.amount > 0);
    if (withSpend.length === 0) return null;
    return withSpend.reduce(
      (prev, curr) => (curr.amount > prev.amount ? curr : prev),
      withSpend[0]
    );
  }, [weekDays]);

  // Week range label e.g., "Mon, 19 Oct – Sun, 25 Oct"
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 7) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.dayLabel}, ${start.dateLabel} – ${end.dayLabel}, ${end.dateLabel}`;
  }, [weekDays]);

  return (
    <div className="w-full space-y-4">
      {/* ─── 1. WEEK HEADER & SUMMARY METRICS ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                Current Week (7 Days)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#0E8F5B]">
                Mon – Sun
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block">
              {weekRangeLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
              7-Day Total
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
              {currencySymbol}{totalWeekAmount.toLocaleString()}
            </span>
          </div>
          {highestDay && highestDay.amount > 0 && (
            <div className="pl-2 border-l border-slate-200 hidden xs:block text-right">
              <span className="text-[10px] text-[#0E8F5B] font-semibold flex items-center justify-end gap-1">
                <ActivityIcon className="w-3 h-3" />
                Peak
              </span>
              <span className="text-xs font-bold text-[#12A66A] tabular-nums">
                {highestDay.dayLabel} ({formatExpenseMark(highestDay.amount, currencySymbol)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. 7-DAY BAR GRAPH PRESENTATION ─────────────────────── */}
      <div className="bg-[#FAFBFD] border border-[#E8EEF4] rounded-[20px] p-3 sm:p-4 shadow-2xs">
        {/* 7 Columns: 1 for each day of the current week */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-3 items-end h-52 sm:h-56 pt-2">
          {weekDays.map((item) => {
            const isHighest = Boolean(highestDay && item.date === highestDay.date && item.amount > 0);
            const isSelected = selectedDate === item.date || activeDay?.date === item.date;
            const hasSpend = item.amount > 0;

            // Height scaling: minimum 8% for visibility, maximum 94%
            const heightPercent = hasSpend
              ? Math.max(12, Math.min(94, Math.round((item.amount / maxAmount) * 88) + 6))
              : 5;

            return (
              <div
                key={item.date}
                onClick={() => onSelectDay?.(item)}
                onMouseEnter={() => setHoveredDay(item)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`flex flex-col items-center h-full justify-end cursor-pointer group transition-all duration-150 p-1 rounded-xl ${isSelected ? 'bg-white shadow-xs ring-1 ring-[#12A66A]/30' : 'hover:bg-white/60'
                  }`}
              >
                {/* ── Expense Mark (Top) ────────────────────────── */}
                <div className="mb-2 flex flex-col items-center">
                  <span
                    className={`text-[9px] sm:text-[11px] font-bold tabular-nums px-1 sm:px-1.5 py-0.5 rounded-md transition-all whitespace-nowrap text-center ${isHighest
                      ? 'bg-[#12A66A] text-white shadow-xs font-black'
                      : isSelected
                        ? 'bg-slate-900 text-white font-bold'
                        : hasSpend
                          ? 'bg-[#E6F7EF] text-[#0E8F5B] font-extrabold'
                          : 'text-slate-400 font-semibold'
                      }`}
                    title={`${currencySymbol}${item.amount.toLocaleString()} on ${item.dayName}, ${item.dateLabel}`}
                  >
                    {formatExpenseMark(item.amount, currencySymbol)}
                  </span>
                </div>

                {/* ── Bar Presentation (Middle) ────────────────── */}
                <div className="w-full flex-1 flex flex-col justify-end items-center px-0.5 sm:px-1">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[32px] sm:max-w-[44px] rounded-t-[8px] transition-all duration-300 origin-bottom relative ${!hasSpend
                      ? 'bg-slate-200/80 group-hover:bg-slate-300 min-h-[5px]'
                      : isHighest
                        ? 'bg-gradient-to-t from-[#0E8F5B] via-[#12A66A] to-[#1FD68B] shadow-sm shadow-[#12A66A]/30'
                        : isSelected
                          ? 'bg-gradient-to-t from-[#0E8F5B] to-[#12A66A] ring-2 ring-[#12A66A]/40'
                          : item.isToday
                            ? 'bg-gradient-to-t from-[#10B981] to-[#34D399] shadow-xs'
                            : 'bg-gradient-to-t from-[#A7F3D0] to-[#6EE7B7] group-hover:from-[#6EE7B7] group-hover:to-[#34D399]'
                      }`}
                  >
                    {/* Peak Indicator Dot */}
                    {isHighest && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                    )}
                  </div>
                </div>

                {/* ── Day & Date Labels (Bottom) ──────────────── */}
                <div className="w-full flex flex-col items-center pt-2 text-center select-none border-t border-slate-100/80 mt-1">
                  {/* Day (e.g. MON, TUE) */}
                  <span
                    className={`text-[10px] sm:text-xs font-black uppercase tracking-tight leading-tight ${item.isToday
                      ? 'text-[#12A66A]'
                      : isSelected
                        ? 'text-slate-900'
                        : 'text-slate-600'
                      }`}
                  >
                    {item.dayOfWeek}
                  </span>

                  {/* Date (e.g. 19 Oct on sm+, 19 on mobile) */}
                  <span
                    className={`text-[9px] sm:text-[11px] leading-tight font-semibold mt-0.5 tabular-nums ${item.isToday
                      ? 'text-[#0E8F5B] font-bold'
                      : isSelected
                        ? 'text-slate-700 font-bold'
                        : 'text-slate-400'
                      }`}
                  >
                    <span className="sm:hidden">{item.dayNumber}</span>
                    <span className="hidden sm:inline">{item.dateLabel}</span>
                  </span>

                  {/* "TODAY" Badge */}
                  {item.isToday ? (
                    <span className="mt-1 px-1.5 py-0.2 rounded-full text-[8px] font-black bg-[#E6F7EF] text-[#0E8F5B] tracking-wider uppercase">
                      Today
                    </span>
                  ) : (
                    <span className="mt-1 h-3 block" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 3. ACTIVE / INSPECTED DAY DETAIL BANNER ──────────────── */}
      {activeDay && (
        <div className="p-3 rounded-[16px] bg-white border border-[#E8EEF4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${activeDay.amount > 0 ? 'bg-[#12A66A]' : 'bg-slate-300'
                }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900">
                  {activeDay.dayName}, {activeDay.dateLabel}
                </span>
                {activeDay.isToday && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#E6F7EF] text-[#0E8F5B] uppercase">
                    Today
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                {activeDay.entriesCount > 0
                  ? `${activeDay.entriesCount} expense ${activeDay.entriesCount === 1 ? 'mark' : 'marks'
                  } recorded for this day`
                  : 'No expenses marked for this day'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-[11px] text-slate-400 font-medium">Marked Spend:</span>
            <span className="text-sm sm:text-base font-black text-[#12A66A] tabular-nums">
              {currencySymbol}{activeDay.amount.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

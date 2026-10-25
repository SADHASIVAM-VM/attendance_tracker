import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: DateRange) => void;
  className?: string;
  maxDate?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helper to format ISO date "YYYY-MM-DD" to human readable "MMM DD, YYYY"
const formatHumanDate = (isoStr: string): string => {
  if (!isoStr || !isoStr.includes('-')) return isoStr;
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return isoStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Format Date object to "YYYY-MM-DD"
const toIsoString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Month currently viewed in the calendar
  const initialViewDate = useMemo(() => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [startDate]);

  const [viewYear, setViewYear] = useState<number>(initialViewDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialViewDate.getMonth()); // 0-11

  // Temporary selection state when clicking
  const [selectingStart, setSelectingStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectingStart(null);
        setHoverDate(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Quick Preset Handlers
  const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'last14' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    const todayStr = toIsoString(now);

    let start = todayStr;
    let end = todayStr;

    if (preset === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      start = toIsoString(y);
      end = start;
    } else if (preset === 'last7') {
      const d = new Date(now);
      d.setDate(now.getDate() - 6);
      start = toIsoString(d);
      end = todayStr;
    } else if (preset === 'last14') {
      const d = new Date(now);
      d.setDate(now.getDate() - 13);
      start = toIsoString(d);
      end = todayStr;
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toIsoString(firstDay);
      end = todayStr;
    } else if (preset === 'lastMonth') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      start = toIsoString(firstDayLastMonth);
      end = toIsoString(lastDayLastMonth);
    }

    onChange({ startDate: start, endDate: end });
    setSelectingStart(null);
    setHoverDate(null);
    setIsOpen(false);
  };

  // Days in current viewing month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dNum);
      const dateStr = toIsoString(prevDate);
      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isDisabled: maxDate ? dateStr > maxDate : false,
      });
    }

    // Days in current month
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const currDate = new Date(viewYear, viewMonth, i);
      const dateStr = toIsoString(currDate);
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isDisabled: maxDate ? dateStr > maxDate : false,
      });
    }

    // Trailing days from next month to make complete 6-row or 5-row grid
    const remainingSlots = 42 - days.length; // 6 rows * 7
    if (remainingSlots > 0 && remainingSlots < 7) {
      for (let i = 1; i <= remainingSlots; i++) {
        const nextDate = new Date(viewYear, viewMonth + 1, i);
        const dateStr = toIsoString(nextDate);
        days.push({
          dateStr,
          dayNumber: i,
          isCurrentMonth: false,
          isDisabled: maxDate ? dateStr > maxDate : false,
        });
      }
    }

    return days;
  }, [viewYear, viewMonth, maxDate]);

  // Click date in calendar
  const handleDayClick = (dayStr: string, isDisabled: boolean) => {
    if (isDisabled) return;

    if (!selectingStart) {
      // First click: sets beginning of range
      setSelectingStart(dayStr);
    } else {
      // Second click: completes range
      if (dayStr < selectingStart) {
        onChange({ startDate: dayStr, endDate: selectingStart });
      } else {
        onChange({ startDate: selectingStart, endDate: dayStr });
      }
      setSelectingStart(null);
      setHoverDate(null);
      setIsOpen(false);
    }
  };

  // Determine current active range for highlighting
  const activeStart = selectingStart || startDate;
  const activeEnd = selectingStart ? (hoverDate || selectingStart) : endDate;

  const effectiveStart = activeStart <= activeEnd ? activeStart : activeEnd;
  const effectiveEnd = activeStart <= activeEnd ? activeEnd : activeStart;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button: Styled like Shadcn UI Calendar Date-Range Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSelectingStart(null);
          setHoverDate(null);
        }}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-800 shadow-2xs hover:shadow-xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20"
      >
        <CalendarIcon className="w-4 h-4 text-[#12A66A] shrink-0" />
        <span className="tabular-nums">
          {startDate ? formatHumanDate(startDate) : 'Start date'} –{' '}
          {endDate ? formatHumanDate(endDate) : 'End date'}
        </span>
      </button>

      {/* Popover Dropdown with Shadcn UI Calendar Styling */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto right-0 sm:right-auto top-11 z-50 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3 w-[340px] sm:w-[500px] animate-in fade-in zoom-in-95 duration-100">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Presets Sidebar */}
            <div className="w-full sm:w-36 flex flex-wrap sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 hidden sm:block">
                Presets
              </span>
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'last7', label: 'Last 7 Days' },
                  { id: 'last14', label: 'Last 14 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className="px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Calendar View */}
            <div className="flex-1 space-y-2">
              {/* Month Navigation */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-bold text-slate-900">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 text-center">
                {WEEKDAY_NAMES.map((name) => (
                  <span
                    key={name}
                    className="text-[10px] font-bold text-slate-400 py-1 uppercase tracking-wider"
                  >
                    {name}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-1">
                {calendarDays.map((d, index) => {
                  const isStart = d.dateStr === effectiveStart;
                  const isEnd = d.dateStr === effectiveEnd;
                  const isSingle = isStart && isEnd;
                  const isInRange = d.dateStr >= effectiveStart && d.dateStr <= effectiveEnd;

                  return (
                    <div
                      key={`${d.dateStr}-${index}`}
                      className={`relative flex items-center justify-center p-0.5 ${
                        isInRange && !isSingle
                          ? 'bg-[#E6F7EF]'
                          : ''
                      } ${isStart && !isSingle ? 'rounded-l-full' : ''} ${
                        isEnd && !isSingle ? 'rounded-r-full' : ''
                      }`}
                    >
                      <button
                        type="button"
                        disabled={d.isDisabled}
                        onClick={() => handleDayClick(d.dateStr, d.isDisabled)}
                        onMouseEnter={() => selectingStart && setHoverDate(d.dateStr)}
                        className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                          d.isDisabled
                            ? 'text-slate-300 cursor-not-allowed'
                            : isStart || isEnd
                            ? 'bg-[#12A66A] text-white shadow-xs font-bold'
                            : isInRange
                            ? 'text-[#0E8F5B] hover:bg-[#C3F2DD]'
                            : d.isCurrentMonth
                            ? 'text-slate-800 hover:bg-slate-100'
                            : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {d.dayNumber}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer with summary and close */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-medium truncate">
              {selectingStart ? (
                <span className="text-amber-600 font-semibold">Select end date...</span>
              ) : (
                <>
                  Selected:{' '}
                  <strong className="text-slate-900">
                    {formatHumanDate(effectiveStart)} – {formatHumanDate(effectiveEnd)}
                  </strong>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSelectingStart(null);
                setHoverDate(null);
              }}
              className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

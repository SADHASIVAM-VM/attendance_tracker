import React, { useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  className?: string;
}

export const DateStrip: React.FC<DateStripProps> = ({
  selectedDate,
  onSelectDate,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Generate 14 days around the selected date (7 days before, 7 days after)
  const baseDate = new Date(selectedDate || new Date().toISOString().split('T')[0]);
  const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];

  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = -6; i <= 6; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    days.push({
      dateStr,
      dayName,
      dayNum,
      isToday: dateStr === todayStr,
    });
  }

  // Scroll active item into view
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDate]);

  return (
    <div className={`bg-white border border-[#E8EEF4] rounded-[16px] p-2.5 shadow-xs flex items-center gap-2 ${className}`}>
      {/* Calendar Picker Trigger */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.focus()}
          title="Pick calendar date"
          className="w-10 h-14 rounded-[12px] bg-[#E6F7EF] hover:bg-[#C3F2DD] text-[#12A66A] flex flex-col items-center justify-center transition-colors active:scale-95"
        >
          <Calendar className="w-4 h-4" />
          <span className="text-[9px] font-bold mt-1">Pick</span>
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && onSelectDate(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
        />
      </div>

      <div className="w-[1px] h-9 bg-slate-200 flex-shrink-0" />

      {/* Horizontal Scrollable Days Strip */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5 scroll-smooth"
      >
        {days.map((item) => {
          const isSelected = item.dateStr === selectedDate;

          return (
            <button
              key={item.dateStr}
              type="button"
              data-active={isSelected ? 'true' : 'false'}
              onClick={() => onSelectDate(item.dateStr)}
              className={`min-w-[44px] h-14 rounded-[12px] flex flex-col items-center justify-center transition-all cursor-pointer flex-shrink-0 relative ${
                isSelected
                  ? 'bg-[#12A66A] text-white shadow-xs'
                  : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-slate-700'
              }`}
            >
              <span
                className={`text-[10px] font-semibold leading-tight ${
                  isSelected ? 'text-emerald-100' : 'text-slate-400'
                }`}
              >
                {item.dayName}
              </span>
              <span className="text-sm font-black tabular-nums leading-tight mt-0.5">
                {item.dayNum}
              </span>
              {item.isToday && (
                <span
                  className={`w-1 h-1 rounded-full absolute bottom-1.5 ${
                    isSelected ? 'bg-white' : 'bg-[#12A66A]'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

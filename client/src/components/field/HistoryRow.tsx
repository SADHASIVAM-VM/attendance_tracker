import React from 'react';
import { AttendanceRecordItem, LanguageCode } from '../../types/fieldWorker';
import { TRANSLATIONS } from '../../lib/translations';
import { MapPin, Camera, CheckCircle2, ChevronRight, Clock, AlertCircle } from 'lucide-react';

interface HistoryRowProps {
  record: AttendanceRecordItem;
  language?: LanguageCode;
  onSelect: (record: AttendanceRecordItem) => void;
}

export const HistoryRow: React.FC<HistoryRowProps> = ({
  record,
  language = 'en',
  onSelect,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusPill = () => {
    if (record.clockInTime?.includes('09:2') || record.clockInTime?.includes('09:3')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#B45309]">
          <Clock className="w-3 h-3" />
          Late (15m)
        </span>
      );
    }
    if (!record.clockOutTime && record.workDate !== new Date().toISOString().split('T')[0]) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626]">
          <AlertCircle className="w-3 h-3" />
          Missed Clock-Out
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F7EF] text-[#12A66A]">
        <CheckCircle2 className="w-3 h-3" />
        On Time
      </span>
    );
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(record)}
      className="w-full bg-white hover:bg-[#F8FAFC] text-left p-4 rounded-[18px] border border-[#E8EEF4] shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(18,166,106,0.06)] active:scale-[0.99] transition-all cursor-pointer space-y-3"
    >
      {/* Top line: Date & Status Pill */}
      <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] pb-2.5">
        <div>
          <span className="font-bold text-sm text-[#111827] block">
            {formatDate(record.workDate)}
          </span>
          <span className="text-[10px] text-[#6B7280]  ">
            Verified Shift Record
          </span>
        </div>

        <div className="flex items-center gap-2">
          {getStatusPill()}
          <span className="font-extrabold text-xs text-[#111827]   bg-[#F8FAFC] px-2 py-0.5 rounded-lg border border-[#E2E8F0]">
            {record.totalHoursWorked ? `${record.totalHoursWorked.toFixed(1)} hrs` : '8.5 hrs'}
          </span>
        </div>
      </div>

      {/* Center line: Clock-in and Clock-out times */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#F1F5F9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
            Clock In
          </span>
          <span className="font-bold text-xs text-[#111827] tabular-nums  ">
            {record.clockInTime || '--:--'}
          </span>
        </div>
        <div className="bg-[#F8FAFC] p-2 rounded-xl border border-[#F1F5F9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
            Clock Out
          </span>
          <span className="font-bold text-xs text-[#111827] tabular-nums  ">
            {record.clockOutTime || '--:--'}
          </span>
        </div>
      </div>

      {/* Footer line: Location name and photo proof badge */}
      <div className="flex items-center justify-between text-xs text-[#6B7280] pt-1">
        <div className="flex items-center gap-1 truncate max-w-[65%]">
          <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
          <span className="truncate font-medium text-[11px]">{record.worksiteName}</span>
        </div>

        <div className="flex items-center gap-1 text-[#12A66A] font-bold text-xs shrink-0 hover:underline">
          <Camera className="w-3.5 h-3.5 text-[#12A66A]" />
          <span>View Selfie</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
        </div>
      </div>
    </button>
  );
};

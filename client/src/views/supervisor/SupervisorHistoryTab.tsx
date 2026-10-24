import React, { useState } from 'react';
import {
  SupervisorWorkerAttendance,
  SpendEntry,
  SupervisorWorksite,
} from '../../types/supervisor';
import { DateStrip } from '../../components/supervisor/DateStrip';
import { WorkerRow } from '../../components/supervisor/WorkerRow';
import { SpendEntryRow } from '../../components/supervisor/SpendEntryRow';
import { ReviewSheet } from '../../components/supervisor/ReviewSheet';
import {
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
  UserX,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

interface SupervisorHistoryTabProps {
  workers: SupervisorWorkerAttendance[];
  spendEntries: SpendEntry[];
  worksites: SupervisorWorksite[];
  selectedWorksite: SupervisorWorksite;
  onSelectWorksite: (worksite: SupervisorWorksite) => void;
  currencySymbol?: string;
}

const MONTH_NAMES = [
  { num: '01', short: 'Jan' },
  { num: '02', short: 'Feb' },
  { num: '03', short: 'Mar' },
  { num: '04', short: 'Apr' },
  { num: '05', short: 'May' },
  { num: '06', short: 'Jun' },
  { num: '07', short: 'Jul' },
  { num: '08', short: 'Aug' },
  { num: '09', short: 'Sep' },
  { num: '10', short: 'Oct' },
  { num: '11', short: 'Nov' },
  { num: '12', short: 'Dec' },
];

export const SupervisorHistoryTab: React.FC<SupervisorHistoryTabProps> = ({
  workers,
  spendEntries,
  worksites,
  selectedWorksite,
  onSelectWorksite,
  currencySymbol = '₹',
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'attendance' | 'spend'>('attendance');
  const [selectedWorkerForReview, setSelectedWorkerForReview] =
    useState<SupervisorWorkerAttendance | null>(null);

  const [selectedYear, setSelectedYear] = useState<string>(todayStr.split('-')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.split('-')[1]);
  const [spendSearch, setSpendSearch] = useState<string>('');

  // Extract available years from entries and workers
  const availableYears = Array.from(
    new Set([
      new Date().getFullYear().toString(),
      ...spendEntries.map((e) => e.date.split('-')[0]),
      ...workers.map((w) => (w.date || '').split('-')[0]).filter(Boolean),
    ])
  ).sort((a, b) => Number(b) - Number(a));

  // Handle Date changes
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const [y, m] = newDate.split('-');
    if (y) setSelectedYear(y);
    if (m) setSelectedMonth(m);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const day = selectedDate.split('-')[2] || '01';
    const newDate = `${year}-${selectedMonth}-${day}`;
    setSelectedDate(newDate);
  };

  const handleMonthChange = (monthNum: string) => {
    setSelectedMonth(monthNum);
    const day = selectedDate.split('-')[2] || '01';
    const newDate = `${selectedYear}-${monthNum}-${day}`;
    setSelectedDate(newDate);
  };

  const handleStepDay = (step: number) => {
    const cur = new Date(selectedDate + 'T00:00:00');
    cur.setDate(cur.getDate() + step);
    const newDate = cur.toISOString().split('T')[0];
    handleDateChange(newDate);
  };

  // Filter attendance for selected date and worksite
  const dateWorkers = workers.filter((w) => {
    const matchesSite = !w.worksiteId || w.worksiteId === selectedWorksite.id;
    const matchesDate = !w.date || w.date === selectedDate;
    return matchesSite && matchesDate;
  });

  // Summary counts for attendance tab
  const approvedCount = dateWorkers.filter((w) => w.status === 'APPROVED').length;
  const rejectedCount = dateWorkers.filter((w) => w.status === 'REJECTED').length;
  const pendingCount = dateWorkers.filter((w) => w.status === 'PENDING').length;
  const absentCount = dateWorkers.filter((w) => w.status === 'ABSENT').length;
  const onLeaveCount = dateWorkers.filter((w) => w.status === 'ON_LEAVE').length;

  // Filter spend for selected date and worksite
  const dateSpendEntries = spendEntries.filter((e) => {
    const matchesDate = e.date === selectedDate;
    const matchesSite = !e.worksiteId || e.worksiteId === selectedWorksite.id;
    if (!matchesDate || !matchesSite) return false;
    if (spendSearch) {
      const q = spendSearch.toLowerCase();
      const matchNote = e.note.toLowerCase().includes(q);
      const matchWorker = (e.workerName || '').toLowerCase().includes(q);
      const matchCat = e.category.toLowerCase().includes(q);
      return matchNote || matchWorker || matchCat;
    }
    return true;
  });

  const daySpendTotal = dateSpendEntries.reduce((sum, e) => sum + e.amount, 0);

  // Spend category breakdown for this day
  const spendByCategory = dateSpendEntries.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  const formattedDateTitle = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pb-20">
      {/* 1. YEAR, MONTH & DATE FILTER CARD */}
      <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              History Date & Year:
            </span>
            <div className="flex items-center gap-1">
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="px-2.5 py-1 bg-[#F8FAFC] border border-[#E8EEF4] rounded-[10px] text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              title="Previous day"
              className="p-1.5 rounded-lg border border-[#E8EEF4] bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(todayStr)}
              className="px-2.5 py-1 rounded-lg border border-[#12A66A]/30 bg-[#E6F7EF] hover:bg-[#d4f3e3] text-[#0E8F5B] text-xs font-bold cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleStepDay(1)}
              title="Next day"
              className="p-1.5 rounded-lg border border-[#E8EEF4] bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Month selector pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {MONTH_NAMES.map((m) => {
            const isSelected = m.num === selectedMonth;
            return (
              <button
                key={m.num}
                type="button"
                onClick={() => handleMonthChange(m.num)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#12A66A] text-white shadow-xs'
                    : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-600 border border-[#E8EEF4]'
                }`}
              >
                {m.short}
              </button>
            );
          })}
        </div>

        {/* Horizontal Date Strip with Calendar Picker */}
        <DateStrip selectedDate={selectedDate} onSelectDate={handleDateChange} />
      </div>

      {/* 2. LOCATION SWITCHER & SUB-TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Location Dropdown */}
        <div className="relative flex-1">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E8EEF4] rounded-[12px] text-xs font-semibold text-slate-800">
            <Building2 className="w-3.5 h-3.5 text-[#12A66A] flex-shrink-0" />
            <select
              value={selectedWorksite.id}
              onChange={(e) => {
                const site = worksites.find((w) => w.id === e.target.value);
                if (site) onSelectWorksite(site);
              }}
              className="bg-transparent w-full focus:outline-none cursor-pointer truncate"
            >
              {worksites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Segment: Attendance vs Spend */}
        <div className="flex p-1 bg-white border border-[#E8EEF4] rounded-[14px]">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('spend')}
            className={`px-4 py-2 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'spend'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Spend Log ({dateSpendEntries.length})
          </button>
        </div>
      </div>

      {/* 3. ATTENDANCE TAB CONTENT */}
      {activeTab === 'attendance' && (
        <div className="space-y-3">
          {/* Summary Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#E6F7EF] text-[#0E8F5B]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approved: {approvedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#DC2626]">
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected: {rejectedCount}</span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309]">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending: {pendingCount}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              <UserX className="w-3.5 h-3.5" />
              <span>Absent: {absentCount}</span>
            </div>
            {onLeaveCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>On Leave: {onLeaveCount}</span>
              </div>
            )}
          </div>

          {/* Worker Records List */}
          {dateWorkers.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm sm:text-base font-bold text-slate-700">No Attendance Records</h4>
              <p className="text-xs text-slate-400">
                No shift activity logged for {selectedDate}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dateWorkers.map((worker) => (
                <div key={worker.id} className="space-y-1">
                  <WorkerRow
                    worker={worker}
                    onSelect={(w) => setSelectedWorkerForReview(w)}
                  />
                  {worker.decisionNote && (
                    <div className="mx-2 px-3 py-1 bg-slate-50 border-l-2 border-[#12A66A] text-[11px] text-slate-600 rounded-r-md">
                      Supervisor Note: {worker.decisionNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SPEND TAB CONTENT */}
      {activeTab === 'spend' && (
        <div className="space-y-4">
          {/* Day Total Card */}
          <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#12A66A] uppercase tracking-wider block">
                {formattedDateTitle}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                  {currencySymbol}
                  {daySpendTotal.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Total Day Spend
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#0E8F5B]">
                {dateSpendEntries.length} {dateSpendEntries.length === 1 ? 'voucher' : 'vouchers'} on this day
              </span>
            </div>
          </div>

          {/* Category Breakdown for Chosen Date */}
          {Object.keys(spendByCategory).length > 0 && (
            <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[18px] p-4 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 block">Day Category Split</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">
                {Object.entries(spendByCategory).map(([cat, amount]) => (
                  <div
                    key={cat}
                    className="bg-white p-3 rounded-[12px] border border-slate-100 flex items-center justify-between shadow-xs"
                  >
                    <span className="font-medium text-slate-600">{cat}</span>
                    <strong className="text-slate-900 tabular-nums font-bold">
                      {currencySymbol}
                      {amount.toLocaleString()}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search within day entries */}
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-slate-900">
              All Vouchers Recorded on {selectedDate}
            </h4>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={spendSearch}
                onChange={(e) => setSpendSearch(e.target.value)}
                placeholder="Search note or worker..."
                className="text-xs pl-8 pr-3 py-1.5 bg-white border border-[#E8EEF4] rounded-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
              />
            </div>
          </div>

          {/* Entries List: 1-col on mobile, 2-col on md+ */}
          {dateSpendEntries.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm sm:text-base font-bold text-slate-700">No Expense Entries</h4>
              <p className="text-xs text-slate-400">
                No money spent was recorded on {selectedDate}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dateSpendEntries.map((entry) => (
                <SpendEntryRow
                  key={entry.id}
                  entry={entry}
                  currencySymbol={currencySymbol}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Bottom Sheet */}
      <ReviewSheet
        worker={selectedWorkerForReview}
        isOpen={Boolean(selectedWorkerForReview)}
        onClose={() => setSelectedWorkerForReview(null)}
        onApprove={() => setSelectedWorkerForReview(null)}
        onReject={() => setSelectedWorkerForReview(null)}
      />
    </div>
  );
};

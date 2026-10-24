import React, { useState } from 'react';
import {
  SpendEntry,
  SpendCategory,
  SpendDaySummary,
  CategorySummary,
  SupervisorWorksite,
} from '../../types/supervisor';
import { SpendEntryRow } from '../../components/supervisor/SpendEntryRow';
import { AddSpendSheet } from '../../components/supervisor/AddSpendSheet';
import { SpendBarChart } from '../../components/supervisor/SpendBarChart';
import { CategoryDonut } from '../../components/supervisor/CategoryDonut';
import { DateStrip } from '../../components/supervisor/DateStrip';
import {
  Plus,
  Receipt,
  PieChart,
  ListFilter,
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface SupervisorSpendTabProps {
  entries: SpendEntry[];
  yesterdayTotal: number;
  monthlySpendData: SpendDaySummary[];
  categoryBreakdown: CategorySummary[];
  workersList: { id: string; name: string }[];
  currentWorksite: SupervisorWorksite;
  onAddSpend: (entry: Omit<SpendEntry, 'id' | 'isLocked' | 'time'>) => void;
  onEditSpend?: (entry: SpendEntry) => void;
  onDeleteSpend?: (entry: SpendEntry) => void;
  currencySymbol?: string;
  isLoading?: boolean;
}

const MONTH_NAMES = [
  { num: '01', short: 'Jan', full: 'January' },
  { num: '02', short: 'Feb', full: 'February' },
  { num: '03', short: 'Mar', full: 'March' },
  { num: '04', short: 'Apr', full: 'April' },
  { num: '05', short: 'May', full: 'May' },
  { num: '06', short: 'Jun', full: 'June' },
  { num: '07', short: 'Jul', full: 'July' },
  { num: '08', short: 'Aug', full: 'August' },
  { num: '09', short: 'Sep', full: 'September' },
  { num: '10', short: 'Oct', full: 'October' },
  { num: '11', short: 'Nov', full: 'November' },
  { num: '12', short: 'Dec', full: 'December' },
];

export const SupervisorSpendTab: React.FC<SupervisorSpendTabProps> = ({
  entries,
  yesterdayTotal,
  monthlySpendData,
  categoryBreakdown,
  workersList,
  currentWorksite,
  onAddSpend,
  onEditSpend,
  onDeleteSpend,
  currencySymbol = '₹',
  isLoading = false,
}) => {
  const [subTab, setSubTab] = useState<'entries' | 'history' | 'analytics'>('entries');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<SpendEntry | null>(null);

  const handleEditClick = (entry: SpendEntry) => {
    setEditingEntry(entry);
    setIsAddSheetOpen(true);
  };

  const handleFormSubmit = (entryData: Omit<SpendEntry, 'id' | 'isLocked' | 'time'>) => {
    if (editingEntry) {
      if (onEditSpend) {
        onEditSpend({
          ...entryData,
          id: editingEntry.id,
          isLocked: editingEntry.isLocked,
          time: editingEntry.time,
        });
      }
      setEditingEntry(null);
    } else {
      onAddSpend(entryData);
    }
    setIsAddSheetOpen(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // History Tab specific states: Date and Year selection
  const [historyDate, setHistoryDate] = useState<string>(todayStr);
  const [historyYear, setHistoryYear] = useState<string>(todayStr.split('-')[0]);
  const [historyMonth, setHistoryMonth] = useState<string>(todayStr.split('-')[1]);
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Extract available years from entries + current year
  const availableYears = Array.from(
    new Set([
      new Date().getFullYear().toString(),
      ...entries.map((e) => e.date.split('-')[0]),
    ])
  ).sort((a, b) => Number(b) - Number(a));

  // Filter today's entries
  const todayEntries = entries.filter((e) => e.date === todayStr);
  const todayTotal = todayEntries.reduce((acc, curr) => acc + curr.amount, 0);

  const diffAmount = todayTotal - yesterdayTotal;
  const isHigher = diffAmount >= 0;

  // Month total from monthly data
  const monthTotal = monthlySpendData.reduce((acc, d) => acc + d.amount, 0);

  // ── History Filtered Entries for Selected Date ─────────────────────────────
  const dayEntries = entries.filter((e) => {
    if (e.date !== historyDate) return false;
    if (historyCategoryFilter !== 'ALL' && e.category !== historyCategoryFilter) return false;
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      const matchNote = e.note.toLowerCase().includes(q);
      const matchWorker = (e.workerName || '').toLowerCase().includes(q);
      const matchCat = e.category.toLowerCase().includes(q);
      if (!matchNote && !matchWorker && !matchCat) return false;
    }
    return true;
  });

  const dayTotal = dayEntries.reduce((acc, curr) => acc + curr.amount, 0);

  // Day category breakdown
  const dayCategoryBreakdown = dayEntries.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  // All entries for selected Year and Month (to show monthly history breakdown)
  const monthPrefix = `${historyYear}-${historyMonth}`;
  const monthEntries = entries.filter((e) => e.date.startsWith(monthPrefix));
  const monthTotalAmount = monthEntries.reduce((acc, curr) => acc + curr.amount, 0);

  // Group month entries by date
  const dateGroups = monthEntries.reduce<Record<string, SpendEntry[]>>((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const datesWithSpend = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

  // Handler: Change date and update Year & Month
  const handleSelectHistoryDate = (newDate: string) => {
    setHistoryDate(newDate);
    const [y, m] = newDate.split('-');
    if (y) setHistoryYear(y);
    if (m) setHistoryMonth(m);
  };

  // Handler: Change Year
  const handleYearChange = (year: string) => {
    setHistoryYear(year);
    const day = historyDate.split('-')[2] || '01';
    const newDate = `${year}-${historyMonth}-${day}`;
    setHistoryDate(newDate);
  };

  // Handler: Change Month
  const handleMonthChange = (monthNum: string) => {
    setHistoryMonth(monthNum);
    const day = historyDate.split('-')[2] || '01';
    const newDate = `${historyYear}-${monthNum}-${day}`;
    setHistoryDate(newDate);
  };

  // Quick Day Stepper
  const handleStepDay = (step: number) => {
    const cur = new Date(historyDate + 'T00:00:00');
    cur.setDate(cur.getDate() + step);
    const newDate = cur.toISOString().split('T')[0];
    handleSelectHistoryDate(newDate);
  };

  // Formatted date string for title
  const formattedDayTitle = new Date(historyDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pb-28">
      {/* 1. TOP SUMMARY CARD IN SOLID GREEN */}
      <div className="bg-gradient-to-br from-[#12A66A] to-[#0E8F5B] rounded-[22px] p-5 sm:p-6 text-white shadow-lg shadow-[#12A66A]/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-100 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-200" />
              Today's Total Spend
            </span>
            <span className="text-[11px] bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full font-bold">
              {currentWorksite.name.split(' - ')[0]}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAddSheetOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-white text-[#0E8F5B] hover:bg-emerald-50 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Record New Expense</span>
          </button>
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
            {currencySymbol}
            {todayTotal.toLocaleString()}
          </span>
          <span className="text-xs sm:text-sm text-emerald-100 font-medium">
            ({todayEntries.length} entries recorded today)
          </span>
        </div>

        <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs">
          <span className="text-emerald-100">
            vs {currencySymbol}{yesterdayTotal.toLocaleString()} yesterday
          </span>
          <span
            className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
              isHigher
                ? 'bg-emerald-900/40 text-emerald-200'
                : 'bg-white/20 text-white'
            }`}
          >
            {isHigher ? `+${currencySymbol}${diffAmount}` : `-${currencySymbol}${Math.abs(diffAmount)}`}
          </span>
        </div>
      </div>

      {/* 2. SUB-VIEW SWITCHER: Today's Entries vs Spent History vs Analytics */}
      <div className="flex p-1 bg-white border border-[#E8EEF4] rounded-[16px] shadow-xs">
        <button
          type="button"
          onClick={() => setSubTab('entries')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'entries'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Today ({todayEntries.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('history')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'history'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Spent History</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('analytics')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'analytics'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Analytics</span>
        </button>
      </div>

      {/* ─── 3. SUB-TAB 1: TODAY'S ENTRIES ─────────────────────────────────── */}
      {subTab === 'entries' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-bold text-[#111827]">Today's Recorded Vouchers</h3>
            <span className="text-xs text-[#6B7280]">Day open for edits</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-[#E8EEF4] rounded-[16px] p-3.5 animate-pulse flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-32 h-4 bg-slate-200 rounded" />
                    <div className="w-48 h-3 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : todayEntries.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-800">No Spend Entries Today</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tap the "+ Add Spend" button below to log food, materials, or transit expenses for this site.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {todayEntries.map((entry) => (
                <SpendEntryRow
                  key={entry.id}
                  entry={entry}
                  currencySymbol={currencySymbol}
                  onEdit={handleEditClick}
                  onDelete={onDeleteSpend}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 4. SUB-TAB 2: SPENT HISTORY BASED ON DATE AND YEAR ─────────────── */}
      {subTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Year & Month Control Card */}
          <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Spend History Period
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                  Filter by Year & Month
                </h3>
              </div>

              {/* Year Dropdown Switcher */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#12A66A]" />
                  <span>Year:</span>
                </label>
                <div className="relative">
                  <select
                    value={historyYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="px-3 py-1.5 bg-[#F8FAFC] border border-[#E8EEF4] rounded-[12px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Month Pill Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {MONTH_NAMES.map((m) => {
                const isSelected = m.num === historyMonth;
                return (
                  <button
                    key={m.num}
                    type="button"
                    onClick={() => handleMonthChange(m.num)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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

            {/* Date Strip & Day Stepper */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  Select Specific Day:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStepDay(-1)}
                    title="Previous day"
                    className="p-1 rounded-lg border border-[#E8EEF4] bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectHistoryDate(todayStr)}
                    className="px-2.5 py-0.5 rounded-lg border border-[#12A66A]/30 bg-[#E6F7EF] hover:bg-[#d4f3e3] text-[#0E8F5B] text-[11px] font-bold cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepDay(1)}
                    title="Next day"
                    className="p-1 rounded-lg border border-[#E8EEF4] bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <DateStrip
                selectedDate={historyDate}
                onSelectDate={handleSelectHistoryDate}
              />
            </div>
          </div>

          {/* ── Day Summary Hero Card ────────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-[#F8FAFC] to-white border border-[#E8EEF4] rounded-[22px] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#12A66A] flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formattedDayTitle}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                    {currencySymbol}
                    {dayTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    total spent on this day
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/20">
                  {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'} on this day
                </span>
              </div>
            </div>

            {/* Day Category Badges (if any) */}
            {Object.keys(dayCategoryBreakdown).length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">Category Split:</span>
                {Object.entries(dayCategoryBreakdown).map(([cat, amt]) => (
                  <span
                    key={cat}
                    className="px-2.5 py-1 rounded-[10px] bg-white border border-[#E8EEF4] text-xs text-slate-700 font-medium flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{cat}:</span>
                    <strong className="text-slate-900 font-bold tabular-nums">
                      {currencySymbol}
                      {amt.toLocaleString()}
                    </strong>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── All Entries On The Day ───────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  All Entries on {new Date(historyDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </h3>
                <span className="text-xs text-slate-500">
                  Complete list of spend vouchers recorded on this day
                </span>
              </div>

              {/* Search & Category Filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search entries..."
                    className="text-xs pl-8 pr-3 py-1.5 bg-white border border-[#E8EEF4] rounded-[10px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
                  />
                </div>

                <select
                  value={historyCategoryFilter}
                  onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#E8EEF4] rounded-[10px] text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Materials">Materials</option>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Worker payment">Worker payment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* List of Entries on the Day */}
            {dayEntries.length === 0 ? (
              <div className="p-10 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800">
                    No Spend Entries on this Day
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                    No vouchers logged for {historyDate}. Tap below to log an expenditure for this date or pick another day from the list.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSheetOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Spend for this Day</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dayEntries.map((entry) => (
                  <SpendEntryRow
                    key={entry.id}
                    entry={entry}
                    currencySymbol={currencySymbol}
                    onEdit={handleEditClick}
                    onDelete={onDeleteSpend}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Monthly Activity Breakdown List (Browse All Days with Spend in Month) ── */}
          <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                  Monthly Days Overview ({MONTH_NAMES.find((m) => m.num === historyMonth)?.short} {historyYear})
                </h4>
                <span className="text-xs text-slate-500">
                  Total month spend: <strong className="text-[#12A66A] font-bold">{currencySymbol}{monthTotalAmount.toLocaleString()}</strong> across {monthEntries.length} vouchers
                </span>
              </div>
            </div>

            {datesWithSpend.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No recorded expenditures found for {MONTH_NAMES.find((m) => m.num === historyMonth)?.full} {historyYear}.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {datesWithSpend.map((dStr) => {
                  const grpEntries = dateGroups[dStr] || [];
                  const grpTotal = grpEntries.reduce((sum, e) => sum + e.amount, 0);
                  const isCurrentSelected = dStr === historyDate;

                  return (
                    <div
                      key={dStr}
                      onClick={() => handleSelectHistoryDate(dStr)}
                      className={`py-3 px-2 rounded-[14px] flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrentSelected
                          ? 'bg-[#E6F7EF]/60 border border-[#12A66A]/20'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-[12px] flex flex-col items-center justify-center text-xs font-bold ${
                            isCurrentSelected
                              ? 'bg-[#12A66A] text-white shadow-xs'
                              : 'bg-[#F8FAFC] text-slate-700 border border-[#E8EEF4]'
                          }`}
                        >
                          <span className="text-[9px] uppercase leading-tight">
                            {new Date(dStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                          <span className="text-sm font-black tabular-nums leading-tight">
                            {dStr.split('-')[2]}
                          </span>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {new Date(dStr + 'T00:00:00').toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {grpEntries.length} {grpEntries.length === 1 ? 'voucher' : 'vouchers'} • Categories: {Array.from(new Set(grpEntries.map((e) => e.category))).join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 tabular-nums block">
                            {currencySymbol}
                            {grpTotal.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#12A66A] font-semibold">
                            {isCurrentSelected ? 'Currently Viewing' : 'Tap to View'}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 5. SUB-TAB 3: ANALYTICS SUB-TAB ───────────────────────────────── */}
      {subTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Daily Bar Chart Card */}
          <div className="lg:col-span-7 bg-white border border-[#E8EEF4] rounded-[20px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">Current Week 7-Day Spend Trend</h4>
                <span className="text-[11px] text-slate-500">Day & date expense marks</span>
              </div>
              <span className="text-xs font-bold text-[#12A66A] bg-[#E6F7EF] px-2.5 py-1 rounded-full tabular-nums">
                Week Total: {currencySymbol}{monthTotal.toLocaleString()}
              </span>
            </div>

            <SpendBarChart data={monthlySpendData} currencySymbol={currencySymbol} />
          </div>

          {/* Category Donut & Breakdown Card */}
          <div className="lg:col-span-5 bg-white border border-[#E8EEF4] rounded-[20px] p-5 shadow-xs space-y-3">
            <div className="pb-1 border-b border-slate-100">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">Category Spend Distribution</h4>
              <span className="text-[11px] text-slate-500">Breakdown of site expenses</span>
            </div>

            <CategoryDonut
              categories={categoryBreakdown}
              totalAmount={monthTotal}
              currencySymbol={currencySymbol}
            />
          </div>
        </div>
      )}

      {/* 6. FLOATING "ADD SPEND" PRIMARY BUTTON */}
      <div className="fixed bottom-20 md:bottom-8 inset-x-4 md:inset-x-auto md:right-8 max-w-md md:max-w-none mx-auto md:mx-0 z-40 pointer-events-none flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditingEntry(null);
            setIsAddSheetOpen(true);
          }}
          className="pointer-events-auto px-5 py-3.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-full font-bold text-xs sm:text-sm shadow-xl shadow-[#12A66A]/30 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Spend</span>
        </button>
      </div>

      {/* Form Bottom Sheet */}
      <AddSpendSheet
        isOpen={isAddSheetOpen}
        onClose={() => {
          setIsAddSheetOpen(false);
          setEditingEntry(null);
        }}
        onSubmit={handleFormSubmit}
        workersList={workersList}
        currentWorksiteId={currentWorksite.id}
        currencySymbol={currencySymbol}
        initialEntry={editingEntry}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Send,
  Plus,
  Info,
  Calendar,
  Sparkles,
  MapPin,
  Building2,
  UserCheck,
  FileText,
  AlertTriangle,
  ArrowRight,
  Table,
  LayoutGrid,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WorkerAttendanceView: React.FC = () => {
  // Current real-world date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayDate = useMemo(() => new Date(), []);

  // View mode: 'calendar' or 'table'
  const [activeTab, setActiveTab] = useState<'calendar' | 'table'>('calendar');

  // Currently selected date (defaults to current date!)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Calendar navigation state (Year & Month)
  const [currentYear, setCurrentYear] = useState<number>(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(todayDate.getMonth()); // 0-indexed

  // Worker Attendance & Leave data
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Date Details Pop-up Modal State
  const [dateModalOpen, setDateModalOpen] = useState<boolean>(false);
  const [modalDateStr, setModalDateStr] = useState<string>(todayStr);

  // Regularization Modal State
  const [regModalOpen, setRegModalOpen] = useState<boolean>(false);
  const [selectedSessionForReg, setSelectedSessionForReg] = useState<any | null>(null);
  const [regReason, setRegReason] = useState<string>('');
  const [proposedClockIn, setProposedClockIn] = useState<string>('');
  const [proposedClockOut, setProposedClockOut] = useState<string>('');
  const [submittingReg, setSubmittingReg] = useState<boolean>(false);

  // Apply Leave Modal State (Quick Apply for Date)
  const [applyLeaveModalOpen, setApplyLeaveModalOpen] = useState<boolean>(false);
  const [applyLeaveTypeId, setApplyLeaveTypeId] = useState<string>('');
  const [applyStartDate, setApplyStartDate] = useState<string>(todayStr);
  const [applyEndDate, setApplyEndDate] = useState<string>(todayStr);
  const [applyReason, setApplyReason] = useState<string>('');
  const [applyIsHalfDay, setApplyIsHalfDay] = useState<boolean>(false);
  const [applyHalfDayPeriod, setApplyHalfDayPeriod] = useState<string>('FIRST_HALF');
  const [submittingLeave, setSubmittingLeave] = useState<boolean>(false);

  useEffect(() => {
    loadAllWorkerData();
  }, []);

  const loadAllWorkerData = async () => {
    try {
      setLoading(true);
      const [attData, leaveData, typesData] = await Promise.all([
        apiRequest('/attendance/me'),
        apiRequest('/leave/requests/me'),
        apiRequest('/leave/types'),
      ]);

      setAttendanceRecords(attData);
      setLeaveRequests(leaveData);
      setLeaveTypes(typesData);
      if (typesData.length > 0 && !applyLeaveTypeId) {
        setApplyLeaveTypeId(typesData[0].id);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load attendance and leave data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Generate Year Range (N years: e.g. current - 5 to current + 10)
  const availableYears = useMemo(() => {
    const startYear = todayDate.getFullYear() - 5;
    const endYear = todayDate.getFullYear() + 10;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [todayDate]);

  // Fast lookup maps for date matching
  // 1. Attendance map by workDate
  const attendanceMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const record of attendanceRecords) {
      map.set(record.workDate, record);
    }
    return map;
  }, [attendanceRecords]);

  // 2. Helper to find leave request covering a given date
  const getLeaveForDate = (dateStr: string) => {
    return leaveRequests.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);
  };

  // Calendar Days calculation for the active month and year
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isFuture: boolean;
      isSelected: boolean;
      attendance: any | null;
      leave: any | null;
    }> = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        isSelected: dateStr === selectedDate,
        attendance: attendanceMap.get(dateStr) || null,
        leave: getLeaveForDate(dateStr) || null,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        isSelected: dateStr === selectedDate,
        attendance: attendanceMap.get(dateStr) || null,
        leave: getLeaveForDate(dateStr) || null,
      });
    }

    // Next month padding days to complete 35 or 42 cells (multiple of 7)
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
        days.push({
          dateStr,
          dayNumber: nextDay,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
          isFuture: dateStr > todayStr,
          isSelected: dateStr === selectedDate,
          attendance: attendanceMap.get(dateStr) || null,
          leave: getLeaveForDate(dateStr) || null,
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, attendanceMap, leaveRequests, todayStr, selectedDate]);

  // Month Statistics for worker summary bar
  const monthStats = useMemo(() => {
    let presentCount = 0;
    let pastLeaveCount = 0;
    let futureLeaveCount = 0;
    let pendingApprovalCount = 0;

    for (const day of calendarDays) {
      if (!day.isCurrentMonth) continue;

      if (day.attendance) {
        if (day.attendance.status === 'APPROVED') presentCount++;
        if (day.attendance.status === 'PENDING') pendingApprovalCount++;
      }

      if (day.leave && day.leave.status !== 'REJECTED' && day.leave.status !== 'CANCELLED') {
        if (day.isFuture) {
          futureLeaveCount++;
        } else {
          pastLeaveCount++;
        }
      }
    }

    return { presentCount, pastLeaveCount, futureLeaveCount, pendingApprovalCount };
  }, [calendarDays]);

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayStr);
    handleOpenDateModal(todayStr);
  };

  // Open the pop-up modal when clicking any date
  const handleOpenDateModal = (dateStr: string) => {
    setSelectedDate(dateStr);
    setModalDateStr(dateStr);
    setDateModalOpen(true);
  };

  // Formatted date string for the details pop-up
  const formattedModalDate = useMemo(() => {
    const [y, m, d] = modalDateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [modalDateStr]);

  const modalDayData = useMemo(() => {
    const isFuture = modalDateStr > todayStr;
    const isToday = modalDateStr === todayStr;
    const attendance = attendanceMap.get(modalDateStr) || null;
    const leave = getLeaveForDate(modalDateStr) || null;

    return { isFuture, isToday, attendance, leave };
  }, [modalDateStr, todayStr, attendanceMap, leaveRequests]);

  // Quick Open Leave Modal prefilling the selected future date
  const handleOpenQuickApplyLeave = (dateStr: string) => {
    setApplyStartDate(dateStr);
    setApplyEndDate(dateStr);
    setApplyReason('');
    setApplyIsHalfDay(false);
    setDateModalOpen(false);
    setApplyLeaveModalOpen(true);
  };

  // Submit Quick Leave
  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyLeaveTypeId || !applyStartDate || !applyEndDate || !applyReason.trim()) {
      setMessage({ text: 'Please fill in all required leave fields', type: 'error' });
      return;
    }

    try {
      setSubmittingLeave(true);
      await apiRequest('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: applyLeaveTypeId,
          startDate: applyStartDate,
          endDate: applyEndDate,
          isHalfDay: applyIsHalfDay,
          halfDayPeriod: applyIsHalfDay ? applyHalfDayPeriod : undefined,
          reason: applyReason,
        }),
      });

      setMessage({ text: `Leave request for ${applyStartDate} submitted successfully!`, type: 'success' });
      setApplyLeaveModalOpen(false);
      await loadAllWorkerData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit leave request', type: 'error' });
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Open Regularization Modal
  const openRegularizationModal = (session: any) => {
    setSelectedSessionForReg(session);
    setRegReason('');
    setProposedClockIn(session.clockInTime ? new Date(session.clockInTime).toISOString().slice(0, 16) : '');
    setProposedClockOut(session.clockOutTime ? new Date(session.clockOutTime).toISOString().slice(0, 16) : '');
    setDateModalOpen(false);
    setRegModalOpen(true);
  };

  // Submit Regularization
  const handleRegularizationSubmit = async () => {
    if (!selectedSessionForReg || !regReason.trim()) return;

    try {
      setSubmittingReg(true);
      await apiRequest(`/attendance/${selectedSessionForReg.id}/regularization`, {
        method: 'POST',
        body: JSON.stringify({
          reason: regReason,
          proposedClockInTime: proposedClockIn ? new Date(proposedClockIn).toISOString() : undefined,
          proposedClockOutTime: proposedClockOut ? new Date(proposedClockOut).toISOString() : undefined,
        }),
      });

      setMessage({ text: 'Regularization request submitted for supervisor review.', type: 'success' });
      setRegModalOpen(false);
      await loadAllWorkerData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit regularization', type: 'error' });
    } finally {
      setSubmittingReg(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert Message */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between shadow-2xs transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-[11px] font-bold uppercase tracking-wider underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 m-0">
                My Attendance & Leave Calendar
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Full multi-year calendar view with color fills for taken and future applied leaves. Click any date to inspect details.
              </p>
            </div>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Full Calendar View
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'table'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Records List
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          {/* Calendar Color Fill Legend Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Color Fill Guide:
              </span>

              <div className="flex flex-wrap items-center gap-4">
                {/* Gray color for past leave taken */}
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-slate-200 border border-slate-300 inline-block shadow-2xs"></span>
                  <span className="font-semibold text-slate-700">Gray Fill:</span>
                  <span className="text-slate-500">Past Leave Taken</span>
                </div>

                {/* Violet color for future leave applied */}
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-violet-200 border border-violet-400 inline-block shadow-2xs"></span>
                  <span className="font-semibold text-violet-900">Violet Fill:</span>
                  <span className="text-slate-500">Future Leave Applied</span>
                </div>

                {/* Green for Present */}
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-300 inline-block"></span>
                  <span className="text-slate-600 font-medium">Present / Clocked In</span>
                </div>

                {/* Amber for Pending */}
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300 inline-block"></span>
                  <span className="text-slate-600 font-medium">Pending Approval</span>
                </div>

                {/* Today */}
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-md ring-2 ring-slate-900 bg-slate-900 text-white text-[8px] font-bold flex items-center justify-center">
                    •
                  </span>
                  <span className="text-slate-600 font-medium">Today</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Controller Bar (Year, Month, Steppers, Jump to Today) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <span className="text-[11px] text-slate-500">
                Default selected: {todayStr} (Current Date)
              </span>
            </div>

            {/* Year & Month Steppers */}
            <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
              {/* Year Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                <button
                  onClick={() => setCurrentYear((y) => y - 1)}
                  title="Previous Year"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  className="bg-transparent px-2 py-0.5 font-bold text-slate-900 cursor-pointer focus:outline-none"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setCurrentYear((y) => y + 1)}
                  title="Next Year"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              {/* Month Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                <button
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="bg-transparent px-2 py-0.5 font-bold text-slate-900 cursor-pointer focus:outline-none"
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={idx}>
                      {mName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Jump to Today Button */}
              <button
                onClick={handleJumpToToday}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                Today
              </button>
            </div>
          </div>

          {/* Month Summary Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Days Present
              </span>
              <span className="text-xl font-bold text-emerald-600 mt-0.5 block">
                {monthStats.presentCount} Days
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Past Leaves Taken
              </span>
              <span className="text-xl font-bold text-slate-700 mt-0.5 block">
                {monthStats.pastLeaveCount} Days (Gray)
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Future Planned Leaves
              </span>
              <span className="text-xl font-bold text-violet-600 mt-0.5 block">
                {monthStats.futureLeaveCount} Days (Violet)
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Pending Approvals
              </span>
              <span className="text-xl font-bold text-amber-600 mt-0.5 block">
                {monthStats.pendingApprovalCount} Records
              </span>
            </div>
          </div>

          {/* Master Calendar Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-3">
              {DAY_NAMES.map((day) => (
                <div key={day} className="tracking-wider uppercase text-[11px]">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarDays.map((day) => {
                const isToday = day.isToday;
                const isFuture = day.isFuture;
                const isSelected = day.isSelected;
                const hasLeave = !!day.leave;
                const hasAttendance = !!day.attendance;

                // Color fill determinations as requested:
                // 1. If he took leave in the past/today -> fill up GRAY colour
                const isGrayLeaveFill = hasLeave && !isFuture && day.leave.status !== 'REJECTED';

                // 2. If he applied a leave in future -> fill up VIOLET colour
                const isVioletLeaveFill = hasLeave && isFuture && day.leave.status !== 'CANCELLED';

                // 3. Other states
                const isPresentGreen = hasAttendance && day.attendance.status === 'APPROVED';
                const isPendingAmber = hasAttendance && day.attendance.status === 'PENDING';
                const isRejectedRed = (hasAttendance && day.attendance.status === 'REJECTED') || (hasLeave && day.leave.status === 'REJECTED');

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => handleOpenDateModal(day.dateStr)}
                    className={`min-h-[110px] sm:min-h-[120px] p-2 sm:p-2.5 transition-all cursor-pointer relative group flex flex-col justify-between ${
                      // 1. Violet color fill for future leave applied
                      isVioletLeaveFill
                        ? 'bg-violet-100/90 hover:bg-violet-200/80 text-violet-950 border-violet-200'
                        // 2. Gray color fill for past leave taken
                        : isGrayLeaveFill
                        ? 'bg-slate-200 hover:bg-slate-300/80 text-slate-800 border-slate-300'
                        // 3. Normal Current Month / Other Month
                        : day.isCurrentMonth
                        ? isPresentGreen
                          ? 'bg-emerald-50/40 hover:bg-emerald-50 text-slate-800'
                          : isFuture
                          ? 'bg-white hover:bg-slate-50/80 text-slate-700'
                          : 'bg-white hover:bg-slate-50/80 text-slate-700'
                        : 'bg-slate-50/30 text-slate-300 hover:bg-slate-50'
                    } ${isSelected ? 'ring-2 ring-inset ring-slate-900' : ''}`}
                  >
                    {/* Top Row: Date Number and Pill */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                          isToday
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : isVioletLeaveFill
                            ? 'bg-violet-700 text-white font-extrabold shadow-2xs'
                            : isGrayLeaveFill
                            ? 'bg-slate-600 text-white font-bold'
                            : day.isCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {isToday && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                          Today
                        </span>
                      )}

                      {/* Pill indicator for future date */}
                      {isFuture && !hasLeave && (
                        <span className="text-[9px] font-medium text-slate-400 opacity-60">
                          Future
                        </span>
                      )}
                    </div>

                    {/* Middle: Status Tag / Badge based on rules */}
                    <div className="my-1.5 space-y-1">
                      {/* Violet Leave Fill Indicator */}
                      {isVioletLeaveFill && (
                        <div className="bg-violet-200/80 border border-violet-300 p-1 rounded-md text-[10px] font-semibold text-violet-950 flex flex-col gap-0.5">
                          <span className="truncate flex items-center gap-1 font-bold">
                            <Sparkles className="w-3 h-3 text-violet-600 shrink-0" />
                            {day.leave.leaveTypeName || 'Leave Applied'}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-violet-700 font-extrabold">
                            {day.leave.status}
                          </span>
                        </div>
                      )}

                      {/* Gray Leave Fill Indicator */}
                      {isGrayLeaveFill && (
                        <div className="bg-slate-300/80 border border-slate-400/60 p-1 rounded-md text-[10px] font-bold text-slate-800 flex flex-col gap-0.5">
                          <span className="truncate font-semibold">
                            Leave: {day.leave.leaveTypeName || 'Approved'}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-600">
                            {day.leave.isHalfDay ? 'Half Day' : 'Full Day'}
                          </span>
                        </div>
                      )}

                      {/* Attendance: Clock-In Present */}
                      {!hasLeave && isPresentGreen && (
                        <div className="bg-emerald-100/80 border border-emerald-200 p-1 rounded-md text-[10px] font-medium text-emerald-900 flex items-center justify-between">
                          <span className="font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            Present
                          </span>
                          {day.attendance.clockInTime && (
                            <span className="text-[9px] opacity-80">
                              {new Date(day.attendance.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Attendance: Pending Approval */}
                      {!hasLeave && isPendingAmber && (
                        <div className="bg-amber-100/80 border border-amber-200 p-1 rounded-md text-[10px] font-medium text-amber-900 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Pending Sup.</span>
                        </div>
                      )}

                      {/* Attendance / Leave: Rejected */}
                      {isRejectedRed && (
                        <div className="bg-rose-100/80 border border-rose-200 p-1 rounded-md text-[10px] font-semibold text-rose-900">
                          Rejected
                        </div>
                      )}

                      {/* Unscheduled past day */}
                      {!hasLeave && !hasAttendance && !isFuture && day.isCurrentMonth && (
                        <span className="text-[9px] text-slate-400 block opacity-0 group-hover:opacity-100 transition-opacity text-center">
                          No Record
                        </span>
                      )}
                    </div>

                    {/* Bottom: Click prompt */}
                    <div className="text-[9px] text-slate-400 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to view
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TABLE VIEW: RAW HISTORICAL LOGS */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm m-0">Historical Attendance Sessions</h3>
            <span className="text-xs text-slate-500">{attendanceRecords.length} total logged sessions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Worksite</th>
                  <th className="py-3 px-4">Shift Name</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Clock In</th>
                  <th className="py-3 px-4">Clock Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      No attendance sessions recorded yet. Clock in to get started.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{r.workDate}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 block">{r.worksiteName}</span>
                        <span className="text-xs text-slate-400">{r.worksiteCode}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">{r.shiftName}</td>
                      <td className="py-3.5 px-4 text-xs font-medium">{r.supervisorName}</td>
                      <td className="py-3.5 px-4 text-xs">
                        {r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openRegularizationModal(r)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Regularize
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POP-UP MODAL: DATE DETAILS (Requested by user) */}
      <Modal
        isOpen={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title={formattedModalDate}
        description="Daily attendance logs, shift status, and leave requests for this date."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-slate-400 font-mono">Date: {modalDateStr}</span>
            <button
              onClick={() => setDateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Badge indicator on top of modal */}
          <div className="flex items-center gap-2">
            {modalDayData.isToday && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                Today
              </span>
            )}
            {modalDayData.isFuture && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-900 border border-violet-200">
                Future Date
              </span>
            )}
            {!modalDayData.isToday && !modalDayData.isFuture && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                Past Record
              </span>
            )}
          </div>

          {/* 1. FUTURE DATE SECTION */}
          {modalDayData.isFuture && (
            <div className="space-y-3">
              {/* Future Date Callout */}
              <div className="p-3.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-950 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">This is a future date</span>
                  <span className="text-violet-800">
                    This shift has not taken place yet. You can check your planned leaves or apply for time off on this date.
                  </span>
                </div>
              </div>

              {/* If leave applied in future: show applied leave and status (approved or reject or pending) */}
              {modalDayData.leave ? (
                <div className="p-4 rounded-xl bg-violet-100/70 border-2 border-violet-300 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-violet-800 block">
                        Applied Leave Request (Violet Fill)
                      </span>
                      <h4 className="text-base font-bold text-violet-950 mt-0.5 m-0">
                        {modalDayData.leave.leaveTypeName}
                      </h4>
                    </div>
                    <StatusBadge status={modalDayData.leave.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white/80 p-3 rounded-lg border border-violet-200">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Leave Duration</span>
                      <span className="font-semibold text-slate-900 block">
                        {modalDayData.leave.startDate === modalDayData.leave.endDate
                          ? modalDayData.leave.startDate
                          : `${modalDayData.leave.startDate} to ${modalDayData.leave.endDate}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Type of Absence</span>
                      <span className="font-semibold text-slate-900 block">
                        {modalDayData.leave.isHalfDay
                          ? `Half Day (${modalDayData.leave.halfDayPeriod?.replace('_', ' ')})`
                          : 'Full Day Absence'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-violet-900 block mb-0.5">Reason for Request:</span>
                    <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-violet-200 m-0 italic">
                      "{modalDayData.leave.reason}"
                    </p>
                  </div>

                  {modalDayData.leave.decisionNote && (
                    <div className="p-2.5 rounded-lg bg-white/90 border border-violet-200 text-xs">
                      <span className="font-bold text-slate-800 block text-[11px]">Reviewer Decision Note:</span>
                      <span className="text-slate-600">{modalDayData.leave.decisionNote}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-xs text-slate-600">
                    No leave currently applied for {modalDateStr}.
                  </div>
                  <button
                    onClick={() => handleOpenQuickApplyLeave(modalDateStr)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Apply for Leave on this Date
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. PAST DATE OR TODAY SECTION */}
          {!modalDayData.isFuture && (
            <div className="space-y-4">
              {/* If leave was taken on this date: Gray color filled */}
              {modalDayData.leave && (
                <div className="p-4 rounded-xl bg-slate-200 border-2 border-slate-300 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                        Leave Taken (Gray Fill)
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-0.5 m-0">
                        {modalDayData.leave.leaveTypeName}
                      </h4>
                    </div>
                    <StatusBadge status={modalDayData.leave.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white/90 p-3 rounded-lg border border-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Period</span>
                      <span className="font-semibold text-slate-900">
                        {modalDayData.leave.startDate} to {modalDayData.leave.endDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Absence Type</span>
                      <span className="font-semibold text-slate-900">
                        {modalDayData.leave.isHalfDay ? 'Half Day' : 'Full Day'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-0.5">Reason:</span>
                    <p className="text-xs text-slate-700 bg-white/90 p-2.5 rounded-lg border border-slate-300 m-0 italic">
                      "{modalDayData.leave.reason}"
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance Session Details if clocked in */}
              {modalDayData.attendance ? (
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Work Attendance Record
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-0.5 m-0">
                        {modalDayData.attendance.worksiteName}
                      </h4>
                      <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Code: {modalDayData.attendance.worksiteCode}
                      </span>
                    </div>
                    <StatusBadge status={modalDayData.attendance.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Clock-In Time</span>
                      <span className="font-bold text-emerald-700 text-sm block mt-0.5">
                        {modalDayData.attendance.clockInTime
                          ? new Date(modalDayData.attendance.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Clock-Out Time</span>
                      <span className="font-bold text-slate-800 text-sm block mt-0.5">
                        {modalDayData.attendance.clockOutTime
                          ? new Date(modalDayData.attendance.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Pending Punch'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Shift</span>
                      <span className="font-semibold text-slate-800">{modalDayData.attendance.shiftName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Supervisor</span>
                      <span className="font-semibold text-slate-800">{modalDayData.attendance.supervisorName}</span>
                    </div>
                  </div>

                  {modalDayData.attendance.rejectionReason && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      <span className="font-bold block text-[11px]">Supervisor Rejection Note:</span>
                      <span>{modalDayData.attendance.rejectionReason}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => openRegularizationModal(modalDayData.attendance)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Request Regularization / Correction
                    </button>
                  </div>
                </div>
              ) : !modalDayData.leave ? (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm m-0">No Clock-In or Leave Logged</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      No clock-in timestamp or approved leave record exists for this past date.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenQuickApplyLeave(modalDateStr)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Apply Retroactive Leave
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      {/* QUICK APPLY LEAVE MODAL */}
      <Modal
        isOpen={applyLeaveModalOpen}
        onClose={() => setApplyLeaveModalOpen(false)}
        title="Apply for Planned Absence / Leave"
        description={`Submit a time-off request covering ${applyStartDate}.`}
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setApplyLeaveModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyLeaveSubmit}
              disabled={submittingLeave || !applyReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submittingLeave ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </>
        }
      >
        <form onSubmit={handleApplyLeaveSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Leave Category</label>
            <select
              value={applyLeaveTypeId}
              onChange={(e) => setApplyLeaveTypeId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Start Date</label>
              <input
                type="date"
                value={applyStartDate}
                onChange={(e) => setApplyStartDate(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">End Date</label>
              <input
                type="date"
                value={applyEndDate}
                onChange={(e) => setApplyEndDate(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={applyIsHalfDay}
                onChange={(e) => setApplyIsHalfDay(e.target.checked)}
                className="rounded text-slate-900"
              />
              <span>Is this a Half Day absence?</span>
            </label>

            {applyIsHalfDay && (
              <div className="flex gap-4 pl-6">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="halfPeriod"
                    value="FIRST_HALF"
                    checked={applyHalfDayPeriod === 'FIRST_HALF'}
                    onChange={() => setApplyHalfDayPeriod('FIRST_HALF')}
                  />
                  <span>First Half</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="halfPeriod"
                    value="SECOND_HALF"
                    checked={applyHalfDayPeriod === 'SECOND_HALF'}
                    onChange={() => setApplyHalfDayPeriod('SECOND_HALF')}
                  />
                  <span>Second Half</span>
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Absence Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={applyReason}
              onChange={(e) => setApplyReason(e.target.value)}
              placeholder="e.g. Doctor appointment, family emergency, travel..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none"
              required
            />
          </div>
        </form>
      </Modal>

      {/* REGULARIZATION MODAL */}
      <Modal
        isOpen={regModalOpen}
        onClose={() => setRegModalOpen(false)}
        title="Request Attendance Regularization"
        description="Submit a timestamp correction request to your designated supervisor."
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setRegModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRegularizationSubmit}
              disabled={submittingReg || !regReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submittingReg ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Work Date & Location
            </label>
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200">
              {selectedSessionForReg?.workDate} — {selectedSessionForReg?.worksiteName}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Proposed Clock-In
              </label>
              <input
                type="datetime-local"
                value={proposedClockIn}
                onChange={(e) => setProposedClockIn(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Proposed Clock-Out
              </label>
              <input
                type="datetime-local"
                value={proposedClockOut}
                onChange={(e) => setProposedClockOut(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Correction Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
              placeholder="Explain reason for discrepancy (e.g. GPS error, network downtime, forgotten clock-out)..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none"
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

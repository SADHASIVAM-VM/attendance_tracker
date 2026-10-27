import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
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
  InfoIcon,
  XCircle,
  ShieldCheck,
  FileEdit,
  Ban,
  History,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface WorkerAttendanceViewProps {
  todayStatus?: string; // 'NOT_CLOCKED_IN' | 'WORKING' | 'ON_BREAK' | 'SHIFT_DONE'
  todayClockInTime?: string | null;
  todayClockOutTime?: string | null;
  todayWorksite?: { name?: string; code?: string; address?: string } | null;
  assignedShiftInfo?: {
    shiftName?: string;
    supervisorName?: string;
    shiftStartTime?: string;
    shiftEndTime?: string;
  } | null;
  onNavigateToday?: () => void;
  hideOvertimeCard?: boolean;
}

export const WorkerAttendanceView: React.FC<WorkerAttendanceViewProps> = ({
  todayStatus,
  todayClockInTime,
  todayClockOutTime,
  todayWorksite,
  assignedShiftInfo,
  onNavigateToday,
  hideOvertimeCard = false,
}) => {
  const { user } = useAuth();
  const userCreatedDateStr = useMemo(() => {
    if (!user?.createdAt) return null;
    return typeof user.createdAt === 'string' ? user.createdAt.split('T')[0] : null;
  }, [user?.createdAt]);

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
  const [tablePage, setTablePage] = useState<number>(1);
  const [tableLimit, setTableLimit] = useState<number>(10);

  // Date Details Pop-up Modal State
  const [dateModalOpen, setDateModalOpen] = useState<boolean>(false);
  const [modalDateStr, setModalDateStr] = useState<string>(todayStr);

  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Regularization Modal State
  const [regModalOpen, setRegModalOpen] = useState<boolean>(false);
  const [selectedSessionForReg, setSelectedSessionForReg] = useState<any | null>(null);
  const [regCorrectionType, setRegCorrectionType] = useState<string>('INCORRECT_HOURS');
  const [regReason, setRegReason] = useState<string>('');
  const [proposedClockIn, setProposedClockIn] = useState<string>('');
  const [proposedClockOut, setProposedClockOut] = useState<string>('');
  const [supportingEvidenceUrl, setSupportingEvidenceUrl] = useState<string>('');
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

  // Overtime Monthly Summary state (Phase 3)
  const [overtimeSummary, setOvertimeSummary] = useState<{
    month: string;
    totalAttendanceDays: number;
    totalNetWorkedMinutes: number;
    totalStandardHoursMinutes: number;
    totalCalculatedOtMinutes: number;
    totalApprovedOtMinutes: number;
    totalPendingOtMinutes: number;
    totalRejectedOtMinutes: number;
    daysWithOtCount: number;
    formattedTotalNetHours: string;
    formattedTotalCalculatedOt: string;
    formattedTotalApprovedOt: string;
    formattedTotalPendingOt: string;
  } | null>(null);

  useEffect(() => {
    loadAllWorkerData();
  }, []);

  useEffect(() => {
    loadOvertimeSummary(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const loadOvertimeSummary = async (year: number, monthIndex: number) => {
    try {
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const data = await apiRequest(`/attendance/me/overtime-summary?month=${monthStr}`);
      if (data && typeof data === 'object') {
        setOvertimeSummary(data);
      }
    } catch (err: any) {
      console.warn('Could not load overtime summary:', err);
    }
  };

  const loadAllWorkerData = async () => {
    try {
      setLoading(true);
      const [attData, leaveData, typesData] = await Promise.all([
        apiRequest('/attendance/me'),
        apiRequest('/leave/requests/me'),
        apiRequest('/leave/types'),
      ]);

      setAttendanceRecords(Array.isArray(attData) ? attData : []);
      setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
      setLeaveTypes(Array.isArray(typesData) ? typesData : []);
      if (typesData.length > 0 && !applyLeaveTypeId) {
        setApplyLeaveTypeId(typesData[0].id);
      }
      await loadOvertimeSummary(currentYear, currentMonth);
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
      if (!record || !record.workDate) continue;
      const cleanDate = typeof record.workDate === 'string'
        ? record.workDate.split('T')[0]
        : new Date(record.workDate).toISOString().split('T')[0];
      map.set(cleanDate, record);
    }

    // Merge live today session if worker clocked in
    if (todayStatus === 'WORKING' || todayStatus === 'SHIFT_DONE' || todayClockInTime) {
      const existing = map.get(todayStr);
      map.set(todayStr, {
        id: existing?.id || 'live_today',
        workDate: todayStr,
        status: existing?.status || 'PENDING',
        clockInTime: existing?.clockInTime || todayClockInTime,
        clockOutTime: existing?.clockOutTime || todayClockOutTime,
        worksiteName: existing?.worksiteName || todayWorksite?.name || 'Assigned Worksite',
        worksiteCode: existing?.worksiteCode || todayWorksite?.code || 'WS-TODAY',
        shiftName: existing?.shiftName || assignedShiftInfo?.shiftName || 'General Shift',
        supervisorName: existing?.supervisorName || assignedShiftInfo?.supervisorName || 'Site Supervisor',
        calculatedOtMinutes: existing?.calculatedOtMinutes || 0,
        approvedOtMinutes: existing?.approvedOtMinutes || 0,
        otStatus: existing?.otStatus || 'NONE',
        standardHoursMinutes: existing?.standardHoursMinutes || 540,
        breakDurationMinutes: existing?.breakDurationMinutes || 0,
        isPayrollLocked: Boolean(existing?.isPayrollLocked),
        exceptionStatus: existing?.exceptionStatus || 'NONE',
      });
    }

    return map;
  }, [attendanceRecords, todayStatus, todayClockInTime, todayClockOutTime, todayWorksite, assignedShiftInfo, todayStr]);

  // 2. Helper to find leave request covering a given date
  const getLeaveForDate = (dateStr: string) => {
    return leaveRequests.find((l) => {
      if (!l.startDate) return false;
      const start = typeof l.startDate === 'string' ? l.startDate.split('T')[0] : l.startDate;
      const end = typeof l.endDate === 'string' ? l.endDate.split('T')[0] : (l.endDate || start);
      return dateStr >= start && dateStr <= end;
    });
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

  // Month Statistics for worker summary bar (Matching business attendance workflow)
  const monthStats = useMemo(() => {
    let presentCount = 0;
    let pendingApprovalCount = 0;
    let missingClockInCount = 0;
    let approvedLeaveCount = 0;
    let flaggedRegCount = 0;
    let confirmedAbsentCount = 0;
    let rejectedCount = 0;

    for (const day of calendarDays) {
      if (!day.isCurrentMonth) continue;

      if (day.leave && day.leave.status === 'APPROVED') {
        approvedLeaveCount++;
        continue;
      }

      if (day.attendance) {
        const rawStatus = (day.attendance.status || '').toUpperCase().trim();
        const rawFlagStatus = (day.attendance.flagStatus || '').toUpperCase().trim();
        const rawAbsenceType = (day.attendance.absenceType || '').toUpperCase().trim();
        const rawResolution = (day.attendance.resolutionType || '').toUpperCase().trim();

        const isAbsentRecord =
          rawStatus === 'ABSENT' ||
          rawStatus === 'UNEXCUSED_ABSENCE' ||
          rawAbsenceType === 'ABSENT' ||
          rawAbsenceType === 'UNEXCUSED_ABSENCE' ||
          rawResolution === 'ABSENT' ||
          rawResolution === 'UNEXCUSED_ABSENCE' ||
          rawFlagStatus === 'REJECTED' ||
          rawFlagStatus === 'ABSENT' ||
          (Boolean(day.attendance.isAbsent) && rawStatus !== 'APPROVED' && rawStatus !== 'EXCUSED_ABSENCE');

        if (isAbsentRecord) {
          confirmedAbsentCount++;
        } else if (rawStatus === 'APPROVED' && !day.attendance.isAbsent) {
          presentCount++;
        } else {
          const isRegPending = day.attendance.regularization && day.attendance.regularization.status === 'PENDING';
          const isFlagged = rawStatus === 'FLAGGED' || (rawFlagStatus !== '' && !['NONE', 'APPROVED', 'REJECTED', 'ABSENT'].includes(rawFlagStatus));

          if (isRegPending || isFlagged) {
            flaggedRegCount++;
          } else if (rawStatus === 'PENDING' && !day.attendance.isAbsent) {
            pendingApprovalCount++;
          } else if (rawStatus === 'MISSING' || rawStatus === 'MISSING_CLOCK_IN') {
            missingClockInCount++;
          } else if (rawStatus === 'REJECTED') {
            rejectedCount++;
          } else if (rawStatus === 'LEAVE') {
            approvedLeaveCount++;
          }
        }
      }
    }

    return {
      presentCount,
      pendingApprovalCount,
      missingClockInCount,
      approvedLeaveCount,
      flaggedRegCount,
      confirmedAbsentCount,
      rejectedCount,
    };
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
    if (applyReason.trim().length < 5) {
      setMessage({ text: 'Reason must be at least 5 characters long', type: 'error' });
      return;
    }

    try {
      setSubmittingLeave(true);
      await apiRequest('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: applyLeaveTypeId,
          startDate: applyStartDate,
          endDate: applyIsHalfDay ? applyStartDate : applyEndDate,
          isHalfDay: applyIsHalfDay,
          halfDayPeriod: applyIsHalfDay ? applyHalfDayPeriod : undefined,
          reason: applyReason.trim(),
        }),
      });

      setMessage({ text: `Leave request for ${applyStartDate} submitted successfully!`, type: 'success' });
      setApplyLeaveModalOpen(false);
      await loadAllWorkerData();
    } catch (err: any) {
      const errorMsg = (err.details && Array.isArray(err.details))
        ? err.details.map((d: any) => d.message || d.code).join(' • ')
        : (err.message || 'Failed to submit leave request');
      setMessage({ text: errorMsg, type: 'error' });
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Open Regularization Modal
  const openRegularizationModal = (session: any) => {
    setSelectedSessionForReg(session);
    setRegReason('');
    setSupportingEvidenceUrl('');
    const dStr = session.workDate || session.date || (session.clockInTime ? new Date(session.clockInTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setProposedClockIn(session.clockInTime ? new Date(session.clockInTime).toISOString().slice(0, 16) : `${dStr}T09:00`);
    setProposedClockOut(session.clockOutTime ? new Date(session.clockOutTime).toISOString().slice(0, 16) : `${dStr}T18:00`);
    if (session.isAbsent || session.status === 'MISSING_CLOCK_IN' || session.status === 'ABSENT' || session.status === 'UNEXCUSED_ABSENCE') {
      setRegCorrectionType('MISSING_CLOCK_IN');
    }
    setDateModalOpen(false);
    setRegModalOpen(true);
  };

  // Submit Regularization
  const handleRegularizationSubmit = async () => {
    if (!selectedSessionForReg) return;
    const trimmedReason = regReason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      setMessage({
        text: 'A meaningful explanation of at least 5 characters is required explaining why attendance requires regularization.',
        type: 'error',
      });
      return;
    }

    const regTargetDate = selectedSessionForReg.workDate || selectedSessionForReg.date || modalDateStr;
    const targetMonth = regTargetDate.substring(0, 7);

    // Front-end enforcement: Current calendar month only
    if (targetMonth < currentMonthStr) {
      setMessage({
        text: `Attendance regularization is restricted to the current calendar month (${currentMonthStr}). For previous months (${targetMonth}), please use the authorized Admin Attendance Correction process.`,
        type: 'error',
      });
      return;
    }

    if (regTargetDate > todayStr) {
      setMessage({
        text: 'Regularization cannot be submitted for future attendance dates. Please apply for planned leave if you anticipate absence.',
        type: 'error',
      });
      return;
    }

    try {
      setSubmittingReg(true);
      await apiRequest(`/attendance/${selectedSessionForReg.id}/regularization`, {
        method: 'POST',
        body: JSON.stringify({
          workDate: regTargetDate,
          correctionType: regCorrectionType,
          reason: trimmedReason,
          proposedClockInTime: proposedClockIn ? new Date(proposedClockIn).toISOString() : undefined,
          proposedClockOutTime: proposedClockOut ? new Date(proposedClockOut).toISOString() : undefined,
          supportingEvidenceUrl: supportingEvidenceUrl.trim() || undefined,
        }),
      });

      setMessage({ text: 'Regularization request submitted successfully for supervisor review.', type: 'success' });
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
          className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between shadow-2xs transition-all ${message.type === 'success'
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

            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: WORKER MONTHLY OVERTIME DASHBOARD */}
      {!hideOvertimeCard && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-blue-900 rounded-3xl p-5 text-white shadow-lg border border-slate-800">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Overtime Summary
                </span>
                <span className="text-xs text-slate-400">Standard: 9 Hours / Workday</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Monthly Overtime Overview • {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                {MONTH_NAMES[currentMonth].slice(0, 3)} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 5 Overtime & Working Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            {/* 1. Total Net Worked Hours */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[11px] font-medium text-slate-400 block">Total Net Worked</span>
              <span className="text-xl font-extrabold text-white block mt-1">
                {overtimeSummary?.formattedTotalNetHours || '0m'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Minus unpaid breaks</span>
            </div>

            {/* 2. Total Calculated OT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[11px] font-medium text-slate-400 block">Calculated OT</span>
              <span className="text-xl font-extrabold text-indigo-300 block mt-1">
                {overtimeSummary?.formattedTotalCalculatedOt || '0m'}
              </span>
              <span className="text-[10px] text-indigo-300/70 mt-0.5 block">&gt; 9h workday threshold</span>
            </div>


            {/* 3. Days with OT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-slate-400 block">Days With OT</span>
              <span className="text-xl font-extrabold text-white block mt-1">
                {overtimeSummary?.daysWithOtCount ?? 0}
                <span className="text-xs font-normal text-slate-400 ml-1">days</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                of {overtimeSummary?.totalAttendanceDays ?? 0} active days
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">

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

          {/* Month Summary Metrics Cards (Matching 6 business workflow states) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* 1. Present (P) */}
            <div className="bg-white rounded-2xl border border-emerald-100 bg-emerald-50/20 p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Present
                </span>
                <span className="w-4 h-4 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  P
                </span>
              </div>
              <div className="mt-1">
                <span className="text-lg font-black text-emerald-700 block">
                  {monthStats.presentCount} Days
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Clocked in & approved</span>
              </div>
            </div>

            {/* 2. Pending Approval (PA) */}
            <div className="bg-white rounded-2xl border border-amber-100 bg-amber-50/20 p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Pending Review
                </span>
                <span className="w-4 h-4 rounded text-[9px] font-black bg-amber-100 text-amber-800 flex items-center justify-center">
                  PA
                </span>
              </div>
              <div className="mt-1">
                <span className="text-lg font-black text-amber-700 block">
                  {monthStats.pendingApprovalCount} Days
                </span>
                <span className="text-[10px] text-amber-600 font-medium">Awaiting supervisor</span>
              </div>
            </div>

            {/* 3. Missing Clock-In (M) */}
            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                  Missing In
                </span>
                <span className="w-4 h-4 rounded text-[9px] font-black bg-amber-200 text-amber-900 flex items-center justify-center">
                  M
                </span>
              </div>
              <div className="mt-1">
                <span className="text-lg font-black text-amber-800 block">
                  {monthStats.missingClockInCount} Days
                </span>
                <span className="text-[10px] text-amber-700 font-medium">Unclocked • Needs review</span>
              </div>
            </div>

            {/* 4. Approved Leave (L) */}
            <div className="bg-white rounded-2xl border border-violet-100 bg-violet-50/20 p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider block">
                  Approved Leave
                </span>
                <span className="w-4 h-4 rounded text-[9px] font-black bg-violet-100 text-violet-800 flex items-center justify-center">
                  L
                </span>
              </div>
              <div className="mt-1">
                <span className="text-lg font-black text-violet-700 block">
                  {monthStats.approvedLeaveCount} Days
                </span>
                <span className="text-[10px] text-violet-600 font-medium">Authorized absence</span>
              </div>
            </div>

            {/* 5. Flagged / Reg. Pending (FR) */}
            <div className="bg-white rounded-2xl border border-purple-100 bg-purple-50/20 p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                  Flagged / Reg.
                </span>
                <span className="w-4 h-4 rounded text-[9px] font-black bg-purple-100 text-purple-800 flex items-center justify-center">
                  FR
                </span>
              </div>
              <div className="mt-1">
                <span className="text-lg font-black text-purple-700 block">
                  {monthStats.flaggedRegCount} Days
                </span>
                <span className="text-[10px] text-purple-600 font-medium">Correction in progress</span>
              </div>
            </div>

            {/* 6. Confirmed Absent (A) */}
            <div className="bg-white rounded-2xl border border-rose-100 bg-rose-50/30 p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                  Confirmed Absent
                </span>
                <span className="w-4 h-4 rounded text-[9px] font-black bg-rose-200 text-rose-900 flex items-center justify-center">
                  A
                </span>
              </div>
              <div className="mt-1">
                <span className="text-lg font-black text-rose-700 block">
                  {monthStats.confirmedAbsentCount} Days
                </span>
                <span className="text-[10px] text-rose-600 font-medium">Unexcused absence</span>
              </div>
            </div>
          </div>

          {/* Status Indicators Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Indicators:</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 my-2">
              <div className="flex items-center gap-1.5" title="Present (P): Clocked in and approved">
                <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs">P</span>
                <span className="text-xs font-semibold text-slate-500">Present</span>
              </div>
              <div className="flex items-center gap-1.5" title="Missing Clock-In (M): Shift scheduled but not clocked in">
                <span className="w-4 h-4 rounded bg-amber-500 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs">M</span>
                <span className="text-xs font-semibold text-slate-500">Missing In</span>
              </div>
              <div className="flex items-center gap-1.5" title="Leave (L): Approved leave">
                <span className="w-4 h-4 rounded bg-violet-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs">L</span>
                <span className="text-xs font-semibold text-slate-500">Leave</span>
              </div>
              <div className="flex items-center gap-1.5" title="Absent (A): Confirmed absence">
                <span className="w-4 h-4 rounded bg-rose-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs">A</span>
                <span className="text-xs font-semibold text-slate-500">Absent</span>
              </div>
              <div className="flex items-center gap-1.5" title="Rejected (R): Clock-in rejected, eligible for appeal">
                <span className="w-4 h-4 rounded bg-rose-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs">R</span>
                <span className="text-xs font-semibold text-slate-500">Rejected</span>
              </div>
              <div className="flex items-center gap-1.5" title="Pending Approval (PA): Clocked in, supervisor review pending">
                <span className="px-1 h-4 rounded bg-amber-500 text-white text-[8px] font-black inline-flex items-center justify-center shadow-xs">PA</span>
                <span className="text-xs font-semibold text-slate-500">Pending</span>
              </div>
              <div className="flex items-center gap-1.5" title="Flagged / Regularization Pending (FR)">
                <span className="px-1 h-4 rounded bg-purple-600 text-white text-[8px] font-black inline-flex items-center justify-center shadow-xs">FR</span>
                <span className="text-xs font-semibold text-slate-500">Flagged/Reg</span>
              </div>
              <div className="flex items-center gap-1.5" title="Excused Absence (E)">
                <span className="w-4 h-4 rounded bg-blue-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs">E</span>
                <span className="text-xs font-semibold text-slate-500">Excused</span>
              </div>
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

                // 1. Leave statuses
                const isApprovedLeave = hasLeave && day.leave.status === 'APPROVED';
                const isPendingLeave = hasLeave && day.leave.status === 'PENDING';
                const isRevokedLeave = hasLeave && day.leave.status === 'REVOKED';

                // Color fill for approved leave:
                const isGrayLeaveFill = isApprovedLeave && !isFuture;
                const isVioletLeaveFill = isApprovedLeave && isFuture;

                // 2. Attendance Status Workflow states
                const rawStatus = (day.attendance?.status || '').toUpperCase().trim();
                const rawFlagStatus = (day.attendance?.flagStatus || '').toUpperCase().trim();
                const rawAbsenceType = (day.attendance?.absenceType || '').toUpperCase().trim();
                const rawResolution = (day.attendance?.resolutionType || '').toUpperCase().trim();

                const isPresent = hasAttendance && rawStatus === 'APPROVED' && !day.attendance.isAbsent;
                const isPendingApproval = hasAttendance && rawStatus === 'PENDING' && !day.attendance.isAbsent;

                // Confirmed Absence (A) - confirmed through workflow, missing punch alone is NOT absent
                const isConfirmedAbsent = hasAttendance && (
                  rawStatus === 'ABSENT' ||
                  rawStatus === 'UNEXCUSED_ABSENCE' ||
                  rawAbsenceType === 'ABSENT' ||
                  rawAbsenceType === 'UNEXCUSED_ABSENCE' ||
                  rawResolution === 'ABSENT' ||
                  rawResolution === 'UNEXCUSED_ABSENCE' ||
                  rawFlagStatus === 'REJECTED' ||
                  rawFlagStatus === 'ABSENT' ||
                  (Boolean(day.attendance.isAbsent) && rawStatus !== 'APPROVED' && rawStatus !== 'EXCUSED_ABSENCE')
                ) && rawStatus !== 'APPROVED' && rawStatus !== 'EXCUSED_ABSENCE';

                const isExcusedAbsence = hasAttendance && (
                  rawStatus === 'EXCUSED_ABSENCE' ||
                  (rawStatus === 'FLAGGED' && rawFlagStatus === 'APPROVED')
                );

                // Regularization & Flagging (FR) - only applies when record is NOT finalized as absent or approved
                const isRegPending = hasAttendance && day.attendance.regularization && day.attendance.regularization.status === 'PENDING';
                const isSupervisorFlagged = hasAttendance && (
                  rawStatus === 'FLAGGED' ||
                  (rawFlagStatus !== '' && !['NONE', 'APPROVED', 'REJECTED', 'ABSENT'].includes(rawFlagStatus))
                );
                const isFlaggedOrReg = !isConfirmedAbsent && !isExcusedAbsence && !isPresent && (isRegPending || isSupervisorFlagged);

                // Clock-In Rejected (Eligible for appeal / regularize, NOT marked absent)
                const isClockInRejected = hasAttendance && day.attendance.status === 'REJECTED' && !day.attendance.isAbsent;

                // Missing Clock-In (M) - ONLY when worker had a scheduled roster shift or supervisor flag and failed to clock in
                const isMissingClockIn = !isApprovedLeave && !isPendingLeave && hasAttendance && (day.attendance.status === 'MISSING' || day.attendance.status === 'MISSING_CLOCK_IN');

                // Days before user was created / registered in the system
                const isBeforeJoining = userCreatedDateStr ? day.dateStr < userCreatedDateStr : false;

                // Past unscheduled day (User created/active, but not assigned to any worksite or shift)
                const isPastUnscheduled = !hasAttendance && !hasLeave && !day.isFuture && !day.isToday && !isBeforeJoining;

                // Today pending clock-in
                const isTodayPendingClockIn = isToday && !hasAttendance && !isApprovedLeave && !isPendingLeave;

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => handleOpenDateModal(day.dateStr)}
                    className={`min-h-[85px] sm:min-h-[95px] p-2 sm:p-2.5 transition-all cursor-pointer relative group flex flex-col justify-between ${
                      // 1. Violet color fill for future leave applied (ONLY APPROVED)
                      isVioletLeaveFill
                        ? 'bg-violet-100/90 hover:bg-violet-200/80 text-violet-950 border-violet-200'
                        // 2. Gray color fill for past leave taken (ONLY APPROVED)
                        : isGrayLeaveFill
                          ? 'bg-slate-200 hover:bg-slate-300/80 text-slate-800 border-slate-300'
                          // 3. Confirmed Absence
                          : isConfirmedAbsent
                            ? 'bg-rose-50/90 hover:bg-rose-100/80 text-rose-950 border-rose-300'
                            : isExcusedAbsence
                              ? 'bg-blue-50/80 hover:bg-blue-100/80 text-blue-950 border-blue-200'
                              // 4. Flagged or Regularization Pending (FR)
                              : isFlaggedOrReg
                                ? 'bg-purple-50/80 hover:bg-purple-100/70 text-purple-950 border-purple-200'
                                // 5. Clock-in rejected alone (not yet confirmed absent)
                                : isClockInRejected
                                  ? 'bg-rose-50/60 hover:bg-rose-100/60 text-rose-950 border-rose-200'
                                  // 6. Missing Clock-In (M) - Only on actual scheduled/flagged shifts
                                  : isMissingClockIn
                                    ? 'bg-amber-50/80 hover:bg-amber-100/70 text-amber-950 border-amber-300'
                                    // 7. Present (P)
                                    : isPresent
                                      ? 'bg-emerald-50/50 hover:bg-emerald-100/60 text-slate-800 border-emerald-200'
                                      // 8. Pending Approval (PA)
                                      : isPendingApproval
                                        ? 'bg-amber-50/80 hover:bg-amber-100/70 text-amber-950 border-amber-300'
                                        // 9. Pending Leave (not approved)
                                        : isPendingLeave
                                          ? 'bg-amber-50/60 hover:bg-amber-100/60 text-amber-950 border-amber-200'
                                          : isTodayPendingClockIn
                                            ? 'bg-amber-50/60 hover:bg-amber-100/60 text-amber-950 border-amber-200'
                                            : isBeforeJoining
                                              ? 'bg-slate-50/40 hover:bg-slate-100/60 text-slate-400 border-transparent'
                                              : day.isCurrentMonth
                                                ? 'bg-white hover:bg-slate-50/80 text-slate-700'
                                                : 'bg-slate-50/30 text-slate-300 hover:bg-slate-50'
                      } ${isSelected ? 'ring-2 ring-inset ring-slate-900' : ''}`}
                  >
                    {/* Top Row: Date Number and Today Tag */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isToday
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : isVioletLeaveFill
                            ? 'bg-violet-700 text-white font-extrabold shadow-2xs'
                            : isGrayLeaveFill
                              ? 'bg-slate-600 text-white font-bold'
                              : isBeforeJoining
                                ? 'text-slate-400 bg-slate-100/60'
                                : day.isCurrentMonth
                                  ? 'text-slate-800'
                                  : 'text-slate-400'
                          }`}
                      >
                        {day.dayNumber}
                      </span>

                      <div className="flex items-center gap-1">
                        {isToday && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-900 text-white shadow-2xs">
                            Today
                          </span>
                        )}

                        {isPastUnscheduled && day.isCurrentMonth && (
                          <span className="text-[9px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            No Shift
                          </span>
                        )}

                        {isBeforeJoining && day.isCurrentMonth && (
                          <span className="text-[9px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Pre-joined
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Clean Minimalist Details */}
                    <div className="my-1 flex-1 flex flex-col justify-center">
                      {/* Clock-in time if attendance exists */}
                      {day.attendance?.clockInTime && !day.attendance.isAbsent && (
                        <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-mono">
                            {typeof day.attendance.clockInTime === 'string' && (day.attendance.clockInTime.includes('AM') || day.attendance.clockInTime.includes('PM'))
                              ? day.attendance.clockInTime
                              : new Date(day.attendance.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}

                      {/* Leave Type Name (Clean text, no bulky card) */}
                      {day.leave && (
                        <div className="text-[11px] font-semibold text-slate-700 truncate">
                          {day.leave.leaveTypeName || 'Leave'}
                          {day.leave.isHalfDay && (
                            <span className="text-[9px] text-slate-500 font-medium ml-1">(Half)</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Status Badge in Bottom Left, OT/Details in Bottom Right */}
                    <div className="flex items-center justify-between mt-auto pt-0.5">
                      {/* Status Simple Indicator Pill - Bottom Left */}
                      <div className="flex items-center gap-1">
                        {isConfirmedAbsent && (
                          <span className="w-5 h-5 rounded-md bg-rose-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-xs" title="Absent (A): Absence confirmed through workflow">
                            A
                          </span>
                        )}

                        {!isConfirmedAbsent && isPresent && (
                          <span className="w-5 h-5 rounded-md bg-emerald-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-xs" title="Present (P): Clocked in & approved by supervisor">
                            P
                          </span>
                        )}

                        {!isConfirmedAbsent && !isPresent && isPendingApproval && (
                          <span className="px-1.5 h-5 rounded-md bg-amber-500 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs" title="Pending Approval (PA): Clocked in, supervisor review pending">
                            PA
                          </span>
                        )}

                        {!isConfirmedAbsent && !isPresent && !isPendingApproval && isFlaggedOrReg && (
                          <span className="px-1.5 h-5 rounded-md bg-purple-600 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs" title="Flagged / Regularization Pending (FR): Correction request or supervisor flag pending">
                            FR
                          </span>
                        )}

                        {!isConfirmedAbsent && !isPresent && !isPendingApproval && !isFlaggedOrReg && isMissingClockIn && (
                          <span className="w-5 h-5 rounded-md bg-amber-500 text-white text-[10px] font-black inline-flex items-center justify-center shadow-xs" title="Missing Clock-In (M): Shift scheduled without clock-in">
                            M
                          </span>
                        )}

                        {isApprovedLeave && (
                          <span className="w-5 h-5 rounded-md bg-violet-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-xs" title="Leave (L): Approved leave">
                            L
                          </span>
                        )}

                        {!isApprovedLeave && isPendingLeave && (
                          <span className="px-1.5 h-5 rounded-md bg-amber-500 text-white text-[9px] font-black inline-flex items-center justify-center shadow-xs" title="Pending Leave (PL): Awaiting supervisor decision">
                            PL
                          </span>
                        )}

                        {!isConfirmedAbsent && !isPresent && !isPendingApproval && !isFlaggedOrReg && !isMissingClockIn && !isApprovedLeave && isClockInRejected && (
                          <span className="w-5 h-5 rounded-md bg-rose-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-xs" title="Clock-In Rejected (R): Eligible for Regularization / Appeal">
                            R
                          </span>
                        )}

                        {!isConfirmedAbsent && !isPresent && !isPendingApproval && !isFlaggedOrReg && !isMissingClockIn && !isApprovedLeave && !isClockInRejected && isExcusedAbsence && (
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-black inline-flex items-center justify-center shadow-xs" title="Excused Absence (E): Approved by supervisor">
                            E
                          </span>
                        )}
                      </div>

                      {/* Bottom Right: Compact Overtime Tag or Hover hint */}
                      <div className="flex items-center gap-1">
                        {day.attendance && day.attendance.calculatedOtMinutes > 0 && (() => {
                          const calcOt = day.attendance.calculatedOtMinutes;
                          const otH = Math.floor(calcOt / 60);
                          const otM = calcOt % 60;
                          const otText = otM > 0 ? `${otH}h ${otM}m` : `${otH}h`;

                          return (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/80 inline-flex items-center gap-1 shadow-2xs"
                              title={`Calculated Overtime: ${otText}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              <span>OT {otText}</span>
                            </span>
                          );
                        })()}

                        <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Details
                        </span>
                      </div>
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
                  attendanceRecords
                    .slice((tablePage - 1) * tableLimit, tablePage * tableLimit)
                    .map((r) => (
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

          {attendanceRecords.length > 0 && (
            <DataTablePagination
              metadata={{
                total: attendanceRecords.length,
                page: tablePage,
                limit: tableLimit,
                offset: (tablePage - 1) * tableLimit,
                totalPages: Math.ceil(attendanceRecords.length / tableLimit),
              }}
              onPageChange={(p) => setTablePage(p)}
              onLimitChange={(l) => {
                setTableLimit(l);
                setTablePage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
              isLoading={loading}
            />
          )}
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
            <span className="text-[11px] text-slate-400  ">Date: {modalDateStr}</span>
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

              {/* If leave applied in future: show applied leave and status (approved or reject or pending or revoked) */}
              {modalDayData.leave ? (
                modalDayData.leave.status === 'REVOKED' ? (
                  <div className="p-4 rounded-xl bg-rose-50/90 border-2 border-rose-300 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                          <Ban className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 block">
                            Leave Revoked
                          </span>
                          <h4 className="text-base font-bold text-rose-950 mt-0.5 m-0">
                            {modalDayData.leave.leaveTypeName || 'Leave Request'}
                          </h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-200 text-rose-900 border border-rose-300">
                        REVOKED
                      </span>
                    </div>

                    <div className="p-3 bg-white/90 rounded-lg border border-rose-200 text-xs space-y-2">
                      <div>
                        <span className="text-slate-500 text-[11px] block font-medium">Revocation Reason:</span>
                        <span className="font-bold text-rose-900 block mt-0.5">
                          "{modalDayData.leave.revocationReason || 'Revoked by site supervisor'}"
                        </span>
                      </div>
                      {modalDayData.leave.decisionNote && (
                        <div className="pt-1.5 border-t border-rose-100">
                          <span className="text-slate-500 text-[11px] block font-medium">Prior Approval Note:</span>
                          <span className="text-slate-700 italic block mt-0.5">"{modalDayData.leave.decisionNote}"</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-rose-100 flex items-center justify-between">
                        <span>Original Dates: {modalDayData.leave.startDate} to {modalDayData.leave.endDate}</span>
                        {modalDayData.leave.revokedAt && (
                          <span>Revoked: {new Date(modalDayData.leave.revokedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl ${modalDayData.leave.status === 'APPROVED' ? 'bg-violet-100/70 border-2 border-violet-300' : 'bg-slate-100 border border-slate-300'} space-y-3`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-violet-800 block">
                          {modalDayData.leave.status === 'APPROVED' ? 'Approved Leave Request' : 'Leave Request'}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5 m-0">
                          {modalDayData.leave.leaveTypeName}
                        </h4>
                      </div>
                      <StatusBadge status={modalDayData.leave.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white/80 p-3 rounded-lg border border-slate-200">
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
                      <span className="text-[11px] font-semibold text-slate-700 block mb-0.5">Reason for Request:</span>
                      <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-slate-200 m-0 italic">
                        "{modalDayData.leave.reason}"
                      </p>
                    </div>

                    {modalDayData.leave.decisionNote && (
                      <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200 text-xs">
                        <span className="font-bold text-slate-800 block text-[11px]">Reviewer Decision Note:</span>
                        <span className="text-slate-600">{modalDayData.leave.decisionNote}</span>
                      </div>
                    )}
                  </div>
                )
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


              {/* WORKER REGULARIZATION STATUS CARD (Section 4 & 5 & 6) */}
              {modalDayData.attendance?.regularization && (
                <div className="p-4 rounded-xl bg-indigo-50/90 border-2 border-indigo-300 space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 block">
                          Attendance Regularization Request
                        </span>
                        <h4 className="text-sm font-bold text-indigo-950 m-0">
                          {modalDayData.attendance.regularization.correctionType?.replace(/_/g, ' ')}
                        </h4>
                      </div>
                    </div>
                    <StatusBadge status={modalDayData.attendance.regularization.status} />
                  </div>

                  <div className="p-3 bg-white/90 rounded-lg border border-indigo-200 text-xs space-y-1.5">
                    <div>
                      <span className="text-slate-500 text-[11px] block font-medium">My Explanation:</span>
                      <span className="italic text-slate-800 font-medium">"{modalDayData.attendance.regularization.reason}"</span>
                    </div>
                    {modalDayData.attendance.regularization.reviewNote && (
                      <div className="pt-1.5 border-t border-indigo-100">
                        <span className="text-slate-500 text-[11px] block font-medium">Supervisor Review Remarks:</span>
                        <span className="font-semibold text-slate-900">"{modalDayData.attendance.regularization.reviewNote}"</span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                      <span>Submitted: {new Date(modalDayData.attendance.regularization.createdAt || Date.now()).toLocaleDateString()}</span>
                      {modalDayData.attendance.regularization.reviewedAt && (
                        <span>Reviewed: {new Date(modalDayData.attendance.regularization.reviewedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
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

              {/* Attendance Session Details if clocked in or recorded as absent/missed */}
              {modalDayData.attendance ? (
                ((Boolean(modalDayData.attendance.isAbsent) || modalDayData.attendance.status === 'ABSENT' || modalDayData.attendance.status === 'UNEXCUSED_ABSENCE' || modalDayData.attendance.flagStatus === 'REJECTED' || modalDayData.attendance.flagStatus === 'ABSENT') && modalDayData.attendance.status !== 'APPROVED') ? (() => {
                  const isExcused = modalDayData.attendance.status === 'EXCUSED_ABSENCE';
                  const isMissing = (modalDayData.attendance.status === 'MISSING_CLOCK_IN' || modalDayData.attendance.status === 'MISSING') && modalDayData.attendance.flagStatus !== 'REJECTED' && modalDayData.attendance.flagStatus !== 'ABSENT';

                  return (
                    <div className={`p-4 rounded-xl bg-white border shadow-2xs space-y-3 ${isExcused
                      ? 'border-blue-200'
                      : isMissing
                        ? 'border-amber-200'
                        : 'border-rose-200'
                      }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-[11px] font-semibold uppercase tracking-wider block ${isExcused
                            ? 'text-blue-600'
                            : isMissing
                              ? 'text-amber-600'
                              : 'text-rose-600'
                            }`}>
                            {isExcused ? 'Excused Absence (Approved)' : isMissing ? 'Missing Clock-In (Status: M)' : 'Confirmed Absence (Status: A)'}
                          </span>
                          <h4 className="text-base font-bold text-slate-900 mt-0.5 m-0">
                            {modalDayData.attendance.worksiteName || 'Assigned Worksite'}
                          </h4>
                          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            Shift: {modalDayData.attendance.shiftName || 'Standard Day Shift'}
                          </span>
                        </div>
                        <StatusBadge status={modalDayData.attendance.status} />
                      </div>

                      <div className={`p-3 border rounded-xl space-y-1.5 text-xs ${isExcused
                        ? 'bg-blue-50 border-blue-200 text-blue-950'
                        : isMissing
                          ? 'bg-amber-50 border-amber-200 text-amber-950'
                          : 'bg-rose-50 border-rose-200 text-rose-950'
                        }`}>
                        <div className={`flex items-center gap-2 font-bold ${isExcused ? 'text-blue-900' : isMissing ? 'text-amber-900' : 'text-rose-900'
                          }`}>
                          {isExcused ? (
                            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : isMissing ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span>
                            {isExcused
                              ? 'Excused Absence Recorded • Approved by Supervisor'
                              : isMissing
                                ? 'Missing Clock-In (Status: M) • Pending Supervisor Determination'
                                : 'Confirmed Absence Recorded • Attendance Workflow Complete'}
                          </span>
                        </div>
                        <p className={`text-[11px] m-0 ${isExcused ? 'text-blue-800' : isMissing ? 'text-amber-800' : 'text-rose-800'
                          }`}>
                          {isMissing
                            ? 'No clock-in punch was logged for this scheduled shift. The supervisor needs to review the day before determining the final outcome. You are not marked absent prematurely.'
                            : modalDayData.attendance.resolutionNote
                              ? `Supervisor Resolution: "${modalDayData.attendance.resolutionNote}"`
                              : isExcused
                                ? 'Your absence explanation was accepted and approved by your supervisor.'
                                : 'An unexcused absence was confirmed through the applicable attendance workflow.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          Were you present or need to regularise this date?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenQuickApplyLeave(modalDateStr)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Apply Retroactive Leave
                          </button>
                          <button
                            onClick={() => openRegularizationModal(modalDayData.attendance)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            Request Regularisation
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
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

                    {modalDayData.attendance.status === 'PENDING' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-950 text-xs">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <span className="font-bold block">Clock-In Registered • Pending Supervisor Review</span>
                          <span className="text-amber-800 text-[11px]">
                            Your punch has been recorded and submitted. It is currently waiting for review and approval from your supervisor.
                          </span>
                        </div>
                      </div>
                    )}

                    {modalDayData.attendance.status === 'REJECTED' && (
                      <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-1.5 text-xs text-amber-950">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Clock-In Rejected • Unresolved / Eligible for Regularization</span>
                        </div>
                        <p className="text-[11px] text-amber-800 m-0">
                          Your clock-in punch was rejected by the site supervisor, but a rejected clock-in alone does not automatically mean absent. You can submit an attendance regularization or correction request below to appeal or correct the record.
                        </p>
                      </div>
                    )}

                    {modalDayData.attendance.flagApproved && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-950">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-bold block text-emerald-900">Late Clock-In Approved by Supervisor</span>
                          <span className="text-emerald-700 text-[11px]">
                            {modalDayData.attendance.flagReason || 'Approved delay'}
                            {modalDayData.attendance.flagNote ? ` • Note: "${modalDayData.attendance.flagNote}"` : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Clock-In Time</span>
                        <span className="font-bold text-emerald-700 text-sm block mt-0.5">
                          {modalDayData.attendance.clockInTime
                            ? (typeof modalDayData.attendance.clockInTime === 'string' && (modalDayData.attendance.clockInTime.includes('AM') || modalDayData.attendance.clockInTime.includes('PM'))
                              ? modalDayData.attendance.clockInTime
                              : new Date(modalDayData.attendance.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Clock-Out Time</span>
                        <span className="font-bold text-slate-800 text-sm block mt-0.5">
                          {modalDayData.attendance.clockOutTime
                            ? (typeof modalDayData.attendance.clockOutTime === 'string' && (modalDayData.attendance.clockOutTime.includes('AM') || modalDayData.attendance.clockOutTime.includes('PM'))
                              ? modalDayData.attendance.clockOutTime
                              : new Date(modalDayData.attendance.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
                            : <span className="text-amber-700 font-bold flex items-center gap-1">Missing Clock-Out</span>}
                        </span>
                      </div>
                    </div>

                    {/* Missing punch alert */}
                    {!modalDayData.attendance.clockOutTime && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2 text-amber-950 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Incomplete Session • Missing Clock-Out</span>
                          <span className="text-[11px] text-amber-800">
                            Overtime cannot be finalized without a valid clock-out. Request regularization below if you forgot to clock out.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Overtime and Working Duration Card */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          Hours & Overtime Breakdown
                        </span>
                        {modalDayData.attendance.isPayrollLocked && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            🔒 Payroll Locked
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Standard Hours</span>
                          <span className="font-bold text-slate-900 block mt-0.5">
                            {Math.floor((modalDayData.attendance.standardHoursMinutes || 540) / 60)}h
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Break Deducted</span>
                          <span className="font-bold text-slate-900 block mt-0.5">
                            {modalDayData.attendance.breakDurationMinutes || 0}m
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Calculated OT</span>
                          <span className="font-bold text-indigo-700 block mt-0.5">
                            {modalDayData.attendance.calculatedOtMinutes
                              ? `${Math.floor(modalDayData.attendance.calculatedOtMinutes / 60)}h ${modalDayData.attendance.calculatedOtMinutes % 60}m`
                              : '0m'}
                          </span>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Approved OT</span>
                          <span className="font-bold text-emerald-700 block mt-0.5">
                            {modalDayData.attendance.approvedOtMinutes
                              ? `${Math.floor(modalDayData.attendance.approvedOtMinutes / 60)}h ${modalDayData.attendance.approvedOtMinutes % 60}m`
                              : '0m'}
                          </span>
                        </div>
                      </div>

                      {modalDayData.attendance.otStatus && modalDayData.attendance.otStatus !== 'NONE' && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                          <span className="text-slate-500 text-[11px]">OT Decision Status:</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${modalDayData.attendance.otStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : modalDayData.attendance.otStatus === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                          >
                            {modalDayData.attendance.otStatus === 'APPROVED'
                              ? 'Approved by Supervisor'
                              : modalDayData.attendance.otStatus === 'REJECTED'
                                ? 'Rejected by Supervisor'
                                : 'Pending Supervisor Review'}
                          </span>
                        </div>
                      )}
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

                    {/* Latest Action Metadata (Section 5) */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Latest Decision Metadata
                        </span>
                        {modalDayData.attendance.updatedAt && (
                          <span className="text-[10px] text-slate-400">
                            Updated: {new Date(modalDayData.attendance.updatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {modalDayData.attendance.notes && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-700 block">Latest Action Note:</span>
                          <p className="text-xs text-slate-800 bg-white p-2 rounded border border-slate-200 m-0 italic">
                            "{modalDayData.attendance.notes}"
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        <span>
                          Action By:{' '}
                          <strong className="text-slate-800">
                            {modalDayData.attendance.actionByName ||
                              (modalDayData.attendance.actionByRole
                                ? modalDayData.attendance.actionByRole
                                : 'Authorized Reviewer')}
                          </strong>
                        </span>
                        {modalDayData.attendance.actionByRole && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                            {modalDayData.attendance.actionByRole}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Only show old supervisor rejection note if current status is actually REJECTED */}
                    {modalDayData.attendance.status === 'REJECTED' && modalDayData.attendance.rejectionReason && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <span className="font-bold block text-[11px]">Supervisor Rejection Note:</span>
                        <span>{modalDayData.attendance.rejectionReason}</span>
                      </div>
                    )}

                    {/* Immutable Audit Trail (Section 6 & 11) */}
                    {modalDayData.attendance.auditHistory && modalDayData.attendance.auditHistory.length > 0 && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-blue-600" />
                            Decision & Audit History ({modalDayData.attendance.auditHistory.length})
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            Immutable Log
                          </span>
                        </div>
                        <div className="space-y-2 divide-y divide-slate-100">
                          {modalDayData.attendance.auditHistory.map((event: any, idx: number) => (
                            <div key={event.id || idx} className="pt-2 first:pt-0 space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {event.previousStatus ? (
                                    <>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                        {event.previousStatus}
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-slate-400" />
                                    </>
                                  ) : null}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    event.newStatus === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : event.newStatus === 'REJECTED'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {event.newStatus}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {event.performedAt ? new Date(event.performedAt).toLocaleString() : '—'}
                                </span>
                              </div>
                              {event.note && (
                                <p className="text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100 m-0">
                                  "{event.note}"
                                </p>
                              )}
                              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                                <span>
                                  Actor: <strong>{event.reviewerName || event.actorRole || 'System'}</strong>
                                </span>
                                {event.actionType && (
                                  <span className="font-mono text-[9px] text-slate-400">
                                    {event.actionType}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
                )
              ) : !modalDayData.leave ? (
                modalDayData.isToday ? (
                  <div className="p-5 rounded-xl bg-amber-50/80 border-2 border-amber-300 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-950 text-sm m-0">Today's Clock-In Pending</h4>
                      <p className="text-xs text-amber-800 mt-1 max-w-sm mx-auto">
                        You have not clocked in for today's shift yet. Go to the Today screen to verify your geofence and record your attendance.
                      </p>
                    </div>
                    {onNavigateToday && (
                      <div className="pt-1">
                        <button
                          onClick={() => {
                            setDateModalOpen(false);
                            onNavigateToday();
                          }}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Go to Today Screen to Clock In
                        </button>
                      </div>
                    )}
                  </div>
                ) : userCreatedDateStr && modalDateStr < userCreatedDateStr ? (
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                      <Calendar className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 mb-1">
                        Pre-Registration Date
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm m-0">Account Not Active on This Date</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Your employee account was created on {userCreatedDateStr}. You were not active in the system prior to this date, so no attendance was required.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                      <Building2 className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 mb-1">
                        No Scheduled Shift
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm m-0">No Worksite or Shift Assigned</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        You were not assigned to any worksite or scheduled shift on this date. No attendance clock-in was required.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenQuickApplyLeave(modalDateStr)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                      >
                        Apply Retroactive Leave
                      </button>
                      <button
                        onClick={() => openRegularizationModal({
                          id: `unassigned_${modalDateStr}`,
                          workDate: modalDateStr,
                          date: modalDateStr,
                          worksiteName: 'Unassigned Worksite',
                          isAbsent: false,
                          status: 'PENDING'
                        })}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        Log Unscheduled Work / Regularize
                      </button>
                    </div>
                  </div>
                )
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
      {(() => {
        const targetRegDate = selectedSessionForReg?.workDate || selectedSessionForReg?.date || modalDateStr;
        const targetRegMonth = targetRegDate ? targetRegDate.substring(0, 7) : currentMonthStr;
        const isRegPrevMonth = targetRegMonth < currentMonthStr;
        const isRegFuture = targetRegDate > todayStr;
        const isRegAlreadyPending = selectedSessionForReg?.regularization?.status === 'PENDING';
        const isSubmitDisabled = submittingReg || isRegPrevMonth || isRegFuture || isRegAlreadyPending || regReason.trim().length < 5;

        return (
          <Modal
            isOpen={regModalOpen}
            onClose={() => setRegModalOpen(false)}
            title="Request Attendance Regularization"
            description="Submit a timestamp correction request to your designated site supervisor."
            maxWidth="md"
            footer={
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] text-slate-400">
                  {isRegPrevMonth
                    ? '⚠️ Previous month restricted'
                    : isRegAlreadyPending
                      ? '⏳ Request already pending'
                      : 'Current month attendance correction'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRegModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegularizationSubmit}
                    disabled={isSubmitDisabled}
                    className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    title={
                      isRegPrevMonth
                        ? 'Regularization is blocked for previous calendar months'
                        : isRegAlreadyPending
                          ? 'Request already pending'
                          : regReason.trim().length < 5
                            ? 'Reason must be at least 5 characters'
                            : undefined
                    }
                  >
                    {submittingReg ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Previous Month Restriction Alert */}
              {isRegPrevMonth && (
                <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Previous Month Restriction</span>
                    <span className="text-amber-800 leading-relaxed block mt-0.5">
                      Attendance regularization is restricted to the current calendar month ({currentMonthStr}).
                      For previous months ({targetRegMonth}), records are locked to protect payroll finalization.
                      Please contact your site administrator to initiate an authorized <strong>Admin Attendance Correction</strong>.
                    </span>
                  </div>
                </div>
              )}

              {/* Already Pending Alert */}
              {isRegAlreadyPending && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border-2 border-indigo-300 text-indigo-950 text-xs flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold block">Active Request Already Pending</span>
                    <span className="text-indigo-800 leading-relaxed block mt-0.5">
                      An attendance regularization request for {targetRegDate} has already been submitted and is awaiting your supervisor's review. Duplicate active requests are prevented.
                    </span>
                  </div>
                </div>
              )}

              {/* Future Date Alert */}
              {isRegFuture && (
                <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Future Date Not Allowed</span>
                    <span className="text-rose-800 leading-relaxed block mt-0.5">
                      Regularization cannot be submitted for future attendance dates. Please apply for planned leave if you anticipate absence.
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Work Date & Location
                </label>
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200 flex items-center justify-between">
                  <span>{targetRegDate} — {selectedSessionForReg?.worksiteName || 'Assigned Worksite'}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {targetRegMonth === currentMonthStr ? 'Current Month' : 'Previous Month'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Correction Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={regCorrectionType}
                  onChange={(e) => setRegCorrectionType(e.target.value)}
                  disabled={isRegPrevMonth || isRegAlreadyPending}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="INCORRECT_HOURS">Incorrect Working Hours</option>
                  <option value="MISSING_CLOCK_IN">Missing Clock-In</option>
                  <option value="MISSING_CLOCK_OUT">Missing Clock-Out</option>
                  <option value="INCORRECT_CLOCK_IN">Incorrect Clock-In Timestamp</option>
                  <option value="INCORRECT_CLOCK_OUT">Incorrect Clock-Out Timestamp</option>
                  <option value="INCORRECT_SITE">Incorrect Site Assignment</option>
                  <option value="OTHER">Other Discrepancy</option>
                </select>
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
                    disabled={isRegPrevMonth || isRegAlreadyPending}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
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
                    disabled={isRegPrevMonth || isRegAlreadyPending}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Correction Reason <span className="text-rose-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">(min 5 characters, non-whitespace)</span>
                </label>
                <textarea
                  value={regReason}
                  onChange={(e) => setRegReason(e.target.value)}
                  disabled={isRegPrevMonth || isRegAlreadyPending}
                  placeholder="Explain why this correction is required (e.g. GPS error, network downtime, forgotten clock-out)..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Supporting Evidence URL <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={supportingEvidenceUrl}
                  onChange={(e) => setSupportingEvidenceUrl(e.target.value)}
                  disabled={isRegPrevMonth || isRegAlreadyPending}
                  placeholder="https://... (e.g. link to photo proof, badge slip, supervisor permission message)"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};

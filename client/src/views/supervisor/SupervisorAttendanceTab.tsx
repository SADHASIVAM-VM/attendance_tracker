import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SupervisorWorkerAttendance,
  SupervisorWorksite,
  SupervisorAttendanceStatistics,
  MissingClockInCase,
} from '../../types/supervisor';
import { WorkerRow } from '../../components/supervisor/WorkerRow';
import { ReviewSheet } from '../../components/supervisor/ReviewSheet';
import { SupervisorPersonalAttendance } from '../../components/supervisor/SupervisorPersonalAttendance';
import { MissingClockInManager } from '../../components/supervisor/MissingClockInManager';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DateRangePicker, DateRange } from '../../components/ui/date-range-picker';
import { apiRequest } from '../../lib/api';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  User,
  Users,
  Search,
  ShieldAlert,
  History,
  Building2,
  RefreshCw,
  Sliders,
  Flag,
  HelpCircle,
  Download,
} from 'lucide-react';

export type SupervisorSection =
  | 'today-attendance'
  | 'missing-attendance'
  | 'attendance-overrides'
  | 'attendance-history'
  | 'my-attendance';

interface SupervisorAttendanceTabProps {
  workers: SupervisorWorkerAttendance[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  statistics?: SupervisorAttendanceStatistics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onApproveWorker: (worker: SupervisorWorkerAttendance) => void;
  onRejectWorker: (worker: SupervisorWorkerAttendance, reason: string) => void;
  onClockOutWorker?: (worker: SupervisorWorkerAttendance, reason: string) => void | Promise<void>;
  onBulkApprove: (workerIds: string[]) => void;
  onUndoLastAction?: () => void;
  undoAvailable?: { message: string } | null;
  currentWorksite?: SupervisorWorksite;
  initialSection?: string;
}

type CardFilterType = 'TOTAL' | 'APPROVED' | 'REJECTED' | 'MISSING_CLOCK_IN' | 'PENDING' | 'FLAGGED';

export const SupervisorAttendanceTab: React.FC<SupervisorAttendanceTabProps> = ({
  workers,
  selectedDate,
  onSelectDate,
  statistics,
  isLoading = false,
  isError = false,
  onRetry,
  onApproveWorker,
  onRejectWorker,
  onClockOutWorker,
  onBulkApprove,
  onUndoLastAction,
  undoAvailable,
  currentWorksite,
  initialSection = 'today-attendance',
}) => {
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }, []);

  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Normalize initialSection (maps legacy daily-attendance to today-attendance)
  const normalizedInitialSection: SupervisorSection = useMemo(() => {
    if (initialSection === 'missing-clock-in' || initialSection === 'missing-attendance') return 'missing-attendance';
    if (initialSection === 'overrides' || initialSection === 'attendance-overrides') return 'attendance-overrides';
    if (initialSection === 'history' || initialSection === 'attendance-history') return 'attendance-history';
    if (initialSection === 'my-attendance') return 'my-attendance';
    return 'today-attendance';
  }, [initialSection]);

  const [section, setSection] = useState<SupervisorSection>(normalizedInitialSection);

  // Missing clock-in state
  const [missingCases, setMissingCases] = useState<MissingClockInCase[]>([]);
  const [isLoadingMissing, setIsLoadingMissing] = useState<boolean>(false);

  // Live Summary Stats from GET /attendance/supervisor/summary
  const [summaryStats, setSummaryStats] = useState<SupervisorAttendanceStatistics | null>(null);

  // Today Attendance Card Filter ('TOTAL' means all assigned workers)
  const [activeCardFilter, setActiveCardFilter] = useState<CardFilterType>('TOTAL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [selectedWorkerForReview, setSelectedWorkerForReview] = useState<SupervisorWorkerAttendance | null>(null);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState<boolean>(false);

  // Toast / Flash Message
  const [flashMessage, setFlashMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // -------------------------------------------------------------
  // ATTENDANCE OVERRIDES STATE
  // -------------------------------------------------------------
  const [overridesList, setOverridesList] = useState<any[]>([]);
  const [isLoadingOverrides, setIsLoadingOverrides] = useState<boolean>(false);
  const [overrideWorkerId, setOverrideWorkerId] = useState<string>('');
  const [overrideDate, setOverrideDate] = useState<string>(todayStr);
  const [overrideStatus, setOverrideStatus] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED');
  const [overrideClockIn, setOverrideClockIn] = useState<string>('');
  const [overrideClockOut, setOverrideClockOut] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideRemarks, setOverrideRemarks] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);

  // Initialize selected worker for override
  useEffect(() => {
    if (workers.length > 0 && !overrideWorkerId) {
      setOverrideWorkerId(workers[0].workerId || workers[0].id);
    }
  }, [workers, overrideWorkerId]);

  // Existing session preview for override worker + date
  const overrideExistingSession = useMemo(() => {
    if (!overrideWorkerId) return null;
    return workers.find((w) => (w.workerId === overrideWorkerId || w.id === overrideWorkerId) && w.date === overrideDate) || null;
  }, [workers, overrideWorkerId, overrideDate]);

  // -------------------------------------------------------------
  // ATTENDANCE HISTORY STATE (Range-Based Selection via Shadcn Calendar UI)
  // -------------------------------------------------------------
  const [historyRange, setHistoryRange] = useState<DateRange>({
    startDate: `${currentMonthStr}-01`,
    endDate: todayStr,
  });
  const [historyWorkerFilter, setHistoryWorkerFilter] = useState<string>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Load summary stats from backend
  const loadSupervisorSummary = useCallback(async () => {
    try {
      const wsQuery = currentWorksite?.id ? `?worksiteId=${encodeURIComponent(currentWorksite.id)}` : '';
      const data = await apiRequest<any>(`/attendance/supervisor/summary${wsQuery}`);
      if (data && typeof data === 'object') {
        setSummaryStats({
          totalWorkers: data.totalWorkers ?? 0,
          approved: data.approved ?? 0,
          rejected: data.rejected ?? 0,
          pending: data.pending ?? 0,
          missingClockIns: data.missingClockIns ?? 0,
          pendingRegularization: data.pendingRegularization ?? 0,
          flaggedDatesCount: data.flaggedDatesCount ?? 0,
        });
      }
    } catch (err) {
      console.warn('Could not load supervisor summary stats:', err);
    }
  }, [currentWorksite?.id]);

  // Load missing clock-in cases
  const loadMissingClockIns = useCallback(async () => {
    setIsLoadingMissing(true);
    try {
      const wsQuery = currentWorksite?.id ? `&worksiteId=${encodeURIComponent(currentWorksite.id)}` : '';
      const res = await apiRequest<any>(`/attendance/missing-clock-ins?date=${todayStr}${wsQuery}`);
      const list = Array.isArray(res) ? res : res?.cases || [];
      setMissingCases(list);
    } catch (err) {
      console.error('Error fetching missing clock-in cases:', err);
      setMissingCases([]);
    } finally {
      setIsLoadingMissing(false);
    }
  }, [todayStr, currentWorksite?.id]);

  // Load Recent Overrides
  const loadRecentOverrides = useCallback(async () => {
    setIsLoadingOverrides(true);
    try {
      const data = await apiRequest<any>('/attendance/supervisor/overrides');
      setOverridesList(Array.isArray(data) ? data : data?.overrides || []);
    } catch (err) {
      console.error('Failed to load overrides audit list:', err);
      setOverridesList([]);
    } finally {
      setIsLoadingOverrides(false);
    }
  }, []);

  // Load Attendance History Range
  const loadAttendanceHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const queryParts: string[] = [
        `startDate=${encodeURIComponent(historyRange.startDate)}`,
        `endDate=${encodeURIComponent(historyRange.endDate)}`,
      ];
      if (currentWorksite?.id) {
        queryParts.push(`worksiteId=${encodeURIComponent(currentWorksite.id)}`);
      }
      if (historyWorkerFilter !== 'ALL') {
        queryParts.push(`workerId=${encodeURIComponent(historyWorkerFilter)}`);
      }
      if (historyStatusFilter !== 'ALL') {
        queryParts.push(`status=${encodeURIComponent(historyStatusFilter)}`);
      }
      if (historySearchQuery.trim()) {
        queryParts.push(`search=${encodeURIComponent(historySearchQuery.trim())}`);
      }

      const res = await apiRequest<any>(`/attendance/supervisor/history-range?${queryParts.join('&')}`);
      const list = Array.isArray(res) ? res : res?.records || [];
      setHistoryRecords(list);
    } catch (err) {
      console.error('Failed to load attendance history range:', err);
      setHistoryRecords([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyRange, currentWorksite?.id, historyWorkerFilter, historyStatusFilter, historySearchQuery]);

  // Initial loads
  useEffect(() => {
    loadSupervisorSummary();
    loadMissingClockIns();
  }, [loadSupervisorSummary, loadMissingClockIns]);

  // Reactive section loads
  useEffect(() => {
    if (section === 'attendance-overrides') {
      loadRecentOverrides();
    } else if (section === 'attendance-history') {
      loadAttendanceHistory();
    }
  }, [section, loadRecentOverrides, loadAttendanceHistory]);

  // Reset page when filter or search changes in Today Attendance
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCardFilter, searchQuery]);

  // Format date display
  const formatDisplayDate = (isoDate: string) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate;
    const [y, m, d] = isoDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return isoDate;
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Format punch timestamps to e.g. "09:30 AM"
  const formatPunchTime = (isoTime: string | null | undefined): string => {
    if (!isoTime) return '—';
    try {
      const d = new Date(isoTime);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  // Metrics for Today's Attendance Cards
  const totalCount = summaryStats?.totalWorkers ?? statistics?.totalWorkers ?? workers.length;
  const approvedCount = summaryStats?.approved ?? statistics?.approved ?? workers.filter((w) => w.status === 'APPROVED').length;
  const rejectedCount = summaryStats?.rejected ?? statistics?.rejected ?? workers.filter((w) => w.status === 'REJECTED').length;
  const pendingCount = summaryStats?.pending ?? statistics?.pending ?? workers.filter((w) => w.status === 'PENDING').length;
  const missingCount = summaryStats?.missingClockIns ?? statistics?.missingClockIns ?? missingCases.length;
  const flaggedDatesCount = summaryStats?.flaggedDatesCount ?? statistics?.flaggedDatesCount ?? 0;

  // Filter Today's workers
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (activeCardFilter === 'APPROVED' && w.status !== 'APPROVED') return false;
      if (activeCardFilter === 'REJECTED' && w.status !== 'REJECTED') return false;
      if (activeCardFilter === 'PENDING' && w.status !== 'PENDING') return false;
      if (activeCardFilter === 'MISSING_CLOCK_IN') {
        const isMissing = !w.clockInTime && w.status !== 'ON_LEAVE';
        if (!isMissing) return false;
      }
      if (activeCardFilter === 'FLAGGED' && (!w.flagStatus || w.flagStatus === 'NONE')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = w.name?.toLowerCase().includes(q);
        const matchesCode = w.employeeCode?.toLowerCase().includes(q);
        const matchesRole = w.role?.toLowerCase().includes(q);
        const matchesSite = w.worksiteName?.toLowerCase().includes(q);
        const matchesNote = w.note?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRole && !matchesSite && !matchesNote) {
          return false;
        }
      }

      return true;
    });
  }, [workers, activeCardFilter, searchQuery]);

  // Pagination for Today's Workers list
  const totalPages = Math.ceil(filteredWorkers.length / pageSize) || 1;
  const paginatedWorkers = useMemo(() => {
    if (filteredWorkers.length <= pageSize) return filteredWorkers;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredWorkers.slice(startIndex, startIndex + pageSize);
  }, [filteredWorkers, currentPage]);

  const handleToggleWorkerSelect = (worker: SupervisorWorkerAttendance) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(worker.id) ? prev.filter((id) => id !== worker.id) : [...prev, worker.id]
    );
  };

  const handleSelectAllPending = () => {
    const pendingIds = filteredWorkers.filter((w) => w.status === 'PENDING').map((w) => w.id);
    if (selectedWorkerIds.length === pendingIds.length) {
      setSelectedWorkerIds([]);
    } else {
      setSelectedWorkerIds(pendingIds);
    }
  };

  const handleConfirmBulkApprove = () => {
    onBulkApprove(selectedWorkerIds);
    setSelectedWorkerIds([]);
    setMultiSelectMode(false);
    setShowBulkConfirmModal(false);
    loadSupervisorSummary();
  };

  // -------------------------------------------------------------
  // ATTENDANCE OVERRIDE SUBMISSION
  // -------------------------------------------------------------
  const isOverridePrevMonth = useMemo(() => {
    return overrideDate.substring(0, 7) < currentMonthStr;
  }, [overrideDate, currentMonthStr]);

  const isOverrideFuture = useMemo(() => {
    return overrideDate > todayStr;
  }, [overrideDate, todayStr]);

  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = overrideReason.trim();

    if (!overrideWorkerId) {
      setFlashMessage({ text: 'Please select a worker to override attendance.', type: 'error' });
      return;
    }

    if (isOverridePrevMonth) {
      setFlashMessage({
        text: `Supervisor overrides are strictly limited to the current calendar month (${currentMonthStr}). For previous months, please use the authorized Admin Attendance Correction process.`,
        type: 'error',
      });
      return;
    }

    if (isOverrideFuture) {
      setFlashMessage({ text: 'Future attendance dates cannot be overridden.', type: 'error' });
      return;
    }

    if (!trimmedReason || trimmedReason.length < 5) {
      setFlashMessage({
        text: 'A meaningful reason of at least 5 characters is mandatory for an override.',
        type: 'error',
      });
      return;
    }

    try {
      setIsSubmittingOverride(true);
      const res = await apiRequest<any>('/attendance/supervisor/override', {
        method: 'POST',
        body: JSON.stringify({
          workerId: overrideWorkerId,
          workDate: overrideDate,
          status: overrideStatus,
          clockInTime: overrideClockIn ? new Date(overrideClockIn).toISOString() : undefined,
          clockOutTime: overrideClockOut ? new Date(overrideClockOut).toISOString() : undefined,
          reason: trimmedReason,
          remarks: overrideRemarks.trim() || undefined,
        }),
      });

      setFlashMessage({
        text: res.message || 'Attendance override applied successfully and recorded in audit trail.',
        type: 'success',
      });

      setOverrideReason('');
      setOverrideRemarks('');
      loadRecentOverrides();
      loadSupervisorSummary();
    } catch (err: any) {
      setFlashMessage({
        text: err.message || 'Failed to apply attendance override',
        type: 'error',
      });
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Export History CSV
  const handleExportHistoryCsv = () => {
    if (historyRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = ['Date', 'Worker Name', 'Employee ID', 'Clock In', 'Clock Out', 'Worksite', 'Status', 'Flag Status', 'Flag Reason', 'Flag Note'];
    const rows = historyRecords.map((r) => [
      r.date,
      `"${(r.workerName || '').replace(/"/g, '""')}"`,
      r.employeeCode || '',
      r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString() : '',
      r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : '',
      `"${(r.worksiteName || '').replace(/"/g, '""')}"`,
      r.status || '',
      r.flag?.status || 'NONE',
      `"${(r.flag?.reason || '').replace(/"/g, '""')}"`,
      `"${(r.flag?.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_history_${historyRange.startDate}_to_${historyRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-24">
      {/* ── Top Flash Alert ─────────────────────────────────────────────────── */}
      {flashMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border flex items-center justify-between shadow-xs transition-all ${
            flashMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {flashMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{flashMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFlashMessage(null)}
            className="text-[11px] font-bold uppercase tracking-wider underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── SUMMARY KPI CARDS (Real Attendance Data) ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* 1. Total Workers */}
        <button
          type="button"
          onClick={() => {
            setSection('today-attendance');
            setActiveCardFilter('TOTAL');
          }}
          className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            section === 'today-attendance' && activeCardFilter === 'TOTAL'
              ? 'bg-[#F0FDF4] border-2 border-[#12A66A] shadow-xs ring-1 ring-[#12A66A]'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalCount}</div>
          <span className="text-[10px] text-slate-400 font-medium">Assigned Today</span>
        </button>

        {/* 2. Approved Today */}
        <button
          type="button"
          onClick={() => {
            setSection('today-attendance');
            setActiveCardFilter('APPROVED');
          }}
          className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            section === 'today-attendance' && activeCardFilter === 'APPROVED'
              ? 'bg-[#E6F7EF] border-2 border-[#12A66A] shadow-xs ring-1 ring-[#12A66A]'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#0E8F5B] tabular-nums">{approvedCount}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Verified Today</span>
        </button>

        {/* 3. Rejected Today */}
        <button
          type="button"
          onClick={() => {
            setSection('today-attendance');
            setActiveCardFilter('REJECTED');
          }}
          className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            section === 'today-attendance' && activeCardFilter === 'REJECTED'
              ? 'bg-rose-50 border-2 border-rose-500 shadow-xs ring-1 ring-rose-400'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 tabular-nums">{rejectedCount}</div>
          <span className="text-[10px] text-rose-600 font-medium">Declined Today</span>
        </button>

        {/* 4. Pending Today */}
        <button
          type="button"
          onClick={() => {
            setSection('today-attendance');
            setActiveCardFilter('PENDING');
          }}
          className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            section === 'today-attendance' && activeCardFilter === 'PENDING'
              ? 'bg-amber-50 border-2 border-amber-500 shadow-xs ring-1 ring-amber-400'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 tabular-nums">{pendingCount}</div>
          <span className="text-[10px] text-amber-600 font-medium">Review Needed</span>
        </button>

        {/* 5. Missing Clock-Ins */}
        <button
          type="button"
          onClick={() => {
            setSection('missing-attendance');
          }}
          className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            section === 'missing-attendance'
              ? 'bg-amber-100/70 border-2 border-amber-600 shadow-xs ring-1 ring-amber-500'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Missing In</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-800 tabular-nums">{missingCount}</div>
          <span className="text-[10px] text-amber-700 font-medium">Unclocked Shifts</span>
        </button>

        {/* 6. Flagged Attendance */}
        <button
          type="button"
          onClick={() => {
            setSection('today-attendance');
            setActiveCardFilter('FLAGGED');
          }}
          className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            section === 'today-attendance' && activeCardFilter === 'FLAGGED'
              ? 'bg-purple-50 border-2 border-purple-600 shadow-xs ring-1 ring-purple-500'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">Flagged</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-700 tabular-nums">{flaggedDatesCount}</div>
          <span className="text-[10px] text-purple-600 font-medium">Exceptions Reviewed</span>
        </button>
      </div>

      {/* ── 5 ATTENDANCE SUB-SECTIONS SWITCHER BAR ───────────────────────────── */}
      <div className="flex p-1 bg-white border border-[#E8EEF4] rounded-[18px] shadow-xs gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSection('today-attendance')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            section === 'today-attendance'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="truncate">Today Attendance</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-extrabold ml-1">
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSection('missing-attendance')}
          className={`flex-1 min-w-[145px] py-2.5 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            section === 'missing-attendance'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">Missing Attendance</span>
          {missingCases.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                section === 'missing-attendance' ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {missingCases.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSection('attendance-overrides')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            section === 'attendance-overrides'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span className="truncate">Attendance Overrides</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('attendance-history')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            section === 'attendance-history'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4 shrink-0" />
          <span className="truncate">Attendance History</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('my-attendance')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            section === 'my-attendance'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate">My Attendance</span>
        </button>
      </div>

      {/* ── SECTION 1: TODAY'S ATTENDANCE ALONE ─────────────────────────────── */}
      {section === 'today-attendance' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Header indicator: Shows today's attendance alone (locked to todayStr) */}
          <div className="bg-white border border-[#E8EEF4] rounded-[18px] p-3 sm:px-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#E6F7EF] text-[#12A66A]">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Today's Attendance Alone
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                  {formatDisplayDate(todayStr)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#0E8F5B]">
                <span className="w-2 h-2 rounded-full bg-[#12A66A] animate-pulse" />
                Live Today
              </span>

              {/* Multi-select toggle button if pending approvals exist */}
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMultiSelectMode(!multiSelectMode);
                    setSelectedWorkerIds([]);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    multiSelectMode
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white border border-[#E8EEF4] text-[#12A66A] hover:bg-[#E6F7EF]'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{multiSelectMode ? 'Cancel Selection' : 'Multi-Select'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Pending Filter Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search worker by name, employee code, role..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#12A66A] focus:ring-2 focus:ring-[#12A66A]/10 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setActiveCardFilter(activeCardFilter === 'PENDING' ? 'TOTAL' : 'PENDING')
                }
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeCardFilter === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Reviews ({pendingCount})</span>
              </button>
            )}
          </div>

          {/* Active Filter Banner */}
          {(activeCardFilter !== 'TOTAL' || searchQuery) && (
            <div className="p-2.5 px-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-600 animate-in fade-in duration-100">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#12A66A]" />
                <span>
                  Filtered by:{' '}
                  <strong className="text-slate-900">
                    {activeCardFilter === 'APPROVED'
                      ? 'Approved'
                      : activeCardFilter === 'REJECTED'
                      ? 'Rejected'
                      : activeCardFilter === 'MISSING_CLOCK_IN'
                      ? 'Missing Clock-ins'
                      : activeCardFilter === 'PENDING'
                      ? 'Pending Reviews'
                      : activeCardFilter === 'FLAGGED'
                      ? 'Flagged Records'
                      : 'All'}
                  </strong>
                  {searchQuery && (
                    <span>
                      {' '}• Search: &ldquo;<strong>{searchQuery}</strong>&rdquo;
                    </span>
                  )}{' '}
                  ({filteredWorkers.length} worker{filteredWorkers.length === 1 ? '' : 's'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveCardFilter('TOTAL');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-[#12A66A] hover:underline cursor-pointer"
              >
                ✕ Clear Filter & Show All
              </button>
            </div>
          )}

          {/* Multi-Select Action Bar */}
          {multiSelectMode && (
            <div className="p-3 bg-[#E6F7EF] border border-[#12A66A]/30 rounded-[14px] flex items-center justify-between animate-in fade-in duration-150">
              <button
                type="button"
                onClick={handleSelectAllPending}
                className="flex items-center gap-2 text-xs font-bold text-[#0E8F5B] cursor-pointer"
              >
                {selectedWorkerIds.length > 0 &&
                selectedWorkerIds.length ===
                  filteredWorkers.filter((w) => w.status === 'PENDING').length ? (
                  <CheckSquare className="w-4 h-4 fill-[#12A66A] text-white" />
                ) : (
                  <Square className="w-4 h-4 text-[#12A66A]" />
                )}
                <span>Select All Pending ({pendingCount})</span>
              </button>

              <span className="text-xs font-semibold text-slate-700">
                {selectedWorkerIds.length} selected
              </span>
            </div>
          )}

          {/* Workers Attendance List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-[#E8EEF4] rounded-[16px] p-4 flex items-center gap-3 animate-pulse"
                >
                  <div className="w-11 h-11 bg-slate-200 rounded-[14px]" />
                  <div className="flex-1 space-y-2">
                    <div className="w-32 h-4 bg-slate-200 rounded-md" />
                    <div className="w-48 h-3 bg-slate-100 rounded-md" />
                  </div>
                  <div className="w-16 h-6 bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-10 text-center bg-white border border-rose-200 rounded-[20px] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Failed to load attendance records</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Unable to retrieve today's attendance records. Please verify your connection and try again.
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#12A66A] hover:bg-[#0E8F5B] text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ) : workers.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">No Workers Assigned Today</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No workers were scheduled or assigned to {currentWorksite?.name || 'this worksite'} for today.
              </p>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-10 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
              <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Filter className="w-5 h-5" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-800">
                No matching records found
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are no attendance records matching your filter criteria for today.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCardFilter('TOTAL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Clear Filter
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {paginatedWorkers.map((worker) => (
                  <WorkerRow
                    key={worker.id}
                    worker={worker}
                    onSelect={(w) => setSelectedWorkerForReview(w)}
                    onQuickApprove={(w, e) => {
                      e.stopPropagation();
                      onApproveWorker(w);
                      loadSupervisorSummary();
                    }}
                    onQuickReject={(w, e) => {
                      e.stopPropagation();
                      setSelectedWorkerForReview(w);
                    }}
                    multiSelectMode={multiSelectMode}
                    isSelected={selectedWorkerIds.includes(worker.id)}
                    onToggleSelect={handleToggleWorkerSelect}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredWorkers.length)} of {filteredWorkers.length} workers
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="font-bold text-slate-800 px-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sticky Bulk Approve Bar */}
          {multiSelectMode && selectedWorkerIds.length > 0 && (
            <div className="fixed bottom-20 inset-x-4 max-w-md mx-auto z-40 bg-white border border-[#12A66A] rounded-[18px] p-3 shadow-xl flex items-center justify-between animate-in slide-in-from-bottom duration-150">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {selectedWorkerIds.length} workers selected
                </span>
                <span className="text-[11px] text-slate-500">Fast batch attendance approval</span>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(true)}
                className="px-4 py-2.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-[12px] text-xs font-bold shadow-md shadow-[#12A66A]/20 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Selected</span>
              </button>
            </div>
          )}

          {/* Undo Action Toast */}
          {undoAvailable && (
            <div className="fixed bottom-20 inset-x-4 max-w-md mx-auto z-40 bg-slate-900 text-white rounded-[14px] p-3 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#12A66A]" />
                <span>{undoAvailable.message}</span>
              </div>
              {onUndoLastAction && (
                <button
                  type="button"
                  onClick={onUndoLastAction}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 px-2 py-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>
              )}
            </div>
          )}

          {/* Bulk Confirm Modal */}
          {showBulkConfirmModal && (
            <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-[20px] max-w-xs w-full p-5 space-y-4 shadow-2xl border border-[#E8EEF4]">
                <div className="w-11 h-11 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-slate-900">Approve All Selected?</h4>
                  <p className="text-xs text-slate-600">
                    You are approving attendance for <strong>{selectedWorkerIds.length} workers</strong>.
                    Their shifts will be marked verified for payroll.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkConfirmModal(false)}
                    className="flex-1 py-2.5 rounded-[12px] border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkApprove}
                    className="flex-1 py-2.5 rounded-[12px] bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold shadow-md shadow-[#12A66A]/20 transition-colors"
                  >
                    Confirm Approval
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Worker Review Bottom Sheet */}
          <ReviewSheet
            worker={selectedWorkerForReview}
            isOpen={Boolean(selectedWorkerForReview)}
            onClose={() => setSelectedWorkerForReview(null)}
            onApprove={(w) => {
              onApproveWorker(w);
              setSelectedWorkerForReview(null);
              loadSupervisorSummary();
            }}
            onReject={(w, reason) => {
              onRejectWorker(w, reason);
              setSelectedWorkerForReview(null);
              loadSupervisorSummary();
            }}
            onClockOutWorker={onClockOutWorker}
          />
        </div>
      )}

      {/* ── SECTION 2: MISSING ATTENDANCE REVIEW ───────────────────────────── */}
      {section === 'missing-attendance' && (
        <MissingClockInManager
          cases={missingCases}
          isLoading={isLoadingMissing}
          onRefresh={() => {
            loadMissingClockIns();
            loadSupervisorSummary();
          }}
          selectedDate={todayStr}
        />
      )}

      {/* ── SECTION 3: ATTENDANCE OVERRIDES ─────────────────────────────────── */}
      {section === 'attendance-overrides' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Supervisor Override Form */}
            <div className="lg:col-span-1 bg-white border border-[#E8EEF4] rounded-[20px] p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-slate-700" />
                  Supervisor Override
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct current-month attendance adjustments with audit tracking.
                </p>
              </div>

              <form onSubmit={handleSubmitOverride} className="space-y-3.5 text-xs">
                {/* Worker selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Select Worker <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={overrideWorkerId}
                    onChange={(e) => setOverrideWorkerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#12A66A]"
                  >
                    {workers.map((w) => (
                      <option key={w.workerId || w.id} value={w.workerId || w.id}>
                        {w.name} ({w.employeeCode || w.workerId.slice(0, 6)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Attendance Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={overrideDate}
                    max={todayStr}
                    min={`${currentMonthStr}-01`}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#12A66A]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Limited strictly to current calendar month ({currentMonthStr}).
                  </span>
                </div>

                {/* Live Existing Session Preview */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Current Record for this Date
                  </span>
                  {overrideExistingSession ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">
                        {overrideExistingSession.clockInTime ? `In: ${overrideExistingSession.clockInTime}` : 'No Clock-In'}
                      </span>
                      <StatusBadge status={overrideExistingSession.status} />
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">No active punch session recorded</span>
                  )}
                </div>

                {/* New Status */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Override Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#12A66A]"
                  >
                    <option value="APPROVED">APPROVED (Verified)</option>
                    <option value="REJECTED">REJECTED (Declined)</option>
                    <option value="PENDING">PENDING (Review Needed)</option>
                  </select>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Clock In Time</label>
                    <input
                      type="datetime-local"
                      value={overrideClockIn}
                      onChange={(e) => setOverrideClockIn(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 text-slate-800 text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Clock Out Time</label>
                    <input
                      type="datetime-local"
                      value={overrideClockOut}
                      onChange={(e) => setOverrideClockOut(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 text-slate-800 text-[11px]"
                    />
                  </div>
                </div>

                {/* Mandatory Reason */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mandatory Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                    placeholder="State reason for supervisor override (min. 5 characters)..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-[#12A66A]"
                  />
                </div>

                {/* Optional Remarks */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Supervisor Remarks</label>
                  <input
                    type="text"
                    value={overrideRemarks}
                    onChange={(e) => setOverrideRemarks(e.target.value)}
                    placeholder="Internal note for payroll auditor..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-[#12A66A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingOverride || overrideReason.trim().length < 5}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmittingOverride ? 'Applying Override...' : 'Apply Attendance Override'}
                </button>
              </form>
            </div>

            {/* Right: Overrides Audit Table */}
            <div className="lg:col-span-2 bg-white border border-[#E8EEF4] rounded-[20px] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Recent Supervisor Overrides</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Traceable audit log of supervisor interventions.</p>
                </div>
                <button
                  type="button"
                  onClick={loadRecentOverrides}
                  disabled={isLoadingOverrides}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOverrides ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {isLoadingOverrides ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading overrides log...</div>
              ) : overridesList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                  No overrides recorded yet for this supervisor scope.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Worker</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Supervisor</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {overridesList.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3 font-semibold text-slate-900">{item.workDate}</td>
                          <td className="py-3 px-3 font-medium">{item.workerName || 'Worker'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                              {item.newStatus || item.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-[180px] truncate" title={item.reason}>
                            "{item.reason}"
                          </td>
                          <td className="py-3 px-3 text-slate-500">{item.supervisorName || 'Supervisor'}</td>
                          <td className="py-3 px-3 text-[11px] text-slate-400 font-mono">
                            {new Date(item.overriddenAt || item.createdAt || Date.now()).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: ATTENDANCE HISTORY (Range-Based Selection via Shadcn Calendar UI) ── */}
      {section === 'attendance-history' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#12A66A]" />
                  Attendance History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a date range using the calendar to inspect historical attendance and missing clock-in flags.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportHistoryCsv}
                  disabled={historyRecords.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Export records to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={loadAttendanceHistory}
                  disabled={isLoadingHistory}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin text-[#12A66A]' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filter controls with Shadcn Calendar Date-Range Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              {/* Range Picker using Shadcn Calendar UI */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Date Range (Shadcn Calendar)
                </label>
                <DateRangePicker
                  startDate={historyRange.startDate}
                  endDate={historyRange.endDate}
                  maxDate={todayStr}
                  onChange={(newRange) => {
                    setHistoryRange(newRange);
                  }}
                  className="w-full"
                />
              </div>

              {/* Worker Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Worker Filter</label>
                <select
                  value={historyWorkerFilter}
                  onChange={(e) => setHistoryWorkerFilter(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#12A66A]"
                >
                  <option value="ALL">All Assigned Workers</option>
                  {workers.map((w) => (
                    <option key={w.workerId || w.id} value={w.workerId || w.id}>
                      {w.name} ({w.employeeCode || w.workerId.slice(0, 6)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Status Filter</label>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#12A66A]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="EXCUSED_ABSENCE">EXCUSED ABSENCE</option>
                </select>
              </div>

              {/* Search input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Search Keyword</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search name, empId, site..."
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#12A66A]"
                  />
                </div>
              </div>
            </div>

            {/* Range Statistics Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                Total Records: <strong>{historyRecords.length}</strong>
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100">
                Approved: <strong>{historyRecords.filter((r) => r.status === 'APPROVED').length}</strong>
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-100">
                Flagged from Missing Review: <strong>{historyRecords.filter((r) => Boolean(r.flag)).length}</strong>
              </span>
            </div>

            {/* ATTENDANCE HISTORY TABLE WITH EXACT REQUESTED COLUMNS:
                { datet, worker name with empId, clock-in, clock-out, site, status, flag } */}
            {isLoadingHistory ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading historical attendance records...</div>
            ) : historyRecords.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 space-y-1">
                <History className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                <p className="font-bold text-slate-800">No Attendance Records Found</p>
                <p className="text-slate-500">
                  No attendance records found between {historyRange.startDate} and {historyRange.endDate} matching your filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5">Date</th>
                      <th className="py-3 px-3.5">Worker Name & Emp ID</th>
                      <th className="py-3 px-3.5">Clock-In</th>
                      <th className="py-3 px-3.5">Clock-Out</th>
                      <th className="py-3 px-3.5">Site</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">Flag (Missing Review)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {historyRecords.map((item) => {
                      const flag = item.flag;
                      const hasFlag = Boolean(flag);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Date */}
                          <td className="py-3.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                            {item.date}
                          </td>

                          {/* 2. Worker Name with EmpId */}
                          <td className="py-3.5 px-3.5">
                            <span className="font-bold text-slate-900 block">{item.workerName}</span>
                            <span className="text-[11px] font-mono text-slate-500">{item.employeeCode}</span>
                          </td>

                          {/* 3. Clock-In */}
                          <td className="py-3.5 px-3.5 font-mono text-slate-800 whitespace-nowrap">
                            {formatPunchTime(item.clockInTime)}
                          </td>

                          {/* 4. Clock-Out */}
                          <td className="py-3.5 px-3.5 font-mono text-slate-800 whitespace-nowrap">
                            {formatPunchTime(item.clockOutTime)}
                          </td>

                          {/* 5. Site */}
                          <td className="py-3.5 px-3.5 text-slate-700">
                            <span className="font-medium">{item.worksiteName}</span>
                            {item.worksiteCode && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {item.worksiteCode}
                              </span>
                            )}
                          </td>

                          {/* 6. Status */}
                          <td className="py-3.5 px-3.5">
                            <StatusBadge status={item.status} />
                          </td>

                          {/* 7. Flag (from missing clock-ins flag review) */}
                          <td className="py-3.5 px-3.5">
                            {hasFlag ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase border">
                                  {flag.status === 'APPROVED' ? (
                                    <span className="bg-emerald-50 text-emerald-800 border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Flag className="w-3 h-3 text-emerald-600" />
                                      Delay Excused
                                    </span>
                                  ) : flag.status === 'REJECTED' ? (
                                    <span className="bg-rose-50 text-rose-800 border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Flag className="w-3 h-3 text-rose-600" />
                                      Unexcused Absence
                                    </span>
                                  ) : (
                                    <span className="bg-amber-50 text-amber-800 border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Flag className="w-3 h-3 text-amber-600" />
                                      Review Pending
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[11px] text-slate-600 font-medium">
                                  {flag.reason}
                                </span>
                                {flag.note && (
                                  <span className="block text-[10px] text-slate-400 italic">
                                    "{flag.note}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 5: MY ATTENDANCE & PERSONAL CLOCK-IN ────────────────────── */}
      {section === 'my-attendance' && (
        <SupervisorPersonalAttendance
          currentWorksite={
            currentWorksite || {
              id: 'ws_default',
              name: 'Assigned Worksite',
              code: 'SITE',
              address: 'Deployment Location',
              radiusMeters: 30,
            }
          }
        />
      )}
    </div>
  );
};

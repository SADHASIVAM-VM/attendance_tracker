import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  SupervisorWorkerAttendance,
  SupervisorWorksite,
  SupervisorAttendanceStatistics,
  MissingClockInCase,
} from '../../types/supervisor';
import { WorkerRow } from '../../components/supervisor/WorkerRow';
import { StatusPill } from '../../components/supervisor/StatusPill';
import { ReviewSheet } from '../../components/supervisor/ReviewSheet';
import { SupervisorPersonalAttendance } from '../../components/supervisor/SupervisorPersonalAttendance';
import { MissingClockInManager } from '../../components/supervisor/MissingClockInManager';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DateRangePicker, DateRange } from '../../components/ui/date-range-picker';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
import { apiRequest } from '../../lib/api';

import {
  ClockIcon,
  CheckCircleIcon,
  CalenderIcon,
  SearchIcon,
  Building1Icon,
  GroupIcon,
  EditProfileIcon,
  ErrorProfileIcon,
  CloseCircleIcon,
  CloseIcon,
  CheckIcon,
  LocationIcon,
  Filter1Icon,
  RotateCwIcon,
  RotateCcwIcon,
  TransactionHistoryIcon,
  ShieldIcon,
  SecuritySafeIcon,
  Download1Icon,
  EyeIcon,
  Profile2Icon,
  HelpCircleIcon,
} from '@astraicons/react/linear';

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

  const navigate = useNavigate();
  const location = useLocation();

  // Derive active attendance sub-section from the current route URL or initialSection
  const section: SupervisorSection = useMemo(() => {
    if (initialSection) {
      return initialSection as SupervisorSection;
    }
    const p = location.pathname.toLowerCase();
    if (p.includes('/my-attendance')) return 'my-attendance';
    if (p.includes('/missing')) return 'missing-attendance';
    if (p.includes('/overrides')) return 'attendance-overrides';
    if (p.includes('/history')) return 'attendance-history';
    return 'today-attendance';
  }, [location.pathname, initialSection]);

  const handleSectionClick = (sec: SupervisorSection) => {
    switch (sec) {
      case 'missing-attendance':
        navigate('/supervisor/attendance/missing');
        break;
      case 'attendance-overrides':
        navigate('/supervisor/attendance/overrides');
        break;
      case 'attendance-history':
        navigate('/supervisor/attendance/history');
        break;
      case 'my-attendance':
        navigate('/supervisor/my-attendance');
        break;
      case 'today-attendance':
      default:
        navigate('/supervisor/attendance/daily');
        break;
    }
  };

  // Missing clock-in state
  const [missingCases, setMissingCases] = useState<MissingClockInCase[]>([]);
  const [isLoadingMissing, setIsLoadingMissing] = useState<boolean>(false);

  // Live Summary Stats from GET /attendance/supervisor/summary
  const [summaryStats, setSummaryStats] = useState<SupervisorAttendanceStatistics | null>(null);

  // Today Attendance Card Filter ('TOTAL' means all assigned workers)
  const [activeCardFilter, setActiveCardFilter] = useState<CardFilterType>('TOTAL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [overridesPage, setOverridesPage] = useState<number>(1);
  const [overridesLimit, setOverridesLimit] = useState<number>(10);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyLimit, setHistoryLimit] = useState<number>(10);

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

  // Check if attendance record exists for the selected worker on overrideDate
  const [sessionCheckState, setSessionCheckState] = useState<{
    isLoading: boolean;
    sessionExists: boolean | null;
    sessionData: any | null;
  }>({ isLoading: false, sessionExists: null, sessionData: null });

  useEffect(() => {
    let isCancelled = false;
    if (!overrideWorkerId || !overrideDate) {
      setSessionCheckState({ isLoading: false, sessionExists: null, sessionData: null });
      return;
    }

    // If date matches todayStr and workers list is loaded, evaluate directly
    if (overrideDate === todayStr && workers.length > 0) {
      const match = workers.find((w) => w.workerId === overrideWorkerId || w.id === overrideWorkerId);
      const hasRecord = Boolean(match && match.clockInTime);
      setSessionCheckState({
        isLoading: false,
        sessionExists: hasRecord,
        sessionData: hasRecord ? match : null,
      });
      return;
    }

    setSessionCheckState((prev) => ({ ...prev, isLoading: true }));
    apiRequest<any>(
      `/attendance/supervisor/history-range?startDate=${overrideDate}&endDate=${overrideDate}&workerId=${overrideWorkerId}`
    )
      .then((res) => {
        if (isCancelled) return;
        const records = Array.isArray(res) ? res : res?.records || [];
        const match = records.find(
          (r: any) =>
            (r.workerId === overrideWorkerId || r.userId === overrideWorkerId || r.id === overrideWorkerId) &&
            String(r.date || r.workDate).split('T')[0] === overrideDate &&
            Boolean(r.clockInTime || r.sessionId)
        );
        setSessionCheckState({
          isLoading: false,
          sessionExists: Boolean(match),
          sessionData: match || null,
        });
      })
      .catch(() => {
        if (isCancelled) return;
        setSessionCheckState({ isLoading: false, sessionExists: null, sessionData: null });
      });

    return () => {
      isCancelled = true;
    };
  }, [overrideWorkerId, overrideDate, todayStr, workers]);

  // Existing session preview for override worker + date
  const overrideExistingSession = useMemo(() => {
    if (sessionCheckState.sessionData) return sessionCheckState.sessionData;
    if (!overrideWorkerId) return null;
    return (
      workers.find(
        (w) =>
          (w.workerId === overrideWorkerId || w.id === overrideWorkerId) &&
          (!w.date || w.date === overrideDate) &&
          Boolean(w.clockInTime)
      ) || null
    );
  }, [workers, overrideWorkerId, overrideDate, sessionCheckState.sessionData]);

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
  const rejectedCount = summaryStats?.rejected ?? statistics?.rejected ?? workers.filter((w) => w.status === 'REJECTED' || w.status === 'ABSENT').length;
  const pendingCount = summaryStats?.pending ?? statistics?.pending ?? workers.filter((w) => w.status === 'PENDING').length;
  const missingCount = summaryStats?.missingClockIns ?? statistics?.missingClockIns ?? missingCases.length;
  const flaggedDatesCount = summaryStats?.flaggedDatesCount ?? statistics?.flaggedDatesCount ?? 0;

  // Filter Today's workers
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      if (activeCardFilter === 'APPROVED' && w.status !== 'APPROVED') return false;
      if (activeCardFilter === 'REJECTED' && w.status !== 'REJECTED' && w.status !== 'ABSENT') return false;
      if (activeCardFilter === 'PENDING' && w.status !== 'PENDING') return false;
      if (activeCardFilter === 'MISSING_CLOCK_IN') {
        const isMissing = !w.clockInTime && w.status !== 'ON_LEAVE' && w.status !== 'ABSENT';
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
  const isOverrideNonCurrentMonth = useMemo(() => {
    return overrideDate.substring(0, 7) !== currentMonthStr;
  }, [overrideDate, currentMonthStr]);

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

    if (isOverrideNonCurrentMonth) {
      setFlashMessage({
        text: `Supervisor overrides are strictly limited to the current calendar month (${currentMonthStr}). For other months, please use the Worker Regularisation or Admin Attendance Correction workflow.`,
        type: 'error',
      });
      return;
    }

    if (isOverrideFuture) {
      setFlashMessage({ text: 'Future attendance dates cannot be overridden.', type: 'error' });
      return;
    }

    if (sessionCheckState.sessionExists === false) {
      setFlashMessage({
        text: `No attendance record exists for this worker on ${overrideDate}. Nonexistent clock-ins cannot be silently created as normal attendance via supervisor override. Please use the Worker Regularisation or Admin Attendance Correction workflow.`,
        type: 'error',
      });
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

    const headers = ['Date', 'Worker Name', 'Employee ID', 'Clock In', 'Clock Out', 'Worksite', 'Status', 'Action By'];
    const rows = historyRecords.map((r) => [
      r.date,
      `"${(r.workerName || '').replace(/"/g, '""')}"`,
      r.employeeCode || '',
      r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString() : '',
      r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : '',
      `"${(r.worksiteName || '').replace(/"/g, '""')}"`,
      r.status || '',
      `"${(r.actionByName || r.actionBy || '—').replace(/"/g, '""')}"`,
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
          className={`p-4 rounded-2xl text-xs font-semibold border flex items-center justify-between shadow-xs transition-all ${flashMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {flashMessage.type === 'success' ? (
              <CheckCircleIcon className="w-4 h-4 text-[#01B075] shrink-0" />
            ) : (
              <CloseCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
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
      {section !== 'my-attendance' && section !== 'attendance-overrides' && section !== 'attendance-history' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1. Total Workers */}
          <button
            type="button"
            onClick={() => {
              handleSectionClick('today-attendance');
              setActiveCardFilter('TOTAL');
            }}
            className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${section === 'today-attendance' && activeCardFilter === 'TOTAL'
                ? 'bg-[#F0FDF4] border-2 border-[#12A66A] shadow-xs ring-1 ring-[#12A66A]'
                : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
              <GroupIcon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalCount}</div>
            <span className="text-[10px] text-slate-400 font-medium">Assigned Today</span>
          </button>

          {/* 2. Approved Today */}
          <button
            type="button"
            onClick={() => {
              handleSectionClick('today-attendance');
              setActiveCardFilter('APPROVED');
            }}
            className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${section === 'today-attendance' && activeCardFilter === 'APPROVED'
                ? 'bg-[#E6F7EF] border-2 border-[#12A66A] shadow-xs ring-1 ring-[#12A66A]'
                : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Approved</span>
              <CheckCircleIcon className="w-4 h-4 text-[#01B075]" />
            </div>
            <div className="text-2xl font-extrabold text-[#0E8F5B] tabular-nums">{approvedCount}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Verified Today</span>
          </button>

          {/* 3. Rejected Today */}
          <button
            type="button"
            onClick={() => {
              handleSectionClick('today-attendance');
              setActiveCardFilter('REJECTED');
            }}
            className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${section === 'today-attendance' && activeCardFilter === 'REJECTED'
                ? 'bg-rose-50 border-2 border-rose-500 shadow-xs ring-1 ring-rose-400'
                : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Rejected / Absent</span>
              <CloseCircleIcon className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-700 tabular-nums">{rejectedCount}</div>
            <span className="text-[10px] text-rose-600 font-medium">Declined / Absent Today</span>
          </button>

          {/* 4. Pending Today */}
          <button
            type="button"
            onClick={() => {
              handleSectionClick('today-attendance');
              setActiveCardFilter('PENDING');
            }}
            className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${section === 'today-attendance' && activeCardFilter === 'PENDING'
                ? 'bg-amber-50 border-2 border-amber-500 shadow-xs ring-1 ring-amber-400'
                : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending</span>
              <ClockIcon className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700 tabular-nums">{pendingCount}</div>
            <span className="text-[10px] text-amber-600 font-medium">Review Needed</span>
          </button>

          {/* 5. Missing Clock-Ins */}
          <button
            type="button"
            onClick={() => {
              handleSectionClick('missing-attendance');
            }}
            className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${section === 'missing-attendance'
                ? 'bg-amber-100/70 border-2 border-amber-600 shadow-xs ring-1 ring-amber-500'
                : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Missing In</span>
              <ErrorProfileIcon className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-800 tabular-nums">{missingCount}</div>
            <span className="text-[10px] text-amber-700 font-medium">Unclocked Shifts</span>
          </button>

          {/* 6. Flagged Attendance */}
          <button
            type="button"
            onClick={() => {
              handleSectionClick('today-attendance');
              setActiveCardFilter('FLAGGED');
            }}
            className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${section === 'today-attendance' && activeCardFilter === 'FLAGGED'
                ? 'bg-purple-50 border-2 border-purple-600 shadow-xs ring-1 ring-purple-500'
                : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">Flagged</span>
              <ShieldIcon className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-purple-700 tabular-nums">{flaggedDatesCount}</div>
            <span className="text-[10px] text-purple-600 font-medium">Exceptions Reviewed</span>
          </button>
        </div>
      )}

      {/* ── COMBINED DAILY ATTENDANCE (TODAY & MISSING) SEGMENTED SWITCHER ───────────────────────────── */}
      {(section === 'today-attendance' || section === 'missing-attendance') && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-[#E8EEF4] rounded-[20px] p-3 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => handleSectionClick('today-attendance')}
              className={`cursor-pointer whitespace-nowrap transition-all ${section === 'today-attendance'
                  ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
                  : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
                }`}
            >
              <GroupIcon className={`w-3.5 h-3.5 ${section === 'today-attendance' ? 'text-[#01B075]' : 'text-[#8C90A0]'}`} />
              <span>Today's Attendance</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${section === 'today-attendance' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
                  }`}
              >
                {totalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSectionClick('missing-attendance')}
              className={`cursor-pointer whitespace-nowrap transition-all ${section === 'missing-attendance'
                  ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
                  : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
                }`}
            >
              <ErrorProfileIcon className={`w-3.5 h-3.5 ${section === 'missing-attendance' ? 'text-amber-400' : 'text-[#8C90A0]'}`} />
              <span>Missing Attendance</span>
              {missingCases.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${section === 'missing-attendance' ? 'bg-amber-400/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                    }`}
                >
                  {missingCases.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-[#8C90A0] px-3 font-medium hidden sm:block">
            {section === 'today-attendance' ? "Live today's worker shift records" : 'Missing punch flags & grace review'}
          </div>
        </div>
      )}

      {/* ── SECTION 1: TODAY'S ATTENDANCE ALONE ─────────────────────────────── */}
      {section === 'today-attendance' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Header indicator: Shows today's attendance alone (locked to todayStr) */}
          <div className="bg-white border border-[#E8EEF4] rounded-[18px] p-3 sm:px-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#E6F7EF] text-[#12A66A]">
                <CalenderIcon className="w-4 h-4 text-[#01B075]" />
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${multiSelectMode
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
              <SearchIcon className="w-4 h-4 text-[#8C90A0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search worker by name, employee code, role..."
                className="w-full pl-10 pr-9 py-2 text-xs bg-white border border-[#E8EEF4] rounded-full text-[#1E1F24] placeholder-[#8C90A0] focus:outline-none focus:border-[#01B075] focus:ring-1 focus:ring-[#01B075] shadow-2xs transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold"
                  title="Clear search"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setActiveCardFilter(activeCardFilter === 'PENDING' ? 'TOTAL' : 'PENDING')
                }
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${activeCardFilter === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
              >
                <ClockIcon className="w-3.5 h-3.5" />
                <span>Pending Reviews ({pendingCount})</span>
              </button>
            )}
          </div>

          {/* Active Filter Banner */}
          {(activeCardFilter !== 'TOTAL' || searchQuery) && (
            <div className="p-2.5 px-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-600 animate-in fade-in duration-100">
              <div className="flex items-center gap-2">
                <Filter1Icon className="w-3.5 h-3.5 text-[#01B075]" />
                <span>
                  Filtered by:{' '}
                  <strong className="text-slate-900">
                    {activeCardFilter === 'APPROVED'
                      ? 'Approved'
                      : activeCardFilter === 'REJECTED'
                        ? 'Rejected / Absent'
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
                  <RotateCcwIcon className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ) : workers.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <GroupIcon className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">No Workers Assigned Today</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No workers were scheduled or assigned to {currentWorksite?.name || 'this worksite'} for today.
              </p>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-10 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
              <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Filter1Icon className="w-5 h-5" />
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
              <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <tr>
                        {multiSelectMode && (
                          <th className="py-3 px-4 w-10">
                            <button
                              type="button"
                              onClick={() => {
                                const allCurrentIds = paginatedWorkers.map((w) => w.id);
                                const allSelected = allCurrentIds.every((id) => selectedWorkerIds.includes(id));
                                if (allSelected) {
                                  setSelectedWorkerIds(selectedWorkerIds.filter((id) => !allCurrentIds.includes(id)));
                                } else {
                                  setSelectedWorkerIds(Array.from(new Set([...selectedWorkerIds, ...allCurrentIds])));
                                }
                              }}
                              className="text-[#12A66A] p-1 transition-transform active:scale-90"
                              title={
                                paginatedWorkers.every((w) => selectedWorkerIds.includes(w.id))
                                  ? 'Deselect all on this page'
                                  : 'Select all on this page'
                              }
                            >
                              {paginatedWorkers.length > 0 &&
                                paginatedWorkers.every((w) => selectedWorkerIds.includes(w.id)) ? (
                                <CheckSquare className="w-4 h-4 fill-[#12A66A] text-white" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                          </th>
                        )}
                        <th className="py-3 px-4">Worker</th>
                        <th className="py-3 px-4">Clock In / Out</th>
                        <th className="py-3 px-4">Worksite</th>
                        <th className="py-3 px-4">Notes / Reason</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedWorkers.map((worker) => {
                        const isSelected = selectedWorkerIds.includes(worker.id);
                        const isPending = worker.status === 'PENDING';
                        return (
                          <tr
                            key={worker.id}
                            onClick={() => {
                              if (multiSelectMode) {
                                handleToggleWorkerSelect(worker);
                              } else {
                                setSelectedWorkerForReview(worker);
                              }
                            }}
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-50/40' : ''
                              }`}
                          >
                            {/* Checkbox column */}
                            {multiSelectMode && (
                              <td className="py-3 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWorkerSelect(worker)}
                                  className="text-[#12A66A] p-1 transition-transform active:scale-90"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 fill-[#12A66A] text-white" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300" />
                                  )}
                                </button>
                              </td>
                            )}

                            {/* Worker */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                  <img
                                    src={worker.avatar}
                                    alt={worker.name}
                                    className="w-9 h-9 rounded-xl object-cover border border-[#E8EEF4]"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        worker.name || 'Worker'
                                      )}&background=0D8ABC&color=fff`;
                                    }}
                                  />
                                  {worker.inPhotoUrl && (
                                    <div
                                      title="Verified Selfie Attached"
                                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#12A66A] border-2 border-white flex items-center justify-center text-[7px] text-white font-bold"
                                    >
                                      ✓
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 block leading-tight">{worker.name}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {worker.employeeCode && (
                                      <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200/60">
                                        {worker.employeeCode}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {worker.role || 'Worker'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Clock In / Out */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-xs font-semibold tabular-nums text-slate-800">
                                  <Clock className="w-3.5 h-3.5 text-[#12A66A]" />
                                  <span>{worker.clockInTime ? worker.clockInTime : 'Not clocked in'}</span>
                                  {worker.clockOutTime && <span className="text-slate-400 font-normal"> – {worker.clockOutTime}</span>}
                                </div>
                                {worker.clockInTime && (
                                  <div
                                    className={`flex items-center gap-0.5 text-[10px] font-semibold ${worker.isWithinRadius ? 'text-emerald-700' : 'text-rose-600'
                                      }`}
                                  >
                                    <LocationIcon className="w-2.5 h-2.5" />
                                    <span>
                                      {worker.distanceMeters}m {worker.isWithinRadius ? 'on site' : 'outside perimeter'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Worksite */}
                            <td className="py-3 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Building1Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{worker.worksiteName || currentWorksite?.name || '—'}</span>
                              </div>
                            </td>

                            {/* Notes / Reason */}
                            <td className="py-3 px-4 max-w-xs text-xs">
                              {worker.rejectionReason || worker.flagReason || (worker.note && !['Not yet clocked in', 'Not yet in', 'Scheduled on shift roster'].includes(worker.note)) ? (
                                <span className="text-slate-700 block truncate" title={worker.rejectionReason || worker.flagReason || worker.note || ''}>
                                  {worker.rejectionReason ? `Reason: ${worker.rejectionReason}` : (worker.flagReason || worker.note)}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <StatusPill status={worker.status} size="sm" />
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending && !multiSelectMode ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onApproveWorker(worker);
                                        loadSupervisorSummary();
                                      }}
                                      title="Approve"
                                      aria-label="Approve"
                                      className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    >
                                      <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWorkerForReview(worker);
                                      }}
                                      title="Reject / Mark Absent"
                                      aria-label="Reject"
                                      className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    >
                                      <CloseIcon className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWorkerForReview(worker);
                                      }}
                                      title="Review Details"
                                      aria-label="Review"
                                      className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    >
                                      <EyeIcon className="w-4 h-4 text-slate-500" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedWorkerForReview(worker)}
                                    title="View Details"
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    <EyeIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Controls */}
              {filteredWorkers.length > 0 && (
                <div className="pt-2">
                  <DataTablePagination
                    metadata={{
                      total: filteredWorkers.length,
                      page: currentPage,
                      limit: pageSize,
                      offset: (currentPage - 1) * pageSize,
                      totalPages: Math.ceil(filteredWorkers.length / pageSize),
                    }}
                    onPageChange={(p) => setCurrentPage(p)}
                    onLimitChange={(l) => {
                      setPageSize(l);
                      setCurrentPage(1);
                    }}
                    pageSizeOptions={[10, 25, 50]}
                  />
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
                <CheckCircleIcon className="w-4 h-4" />
                <span>Approve Selected</span>
              </button>
            </div>
          )}

          {/* Undo Action Toast */}
          {undoAvailable && (
            <div className="fixed bottom-20 inset-x-4 max-w-md mx-auto z-40 bg-slate-900 text-white rounded-[14px] p-3 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircleIcon className="w-4 h-4 text-[#01B075]" />
                <span>{undoAvailable.message}</span>
              </div>
              {onUndoLastAction && (
                <button
                  type="button"
                  onClick={onUndoLastAction}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 px-2 py-1 cursor-pointer"
                >
                  <RotateCcwIcon className="w-3 h-3" />
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
                  <CheckCircleIcon className="w-6 h-6" />
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
                  {sessionCheckState.isLoading ? (
                    <span className="text-slate-400 text-[11px] italic">Checking attendance record...</span>
                  ) : overrideExistingSession ? (
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

                {/* Nonexistent Attendance Session Banner */}
                {sessionCheckState.sessionExists === false && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-start gap-2">
                      <ErrorProfileIcon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900 leading-relaxed">
                        <p className="font-bold text-amber-950 m-0">No Attendance Record</p>
                        <p className="mt-1 text-[11px] text-amber-800 m-0">
                          No attendance record exists for this worker on {overrideDate}. Nonexistent clock-ins cannot be silently created as normal attendance via supervisor override. Please use the Worker Regularisation or Admin Attendance Correction workflow.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={() => navigate('/supervisor/regularizations')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Worker Regularisation
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/supervisor/attendance-exceptions')}
                        className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Attendance Exceptions
                      </button>
                    </div>
                  </div>
                )}

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
                  disabled={
                    isSubmittingOverride ||
                    overrideReason.trim().length < 5 ||
                    sessionCheckState.sessionExists === false ||
                    isOverrideNonCurrentMonth ||
                    isOverrideFuture
                  }
                  className="w-full py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmittingOverride
                    ? 'Applying Override...'
                    : sessionCheckState.sessionExists === false
                      ? 'Override Blocked - No Attendance Record'
                      : isOverrideNonCurrentMonth
                        ? 'Current Month Only'
                        : 'Apply Attendance Override'}
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
                      {overridesList
                        .slice((overridesPage - 1) * overridesLimit, overridesPage * overridesLimit)
                        .map((item, idx) => (
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
                  <DataTablePagination
                    metadata={{
                      total: overridesList.length,
                      page: overridesPage,
                      limit: overridesLimit,
                      offset: (overridesPage - 1) * overridesLimit,
                      totalPages: Math.ceil(overridesList.length / overridesLimit),
                    }}
                    onPageChange={(p) => setOverridesPage(p)}
                    onLimitChange={(l) => {
                      setOverridesLimit(l);
                      setOverridesPage(1);
                    }}
                    pageSizeOptions={[10, 25, 50]}
                    isLoading={isLoadingOverrides}
                  />
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
                  <TransactionHistoryIcon className="w-5 h-5 text-[#01B075]" />
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
                  <Download1Icon className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={loadAttendanceHistory}
                  disabled={isLoadingHistory}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCwIcon className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin text-[#01B075]' : ''}`} />
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
                <TransactionHistoryIcon className="w-8 h-8 text-slate-400 mx-auto mb-1" />
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
                      <th className="py-3 px-3.5">Action By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {historyRecords
                      .slice((historyPage - 1) * historyLimit, historyPage * historyLimit)
                      .map((item) => {
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

                            {/* 7. Action By */}
                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              {item.actionByName && item.actionByName !== '—' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 uppercase">
                                    {item.actionByName.charAt(0)}
                                  </div>
                                  <span className="font-medium text-slate-800 text-xs">
                                    {item.actionByName}
                                  </span>
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
                <DataTablePagination
                  metadata={{
                    total: historyRecords.length,
                    page: historyPage,
                    limit: historyLimit,
                    offset: (historyPage - 1) * historyLimit,
                    totalPages: Math.ceil(historyRecords.length / historyLimit),
                  }}
                  onPageChange={(p) => setHistoryPage(p)}
                  onLimitChange={(l) => {
                    setHistoryLimit(l);
                    setHistoryPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                  isLoading={isLoadingHistory}
                />
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

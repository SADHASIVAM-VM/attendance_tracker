import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Filter,
  Search,
  RefreshCw,
  LogOut,
  Flag,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  Building2,
  Briefcase,
  AlertCircle,
  X,
  Check,
  ExternalLink,
  Sliders,
  ShieldAlert,
  Info,
  UserX,
  FileEdit,
} from 'lucide-react';
import { SupervisorAttendanceAuditView } from './SupervisorAttendanceAuditView';
import { ExcelExportModal } from '../../components/admin/ExcelExportModal';
import { useNavigate } from 'react-router-dom';

export interface DailyWorker {
  id: string;
  sessionId: string | null;
  workerId: string;
  name: string;
  employeeCode: string;
  email: string;
  phone: string;
  avatar: string;
  roles: string[];
  role: string;
  employmentType: string;
  isActive: boolean;
  worksiteId: string | null;
  worksiteName: string;
  worksiteCode: string;
  worksiteAddress?: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  status: 'NOT_YET_IN' | 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ON_LEAVE' | 'ABSENT';
  sessionStatus: string | null;
  totalHours: number;
  distanceMeters: number;
  isWithinGeofence: boolean;
  isLocationBypassed: boolean;
  latitude: number | null;
  longitude: number | null;
  inPhotoUrl: string | null;
  outPhotoUrl: string | null;
  flagId: string | null;
  flagStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | null;
  flagReason: string | null;
  flagNote: string | null;
  leaveId: string | null;
  leaveType: string | null;
  rejectionReason: string | null;
}

export interface MissingCase {
  id: string;
  assignmentId?: string;
  workerId: string;
  workerName: string;
  employeeCode?: string;
  workerRole?: string;
  avatar?: string;
  worksiteId: string;
  worksiteName: string;
  workDate?: string;
  shiftName: string;
  shiftStartTime: string;
  gracePeriodExpiresAt?: string;
  timeElapsedFormatted?: string;
  flagStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  note?: string | null;
  resolvedByClockIn?: boolean;
  isYesterday?: boolean;
  resolvedAt?: string | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
}

export const AdminDailyAttendanceView: React.FC = () => {
  const navigate = useNavigate();

  // Active Tab: 'daily' (Daily Attendance) | 'missing' (Missing Clock-ins) | 'supervisors' (Supervisor Audit)
  const [activeTab, setActiveTab] = useState<'daily' | 'missing' | 'supervisors'>('daily');

  // Excel Modal
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Data state
  const [workers, setWorkers] = useState<DailyWorker[]>([]);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalWorkers: 0,
    clockedIn: 0,
    clockedOut: 0,
    absent: 0,
    notYetIn: 0,
    onLeave: 0,
    flaggedCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Missing Clock-in cases for tab 2
  const [missingCases, setMissingCases] = useState<MissingCase[]>([]);
  const [loadingMissing, setLoadingMissing] = useState<boolean>(false);
  const [missingFilter, setMissingFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED'>('ALL');

  // Filters
  const [worksiteFilter, setWorksiteFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination for Daily Attendance table
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Pagination for Missing Clock-Ins table
  const [missingPage, setMissingPage] = useState<number>(1);
  const [missingLimit, setMissingLimit] = useState<number>(10);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  // 1. Clock-Out Modal
  const [clockOutTarget, setClockOutTarget] = useState<DailyWorker | null>(null);
  const [clockOutReason, setClockOutReason] = useState<string>('Admin Assisted Clock-Out');
  const [customClockOutReason, setCustomClockOutReason] = useState<string>('');
  const [clockOutNote, setClockOutNote] = useState<string>('');
  const [isSubmittingClockOut, setIsSubmittingClockOut] = useState<boolean>(false);

  // 2. Missing Clock-In Flag Modal
  const [flagTarget, setFlagTarget] = useState<{
    workerId: string;
    workerName: string;
    employeeCode?: string;
    role?: string;
    worksiteName?: string;
    flagId?: string | null;
    currentStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | null;
    currentReason?: string | null;
    currentNote?: string | null;
  } | null>(null);
  const [flagStatusChoice, setFlagStatusChoice] = useState<'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'>('APPROVED');
  const [flagReasonChoice, setFlagReasonChoice] = useState<string>('Transit / Traffic Delay');
  const [customFlagReason, setCustomFlagReason] = useState<string>('');
  const [flagNoteInput, setFlagNoteInput] = useState<string>('');
  const [isSubmittingFlag, setIsSubmittingFlag] = useState<boolean>(false);

  // 3. Photo Preview Modal
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Show Toast helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Load Daily Attendance
  const loadDailyAttendance = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      const params = new URLSearchParams();
      params.append('date', selectedDate);
      if (worksiteFilter !== 'ALL') params.append('worksiteId', worksiteFilter);
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiRequest<any>(`/attendance/admin/daily?${params.toString()}`);
      if (res && res.workers) {
        setWorkers(res.workers);
        if (res.stats) setStats(res.stats);
        if (res.worksites) setWorksites(res.worksites);
      }
    } catch (err: any) {
      console.error('Failed to load admin daily attendance:', err);
      showToast(err?.message || 'Failed to load daily attendance data', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate, worksiteFilter, roleFilter, statusFilter, searchQuery]);

  // Load Missing Clock-in cases
  const loadMissingCases = useCallback(async () => {
    try {
      setLoadingMissing(true);
      const res = await apiRequest<any>(`/attendance/missing-clock-ins?date=${selectedDate}`);
      if (res && Array.isArray(res.cases)) {
        setMissingCases(res.cases);
      } else {
        setMissingCases([]);
      }
    } catch (err: any) {
      console.error('Failed to load missing clock-in cases:', err);
    } finally {
      setLoadingMissing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDailyAttendance();
  }, [loadDailyAttendance]);

  useEffect(() => {
    if (activeTab === 'missing') {
      loadMissingCases();
    }
  }, [activeTab, loadMissingCases]);

  // Handle Date Stepping
  const handleDateShift = (deltaDays: number) => {
    const parts = selectedDate.split('-');
    const curr = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    curr.setDate(curr.getDate() + deltaDays);
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const dt = String(curr.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${dt}`);
    setPage(1);
  };

  // Format Display Date
  const displayDateText = useMemo(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const isToday = selectedDate === todayStr;
    const dateFormatted = d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return isToday ? `Today • ${dateFormatted}` : dateFormatted;
  }, [selectedDate, todayStr]);

  // -------------------------------------------------------------
  // CLOCK-OUT SUBMISSION
  // -------------------------------------------------------------
  const handleOpenClockOutModal = (w: DailyWorker) => {
    setClockOutTarget(w);
    setClockOutReason('Admin Assisted Clock-Out');
    setCustomClockOutReason('');
    setClockOutNote('');
  };

  const handleConfirmClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockOutTarget) return;

    const finalReason = clockOutReason === 'Other' ? customClockOutReason.trim() : clockOutReason.trim();
    if (!finalReason || finalReason.length < 3) {
      alert('A valid reason of at least 3 characters is required to clock out this worker.');
      return;
    }

    try {
      setIsSubmittingClockOut(true);
      const targetIdentifier = clockOutTarget.sessionId || clockOutTarget.workerId;
      await apiRequest(`/attendance/${targetIdentifier}/supervisor-clock-out`, {
        method: 'POST',
        body: JSON.stringify({
          reason: finalReason,
          note: clockOutNote.trim() || undefined,
        }),
      });

      showToast(`Successfully clocked out ${clockOutTarget.name}`);
      setClockOutTarget(null);
      loadDailyAttendance(true);
    } catch (err: any) {
      console.error('Clock out error:', err);
      alert(err?.message || 'Failed to record clock-out');
    } finally {
      setIsSubmittingClockOut(false);
    }
  };

  // -------------------------------------------------------------
  // MISSING CLOCK-IN FLAG SUBMISSION
  // -------------------------------------------------------------
  const handleOpenFlagModal = (
    data: {
      workerId: string;
      workerName: string;
      employeeCode?: string;
      role?: string;
      worksiteName?: string;
      flagId?: string | null;
      currentStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | null;
      currentReason?: string | null;
      currentNote?: string | null;
    },
    initialChoice?: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW'
  ) => {
    setFlagTarget(data);
    setFlagStatusChoice(initialChoice || data.currentStatus || 'APPROVED');
    setFlagReasonChoice(
      data.currentReason || (initialChoice === 'REJECTED' ? 'Unexcused Absence' : 'Transit / Traffic Delay')
    );
    setCustomFlagReason('');
    setFlagNoteInput(data.currentNote || '');
  };

  const handleConfirmFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagTarget) return;

    const finalReason = flagReasonChoice === 'Other' ? customFlagReason.trim() : flagReasonChoice.trim();
    if (!finalReason || finalReason.length < 3) {
      alert('A meaningful reason of at least 3 characters is mandatory for recording an attendance flag.');
      return;
    }

    try {
      setIsSubmittingFlag(true);

      if (flagTarget.flagId) {
        // Update existing flag
        await apiRequest(`/attendance/missing-clock-ins/${flagTarget.flagId}/flag`, {
          method: 'POST',
          body: JSON.stringify({
            status: flagStatusChoice,
            flagStatus: flagStatusChoice,
            decision: flagStatusChoice === 'APPROVED' ? 'PRESENT' : flagStatusChoice === 'REJECTED' ? 'ABSENT' : 'PENDING',
            action: flagStatusChoice === 'APPROVED' ? 'MARK_PRESENT' : flagStatusChoice === 'REJECTED' ? 'MARK_ABSENT' : 'KEEP_PENDING',
            reason: finalReason,
            note: flagNoteInput.trim() || undefined,
          }),
        });
      } else {
        // Create new flag for worker on selectedDate
        await apiRequest(`/attendance/missing-clock-ins/flag-worker`, {
          method: 'POST',
          body: JSON.stringify({
            workerId: flagTarget.workerId,
            workDate: selectedDate,
            flagStatus: flagStatusChoice,
            reason: finalReason,
            note: flagNoteInput.trim() || undefined,
          }),
        });
      }

      showToast(`Attendance flag updated for ${flagTarget.workerName}`);
      setFlagTarget(null);
      loadDailyAttendance(true);
      if (activeTab === 'missing') {
        loadMissingCases();
      }
    } catch (err: any) {
      console.error('Flag submit error:', err);
      alert(err?.message || 'Failed to submit missing clock-in flag');
    } finally {
      setIsSubmittingFlag(false);
    }
  };

  // Filter cases to strictly ONLY today's missing date
  const todayOnlyMissingCases = useMemo(() => {
    return missingCases.filter((c) => {
      if (c.isYesterday) return false;
      if (c.workDate) {
        const wDate = c.workDate.split('T')[0];
        if (selectedDate && wDate !== selectedDate) return false;
      }
      return true;
    });
  }, [missingCases, selectedDate]);

  // Filtered Missing Cases
  const filteredMissingCases = useMemo(() => {
    return todayOnlyMissingCases.filter((c) => {
      if (missingFilter === 'ALL') return true;
      if (missingFilter === 'RESOLVED') return c.resolvedByClockIn;
      if (missingFilter === 'PENDING_REVIEW') return c.flagStatus === 'PENDING_REVIEW' && !c.resolvedByClockIn;
      if (missingFilter === 'APPROVED') return c.flagStatus === 'APPROVED';
      if (missingFilter === 'REJECTED') return c.flagStatus === 'REJECTED';
      return true;
    });
  }, [todayOnlyMissingCases, missingFilter]);

  const paginatedMissingCases = useMemo(() => {
    const startIdx = (missingPage - 1) * missingLimit;
    return filteredMissingCases.slice(startIdx, startIdx + missingLimit);
  }, [filteredMissingCases, missingPage, missingLimit]);

  const missingPaginationMeta: PaginationMetadata = useMemo(() => {
    return {
      total: filteredMissingCases.length,
      page: missingPage,
      limit: missingLimit,
      offset: (missingPage - 1) * missingLimit,
      totalPages: Math.max(1, Math.ceil(filteredMissingCases.length / missingLimit)),
    };
  }, [filteredMissingCases.length, missingPage, missingLimit]);

  // Paginated workers for Tab 1
  const paginatedWorkers = useMemo(() => {
    const startIdx = (page - 1) * limit;
    return workers.slice(startIdx, startIdx + limit);
  }, [workers, page, limit]);

  const paginationMeta: PaginationMetadata = useMemo(() => {
    return {
      total: workers.length,
      page,
      limit,
      offset: (page - 1) * limit,
      totalPages: Math.max(1, Math.ceil(workers.length / limit)),
    };
  }, [workers.length, page, limit]);

  // Distinct roles for filter
  const distinctRoles = useMemo(() => {
    const s = new Set<string>();
    workers.forEach((w) => {
      if (Array.isArray(w.roles)) {
        w.roles.forEach((r) => s.add(r));
      } else if (w.role) {
        s.add(w.role);
      }
    });
    return Array.from(s);
  }, [workers]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold border transition-all animate-in fade-in slide-in-from-top-3 ${toastMessage.type === 'success'
            ? 'bg-emerald-900 text-white border-emerald-700'
            : 'bg-rose-900 text-white border-rose-700'
            }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-75 cursor-pointer text-white/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Tab Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs (Only: Daily Attendance, Missing Clock-ins, Supervisor Audit) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#E8EEF4] p-1.5 rounded-2xl shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'daily'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Daily Attendance</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === 'daily' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {stats.totalWorkers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('missing')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'missing'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Missing Clock-ins</span>
            {stats.notYetIn > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === 'missing' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
              >
                {stats.notYetIn}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('supervisors')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'supervisors'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Supervisor Audit</span>
          </button>
        </div>

        {/* Action Controls: Date Navigator & Excel Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker & Prev/Next Navigator */}
          <div className="flex items-center bg-white border border-[#E8EEF4] rounded-xl px-2 py-1 shadow-2xs">
            <button
              onClick={() => handleDateShift(-1)}
              title="Previous Day"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-3.5 h-3.5 text-[#12A66A]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleDateShift(1)}
              title="Next Day"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="ml-1 text-[11px] font-bold text-[#12A66A] hover:underline px-2 py-0.5 rounded-md hover:bg-emerald-50 cursor-pointer"
              >
                Today
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadDailyAttendance(true)}
            disabled={isRefreshing || loading}
            title="Refresh Attendance"
            className="p-2.5 bg-white border border-[#E8EEF4] hover:bg-slate-50 text-slate-700 rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#12A66A]' : ''}`} />
          </button>

          {/* Excel Exports Button */}
          <button
            onClick={() => setShowExcelModal(true)}
            className="px-3.5 py-2 bg-[#12A66A] text-white rounded-xl text-xs font-semibold hover:bg-[#0f8a58] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Exports</span>
          </button>
        </div>
      </div>

      <ExcelExportModal isOpen={showExcelModal} onClose={() => setShowExcelModal(false)} />

      {/* ── TAB 1: DAILY ATTENDANCE ────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Header Title & Date Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 p-5 rounded-2xl text-white shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
                  Daily Attendance Tracker
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#12A66A] text-white">
                  Live All Roles
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Realtime status for all workers, supervisors, engineers, and accountants across all worksite locations on{' '}
                <span className="font-semibold text-emerald-400">{displayDateText}</span>.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">Roster Coverage</span>
                <span className="text-lg font-black text-white">
                  {stats.totalWorkers > 0
                    ? `${Math.round(((stats.clockedIn + stats.clockedOut) / stats.totalWorkers) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3.5">
            <StatCard
              title="All Staff"
              value={stats.totalWorkers}
              icon={Users}
              badge="Total Staff"
            />
            <StatCard
              title="Clocked In"
              value={stats.clockedIn}
              icon={Clock}
              badge="Active Now"
              badgeColor="text-emerald-700 bg-emerald-50 border-emerald-200"
            />
            <StatCard
              title="Clocked Out"
              value={stats.clockedOut}
              icon={CheckCircle2}
              badge="Completed"
              badgeColor="text-blue-700 bg-blue-50 border-blue-200"
            />
            <StatCard
              title="Absent"
              value={stats.absent || 0}
              icon={UserX}
              badge="Confirmed Absent"
              badgeColor="text-rose-700 bg-rose-50 border-rose-200"
            />
            <StatCard
              title="Not Yet In"
              value={stats.notYetIn}
              icon={Clock}
              badge="Awaiting Clock-in"
              badgeColor="text-amber-700 bg-amber-50 border-amber-200"
            />

          </div>

          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            {/* Worksite / Location Filter */}
            <div className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={worksiteFilter}
                onChange={(e) => {
                  setWorksiteFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
              >
                <option value="ALL">All Locations / Worksites</option>
                {worksites.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.code || 'Site'})
                  </option>
                ))}
              </select>
            </div>

            {/* Role Filter (includes all roles: Worker, Supervisor, Engineer, Accountant, Admin) */}
            <div className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
              >
                <option value="ALL">All Roles (Workers, Supervisors, Engineers...)</option>
                <option value="WORKER">Workers</option>
                <option value="SUPERVISOR">Supervisors</option>
                <option value="ENGINEER">Engineers</option>
                <option value="ACCOUNTANT">Accountants</option>
                <option value="ADMIN">Admins</option>
              </select>
            </div>

            {/* Attendance Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
            >
              <option value="ALL">All Statuses</option>
              <option value="CLOCKED_IN">Clocked-In (Active on site)</option>
              <option value="CLOCKED_OUT">Clocked-Out (Completed)</option>
              <option value="ABSENT">Absent (Confirmed Absent)</option>
              <option value="NOT_YET_IN">Not Yet In (Missing Clock-in)</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="FLAGGED">Flagged Missing Clock-ins</option>
            </select>

            {/* Search Box */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search staff name, employee code, role, or site..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
              />
            </div>

            {/* Clear Filters */}
            {(worksiteFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setWorksiteFilter('ALL');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Worksite / Location</th>
                    <th className="py-3.5 px-4">Shift</th>
                    <th className="py-3.5 px-4">Clock In</th>
                    <th className="py-3.5 px-4">Clock Out</th>
                    <th className="py-3.5 px-4">Hours</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#12A66A] mb-2" />
                        <span>Loading daily attendance records across all locations...</span>
                      </td>
                    </tr>
                  ) : paginatedWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <span className="font-semibold text-slate-600 block text-sm">No workers found</span>
                        <span>No attendance matches the selected filters for {displayDateText}.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedWorkers.map((w) => {
                      const isClockedIn = w.status === 'CLOCKED_IN';
                      const isClockedOut = w.status === 'CLOCKED_OUT';
                      const isAbsent = w.status === 'ABSENT' || w.sessionStatus === 'ABSENT' || w.flagStatus === 'REJECTED';
                      const isNotYetIn = w.status === 'NOT_YET_IN';
                      const isOnLeave = w.status === 'ON_LEAVE';

                      // Format clock in / out time
                      const formatClockIn = w.clockInTime
                        ? new Date(w.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—';
                      const formatClockOut = w.clockOutTime
                        ? new Date(w.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : isClockedIn
                          ? 'Working...'
                          : '—';

                      return (
                        <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Worker Name & Avatar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={w.avatar}
                                alt={w.name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">{w.name}</span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {w.employeeCode || 'EMP-NA'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Role Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${w.role === 'ADMIN' || w.role === 'SUPER_ADMIN'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : w.role === 'SUPERVISOR'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : w.role === 'ENGINEER'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : w.role === 'ACCOUNTANT'
                                      ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                            >
                              {w.role}
                            </span>
                          </td>

                          {/* 3. Worksite / Location */}
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-xs font-semibold text-slate-800 block">
                                  {w.worksiteName}
                                </span>
                                {w.worksiteCode && (
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {w.worksiteCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 4. Shift */}
                          <td className="py-3 px-4 text-xs">
                            <span className="font-medium text-slate-700 block">{w.shiftName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {w.shiftStartTime} - {w.shiftEndTime}
                            </span>
                          </td>

                          {/* 5. Clock In */}
                          <td className="py-3 px-4 text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                              {isClockedIn || isClockedOut ? (
                                <>
                                  <span className="text-slate-900">{formatClockIn}</span>
                                  {w.inPhotoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setPhotoPreviewUrl(w.inPhotoUrl)}
                                      title="View Clock-in Photo"
                                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                                    >
                                      <img
                                        src={w.inPhotoUrl}
                                        alt="Punch"
                                        className="w-5 h-5 rounded object-cover border border-slate-200"
                                      />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </div>
                          </td>

                          {/* 6. Clock Out */}
                          <td className="py-3 px-4 text-xs font-semibold">
                            {isClockedIn ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Working
                              </span>
                            ) : isClockedOut ? (
                              <span className="text-slate-900">{formatClockOut}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>

                          {/* 7. Total Hours */}
                          <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                            {w.totalHours > 0 ? `${w.totalHours} hrs` : isClockedIn ? '< 1 hr' : '—'}
                          </td>

                          {/* 8. Attendance Status */}
                          <td className="py-3 px-4">
                            {isClockedIn ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping mr-0.5" />
                                Clocked-In
                              </span>
                            ) : isClockedOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                Clocked-Out
                              </span>
                            ) : isOnLeave ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                <Calendar className="w-3 h-3 text-purple-600" />
                                On Leave
                              </span>
                            ) : isAbsent ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  <UserX className="w-3 h-3 text-rose-600" />
                                  Absent
                                </span>
                                {(w.rejectionReason || w.flagReason || w.flagNote) && (
                                  <span
                                    className="block text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded truncate max-w-[140px]"
                                    title={w.rejectionReason || w.flagReason || w.flagNote || ''}
                                  >
                                    {w.rejectionReason || w.flagReason || w.flagNote}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Not Yet In
                                </span>
                                {w.flagStatus && (
                                  <span
                                    className={`block text-[10px] font-black px-1.5 py-0.5 rounded text-center ${w.flagStatus === 'APPROVED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : w.flagStatus === 'REJECTED'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                      }`}
                                  >
                                    Flag: {w.flagStatus === 'APPROVED' ? 'Approve' : w.flagStatus === 'REJECTED' ? 'Absent' : 'Pending'}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 9. Action Buttons: Clock Out & Missing Flag */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Clock Out Action (Enabled for Clocked-In workers) */}
                              {isClockedIn ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenClockOutModal(w)}
                                  title="Assisted Clock-Out Worker"
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs hover:shadow-xs"
                                >
                                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Clock Out</span>
                                </button>
                              ) : null}

                              {/* Flag Missing Clock-In Action (For Not Yet In workers or Reviewing existing flag) */}
                              {isNotYetIn || w.flagStatus ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenFlagModal({
                                      workerId: w.workerId,
                                      workerName: w.name,
                                      employeeCode: w.employeeCode,
                                      role: w.role,
                                      worksiteName: w.worksiteName,
                                      flagId: w.flagId,
                                      currentStatus: w.flagStatus,
                                      currentReason: w.flagReason,
                                      currentNote: w.flagNote,
                                    })
                                  }
                                  title={w.flagStatus ? 'Review Attendance Flag' : 'Flag Missing Clock-In'}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs hover:shadow-xs border ${w.flagStatus
                                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    }`}
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                  <span>{w.flagStatus ? 'Review Flag' : 'Flag Missing'}</span>
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <DataTablePagination
              metadata={paginationMeta}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
              isLoading={loading}
            />
          </div>
        </div>
      )}

      {/* ── TAB 2: MISSING CLOCK-INS (DEDICATED VIEW) ─────────────────────── */}
      {activeTab === 'missing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-xl font-bold tracking-tight text-slate-900 m-0">
                  Missing Clock-Ins Ledger
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Workers scheduled for shifts on <span className="font-semibold text-slate-800">{displayDateText}</span> who have not clocked in past their scheduled start time + grace period.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setMissingFilter(mode);
                    setMissingPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${missingFilter === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {mode === 'ALL'
                    ? 'All Cases'
                    : mode === 'PENDING_REVIEW'
                      ? 'Pending'
                      : mode === 'APPROVED'
                        ? 'Approve'
                        : mode === 'REJECTED'
                          ? 'Absent'
                          : 'Resolved (Punched)'}
                </button>
              ))}
            </div>
          </div>

          {/* Missing Cases Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Missed Date</th>
                    <th className="py-3 px-4">Worksite</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Resolved Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingMissing ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#12A66A] mb-2" />
                        <span>Evaluating missing clock-ins for {displayDateText}...</span>
                      </td>
                    </tr>
                  ) : filteredMissingCases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                        <span className="font-semibold text-slate-700 block text-sm">
                          No missing clock-ins detected
                        </span>
                        <span>All scheduled workers for this date have successfully checked in or have excused leaves.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedMissingCases.map((c) => {
                      const isResolved = c.resolvedByClockIn;
                      const isPending = c.flagStatus === 'PENDING_REVIEW' && !isResolved;
                      const missedDateObj = c.workDate ? new Date(c.workDate) : new Date(selectedDate);
                      const missedDateFormatted = isNaN(missedDateObj.getTime())
                        ? selectedDate
                        : missedDateObj.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        });
                      const resolvedTimestamp = c.resolvedAt || c.reviewedAt;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Worker */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  c.avatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(c.workerName)}&background=0D8ABC&color=fff`
                                }
                                alt={c.workerName}
                                className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">{c.workerName}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {c.employeeCode && (
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                                      {c.employeeCode}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400">
                                    {c.workerRole || 'Worker'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Missed Date */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{missedDateFormatted}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 ml-1">
                                Today
                              </span>
                            </div>
                          </td>

                          {/* 3. Worksite */}
                          <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.worksiteName || '—'}</span>
                            </div>
                          </td>

                          {/* 4. Notes */}
                          <td className="py-3 px-4 max-w-xs text-xs">
                            {c.reason || c.note ? (
                              <div className="space-y-0.5">
                                {c.reason && (
                                  <span className="font-semibold text-slate-800 block truncate" title={c.reason}>
                                    {c.reason}
                                  </span>
                                )}
                                {c.note && (
                                  <span className="text-[11px] text-slate-500 italic block truncate" title={c.note}>
                                    "{c.note}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>

                          {/* 5. Resolved Date */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {resolvedTimestamp || isResolved ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold font-mono">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>
                                    {resolvedTimestamp
                                      ? new Date(resolvedTimestamp).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                      : 'Clocked In'}
                                  </span>
                                </div>
                                {resolvedTimestamp && (
                                  <span className="text-[10px] text-slate-500 font-mono block pl-5">
                                    {new Date(resolvedTimestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                    {c.reviewerName ? ` by ${c.reviewerName}` : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>

                          {/* 6. Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenFlagModal(
                                        {
                                          workerId: c.workerId,
                                          workerName: c.workerName,
                                          employeeCode: c.employeeCode,
                                          role: c.workerRole,
                                          worksiteName: c.worksiteName,
                                          flagId: c.id,
                                          currentStatus: c.flagStatus,
                                          currentReason: c.reason,
                                          currentNote: c.note,
                                        },
                                        'APPROVED'
                                      )
                                    }
                                    className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    title="Approve"
                                    aria-label="Approve"
                                  >
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenFlagModal(
                                        {
                                          workerId: c.workerId,
                                          workerName: c.workerName,
                                          employeeCode: c.employeeCode,
                                          role: c.workerRole,
                                          worksiteName: c.worksiteName,
                                          flagId: c.id,
                                          currentStatus: c.flagStatus,
                                          currentReason: c.reason,
                                          currentNote: c.note,
                                        },
                                        'REJECTED'
                                      )
                                    }
                                    className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    title="Absent / Reject"
                                    aria-label="Absent"
                                  >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenFlagModal(
                                        {
                                          workerId: c.workerId,
                                          workerName: c.workerName,
                                          employeeCode: c.employeeCode,
                                          role: c.workerRole,
                                          worksiteName: c.worksiteName,
                                          flagId: c.id,
                                          currentStatus: c.flagStatus,
                                          currentReason: c.reason,
                                          currentNote: c.note,
                                        },
                                        'PENDING_REVIEW'
                                      )
                                    }
                                    className="w-8 h-8 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                    title="Keep Pending"
                                    aria-label="Pending"
                                  >
                                    <Clock className="w-4 h-4 stroke-[2.5] text-amber-600" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.flagStatus === 'APPROVED'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : c.flagStatus === 'REJECTED'
                                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                      }`}
                                  >
                                    {c.flagStatus === 'APPROVED'
                                      ? 'Flag: Approve'
                                      : c.flagStatus === 'REJECTED'
                                        ? 'Flag: Absent'
                                        : 'Flag: Pending'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenFlagModal({
                                        workerId: c.workerId,
                                        workerName: c.workerName,
                                        employeeCode: c.employeeCode,
                                        role: c.workerRole,
                                        worksiteName: c.worksiteName,
                                        flagId: c.id,
                                        currentStatus: c.flagStatus,
                                        currentReason: c.reason,
                                        currentNote: c.note,
                                      })
                                    }
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                    title="Update Flag"
                                    aria-label="Update Flag"
                                  >
                                    <FileEdit className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Missing Table */}
            <DataTablePagination
              metadata={missingPaginationMeta}
              onPageChange={(newPage) => setMissingPage(newPage)}
              onLimitChange={(newLimit) => {
                setMissingLimit(newLimit);
                setMissingPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
              isLoading={loadingMissing}
            />
          </div>
        </div>
      )}

      {/* ── TAB 3: SUPERVISOR AUDIT ────────────────────────────────────────── */}
      {activeTab === 'supervisors' && (
        <div className="space-y-4">
          <SupervisorAttendanceAuditView />
        </div>
      )}

      {/* ── MODAL 1: ASSISTED CLOCK-OUT ────────────────────────────────────── */}
      {clockOutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold m-0 text-white">Record Worker Clock-Out</h3>
              </div>
              <button
                onClick={() => setClockOutTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmClockOut} className="p-5 space-y-4 text-left">
              {/* Worker Snapshot */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <img
                  src={clockOutTarget.avatar}
                  alt={clockOutTarget.name}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-300"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-sm">{clockOutTarget.name}</span>
                  <span className="text-xs text-slate-500 block">
                    {clockOutTarget.role} • {clockOutTarget.worksiteName}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 block mt-0.5">
                    Clocked in at:{' '}
                    {clockOutTarget.clockInTime
                      ? new Date(clockOutTarget.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Earlier today'}
                  </span>
                </div>
              </div>

              {/* Mandatory Reason Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Clock-Out Reason <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {[
                    'Admin Assisted Clock-Out',
                    'Shift Ended Normally',
                    'Early Departure Approved',
                    'Emergency Departure',
                    'Other',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setClockOutReason(chip)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition-all cursor-pointer ${clockOutReason === chip
                        ? 'bg-[#12A66A] text-white border-[#12A66A]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {clockOutReason === 'Other' && (
                  <input
                    type="text"
                    required
                    value={customClockOutReason}
                    onChange={(e) => setCustomClockOutReason(e.target.value)}
                    placeholder="Enter custom reason for assisted clock-out..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
                  />
                )}
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Optional Supervisor / Admin Remarks
                </label>
                <textarea
                  rows={2}
                  value={clockOutNote}
                  onChange={(e) => setClockOutNote(e.target.value)}
                  placeholder="Additional context, notes, or verification notes..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClockOutTarget(null)}
                  disabled={isSubmittingClockOut}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClockOut}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isSubmittingClockOut ? 'Recording Clock-Out...' : 'Confirm Clock-Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MISSING CLOCK-IN FLAG ─────────────────────────────────── */}
      {flagTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold m-0 text-white">Missing Clock-In Flag Decision</h3>
              </div>
              <button
                onClick={() => setFlagTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmFlagSubmit} className="p-5 space-y-4 text-left">
              {/* Worker Target Header */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block text-sm">{flagTarget.workerName}</span>
                <span className="text-xs text-slate-500 block">
                  {flagTarget.role || 'Staff'} • {flagTarget.worksiteName || 'Assigned Worksite'} • Date: {selectedDate}
                </span>
              </div>

              {/* Flag Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Flag Status Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFlagStatusChoice('APPROVED')}
                    className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${flagStatusChoice === 'APPROVED'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <span className="block text-xs font-black">Approve</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Approved Delay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFlagStatusChoice('REJECTED')}
                    className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${flagStatusChoice === 'REJECTED'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <span className="block text-xs font-black">Absent</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Mark Absent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFlagStatusChoice('PENDING_REVIEW')}
                    className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer ${flagStatusChoice === 'PENDING_REVIEW'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <span className="block text-xs font-black">Pending</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Under Review</span>
                  </button>
                </div>
              </div>

              {/* Flag Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Reason for Flag <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {[
                    'Transit / Traffic Delay',
                    'Medical / Sick Emergency',
                    'Commute / Weather Disruption',
                    'Unnotified Absence',
                    'Device / App Issue',
                    'Other',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setFlagReasonChoice(chip)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition-all cursor-pointer ${flagReasonChoice === chip
                        ? 'bg-[#12A66A] text-white border-[#12A66A]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {flagReasonChoice === 'Other' && (
                  <input
                    type="text"
                    required
                    value={customFlagReason}
                    onChange={(e) => setCustomFlagReason(e.target.value)}
                    placeholder="Enter custom explanation for missing clock-in..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
                  />
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Optional Follow-up Note / Supervisor Remarks
                </label>
                <textarea
                  rows={2}
                  value={flagNoteInput}
                  onChange={(e) => setFlagNoteInput(e.target.value)}
                  placeholder="e.g. Worker contacted via phone, will arrive at 10:30 AM..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#12A66A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFlagTarget(null)}
                  disabled={isSubmittingFlag}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFlag}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#12A66A] hover:bg-[#0f8a58] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {isSubmittingFlag ? 'Applying Flag...' : 'Save Flag Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: PHOTO PREVIEW ────────────────────────────────────────── */}
      {photoPreviewUrl && (
        <div
          onClick={() => setPhotoPreviewUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs cursor-pointer animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden cursor-default"
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">Selfie Verification Photo</span>
              <button
                onClick={() => setPhotoPreviewUrl(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              <img
                src={photoPreviewUrl}
                alt="Selfie Preview"
                className="w-full h-auto rounded-xl object-cover max-h-[400px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
import {
  AlertTriangle,
  Clock,
  FileEdit,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  User,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
  X,
  History,
  Info,
  CalendarDays,
  FileText,
  Sliders,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export type ExceptionCategory = 'all' | 'missing' | 'pending-regularisation' | 'rejected-regularisation';

interface AttendanceExceptionsViewProps {
  isSupervisorView?: boolean;
  currentWorksite?: { id: string; name: string };
  initialCategory?: ExceptionCategory;
}

export const AttendanceExceptionsView: React.FC<AttendanceExceptionsViewProps> = ({
  isSupervisorView = false,
  currentWorksite,
  initialCategory,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read initial category from URL param if available
  const activeCategory: ExceptionCategory = useMemo(() => {
    const cat = searchParams.get('category');
    if (cat === 'missing' || cat === 'missing-attendance') return 'missing';
    if (cat === 'pending-regularisation' || cat === 'pending') return 'pending-regularisation';
    if (cat === 'rejected-regularisation' || cat === 'rejected') return 'rejected-regularisation';
    if (initialCategory) return initialCategory;
    return 'all';
  }, [searchParams, initialCategory]);

  const setCategory = (cat: ExceptionCategory) => {
    const nextParams = new URLSearchParams(searchParams);
    if (cat === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', cat);
    }
    setSearchParams(nextParams);
  };

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Data states
  const [missingAttendanceCases, setMissingAttendanceCases] = useState<any[]>([]);
  const [pendingRegularisations, setPendingRegularisations] = useState<any[]>([]);
  const [rejectedRegularisations, setRejectedRegularisations] = useState<any[]>([]);
  const [summaryCounts, setSummaryCounts] = useState<{
    missingAttendanceCount: number;
    pendingRegularisationCount: number;
    rejectedRegularisationCount: number;
    totalExceptionsCount: number;
    yesterdayDate?: string;
    todayDate?: string;
  }>({
    missingAttendanceCount: 0,
    pendingRegularisationCount: 0,
    rejectedRegularisationCount: 0,
    totalExceptionsCount: 0,
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWorksiteId, setSelectedWorksiteId] = useState<string>(currentWorksite?.id || '');
  const [includeYesterday, setIncludeYesterday] = useState<boolean>(true);
  const [worksitesList, setWorksitesList] = useState<any[]>([]);
  const [missingPage, setMissingPage] = useState<number>(1);
  const [missingLimit, setMissingLimit] = useState<number>(10);

  // Action Modals State
  // 1. Missing Attendance Review (Present, Absent, Keep Pending)
  const [missingModalOpen, setMissingModalOpen] = useState<boolean>(false);
  const [selectedMissingCase, setSelectedMissingCase] = useState<any | null>(null);
  const [missingDecision, setMissingDecision] = useState<'PRESENT' | 'ABSENT' | 'PENDING'>('PRESENT');
  const [clockInTime, setClockInTime] = useState<string>('08:00');
  const [clockOutTime, setClockOutTime] = useState<string>('17:00');
  const [missingReason, setMissingReason] = useState<string>('');
  const [missingNote, setMissingNote] = useState<string>('');
  const [submittingMissing, setSubmittingMissing] = useState<boolean>(false);

  // 2. Regularisation Decision (Approve / Reject)
  const [regModalOpen, setRegModalOpen] = useState<boolean>(false);
  const [selectedRegItem, setSelectedRegItem] = useState<any | null>(null);
  const [regDecision, setRegDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [regReason, setRegReason] = useState<string>('');
  const [submittingReg, setSubmittingReg] = useState<boolean>(false);

  // 3. View Details Modal (for rejected regularisations or case history)
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // Load worksites
  useEffect(() => {
    apiRequest('/worksites')
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setWorksitesList(list);
      })
      .catch(() => { });
  }, []);

  // Update worksite filter if currentWorksite prop changes
  useEffect(() => {
    if (currentWorksite?.id) {
      setSelectedWorksiteId(currentWorksite.id);
    }
  }, [currentWorksite?.id]);

  // Load all exception data
  const loadExceptionData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams();
      if (includeYesterday) params.append('includeYesterday', 'true');
      if (selectedWorksiteId) params.append('worksiteId', selectedWorksiteId);

      // Concurrently fetch summary, missing-clock-ins, pending regularisation, and rejected regularisation
      const [summaryRes, missingRes, pendingRegRes, rejectedRegRes] = await Promise.allSettled([
        apiRequest('/attendance/exceptions/summary'),
        apiRequest(`/attendance/missing-clock-ins?${params.toString()}`),
        apiRequest(`/regularization/requests?status=PENDING`),
        apiRequest(`/regularization/requests?status=REJECTED`),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setSummaryCounts(summaryRes.value);
      }

      if (missingRes.status === 'fulfilled' && missingRes.value?.cases) {
        setMissingAttendanceCases(missingRes.value.cases);
      }

      if (pendingRegRes.status === 'fulfilled') {
        const list = Array.isArray(pendingRegRes.value)
          ? pendingRegRes.value
          : pendingRegRes.value?.requests || [];
        setPendingRegularisations(list);
      }

      if (rejectedRegRes.status === 'fulfilled') {
        const list = Array.isArray(rejectedRegRes.value)
          ? rejectedRegRes.value
          : rejectedRegRes.value?.requests || [];
        setRejectedRegularisations(list);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load exception data', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [includeYesterday, selectedWorksiteId]);

  useEffect(() => {
    loadExceptionData();
  }, [loadExceptionData]);

  // Auto-clear toast
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Handle Missing Attendance Decision (Present, Absent, Keep Pending)
  const handleOpenMissingModal = (caseItem: any, decision: 'PRESENT' | 'ABSENT' | 'PENDING') => {
    setSelectedMissingCase(caseItem);
    setMissingDecision(decision);
    setClockInTime(caseItem.shiftStartTime || '08:00');
    setClockOutTime(caseItem.shiftEndTime || '17:00');
    if (decision === 'PRESENT') {
      setMissingReason('Worker attended shift, phone battery dead/network issue');
    } else if (decision === 'ABSENT') {
      setMissingReason('Unexcused absence, did not report to work');
    } else {
      setMissingReason('Pending investigation with worker/site supervisor');
    }
    setMissingNote('');
    setMissingModalOpen(true);
  };

  const handleSubmitMissingDecision = async () => {
    if (!selectedMissingCase) return;
    try {
      setSubmittingMissing(true);
      await apiRequest(`/attendance/missing-clock-ins/${selectedMissingCase.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          decision: missingDecision,
          action: missingDecision === 'PRESENT' ? 'MARK_PRESENT' : missingDecision === 'ABSENT' ? 'MARK_ABSENT' : 'KEEP_PENDING',
          reason: missingReason.trim(),
          note: missingNote.trim() || undefined,
          clockInTime: missingDecision === 'PRESENT' ? clockInTime : undefined,
          clockOutTime: missingDecision === 'PRESENT' ? clockOutTime : undefined,
        }),
      });

      const decisionLabel =
        missingDecision === 'PRESENT'
          ? 'Confirmed Present (Attendance session recorded)'
          : missingDecision === 'ABSENT'
            ? 'Confirmed Absent'
            : 'Kept Pending Review';

      setMessage({
        text: `Missing attendance for ${selectedMissingCase.workerName} on ${selectedMissingCase.workDate}: ${decisionLabel}.`,
        type: 'success',
      });
      setMissingModalOpen(false);
      setSelectedMissingCase(null);
      loadExceptionData(true);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update missing attendance record', type: 'error' });
    } finally {
      setSubmittingMissing(false);
    }
  };

  // Handle Regularisation Decision (Approve or Reject)
  const handleOpenRegModal = (item: any, decision: 'APPROVE' | 'REJECT') => {
    setSelectedRegItem(item);
    setRegDecision(decision);
    setRegReason(decision === 'APPROVE' ? 'Approved based on supervisor verification' : 'Attendance punch discrepancy not verified');
    setRegModalOpen(true);
  };

  const handleSubmitRegDecision = async () => {
    if (!selectedRegItem) return;
    try {
      setSubmittingReg(true);
      const endpoint = regDecision === 'APPROVE'
        ? `/regularization/${selectedRegItem.id}/approve`
        : `/regularization/${selectedRegItem.id}/reject`;

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          reason: regReason.trim(),
          reviewNote: regReason.trim(),
        }),
      });

      setMessage({
        text: `Regularisation request successfully ${regDecision === 'APPROVE' ? 'approved' : 'rejected'}.`,
        type: 'success',
      });
      setRegModalOpen(false);
      setSelectedRegItem(null);
      loadExceptionData(true);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit regularization decision', type: 'error' });
    } finally {
      setSubmittingReg(false);
    }
  };

  // Filtered Missing Attendance Cases
  const filteredMissingCases = useMemo(() => {
    return missingAttendanceCases.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.employeeCode && c.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.worksiteName && c.worksiteName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSite =
        !selectedWorksiteId ||
        !c.worksiteId ||
        c.worksiteId === selectedWorksiteId;

      return matchesSearch && matchesSite;
    });
  }, [missingAttendanceCases, searchQuery, selectedWorksiteId]);

  // Reset missing pagination when search or filters change
  useEffect(() => {
    setMissingPage(1);
  }, [searchQuery, selectedWorksiteId]);

  const paginatedMissingCases = useMemo(() => {
    const start = (missingPage - 1) * missingLimit;
    return filteredMissingCases.slice(start, start + missingLimit);
  }, [filteredMissingCases, missingPage, missingLimit]);

  // Filtered Pending Regularisations
  const filteredPendingReg = useMemo(() => {
    return pendingRegularisations.filter((r) => {
      const matchesSearch =
        !searchQuery.trim() ||
        r.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeCode && r.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.worksiteName && r.worksiteName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.reason && r.reason.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSite =
        !selectedWorksiteId ||
        !r.worksiteId ||
        r.worksiteId === selectedWorksiteId;

      return matchesSearch && matchesSite;
    });
  }, [pendingRegularisations, searchQuery, selectedWorksiteId]);

  // Filtered Rejected Regularisations
  const filteredRejectedReg = useMemo(() => {
    return rejectedRegularisations.filter((r) => {
      const matchesSearch =
        !searchQuery.trim() ||
        r.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.employeeCode && r.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.worksiteName && r.worksiteName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.reason && r.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.reviewNote && r.reviewNote.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSite =
        !selectedWorksiteId ||
        !r.worksiteId ||
        r.worksiteId === selectedWorksiteId;

      return matchesSearch && matchesSite;
    });
  }, [rejectedRegularisations, searchQuery, selectedWorksiteId]);

  const missingPendingCount = useMemo(() => {
    return missingAttendanceCases.filter((c) => c.flagStatus === 'PENDING_REVIEW').length;
  }, [missingAttendanceCases]);

  const yesterdayMissingCount = useMemo(() => {
    return missingAttendanceCases.filter((c) => c.isYesterday && c.flagStatus === 'PENDING_REVIEW').length;
  }, [missingAttendanceCases]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 font-sans">
      {/* Toast Notification */}
      {message && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in slide-in-from-top duration-200 ${message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── 1. HEADER SECTION ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E8EEF4] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight m-0">
                Attendance Exceptions
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {missingPendingCount + pendingRegularisations.length} Unresolved
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Review and resolve Missing Attendance, Pending Regularisations, and Rejected Regularisations.
              Yesterday&apos;s unresolved records remain visible until handled.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => loadExceptionData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#E8EEF4] text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#12A66A]' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI METRIC SUMMARY STRIP ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Exceptions */}
        <div
          onClick={() => setCategory('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${activeCategory === 'all'
            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
            : 'bg-white border-[#E8EEF4] hover:border-slate-300'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${activeCategory === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Exceptions
            </span>
            <ShieldAlert className={`w-4 h-4 ${activeCategory === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-2">
            {missingPendingCount + pendingRegularisations.length + rejectedRegularisations.length}
          </div>
          <p className={`text-[11px] mt-1 ${activeCategory === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
            {yesterdayMissingCount > 0 ? `${yesterdayMissingCount} carried from yesterday` : 'Active across all categories'}
          </p>
        </div>

        {/* Missing Attendance */}
        <div
          onClick={() => setCategory('missing')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${activeCategory === 'missing'
            ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
            : 'bg-white border-[#E8EEF4] hover:border-amber-200'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Missing Attendance</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-2">
            {missingPendingCount}
          </div>
          <p className="text-[11px] text-amber-700 mt-1">
            {yesterdayMissingCount > 0 ? `${yesterdayMissingCount} from yesterday` : 'No yesterday backlog'}
          </p>
        </div>

        {/* Pending Regularisation */}
        <div
          onClick={() => setCategory('pending-regularisation')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${activeCategory === 'pending-regularisation'
            ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-xs'
            : 'bg-white border-[#E8EEF4] hover:border-blue-200'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800">Pending Regularisation</span>
            <FileEdit className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">
            {pendingRegularisations.length}
          </div>
          <p className="text-[11px] text-blue-700 mt-1">
            Requires supervisor review
          </p>
        </div>

        {/* Rejected Regularisation */}
        <div
          onClick={() => setCategory('rejected-regularisation')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${activeCategory === 'rejected-regularisation'
            ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-xs'
            : 'bg-white border-[#E8EEF4] hover:border-rose-200'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">Rejected Regularisation</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-2">
            {rejectedRegularisations.length}
          </div>
          <p className="text-[11px] text-rose-700 mt-1">
            Unresolved / audit review
          </p>
        </div>
      </div>

      {/* ─── 3. CATEGORY SELECTOR & FILTERS ─────────────────────────────────── */}
      <div className="bg-white border border-[#E8EEF4] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F1F6FC] rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeCategory === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              All Exceptions
            </button>
            <button
              type="button"
              onClick={() => setCategory('missing')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeCategory === 'missing'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-amber-700'
                }`}
            >
              <span>Missing Attendance</span>
              {missingPendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                  {missingPendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCategory('pending-regularisation')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeCategory === 'pending-regularisation'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-blue-700'
                }`}
            >
              <span>Pending Regularisation</span>
              {pendingRegularisations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                  {pendingRegularisations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCategory('rejected-regularisation')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeCategory === 'rejected-regularisation'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-rose-700'
                }`}
            >
              <span>Rejected Regularisation</span>
              {rejectedRegularisations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                  {rejectedRegularisations.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Retention Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none bg-amber-50/80 border border-amber-200/80 px-3 py-1.5 rounded-xl">
            <input
              type="checkbox"
              checked={includeYesterday}
              onChange={(e) => setIncludeYesterday(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-amber-900">
              Keep Yesterday&apos;s Unresolved Records Visible
            </span>
          </label>
        </div>

        {/* Search & Location Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 border-t border-[#E8EEF4]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search worker by name, employee code, or shift..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-[#F8FAFC] border border-[#E8EEF4] text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Worksite Filter (if admin or not locked to one site) */}
          <div className="relative sm:w-64">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedWorksiteId}
              onChange={(e) => setSelectedWorksiteId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-[#F8FAFC] border border-[#E8EEF4] text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] appearance-none cursor-pointer"
            >
              <option value="">All Worksites / Locations</option>
              {worksitesList.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.code || 'SITE'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 4. CATEGORY CONTENT SECTIONS ─────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-[#E8EEF4] rounded-2xl p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#12A66A] animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading attendance exceptions...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION A: MISSING ATTENDANCE */}
          {(activeCategory === 'all' || activeCategory === 'missing') && (
            <div className="bg-white border border-[#E8EEF4] rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#E8EEF4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 m-0">Missing Attendance</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {filteredMissingCases.filter((c) => c.flagStatus === 'PENDING_REVIEW').length} Pending Review
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                      Workers past scheduled start and grace period without clock-in. Unresolved records carry over from yesterday.
                    </p>
                  </div>
                </div>

                {yesterdayMissingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{yesterdayMissingCount} yesterday cases active</span>
                  </span>
                )}
              </div>

              {filteredMissingCases.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Missing Attendance Cases</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    All scheduled workers are clocked in, on approved leave, or their missing attendance flags have been resolved.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-[#E8EEF4]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3.5">Worker</th>
                        <th className="py-3 px-3.5">Missed Date</th>
                        <th className="py-3 px-3.5">Worksite</th>
                        <th className="py-3 px-3.5">Notes</th>
                        <th className="py-3 px-3.5">Resolved Date</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                      {paginatedMissingCases.map((c) => {
                        const isPending = c.flagStatus === 'PENDING_REVIEW';
                        return (
                          <tr
                            key={c.id}
                            className={`hover:bg-slate-50/70 transition-colors ${c.isYesterday && isPending ? 'bg-amber-50/30' : ''
                              }`}
                          >
                            {/* 1. Worker */}
                            <td className="py-3.5 px-3.5">
                              <div className="flex items-center gap-3">
                                {c.avatar ? (
                                  <img
                                    src={c.avatar}
                                    alt={c.workerName}
                                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 uppercase">
                                    {c.workerName ? c.workerName.charAt(0) : 'W'}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 block">{c.workerName}</span>
                                    {c.leaveStatus === 'PENDING_LEAVE' && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800">
                                        Leave Pending
                                      </span>
                                    )}
                                  </div>
                                  {c.employeeCode && (
                                    <span className="text-[11px] font-mono text-slate-500">{c.employeeCode}</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* 2. Missed Date */}
                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900 font-mono text-xs block">
                                {c.workDate}
                              </span>
                              {c.isYesterday ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 mt-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  Yesterday
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-800 border border-blue-200 mt-0.5">
                                  Today
                                </span>
                              )}
                            </td>

                            {/* 3. Worksite */}
                            <td className="py-3.5 px-3.5 text-slate-700">
                              <span className="font-medium">{c.worksiteName}</span>
                            </td>

                            {/* 4. Notes (provided by supervisor while approve or absent) */}
                            <td className="py-3.5 px-3.5 max-w-[240px]">
                              {c.reason || c.note ? (
                                <div className="space-y-0.5">
                                  {c.reason && (
                                    <span className="text-xs text-slate-800 font-medium block truncate" title={c.reason}>
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
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>

                            {/* 5. Resolved Date */}
                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              {c.resolvedAt || c.reviewedAt ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold font-mono">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>
                                      {new Date(c.resolvedAt || c.reviewedAt).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono block pl-5">
                                    {new Date(c.resolvedAt || c.reviewedAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                    {c.reviewerName ? ` by ${c.reviewerName}` : ''}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMissingModal(c, 'PRESENT')}
                                      className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                      title="Approve"
                                      aria-label="Approve"
                                    >
                                      <Check className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMissingModal(c, 'ABSENT')}
                                      className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                      title="Absent / Reject"
                                      aria-label="Absent"
                                    >
                                      <X className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMissingModal(c, 'PENDING')}
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
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        : 'bg-rose-100 text-rose-800 border-rose-200'
                                        }`}
                                    >
                                      {c.flagStatus === 'APPROVED' ? 'Flag: Approve' : 'Flag: Absent'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMissingModal(c, c.flagStatus === 'APPROVED' ? 'PRESENT' : 'ABSENT')}
                                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                      title="Change or review decision"
                                      aria-label="Edit decision"
                                    >
                                      <FileEdit className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <DataTablePagination
                    metadata={{
                      total: filteredMissingCases.length,
                      page: missingPage,
                      limit: missingLimit,
                      offset: (missingPage - 1) * missingLimit,
                      totalPages: Math.ceil(filteredMissingCases.length / missingLimit) || 1,
                    }}
                    onPageChange={(p) => setMissingPage(p)}
                    onLimitChange={(l) => {
                      setMissingLimit(l);
                      setMissingPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: MISSING ATTENDANCE DECISION ─────────────────────────── */}
      <Modal
        isOpen={missingModalOpen}
        onClose={() => setMissingModalOpen(false)}
        title={
          missingDecision === 'PRESENT'
            ? 'Confirm Attendance as Present'
            : missingDecision === 'ABSENT'
              ? 'Confirm Worker as Absent'
              : 'Keep Attendance Exception Pending'
        }
        description={`Resolve missing attendance for ${selectedMissingCase?.workerName || 'Worker'}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setMissingModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitMissingDecision}
              disabled={submittingMissing || !missingReason.trim()}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 ${missingDecision === 'PRESENT'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : missingDecision === 'ABSENT'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
                }`}
            >
              {submittingMissing
                ? 'Saving...'
                : missingDecision === 'PRESENT'
                  ? 'Confirm Approve'
                  : missingDecision === 'ABSENT'
                    ? 'Confirm Absent'
                    : 'Confirm Pending'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          {/* Worker Context Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Worker:</span>
              <strong className="text-slate-900 font-bold">
                {selectedMissingCase?.workerName} ({selectedMissingCase?.employeeCode || 'N/A'})
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Original Work Date:</span>
              <div className="flex items-center gap-1.5">
                <strong className="text-slate-900 font-bold">{selectedMissingCase?.workDate}</strong>
                {selectedMissingCase?.isYesterday && (
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    Yesterday backlog
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Scheduled Shift:</span>
              <span className="text-slate-800 font-semibold">
                {selectedMissingCase?.shiftName} ({selectedMissingCase?.shiftStartTime} - {selectedMissingCase?.shiftEndTime || '17:00'})
              </span>
            </div>
          </div>

          {/* Decision Type Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Resolution Decision <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMissingDecision('PRESENT');
                  if (!missingReason.trim() || missingReason.includes('absence') || missingReason.includes('investigation')) {
                    setMissingReason('Worker attended shift, phone battery dead/network issue');
                  }
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${missingDecision === 'PRESENT'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approve</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal">Records attendance</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMissingDecision('ABSENT');
                  if (!missingReason.trim() || missingReason.includes('attended') || missingReason.includes('investigation')) {
                    setMissingReason('Unexcused absence, did not report to work');
                  }
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${missingDecision === 'ABSENT'
                  ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5 text-rose-600" />
                  <span>Absent</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal">Records absence</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMissingDecision('PENDING');
                  setMissingReason('Pending investigation with worker/site supervisor');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${missingDecision === 'PENDING'
                  ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pending</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal">Unverified case</span>
              </button>
            </div>
          </div>

          {/* Working Hours Input (Only when Mark Present) */}
          {missingDecision === 'PRESENT' && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-emerald-900 block">
                Shift Working Hours (Original Work Date: {selectedMissingCase?.workDate})
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Clock-In Time
                  </label>
                  <input
                    type="time"
                    value={clockInTime}
                    onChange={(e) => setClockInTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Clock-Out Time
                  </label>
                  <input
                    type="time"
                    value={clockOutTime}
                    onChange={(e) => setClockOutTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-emerald-800 m-0">
                An attendance session will be created on {selectedMissingCase?.workDate} with status APPROVED.
              </p>
            </div>
          )}

          {/* Mandatory Reason */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800">
                Mandatory Reason <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Min 3 characters</span>
            </div>
            <input
              type="text"
              value={missingReason}
              onChange={(e) => setMissingReason(e.target.value)}
              placeholder={
                missingDecision === 'PRESENT'
                  ? 'e.g. Worker attended shift, phone battery dead/network issue'
                  : missingDecision === 'ABSENT'
                    ? 'e.g. Unexcused absence, did not report to work'
                    : 'e.g. Awaiting verification from site engineer'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] focus:outline-none"
            />

            {/* Quick Reason Suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(missingDecision === 'PRESENT'
                ? [
                  'Worker attended shift, phone battery died',
                  'Biometric device offline, manual verification',
                  'On-site supervisor confirmed presence',
                ]
                : missingDecision === 'ABSENT'
                  ? [
                    'Unexcused absence, did not report to work',
                    'Emergency reported, shift unattended',
                    'Unscheduled off / absent without notice',
                  ]
                  : [
                    'Pending gate log verification',
                    'Contacting worker for attendance confirmation',
                  ]
              ).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setMissingReason(chip)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Supervisor Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={missingNote}
              onChange={(e) => setMissingNote(e.target.value)}
              placeholder="Add any internal verification notes or references..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 2: REGULARISATION DECISION ─────────────────────────────── */}
      <Modal
        isOpen={regModalOpen}
        onClose={() => setRegModalOpen(false)}
        title={regDecision === 'APPROVE' ? 'Approve Attendance Regularisation' : 'Reject Regularisation Request'}
        description={`Submit decision for ${selectedRegItem?.workerName || 'Worker'}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setRegModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitRegDecision}
              disabled={submittingReg || (regDecision === 'REJECT' && regReason.trim().length < 3)}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 ${regDecision === 'APPROVE' ? 'bg-[#12A66A] hover:bg-[#0E8F5B]' : 'bg-rose-600 hover:bg-rose-700'
                }`}
            >
              {submittingReg ? 'Submitting...' : regDecision === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Worker:</span>
              <strong className="text-slate-800">{selectedRegItem?.workerName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Shift Date:</span>
              <strong className="text-slate-800">{selectedRegItem?.workDate}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Correction Type:</span>
              <strong className="text-slate-800">{selectedRegItem?.correctionType}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Worker Reason:</span>
              <span className="text-slate-700 italic max-w-xs text-right">&ldquo;{selectedRegItem?.reason}&rdquo;</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Review Note / Reason {regDecision === 'REJECT' ? <span className="text-rose-500">* (Mandatory)</span> : '(Optional)'}
            </label>
            <textarea
              rows={3}
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
              placeholder={regDecision === 'APPROVE' ? 'Approved by supervisor' : 'Explain why the request was rejected...'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 3: VIEW DETAILS MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Attendance Exception Details"
        description="Comprehensive audit record"
        maxWidth="md"
        footer={
          <button
            type="button"
            onClick={() => setDetailModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 cursor-pointer"
          >
            Close
          </button>
        }
      >
        {detailItem && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Worker Name:</span>
                <strong className="text-slate-800">{detailItem.workerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Employee Code:</span>
                <span className="font-mono text-slate-800 font-bold">{detailItem.employeeCode || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Work Date:</span>
                <strong className="text-slate-800">{detailItem.workDate}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800">
                  {detailItem.status || 'REJECTED'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-700 block mb-1">Worker&apos;s Submitted Reason:</span>
              <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 m-0">
                {detailItem.reason || 'None provided'}
              </p>
            </div>

            {detailItem.reviewNote && (
              <div>
                <span className="font-bold text-rose-800 block mb-1">Supervisor Decision Note:</span>
                <p className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 m-0 font-medium">
                  {detailItem.reviewNote}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

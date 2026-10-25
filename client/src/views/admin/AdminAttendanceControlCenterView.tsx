import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  RefreshCw,
  Sliders,
  FileText,
  Building2,
  Lock,
  Calendar,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Filter,
  Play,
  Send,
  ArrowRightLeft,
  Eye,
  Check,
  X,
  MapPin,
  ExternalLink,
  History,
  ShieldCheck,
  ArrowUpDown,
  UserCheck,
} from 'lucide-react';

interface SummaryData {
  pendingCorrections: number;
  overdueApprovals: number;
  missingAttendanceExceptions: number;
  approvedCorrections: number;
  rejectedCorrections: number;
  payrollLockedPeriods: number;
}

export const AdminAttendanceControlCenterView: React.FC = () => {
  // Active Tab: 'corrections' | 'overdue' | 'exceptions' | 'audit'
  const [activeTab, setActiveTab] = useState<'corrections' | 'overdue' | 'exceptions' | 'audit'>('corrections');

  // Summary Metrics
  const [summary, setSummary] = useState<SummaryData>({
    pendingCorrections: 0,
    overdueApprovals: 0,
    missingAttendanceExceptions: 0,
    approvedCorrections: 0,
    rejectedCorrections: 0,
    payrollLockedPeriods: 0,
  });

  // Global State
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [worksitesList, setWorksitesList] = useState<any[]>([]);
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [runningJob, setRunningJob] = useState<boolean>(false);

  // ==========================================
  // TAB 1: CORRECTION REQUESTS STATE
  // ==========================================
  const [corrections, setCorrections] = useState<any[]>([]);
  const [correctionsTotal, setCorrectionsTotal] = useState<number>(0);
  const [correctionsPage, setCorrectionsPage] = useState<number>(1);
  const [correctionsLimit] = useState<number>(12);
  const [correctionsTotalPages, setCorrectionsTotalPages] = useState<number>(1);

  // Filters for Corrections
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterWorksite, setFilterWorksite] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Selected Request Detail Modal
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestDetail, setRequestDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Action Modals
  const [approveConfirmOpen, setApproveConfirmOpen] = useState<boolean>(false);
  const [approveNote, setApproveNote] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState<boolean>(false);
  const [requestInfoNote, setRequestInfoNote] = useState<string>('');

  // New Missing Attendance Correction Modal
  const [showCreateMissingModal, setShowCreateMissingModal] = useState<boolean>(false);
  const [newMissingWorkerId, setNewMissingWorkerId] = useState<string>('');
  const [newMissingWorksiteId, setNewMissingWorksiteId] = useState<string>('');
  const [newMissingDate, setNewMissingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newMissingClockIn, setNewMissingClockIn] = useState<string>('');
  const [newMissingClockOut, setNewMissingClockOut] = useState<string>('');
  const [newMissingReason, setNewMissingReason] = useState<string>('');
  const [newMissingStatus, setNewMissingStatus] = useState<'APPROVED' | 'PENDING'>('APPROVED');

  // ==========================================
  // TAB 2: OVERDUE APPROVALS STATE
  // ==========================================
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [overdueLoading, setOverdueLoading] = useState<boolean>(false);
  const [overdueSeverity, setOverdueSeverity] = useState<string>('');
  const [overdueSearch, setOverdueSearch] = useState<string>('');
  const [escalateModalOpen, setEscalateModalOpen] = useState<boolean>(false);
  const [selectedOverdueSession, setSelectedOverdueSession] = useState<any | null>(null);
  const [escalateReason, setEscalateReason] = useState<string>('');
  const [escalateTargetApprover, setEscalateTargetApprover] = useState<string>('');

  // ==========================================
  // TAB 3: EXCEPTIONS STATE (Phase 2 Integration)
  // ==========================================
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState<boolean>(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [overrideItem, setOverrideItem] = useState<any | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideClockIn, setOverrideClockIn] = useState<string>('');
  const [overrideClockOut, setOverrideClockOut] = useState<string>('');

  // ==========================================
  // TAB 4: AUDIT LOGS STATE
  // ==========================================
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditSearch, setAuditSearch] = useState<string>('');

  // Initial Load
  useEffect(() => {
    loadSummary();
    loadWorksites();
    loadWorkers();
  }, []);

  // Corrections fetch on filter/page change
  useEffect(() => {
    if (activeTab === 'corrections') {
      loadCorrections();
    } else if (activeTab === 'overdue') {
      loadOverdueApprovals();
    } else if (activeTab === 'exceptions') {
      loadExceptions();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [
    activeTab,
    correctionsPage,
    filterStatus,
    filterType,
    filterWorksite,
    filterDate,
    filterStartDate,
    filterEndDate,
    overdueSeverity,
  ]);

  // Load KPI Summary
  const loadSummary = async () => {
    try {
      const res = await apiRequest<SummaryData>('/admin/corrections/summary');
      if (res) setSummary(res);
    } catch (err: any) {
      console.error('Failed to load control summary:', err);
    }
  };

  const loadWorksites = async () => {
    try {
      const res = await apiRequest<any>('/worksites');
      const list = Array.isArray(res) ? res : res?.data || [];
      setWorksitesList(list);
    } catch {}
  };

  const loadWorkers = async () => {
    try {
      const res = await apiRequest<any>('/users?limit=100');
      const list = Array.isArray(res) ? res : res?.users || res?.data || [];
      setWorkersList(list);
    } catch {}
  };

  // Load Corrections Table
  const loadCorrections = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(correctionsPage));
      params.append('limit', String(correctionsLimit));
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterType && filterType !== 'ALL') params.append('correctionType', filterType);
      if (filterWorksite) params.append('worksiteId', filterWorksite);
      if (filterDate) params.append('attendanceDate', filterDate);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterSearch.trim()) params.append('search', filterSearch.trim());

      const res = await apiRequest<any>(`/admin/corrections?${params.toString()}`);
      if (res) {
        setCorrections(res.data || []);
        if (res.pagination) {
          setCorrectionsTotal(res.pagination.total);
          setCorrectionsTotalPages(res.pagination.totalPages);
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load correction requests', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Load Overdue Approvals
  const loadOverdueApprovals = async () => {
    try {
      setOverdueLoading(true);
      const params = new URLSearchParams();
      if (overdueSeverity) params.append('severity', overdueSeverity);
      if (overdueSearch.trim()) params.append('search', overdueSearch.trim());

      const res = await apiRequest<any>(`/admin/overdue-approvals?${params.toString()}`);
      if (res) {
        setOverdueList(res.data || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load overdue approvals', type: 'error' });
    } finally {
      setOverdueLoading(false);
    }
  };

  // Load Exceptions
  const loadExceptions = async () => {
    try {
      setExceptionsLoading(true);
      const res = await apiRequest<any[]>('/admin/exceptions');
      if (Array.isArray(res)) setExceptions(res);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load exceptions', type: 'error' });
    } finally {
      setExceptionsLoading(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await apiRequest<any>('/audit-logs?limit=50&sortBy=createdAt&sortOrder=desc');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAuditLogsList(list);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load audit logs', type: 'error' });
    } finally {
      setAuditLoading(false);
    }
  };

  // Open Request Detail Drawer
  const openRequestDetail = async (requestId: string) => {
    setSelectedRequestId(requestId);
    setDetailLoading(true);
    try {
      const res = await apiRequest<any>(`/admin/corrections/${requestId}`);
      setRequestDetail(res);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load request details', type: 'error' });
      setSelectedRequestId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // 1. Approve Correction
  const handleApproveSubmit = async () => {
    if (!selectedRequestId) return;
    try {
      setActionSubmitting(true);
      await apiRequest(`/admin/corrections/${selectedRequestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: approveNote || 'Approved by Administrator' }),
      });
      setMessage({ text: 'Correction request approved and attendance updated atomically.', type: 'success' });
      setApproveConfirmOpen(false);
      setSelectedRequestId(null);
      setRequestDetail(null);
      loadSummary();
      loadCorrections();
    } catch (err: any) {
      setMessage({ text: err.message || 'Approval failed', type: 'error' });
    } finally {
      setActionSubmitting(false);
    }
  };

  // 2. Reject Correction
  const handleRejectSubmit = async () => {
    if (!selectedRequestId) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      alert('A mandatory explanation of at least 5 characters is required.');
      return;
    }
    try {
      setActionSubmitting(true);
      await apiRequest(`/admin/corrections/${selectedRequestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setMessage({ text: 'Correction request rejected. Original record preserved unchanged.', type: 'success' });
      setRejectModalOpen(false);
      setSelectedRequestId(null);
      setRequestDetail(null);
      loadSummary();
      loadCorrections();
    } catch (err: any) {
      setMessage({ text: err.message || 'Rejection failed', type: 'error' });
    } finally {
      setActionSubmitting(false);
    }
  };

  // 3. Request More Information
  const handleRequestInfoSubmit = async () => {
    if (!selectedRequestId || !requestInfoNote.trim()) {
      alert('Please enter clarification note.');
      return;
    }
    try {
      setActionSubmitting(true);
      await apiRequest(`/admin/corrections/${selectedRequestId}/request-info`, {
        method: 'POST',
        body: JSON.stringify({ note: requestInfoNote.trim() }),
      });
      setMessage({ text: 'Clarification inquiry sent to employee.', type: 'success' });
      setRequestInfoModalOpen(false);
      setSelectedRequestId(null);
      setRequestDetail(null);
      loadCorrections();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to send inquiry', type: 'error' });
    } finally {
      setActionSubmitting(false);
    }
  };

  // 4. Create Missing Attendance Correction
  const handleCreateMissingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMissingWorkerId || !newMissingWorksiteId || !newMissingDate || !newMissingReason.trim()) {
      alert('Please fill all mandatory fields (Worker, Worksite, Date, Reason).');
      return;
    }
    try {
      setActionSubmitting(true);
      await apiRequest('/admin/corrections/create-missing-attendance', {
        method: 'POST',
        body: JSON.stringify({
          workerId: newMissingWorkerId,
          worksiteId: newMissingWorksiteId,
          workDate: newMissingDate,
          clockInTime: newMissingClockIn ? new Date(`${newMissingDate}T${newMissingClockIn}`).toISOString() : undefined,
          clockOutTime: newMissingClockOut ? new Date(`${newMissingDate}T${newMissingClockOut}`).toISOString() : undefined,
          reason: newMissingReason.trim(),
          status: newMissingStatus,
        }),
      });
      setMessage({ text: 'Authorized attendance correction created successfully.', type: 'success' });
      setShowCreateMissingModal(false);
      setNewMissingReason('');
      setNewMissingClockIn('');
      setNewMissingClockOut('');
      loadSummary();
      loadCorrections();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create correction', type: 'error' });
    } finally {
      setActionSubmitting(false);
    }
  };

  // 5. Send Overdue Reminder
  const handleSendReminder = async (sessionId: string) => {
    try {
      await apiRequest(`/admin/overdue-approvals/${sessionId}/remind`, { method: 'POST' });
      setMessage({ text: 'Urgent reminder dispatched to supervisor.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to dispatch reminder', type: 'error' });
    }
  };

  // 6. Escalate Overdue Approval
  const handleEscalateSubmit = async () => {
    if (!selectedOverdueSession || !escalateReason.trim()) {
      alert('Please enter an escalation reason.');
      return;
    }
    try {
      setActionSubmitting(true);
      await apiRequest(`/admin/overdue-approvals/${selectedOverdueSession.id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({
          reason: escalateReason.trim(),
          targetApproverId: escalateTargetApprover || undefined,
        }),
      });
      setMessage({ text: 'Overdue approval escalated successfully.', type: 'success' });
      setEscalateModalOpen(false);
      setSelectedOverdueSession(null);
      setEscalateReason('');
      loadSummary();
      loadOverdueApprovals();
    } catch (err: any) {
      setMessage({ text: err.message || 'Escalation failed', type: 'error' });
    } finally {
      setActionSubmitting(false);
    }
  };

  // 7. Run Escalation Job
  const handleRunEscalationJob = async () => {
    try {
      setRunningJob(true);
      await apiRequest('/admin/escalation/run', { method: 'POST' });
      setMessage({ text: 'Automated escalation & missing attendance checks completed.', type: 'success' });
      loadSummary();
      if (activeTab === 'corrections') loadCorrections();
      if (activeTab === 'overdue') loadOverdueApprovals();
    } catch (err: any) {
      setMessage({ text: err.message || 'Escalation check run failed', type: 'error' });
    } finally {
      setRunningJob(false);
    }
  };

  // Helper formatting
  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const parts = String(iso).split('T')[0].split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & PRIMARY ACTIONS ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 m-0">
                Attendance Control Center
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Administrative corrections, supervisor escalation queues, and immutable compliance audit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreateMissingModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Record Missing Attendance</span>
          </button>

          <button
            type="button"
            onClick={handleRunEscalationJob}
            disabled={runningJob}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningJob ? 'animate-spin' : ''}`} />
            <span>{runningJob ? 'Checking...' : 'Run Escalations'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadSummary();
              if (activeTab === 'corrections') loadCorrections();
              if (activeTab === 'overdue') loadOverdueApprovals();
              if (activeTab === 'exceptions') loadExceptions();
              if (activeTab === 'audit') loadAuditLogs();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            title="Refresh All"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── TOAST NOTIFICATION ──────────────────────────────────────────────── */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-100 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="cursor-pointer text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── SECTION A: 6 INTERACTIVE SUMMARY CARDS (ACTUAL DATABASE DATA) ───── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Pending Corrections */}
        <div
          onClick={() => {
            setActiveTab('corrections');
            setFilterStatus('PENDING');
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'corrections' && filterStatus === 'PENDING'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Pending Corrections
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800 tabular-nums">
            {summary.pendingCorrections}
          </div>
          <span className="text-[10px] text-amber-600/80 font-medium">Awaiting decision</span>
        </div>

        {/* 2. Overdue Approvals */}
        <div
          onClick={() => setActiveTab('overdue')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'overdue'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
              Overdue Approvals
            </span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-800 tabular-nums">
            {summary.overdueApprovals}
          </div>
          <span className="text-[10px] text-rose-600/80 font-medium">&gt; 24h past deadline</span>
        </div>

        {/* 3. Missing Exceptions */}
        <div
          onClick={() => setActiveTab('exceptions')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'exceptions'
              ? 'bg-orange-50/80 border-orange-400 ring-2 ring-orange-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">
              Missing Clock-Ins
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-800 tabular-nums">
            {summary.missingAttendanceExceptions}
          </div>
          <span className="text-[10px] text-orange-600/80 font-medium">Open exception cases</span>
        </div>

        {/* 4. Approved Corrections */}
        <div
          onClick={() => {
            setActiveTab('corrections');
            setFilterStatus('APPROVED');
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'corrections' && filterStatus === 'APPROVED'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Approved
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 tabular-nums">
            {summary.approvedCorrections}
          </div>
          <span className="text-[10px] text-emerald-600/80 font-medium">Applied corrections</span>
        </div>

        {/* 5. Rejected Corrections */}
        <div
          onClick={() => {
            setActiveTab('corrections');
            setFilterStatus('REJECTED');
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'corrections' && filterStatus === 'REJECTED'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Rejected
            </span>
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 tabular-nums">
            {summary.rejectedCorrections}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Declined requests</span>
        </div>

        {/* 6. Payroll Locked Periods */}
        <div
          onClick={() => setActiveTab('corrections')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
              Locked Payroll
            </span>
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-800 tabular-nums">
            {summary.payrollLockedPeriods}
          </div>
          <span className="text-[10px] text-indigo-600/80 font-medium">Strict audit mode</span>
        </div>
      </div>

      {/* ── TAB NAVIGATION ──────────────────────────────────────────────────── */}
      <div className="flex p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('corrections')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'corrections'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>Correction Requests ({correctionsTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Overdue Approvals ({summary.overdueApprovals})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exceptions')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'exceptions'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Exceptions & Overrides</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* ======================================================================= */}
      {/* ── TAB 1: CORRECTION REQUESTS TABLE ─────────────────────────────────── */}
      {/* ======================================================================= */}
      {activeTab === 'corrections' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by worker name, code, request ID..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadCorrections()}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-[#12A66A] bg-slate-50/50"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCorrectionsPage(1);
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-[#12A66A]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="MORE_INFO_REQUESTED">More Info Requested</option>
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCorrectionsPage(1);
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-[#12A66A]"
              >
                <option value="ALL">All Types</option>
                <option value="MISSING_CLOCK_IN">Missing Clock-In</option>
                <option value="MISSING_CLOCK_OUT">Missing Clock-Out</option>
                <option value="INCORRECT_CLOCK_IN">Incorrect Clock-In</option>
                <option value="INCORRECT_CLOCK_OUT">Incorrect Clock-Out</option>
                <option value="INCORRECT_HOURS">Incorrect Hours</option>
                <option value="STATUS_CHANGE">Status Change</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Worksite Filter */}
              <select
                value={filterWorksite}
                onChange={(e) => {
                  setFilterWorksite(e.target.value);
                  setCorrectionsPage(1);
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-[#12A66A]"
              >
                <option value="">All Sites</option>
                {worksitesList.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>

              {/* Attendance Date */}
              <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400">Date:</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setCorrectionsPage(1);
                  }}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              {/* Clear Filter button */}
              {(filterStatus !== 'ALL' || filterType !== 'ALL' || filterWorksite || filterDate || filterSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('ALL');
                    setFilterType('ALL');
                    setFilterWorksite('');
                    setFilterDate('');
                    setFilterSearch('');
                    setCorrectionsPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Req. ID</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Site / Supervisor</th>
                    <th className="py-3 px-4">Work Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Original Record</th>
                    <th className="py-3 px-4">Requested Correction</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#12A66A]" />
                        Loading correction requests...
                      </td>
                    </tr>
                  ) : corrections.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No attendance correction requests match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    corrections.map((row) => {
                      const isPending = row.status === 'PENDING';
                      const isApproved = row.status === 'APPROVED';
                      const isRejected = row.status === 'REJECTED';
                      const isMoreInfo = row.status === 'MORE_INFO_REQUESTED';

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          onClick={() => openRequestDetail(row.id)}
                        >
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                            #{row.id.substring(0, 8)}
                          </td>

                          {/* Employee */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <img
                                src={row.workerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.workerName)}&background=0D8ABC&color=fff`}
                                alt={row.workerName}
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200"
                              />
                              <div>
                                <strong className="block text-slate-900 font-bold">{row.workerName}</strong>
                                <span className="text-[10px] text-slate-400 font-mono">{row.employeeCode || row.workerRole}</span>
                              </div>
                            </div>
                          </td>

                          {/* Site & Supervisor */}
                          <td className="py-3 px-4">
                            <strong className="block text-slate-800 font-semibold truncate max-w-[140px]">
                              {row.worksiteName}
                            </strong>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                              Sup: {row.supervisorName}
                            </span>
                          </td>

                          {/* Work Date */}
                          <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">
                            {formatDate(row.workDate)}
                          </td>

                          {/* Type */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                              {row.correctionType.replace(/_/g, ' ')}
                            </span>
                          </td>

                          {/* Original Record */}
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold mr-1.5 ${
                              row.originalStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                              row.originalStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {row.originalStatus}
                            </span>
                            <span className="tabular-nums text-[11px]">
                              {formatTime(row.originalClockInTime)} – {formatTime(row.originalClockOutTime)}
                            </span>
                          </td>

                          {/* Requested Changes */}
                          <td className="py-3 px-4 text-[#12A66A] font-bold whitespace-nowrap tabular-nums">
                            {formatTime(row.proposedClockInTime)} – {formatTime(row.proposedClockOutTime)}
                          </td>

                          {/* Reason */}
                          <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate" title={row.reason}>
                            {row.reason}
                          </td>

                          {/* Submitted */}
                          <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                            {formatDate(row.submittedDate)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                isRejected ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {isPending && <Clock className="w-2.5 h-2.5" />}
                              {isApproved && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {isRejected && <XCircle className="w-2.5 h-2.5" />}
                              {isMoreInfo && <HelpCircle className="w-2.5 h-2.5" />}
                              <span>{row.status.replace(/_/g, ' ')}</span>
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openRequestDetail(row.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-[#12A66A] hover:text-white text-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {correctionsTotalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span>
                  Showing {(correctionsPage - 1) * correctionsLimit + 1}–{Math.min(correctionsPage * correctionsLimit, correctionsTotal)} of {correctionsTotal} requests
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCorrectionsPage((p) => Math.max(1, p - 1))}
                    disabled={correctionsPage === 1}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-bold text-slate-800 px-1">
                    {correctionsPage} / {correctionsTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCorrectionsPage((p) => Math.min(correctionsTotalPages, p + 1))}
                    disabled={correctionsPage === correctionsTotalPages}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ── TAB 2: OVERDUE SUPERVISOR APPROVALS VIEW ─────────────────────────── */}
      {/* ======================================================================= */}
      {activeTab === 'overdue' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by supervisor, worker, site..."
                  value={overdueSearch}
                  onChange={(e) => setOverdueSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-rose-600 bg-slate-50/50"
                />
              </div>

              <select
                value={overdueSeverity}
                onChange={(e) => setOverdueSeverity(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-rose-600"
              >
                <option value="">All Severity Durations</option>
                <option value="MODERATE">Moderate (24h – 48h)</option>
                <option value="HIGH">High (48h – 72h)</option>
                <option value="CRITICAL">Critical (&gt; 72h)</option>
              </select>
            </div>

            <span className="text-xs font-semibold text-slate-500">
              {overdueList.length} punch approval{overdueList.length === 1 ? '' : 's'} past deadline
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Supervisor Contact</th>
                    <th className="py-3 px-4">Worksite</th>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Shift Date</th>
                    <th className="py-3 px-4">Punched At</th>
                    <th className="py-3 px-4">Overdue Duration</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-600" />
                        Scanning for overdue approvals...
                      </td>
                    </tr>
                  ) : overdueList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        All supervisor attendance approvals are currently up to date!
                      </td>
                    </tr>
                  ) : (
                    overdueList.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="block text-slate-900 font-bold">{row.supervisorName}</strong>
                          <span className="text-[10px] text-slate-400 block">{row.supervisorEmail || row.supervisorPhone}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{row.worksiteName}</td>
                        <td className="py-3 px-4">
                          <strong className="block text-slate-900">{row.workerName}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{row.employeeCode}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">{formatDate(row.workDate)}</td>
                        <td className="py-3 px-4 text-slate-600 tabular-nums">{formatTime(row.clockInTime)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              row.severityLevel === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              row.severityLevel === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>{row.overdueFormatted}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {row.isEscalated ? 'ESCALATED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSendReminder(row.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Send Urgent Reminder"
                            >
                              <Send className="w-3 h-3" />
                              <span>Remind</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOverdueSession(row);
                                setEscalateReason(`Overdue review by supervisor (${row.overdueFormatted}) - Administrator escalated`);
                                setEscalateModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Escalate</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ── TAB 3: EXCEPTIONS & OVERRIDES (PHASE 2 INTEGRATION) ─────────────── */}
      {/* ======================================================================= */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Showing active missing attendance, unclosed shifts, and leave conflict exceptions.
            </span>
            <button
              type="button"
              onClick={loadExceptions}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Refresh Cases
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exceptionsLoading ? (
              <div className="col-span-full py-12 text-center text-slate-400">Loading exceptions...</div>
            ) : exceptions.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">No active exceptions found.</div>
            ) : (
              exceptions.map((ex) => (
                <div key={ex.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {ex.exceptionType.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ex.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700' :
                        ex.status === 'ESCALATED' ? 'bg-rose-50 text-rose-700' :
                        'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {ex.status}
                    </span>
                  </div>

                  <div>
                    <strong className="block text-sm font-bold text-slate-900">{ex.workerName}</strong>
                    <span className="text-xs text-slate-500 font-medium">{ex.worksiteName} • {formatDate(ex.workDate)}</span>
                  </div>

                  {ex.resolutionNote && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl italic">
                      Note: {ex.resolutionNote}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Supervisor: {ex.primarySupervisorName}</span>
                    {ex.sessionId && ex.status !== 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideItem(ex);
                          setOverrideStatus('APPROVED');
                          setOverrideReason('Administrative override after exception investigation');
                          setOverrideModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg cursor-pointer"
                      >
                        Override Status
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ── TAB 4: AUDIT LOG TRAIL ───────────────────────────────────────────── */}
      {/* ======================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit trail by actor, action, reason..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-indigo-600 bg-slate-50/50"
              />
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Refresh Audit
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Reason / Justification</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">Loading security audit trail...</td>
                    </tr>
                  ) : auditLogsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">No audit logs recorded yet.</td>
                    </tr>
                  ) : (
                    auditLogsList
                      .filter((l) => {
                        if (!auditSearch.trim()) return true;
                        const q = auditSearch.toLowerCase();
                        return (
                          (l.actorName && l.actorName.toLowerCase().includes(q)) ||
                          (l.action && l.action.toLowerCase().includes(q)) ||
                          (l.reason && l.reason.toLowerCase().includes(q))
                        );
                      })
                      .map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px] tabular-nums">
                            {new Date(l.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">{l.actorName}</td>
                          <td className="py-3 px-4">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {l.actorRole}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700 text-[11px]">
                            {l.action}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{l.entityType}</td>
                          <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate" title={l.reason || ''}>
                            {l.reason || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                            {l.afterValues ? JSON.stringify(l.afterValues) : '—'}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ── SECTION C: REQUEST DETAIL INSPECTOR MODAL ───────────────────────── */}
      {/* ======================================================================= */}
      {selectedRequestId && (
        <Modal
          isOpen={!!selectedRequestId}
          onClose={() => {
            setSelectedRequestId(null);
            setRequestDetail(null);
          }}
          title="Attendance Correction Inspector"
          maxWidth="xl"
        >
          {detailLoading || !requestDetail ? (
            <div className="py-16 text-center text-slate-400 font-medium">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#12A66A]" />
              Loading complete audit & correction history...
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Header Info */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">Request #{requestDetail.request.id.substring(0, 8)}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {requestDetail.request.correctionType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-1">{requestDetail.worker?.fullName}</h3>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {requestDetail.worker?.employeeCode} • {requestDetail.worksite?.name}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-block mt-0.5 ${
                    requestDetail.request.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    requestDetail.request.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {requestDetail.request.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Submitted: {new Date(requestDetail.request.submittedDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Comparison: Original vs Proposed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Record */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                    Original Attendance Session
                  </span>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Decision Status:</span>
                      <strong className="text-slate-800">{requestDetail.session?.status}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Clock-In Time:</span>
                      <strong className="text-slate-900 tabular-nums">{formatTime(requestDetail.session?.clockInTime)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Clock-Out Time:</span>
                      <strong className="text-slate-900 tabular-nums">{formatTime(requestDetail.session?.clockOutTime)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Duration:</span>
                      <strong className="text-slate-900 tabular-nums">
                        {requestDetail.session?.totalDurationSeconds
                          ? `${Math.round(requestDetail.session.totalDurationSeconds / 3600 * 10) / 10} hrs`
                          : '—'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Proposed Changes */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3 shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block border-b border-emerald-100 pb-1.5">
                    Proposed Correction Values
                  </span>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Target Status:</span>
                      <strong className="text-emerald-900">APPROVED</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Proposed In:</span>
                      <strong className="text-emerald-900 tabular-nums font-bold">
                        {formatTime(requestDetail.request.proposedClockInTime) || formatTime(requestDetail.session?.clockInTime)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Proposed Out:</span>
                      <strong className="text-emerald-900 tabular-nums font-bold">
                        {formatTime(requestDetail.request.proposedClockOutTime) || formatTime(requestDetail.session?.clockOutTime)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Effective Date:</span>
                      <strong className="text-emerald-900">{formatDate(requestDetail.request.workDate)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Justification & Evidence */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Worker / Requester Justification
                </span>
                <p className="text-xs text-slate-800 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  &ldquo;{requestDetail.request.reason}&rdquo;
                </p>
                {requestDetail.request.supportingEvidenceUrl && (
                  <div className="pt-1">
                    <a
                      href={requestDetail.request.supportingEvidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Supporting Document / Receipt</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Payroll Status Warning (Section D requirement) */}
              {requestDetail.session?.isPayrollLocked || requestDetail.payrollPeriod?.status === 'LOCKED' || requestDetail.payrollPeriod?.status === 'FINALIZED' ? (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-amber-900">
                  <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <strong className="block text-xs font-bold">Payroll Period Locked / Finalized</strong>
                    <span className="text-[11px] block mt-0.5">
                      This attendance date falls inside finalized payroll period <strong>{requestDetail.payrollPeriod?.name || 'Standard Period'}</strong>.
                      Approving this correction will <strong>not silently alter closed payroll totals</strong>; it will create a verified post-payroll reconciliation adjustment record.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Payroll is currently open (Draft). Changes will flow directly into the next payroll cycle.</span>
                </div>
              )}

              {/* Decision Note if Already Decided */}
              {requestDetail.request.reviewNote && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reviewer Decision Note</span>
                  <p className="text-xs text-slate-700 mt-0.5 font-medium">{requestDetail.request.reviewNote}</p>
                </div>
              )}

              {/* Previous Decisions & Audit Trail */}
              {requestDetail.previousActions && requestDetail.previousActions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Decision History</span>
                  <div className="space-y-1">
                    {requestDetail.previousActions.map((act: any) => (
                      <div key={act.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                        <div>
                          <strong className="text-slate-800 font-bold">{act.action}</strong> by {act.reviewerName || 'Reviewer'}
                          {act.note && <span className="text-slate-500 italic block">&ldquo;{act.note}&rdquo;</span>}
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(act.performedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons for Pending / More Info Requested */}
              {requestDetail.request.status !== 'APPROVED' && requestDetail.request.status !== 'REJECTED' && (
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRequestInfoNote('');
                      setRequestInfoModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Request More Info
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRejectReason('');
                      setRejectModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Reject Request
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setApproveNote('Approved by Administrator');
                      setApproveConfirmOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Approve Correction</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── MODAL: CONFIRM APPROVE CORRECTION ────────────────────────────────── */}
      {approveConfirmOpen && (
        <Modal
          isOpen={approveConfirmOpen}
          onClose={() => setApproveConfirmOpen(false)}
          title="Confirm Attendance Correction Approval"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              You are about to apply this official attendance correction. The attendance record will be atomically updated to <strong>APPROVED</strong> with the proposed timestamps.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Approval Note (Recorded in Audit Trail):
              </label>
              <input
                type="text"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="e.g. Approved after physical timesheet verification"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-[#12A66A]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApproveConfirmOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                disabled={actionSubmitting}
                className="px-4 py-2 text-xs font-bold bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {actionSubmitting ? 'Applying...' : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: REJECT CORRECTION (MANDATORY EXPLANATION) ─────────────────── */}
      {rejectModalOpen && (
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Reject Attendance Correction"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Please provide a mandatory explanation for declining this request. The original attendance record will remain <strong>completely unchanged</strong>.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mandatory Rejection Explanation: <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify why this correction cannot be granted (e.g. Missing site sign-off, contradictory CCTV logs)..."
                className="w-full p-2.5 text-xs border border-rose-200 rounded-xl focus:outline-rose-600 bg-rose-50/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actionSubmitting || rejectReason.trim().length < 5}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {actionSubmitting ? 'Declining...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: REQUEST MORE INFO ────────────────────────────────────────── */}
      {requestInfoModalOpen && (
        <Modal
          isOpen={requestInfoModalOpen}
          onClose={() => setRequestInfoModalOpen(false)}
          title="Request Clarification from Requester"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Clarification Inquiry for Worker/Supervisor: <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={requestInfoNote}
                onChange={(e) => setRequestInfoNote(e.target.value)}
                placeholder="e.g. Please upload gate pass or site logbook photo to verify early departure..."
                className="w-full p-2.5 text-xs border border-indigo-200 rounded-xl focus:outline-indigo-600 bg-indigo-50/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRequestInfoModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestInfoSubmit}
                disabled={actionSubmitting || requestInfoNote.trim().length < 5}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {actionSubmitting ? 'Sending...' : 'Send Inquiry'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: CREATE MISSING ATTENDANCE RECORD (SECTION D) ─────────────── */}
      {showCreateMissingModal && (
        <Modal
          isOpen={showCreateMissingModal}
          onClose={() => setShowCreateMissingModal(false)}
          title="Authorized Missing Attendance Resolution"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateMissingSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Use this authorized administrative workflow to create an official attendance record for a worker who did not punch in on a scheduled date. This generates an explicit, traceable correction entry.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Worker: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newMissingWorkerId}
                  onChange={(e) => setNewMissingWorkerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                  required
                >
                  <option value="">Select Worker</option>
                  {workersList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.fullName} ({w.employeeCode || 'Worker'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Worksite: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={newMissingWorksiteId}
                  onChange={(e) => setNewMissingWorksiteId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                  required
                >
                  <option value="">Select Worksite</option>
                  {worksitesList.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.code || 'SITE'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Shift Date: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={newMissingDate}
                  onChange={(e) => setNewMissingDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold"
                  required
                >
                </input>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Resolution Status:
                </label>
                <select
                  value={newMissingStatus}
                  onChange={(e: any) => setNewMissingStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="APPROVED">APPROVED (Apply Instantly)</option>
                  <option value="PENDING">PENDING (Supervisor Review)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Actual Clock-In Time (HH:MM):
                </label>
                <input
                  type="time"
                  value={newMissingClockIn}
                  onChange={(e) => setNewMissingClockIn(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Actual Clock-Out Time (HH:MM):
                </label>
                <input
                  type="time"
                  value={newMissingClockOut}
                  onChange={(e) => setNewMissingClockOut(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mandatory Administrative Justification: <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={newMissingReason}
                onChange={(e) => setNewMissingReason(e.target.value)}
                placeholder="e.g. Worker was present on site; mobile app device battery died; confirmed via physical register..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-[#12A66A]"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateMissingModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionSubmitting}
                className="px-4 py-2 text-xs font-bold bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {actionSubmitting ? 'Creating...' : 'Create & Apply'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: ESCALATE OVERDUE APPROVAL ─────────────────────────────────── */}
      {escalateModalOpen && selectedOverdueSession && (
        <Modal
          isOpen={escalateModalOpen}
          onClose={() => setEscalateModalOpen(false)}
          title="Escalate Overdue Supervisor Approval"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Escalate this overdue punch approval to the Administrator queue or reassign it to an alternate supervisor.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Escalate To:
              </label>
              <select
                value={escalateTargetApprover}
                onChange={(e) => setEscalateTargetApprover(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
              >
                <option value="">Administrator Queue (Default)</option>
                {workersList
                  .filter((u) => u.roles?.includes('SUPERVISOR') || u.roles?.includes('ADMIN'))
                  .map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.fullName} ({sup.roles?.[0]})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Escalation Reason: <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEscalateModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEscalateSubmit}
                disabled={actionSubmitting}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {actionSubmitting ? 'Escalating...' : 'Confirm Escalation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: STATUS OVERRIDE (FROM EXCEPTIONS TAB) ────────────────────── */}
      {overrideModalOpen && overrideItem && (
        <Modal
          isOpen={overrideModalOpen}
          onClose={() => setOverrideModalOpen(false)}
          title="Administrative Status Override"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Apply a direct administrative override for worker <strong>{overrideItem.workerName}</strong>.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">New Status:</label>
              <select
                value={overrideStatus}
                onChange={(e: any) => setOverrideStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mandatory Administrative Justification: <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setActionSubmitting(true);
                    await apiRequest(`/admin/attendance/${overrideItem.sessionId}/override`, {
                      method: 'POST',
                      body: JSON.stringify({
                        status: overrideStatus,
                        reason: overrideReason.trim(),
                      }),
                    });
                    setMessage({ text: 'Administrative override applied.', type: 'success' });
                    setOverrideModalOpen(false);
                    loadExceptions();
                  } catch (err: any) {
                    setMessage({ text: err.message || 'Override failed', type: 'error' });
                  } finally {
                    setActionSubmitting(false);
                  }
                }}
                disabled={actionSubmitting || overrideReason.trim().length < 5}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                {actionSubmitting ? 'Applying...' : 'Apply Override'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
import {
  CheckCircleIcon,
  ClockIcon,
  CalenderIcon,
  SearchIcon,
  ErrorProfileIcon,
  EditProfileIcon,
  CheckIcon,
  CloseIcon,
  CloseCircleIcon,
  RotateCwIcon,
  EyeIcon,
  SecuritySafeIcon,
  HelpCircleIcon,
  Building1Icon,
  ArrowUpRightIcon,
  EmailSentIcon,
} from '@astraicons/react/linear';

export type QueueTab = 'attendance' | 'regularization' | 'overtime' | 'leave' | 'exceptions' | 'escalated';

export const SupervisorApprovalsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<QueueTab>('attendance');

  // Queue Data
  const [pendingAttendance, setPendingAttendance] = useState<any[]>([]);
  const [pendingRegularization, setPendingRegularization] = useState<any[]>([]);
  const [pendingOvertime, setPendingOvertime] = useState<any[]>([]);
  const [pendingLeave, setPendingLeave] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [escalated, setEscalated] = useState<any[]>([]);
  const [counts, setCounts] = useState<{
    pendingAttendance: number;
    regularization: number;
    overtime: number;
    pendingLeave: number;
    exceptions: number;
    escalated: number;
  }>({
    pendingAttendance: 0,
    regularization: 0,
    overtime: 0,
    pendingLeave: 0,
    exceptions: 0,
    escalated: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [searchWorker, setSearchWorker] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterExceptionType, setFilterExceptionType] = useState<string>('');
  const [delegatedScope, setDelegatedScope] = useState<any>(null);
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'PRIMARY' | 'DELEGATED'>('ALL');

  // Selected item for inspection / actions
  const [inspectItem, setInspectItem] = useState<any | null>(null);

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedForReject, setSelectedForReject] = useState<{ item: any; type: 'attendance' | 'leave' | 'overtime' | 'regularization' } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Clarification Modal
  const [clarifyModalOpen, setClarifyModalOpen] = useState<boolean>(false);
  const [selectedForClarify, setSelectedForClarify] = useState<{ id: string; type: string } | null>(null);
  const [clarifyMessage, setClarifyMessage] = useState<string>('');

  // Exception Resolution Modal
  const [resolveModalOpen, setResolveModalOpen] = useState<boolean>(false);
  const [selectedForResolve, setSelectedForResolve] = useState<any | null>(null);
  const [resolutionType, setResolutionType] = useState<string>('EXCUSED_ABSENCE');
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Manual Escalation Modal
  const [escalateModalOpen, setEscalateModalOpen] = useState<boolean>(false);
  const [selectedForEscalate, setSelectedForEscalate] = useState<{ id: string; type: string } | null>(null);
  const [escalateReason, setEscalateReason] = useState<string>('');
  const [exceptionPage, setExceptionPage] = useState<number>(1);
  const [exceptionLimit, setExceptionLimit] = useState<number>(10);
  const [regPage, setRegPage] = useState<number>(1);
  const [regLimit, setRegLimit] = useState<number>(10);

  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadQueueData();
  }, [filterDate, filterExceptionType]);

  const loadQueueData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterDate) params.append('startDate', filterDate);
      if (filterDate) params.append('endDate', filterDate);
      if (filterExceptionType) params.append('exceptionType', filterExceptionType);

      const [res, otRes, regRes, scopeRes] = await Promise.all([
        apiRequest(`/supervisor/queues?${params.toString()}`),
        apiRequest(`/overtime/pending?${params.toString()}`).catch(() => []),
        apiRequest(`/regularization/pending`).catch(() => []),
        apiRequest(`/supervisor/delegated-scope`).catch(() => null),
      ]);

      if (scopeRes && scopeRes.hasActiveDelegation) {
        setDelegatedScope(scopeRes);
      }

      if (res) {
        setPendingAttendance(res.pendingAttendance || []);
        setPendingLeave(res.pendingLeave || []);
        setExceptions(res.exceptions || []);
        setEscalated(res.escalated || []);
      }
      const otList = Array.isArray(otRes) ? otRes : [];
      setPendingOvertime(otList);
      const regList = Array.isArray(regRes) ? regRes : [];
      setPendingRegularization(regList);

      setCounts({
        pendingAttendance: res?.counts?.pendingAttendance ?? 0,
        pendingLeave: res?.counts?.pendingLeave ?? 0,
        exceptions: res?.counts?.exceptions ?? 0,
        escalated: res?.counts?.escalated ?? 0,
        overtime: otList.filter((o: any) => o.otStatus === 'PENDING').length,
        regularization: regList.filter((r: any) => r.status === 'PENDING').length,
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load queues', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────

  const handleApproveOvertime = async (item: any, customMinutes?: number) => {
    try {
      setSubmitting(true);
      const sid = item.sessionId || item.id;
      // Immediately remove from pending OT list so decision buttons disappear instantly
      setPendingOvertime((prev) => prev.filter((o) => o.id !== sid && o.sessionId !== sid));
      setCounts((prev) => ({
        ...prev,
        overtime: Math.max(0, prev.overtime - 1),
      }));

      await apiRequest(`/overtime/${sid}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approvedOtMinutes: customMinutes !== undefined ? customMinutes : item.calculatedOtMinutes,
        }),
      });
      setMessage({ text: `Overtime approved (${item.formattedCalculatedOt || item.calculatedOtMinutes + 'm'})`, type: 'success' });
      setInspectItem(null);
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Overtime approval failed', type: 'error' });
      loadQueueData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAttendance = async (sessionId: string) => {
    try {
      setSubmitting(true);
      // Immediately remove from pending attendance list so buttons disappear instantly
      setPendingAttendance((prev) => prev.filter((p) => p.id !== sessionId && p.sessionId !== sessionId));
      setCounts((prev) => ({
        ...prev,
        pendingAttendance: Math.max(0, prev.pendingAttendance - 1),
      }));

      await apiRequest(`/attendance/${sessionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Verified by supervisor' }),
      });
      setMessage({ text: 'Attendance approved successfully.', type: 'success' });
      setInspectItem(null);
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Approval failed', type: 'error' });
      loadQueueData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    try {
      setSubmitting(true);
      // Immediately remove from pending leave list so buttons disappear instantly
      setPendingLeave((prev) => prev.filter((l) => l.id !== leaveId));
      setCounts((prev) => ({
        ...prev,
        pendingLeave: Math.max(0, prev.pendingLeave - 1),
      }));

      await apiRequest(`/leave/requests/${leaveId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: 'Approved by supervisor' }),
      });
      setMessage({ text: 'Leave request approved successfully.', type: 'success' });
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Leave approval failed', type: 'error' });
      loadQueueData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRegularization = async (id: string) => {
    try {
      setSubmitting(true);
      setPendingRegularization((prev) => prev.filter((r) => r.id !== id));
      setCounts((prev) => ({
        ...prev,
        regularization: Math.max(0, prev.regularization - 1),
      }));

      await apiRequest(`/regularization/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: 'Approved by supervisor' }),
      });
      setMessage({ text: 'Attendance regularisation approved and timestamps updated.', type: 'success' });
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Regularization approval failed', type: 'error' });
      loadQueueData();
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectModal = (item: any, type: 'attendance' | 'leave' | 'overtime' | 'regularization') => {
    setSelectedForReject({ item, type });
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedForReject || !rejectReason.trim()) return;

    try {
      setSubmitting(true);
      if (selectedForReject.type === 'attendance') {
        const sid = selectedForReject.item.sessionId || selectedForReject.item.id;
        // Immediately remove from pending list so buttons disappear
        setPendingAttendance((prev) => prev.filter((p) => p.id !== sid && p.sessionId !== sid));
        setCounts((prev) => ({
          ...prev,
          pendingAttendance: Math.max(0, prev.pendingAttendance - 1),
        }));

        await apiRequest(`/attendance/${sid}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason.trim() }),
        });
        setMessage({ text: 'Clock-in rejected with recorded reason.', type: 'success' });
      } else if (selectedForReject.type === 'overtime') {
        const sid = selectedForReject.item.sessionId || selectedForReject.item.id;
        setPendingOvertime((prev) => prev.filter((o) => o.id !== sid && o.sessionId !== sid));
        setCounts((prev) => ({
          ...prev,
          overtime: Math.max(0, prev.overtime - 1),
        }));

        await apiRequest(`/overtime/${sid}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason.trim() }),
        });
        setMessage({ text: 'Overtime rejected with mandatory reason recorded.', type: 'success' });
      } else if (selectedForReject.type === 'regularization') {
        const rid = selectedForReject.item.id;
        setPendingRegularization((prev) => prev.filter((r) => r.id !== rid));
        setCounts((prev) => ({
          ...prev,
          regularization: Math.max(0, prev.regularization - 1),
        }));

        await apiRequest(`/regularization/${rid}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reviewNote: rejectReason.trim() }),
        });
        setMessage({ text: 'Attendance regularisation rejected with recorded reason.', type: 'success' });
      } else {
        const lid = selectedForReject.item.id;
        // Immediately remove from pending leave list so buttons disappear
        setPendingLeave((prev) => prev.filter((l) => l.id !== lid));
        setCounts((prev) => ({
          ...prev,
          pendingLeave: Math.max(0, prev.pendingLeave - 1),
        }));

        await apiRequest(`/leave/requests/${lid}/reject`, {
          method: 'POST',
          body: JSON.stringify({ decisionNote: rejectReason.trim() }),
        });
        setMessage({ text: 'Leave request rejected with recorded reason.', type: 'success' });
      }

      setRejectModalOpen(false);
      setInspectItem(null);
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Rejection failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!selectedForClarify || !clarifyMessage.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest(`/supervisor/queues/${selectedForClarify.type}/${selectedForClarify.id}/clarification`, {
        method: 'POST',
        body: JSON.stringify({ message: clarifyMessage.trim() }),
      });
      setMessage({ text: 'Clarification request sent to worker.', type: 'success' });
      setClarifyModalOpen(false);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to send clarification', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveExceptionSubmit = async () => {
    if (!selectedForResolve || !resolutionNote.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest(`/supervisor/queues/exceptions/${selectedForResolve.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          resolutionType,
          resolutionNote: resolutionNote.trim(),
        }),
      });
      setMessage({ text: 'Exception resolved successfully.', type: 'success' });
      setResolveModalOpen(false);
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to resolve exception', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualEscalateSubmit = async () => {
    if (!selectedForEscalate || !escalateReason.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest(`/supervisor/queues/${selectedForEscalate.type}/${selectedForEscalate.id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ reason: escalateReason.trim() }),
      });
      setMessage({ text: 'Request escalated successfully.', type: 'success' });
      setEscalateModalOpen(false);
      loadQueueData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to escalate request', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Search and Scope filter
  const filterList = (list: any[]) => {
    let result = list;
    if (scopeFilter === 'DELEGATED') {
      result = result.filter(
        (item) => item.isDelegated || (item.worksiteId && delegatedScope?.delegatedWorksiteIds?.includes(item.worksiteId))
      );
    } else if (scopeFilter === 'PRIMARY') {
      result = result.filter(
        (item) => !item.isDelegated && (!item.worksiteId || !delegatedScope?.delegatedWorksiteIds?.includes(item.worksiteId))
      );
    }

    if (!searchWorker.trim()) return result;
    const q = searchWorker.toLowerCase();
    return result.filter(
      (item) =>
        (item.workerName && item.workerName.toLowerCase().includes(q)) ||
        (item.employeeCode && item.employeeCode.toLowerCase().includes(q)) ||
        (item.worksiteName && item.worksiteName.toLowerCase().includes(q))
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Supervisor Approval Queues</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review worker clock-ins, leave requests, attendance exceptions, and escalated cases.
          </p>
        </div>

        <button
          onClick={loadQueueData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer shadow-2xs transition-all w-fit"
        >
          <RotateCwIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
          <span>Refresh Queues</span>
        </button>
      </div>

      {/* ACTIVE DELEGATION COVERAGE BANNER */}
      {delegatedScope?.hasActiveDelegation && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#E6F7EF] via-[#F0FDF4] to-white border border-[#A7F3D0] shadow-xs flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <SecuritySafeIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#12A66A] text-white px-2 py-0.5 rounded-full">
                  Temporary Coverage Active
                </span>
                <span className="text-xs text-[#0E8F5B] font-bold">
                  Covering: {delegatedScope.activeDelegations.map((d: any) => `${d.worksiteName} (${d.primarySupervisorName})`).join(', ')}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5 m-0">
                You have authorized delegation permissions for attendance, leave, and regularization approvals for these sites until {delegatedScope.activeDelegations[0]?.endDate || 'End of leave'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white border border-[#A7F3D0] text-[#0E8F5B]">
              {delegatedScope.delegatedWorkerCount} Delegated Workers
            </span>
          </div>
        </div>
      )}

      {/* Toast Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="cursor-pointer text-slate-400 hover:text-slate-600">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* QUEUE TABS */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-none">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`cursor-pointer whitespace-nowrap transition-all ${
            activeTab === 'attendance'
              ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
              : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
          }`}
        >
          <CheckCircleIcon className="w-4 h-4 text-[#01B075]" />
          <span>Pending Attendance</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'attendance' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
            }`}
          >
            {counts.pendingAttendance}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('overtime')}
          className={`cursor-pointer whitespace-nowrap transition-all ${
            activeTab === 'overtime'
              ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
              : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
          }`}
        >
          <ClockIcon className="w-4 h-4 text-[#01B075]" />
          <span>Overtime Review</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'overtime' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
            }`}
          >
            {counts.overtime}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('regularization')}
          className={`cursor-pointer whitespace-nowrap transition-all ${
            activeTab === 'regularization'
              ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
              : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
          }`}
        >
          <EditProfileIcon className="w-4 h-4 text-[#01B075]" />
          <span>Attendance Regularisation</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'regularization' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
            }`}
          >
            {counts.regularization}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className={`cursor-pointer whitespace-nowrap transition-all ${
            activeTab === 'leave'
              ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
              : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
          }`}
        >
          <CalenderIcon className="w-4 h-4 text-[#01B075]" />
          <span>Pending Leave</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'leave' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
            }`}
          >
            {counts.pendingLeave}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('exceptions')}
          className={`cursor-pointer whitespace-nowrap transition-all ${
            activeTab === 'exceptions'
              ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
              : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
          }`}
        >
          <ErrorProfileIcon className="w-4 h-4 text-amber-500" />
          <span>Attendance Exceptions</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'exceptions' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
            }`}
          >
            {counts.exceptions}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('escalated')}
          className={`cursor-pointer whitespace-nowrap transition-all ${
            activeTab === 'escalated'
              ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
              : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
          }`}
        >
          <Flag className="w-4 h-4 text-rose-500" />
          <span>Escalated Requests</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'escalated' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
            }`}
          >
            {counts.escalated}
          </span>
        </button>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#E8EEF4] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="w-4 h-4 text-[#8C90A0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search worker by name or ID..."
              value={searchWorker}
              onChange={(e) => setSearchWorker(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-[#E8EEF4] rounded-full text-[#1E1F24] placeholder-[#8C90A0] focus:outline-none focus:border-[#01B075] focus:ring-1 focus:ring-[#01B075] shadow-2xs transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#464853] bg-[#F8FAFC] border border-[#E8EEF4] px-3 py-1.5 rounded-full">
            <CalenderIcon className="w-3.5 h-3.5 text-[#8C90A0]" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
            />
          </div>

          {activeTab === 'exceptions' && (
            <select
              value={filterExceptionType}
              onChange={(e) => setFilterExceptionType(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-emerald-600"
            >
              <option value="">All Exception Types</option>
              <option value="MISSING_CLOCK_IN">Missing Clock-In</option>
              <option value="MISSING_CLOCK_OUT">Missing Clock-Out</option>
              <option value="LEAVE_ATTENDANCE_CONFLICT">Leave Conflict</option>
              <option value="OVERDUE_APPROVAL">Overdue Approval</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {delegatedScope?.hasActiveDelegation && (
            <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-full border border-[#E8EEF4]">
              {(['ALL', 'PRIMARY', 'DELEGATED'] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setScopeFilter(sc)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    scopeFilter === sc
                      ? 'bg-[#12A66A] text-white shadow-2xs'
                      : 'text-[#64748B] hover:text-[#111827]'
                  }`}
                >
                  {sc === 'ALL' ? 'All Scope' : sc === 'PRIMARY' ? 'Primary Sites' : 'Delegated Coverage'}
                </button>
              ))}
            </div>
          )}

          {(filterDate || searchWorker || filterExceptionType) && (
            <button
              onClick={() => {
                setFilterDate('');
                setSearchWorker('');
                setFilterExceptionType('');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <RotateCwIcon className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold">Loading Queue Records...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: PENDING ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {filterList(pendingAttendance).length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No Pending Attendance Approvals</p>
                  <p className="text-xs text-slate-400 mt-1">All worker clock-ins for your sites are up to date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterList(pendingAttendance).map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all p-4.5 flex flex-col justify-between space-y-4"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.workerPhoto ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.workerName)}&background=0D8ABC&color=fff`
                            }
                            alt={item.workerName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-100"
                          />
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 m-0">{item.workerName}</h3>
                            <span className="text-[11px] font-semibold text-slate-500 block">
                              ID: {item.employeeCode}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {item.requestAge}
                        </span>
                      </div>

                      {/* Delegation Badge if applicable */}
                      {(item.isDelegated || (item.worksiteId && delegatedScope?.delegatedWorksiteIds?.includes(item.worksiteId))) && (
                        <div className="px-2.5 py-1 rounded-xl bg-[#E6F7EF] text-[#0E8F5B] border border-[#A7F3D0] text-[10px] font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <SecuritySafeIcon className="w-3.5 h-3.5 text-[#12A66A]" />
                            Delegated Coverage Responsibility
                          </span>
                          {item.assignmentSupervisorId && (
                            <span className="text-[#065F46] font-extrabold">Delegated Scope</span>
                          )}
                        </div>
                      )}

                      {/* Worksite & Shift */}
                      <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {item.worksiteName}
                          </span>
                              <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/50">
                          <span className="flex items-center gap-1.5">
                            <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                            {item.shiftName} ({item.shiftStartTime} - {item.shiftEndTime})
                          </span>
                          <span className="font-semibold text-emerald-700">
                            {item.netWorkingDurationFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Geofence & Evidence Status */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-2">
                          {item.isWithinGeofence ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <SecuritySafeIcon className="w-3.5 h-3.5" /> Inside Geofence
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                              <ErrorProfileIcon className="w-3.5 h-3.5" /> {Math.round(item.calculatedDistanceMeters)}m outside
                            </span>
                          )}

                          {item.hasMissingClockOut && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              No Out-Punch
                            </span>
                          )}
                        </div>

                        {item.photoUrl && (
                          <button
                            onClick={() => setInspectItem(item)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                          >
                            <EyeIcon className="w-3.5 h-3.5" /> Inspect
                          </button>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleApproveAttendance(item.id)}
                          disabled={submitting}
                          className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" /> Approve
                        </button>

                        <button
                          onClick={() => openRejectModal(item, 'attendance')}
                          disabled={submitting}
                          className="w-full py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CloseIcon className="w-3.5 h-3.5 stroke-[2.5]" /> Reject
                        </button>
                      </div>

                      {/* Secondary Actions: Clarification & Escalation */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <button
                          onClick={() => {
                            setSelectedForClarify({ id: item.id, type: 'attendance' });
                            setClarifyMessage('');
                            setClarifyModalOpen(true);
                          }}
                          className="hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircleIcon className="w-3 h-3" /> Ask Clarification
                        </button>

                        <button
                          onClick={() => {
                            setSelectedForEscalate({ id: item.id, type: 'attendance' });
                            setEscalateReason('');
                            setEscalateModalOpen(true);
                          }}
                          className="hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRightIcon className="w-3 h-3" /> Escalate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: OVERTIME REVIEW (PHASE 3) */}
          {activeTab === 'overtime' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 m-0">Overtime Review Queue</h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    Review and authorize overtime hours for assigned workers exceeding the 9-hour daily standard threshold.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                  {pendingOvertime.filter((o) => o.otStatus === 'PENDING').length} Pending Decisions
                </span>
              </div>

              {pendingOvertime.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800 m-0">No Overtime Pending Review</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    All worker overtime calculations are either reviewed, within standard working hours, or locked in payroll.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingOvertime.map((item: any) => {
                    const isPendingDecision = item.otStatus === 'PENDING';
                    const isApproved = item.otStatus === 'APPROVED';
                    const isRejected = item.otStatus === 'REJECTED';

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 m-0">{item.workerName}</h4>
                              <span className="text-xs text-slate-500 font-mono">Code: {item.employeeCode}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : isRejected
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {item.otStatus}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold flex items-center gap-1.5 truncate">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {item.worksiteName}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">{item.workDate}</span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                              <span>Punches:</span>
                              <span className="font-mono text-slate-800">
                                {item.clockInTime ? new Date(item.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                {' → '}
                                {item.clockOutTime ? new Date(item.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'MISSING'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1.5 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Net Worked</span>
                                <span className="font-bold text-slate-800">{item.formattedNetHours || `${item.netWorkingMinutes}m`}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Standard (Threshold)</span>
                                <span className="font-bold text-slate-800">9h (540m)</span>
                              </div>
                            </div>
                          </div>

                          {/* Overtime Metric Box */}
                          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block">Calculated OT</span>
                              <span className="text-base font-extrabold text-indigo-950">
                                {item.formattedCalculatedOt || `${item.calculatedOtMinutes}m`}
                              </span>
                            </div>
                            {item.breakDurationMinutes > 0 && (
                              <span className="text-[11px] text-indigo-600 font-medium">
                                -{item.breakDurationMinutes}m break
                              </span>
                            )}
                          </div>

                          {item.hasMissingClockOut && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Missing punch: Clock-out required before OT approval</span>
                            </div>
                          )}

                          {item.otRejectionReason && (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
                              <span className="font-bold block text-[11px]">Rejection Reason:</span>
                              <span>{item.otRejectionReason}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons: Disappear after terminal decision */}
                        {isPendingDecision && !item.hasMissingClockOut ? (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleApproveOvertime(item)}
                              disabled={submitting}
                              className="py-2 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" /> Approve OT
                            </button>

                            <button
                              onClick={() => openRejectModal(item, 'overtime')}
                              disabled={submitting}
                              className="py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <CloseIcon className="w-3.5 h-3.5 stroke-[2.5]" /> Reject
                            </button>
                          </div>
                        ) : isPendingDecision && item.hasMissingClockOut ? (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400 block text-center italic">
                              Cannot approve OT with missing punch
                            </span>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span>Decision Finalized</span>
                            <span className="font-bold text-slate-700">{item.otStatus}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: ATTENDANCE REGULARISATION */}
          {activeTab === 'regularization' && (
            <div className="space-y-4">
              {filterList(pendingRegularization).length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <CheckCircleIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No Pending Attendance Regularisations</p>
                  <p className="text-xs text-slate-400 mt-1">All timestamp correction and missed punch requests are resolved.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Worker</th>
                          <th className="py-3 px-4">Worksite</th>
                          <th className="py-3 px-4">Work Date</th>
                          <th className="py-3 px-4">Proposed Times</th>
                          <th className="py-3 px-4">Worker Reason</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filterList(pendingRegularization)
                          .slice((regPage - 1) * regLimit, regPage * regLimit)
                          .map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center border border-blue-100 text-[11px] shrink-0">
                                  {item.workerName ? item.workerName.slice(0, 2).toUpperCase() : 'WR'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{item.workerName}</div>
                                  <span className="text-[10px] text-slate-400 font-normal">ID: {item.employeeCode}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              <div className="flex items-center gap-1.5">
                                <Building1Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{item.worksiteName || 'Assigned Site'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                              {item.workDate}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5 text-[11px] font-mono">
                                <div>
                                  <span className="text-slate-400 font-sans text-[10px] uppercase font-bold mr-1">In:</span>
                                  <span className="font-bold text-blue-700">
                                    {item.proposedClockInTime ? new Date(item.proposedClockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unchanged'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-sans text-[10px] uppercase font-bold mr-1">Out:</span>
                                  <span className="font-bold text-blue-700">
                                    {item.proposedClockOutTime ? new Date(item.proposedClockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unchanged'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 max-w-[220px]">
                              <p className="text-xs text-amber-900 italic bg-amber-50/70 border border-amber-200/70 rounded-lg p-2 m-0 line-clamp-2" title={item.reason}>
                                "{item.reason}"
                              </p>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {item.status || 'PENDING'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {item.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleApproveRegularization(item.id)}
                                    disabled={submitting}
                                    title="Approve regularisation"
                                    className="p-1.5 text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                  >
                                    <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                                  </button>

                                  <button
                                    onClick={() => openRejectModal(item, 'regularization')}
                                    disabled={submitting}
                                    title="Reject regularisation"
                                    className="p-1.5 text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                  >
                                    <CloseIcon className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {item.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filterList(pendingRegularization).length > 0 && (
                    <DataTablePagination
                      metadata={{
                        total: filterList(pendingRegularization).length,
                        page: regPage,
                        limit: regLimit,
                        offset: (regPage - 1) * regLimit,
                        totalPages: Math.ceil(filterList(pendingRegularization).length / regLimit),
                      }}
                      onPageChange={(p) => setRegPage(p)}
                      onLimitChange={(l) => {
                        setRegLimit(l);
                        setRegPage(1);
                      }}
                      pageSizeOptions={[10, 25, 50]}
                      isLoading={loading}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENDING LEAVE */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              {filterList(pendingLeave).length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No Pending Leave Requests</p>
                  <p className="text-xs text-slate-400 mt-1">All leave submissions are resolved.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterList(pendingLeave).map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4.5 flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.workerPhoto ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.workerName)}&background=8B5CF6&color=fff`
                            }
                            alt={item.workerName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-100"
                          />
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 m-0">{item.workerName}</h3>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {item.leaveTypeName} ({item.leaveTypeCode})
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {item.durationDays} day(s)
                        </span>
                      </div>

                      {/* Dates & Reason */}
                      <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 border border-slate-100">
                        <div className="flex items-center justify-between text-slate-700 font-semibold">
                          <span>
                            {item.startDate} to {item.endDate}
                          </span>
                          {item.isHalfDay && (
                            <span className="text-indigo-600 font-bold">
                              ½ Day ({item.halfDayPeriod === 'FIRST_HALF' ? 'Morning' : 'Afternoon'})
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-[11px] m-0 italic bg-white p-2 rounded-lg border border-slate-100">
                          "{item.reason}"
                        </p>
                      </div>

                      {/* Conflict Warning */}
                      {item.hasConflict && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Attendance Conflict Flagged</span>
                            <span className="text-[11px]">{item.conflictDetails}</span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleApproveLeave(item.id)}
                          disabled={submitting}
                          className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" /> Approve
                        </button>

                        <button
                          onClick={() => openRejectModal(item, 'leave')}
                          disabled={submitting}
                          className="w-full py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CloseIcon className="w-3.5 h-3.5 stroke-[2.5]" /> Reject
                        </button>
                      </div>

                      {/* Escalation Option */}
                      <div className="flex items-center justify-end text-[11px] text-slate-500 pt-1">
                        <button
                          onClick={() => {
                            setSelectedForEscalate({ id: item.id, type: 'leave' });
                            setEscalateReason('');
                            setEscalateModalOpen(true);
                          }}
                          className="hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRightIcon className="w-3 h-3" /> Escalate to Fallback / Admin
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTENDANCE EXCEPTIONS */}
          {activeTab === 'exceptions' && (
            <div className="space-y-4">
              {filterList(exceptions).length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No Open Attendance Exceptions</p>
                  <p className="text-xs text-slate-400 mt-1">No missing punches or conflicts requiring resolution.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Worker</th>
                          <th className="py-3 px-4">Worksite</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Exception Type</th>
                          <th className="py-3 px-4">Severity</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filterList(exceptions)
                          .slice((exceptionPage - 1) * exceptionLimit, exceptionPage * exceptionLimit)
                          .map((ex) => (
                          <tr key={ex.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              <div>{ex.workerName}</div>
                              <span className="text-[10px] text-slate-400 font-normal">ID: {ex.employeeCode}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">{ex.worksiteName || 'Site Location'}</td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">{ex.workDate}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  ex.exceptionType === 'MISSING_CLOCK_IN'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : ex.exceptionType === 'MISSING_CLOCK_OUT'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {ex.exceptionType.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ex.severity === 'HIGH'
                                    ? 'bg-rose-100 text-rose-800'
                                    : ex.severity === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {ex.severity}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-slate-600 text-[11px]">{ex.status}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedForResolve(ex);
                                  setResolutionNote('');
                                  setResolveModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer"
                              >
                                Resolve
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filterList(exceptions).length > 0 && (
                    <DataTablePagination
                      metadata={{
                        total: filterList(exceptions).length,
                        page: exceptionPage,
                        limit: exceptionLimit,
                        offset: (exceptionPage - 1) * exceptionLimit,
                        totalPages: Math.ceil(filterList(exceptions).length / exceptionLimit),
                      }}
                      onPageChange={(p) => setExceptionPage(p)}
                      onLimitChange={(l) => {
                        setExceptionLimit(l);
                        setExceptionPage(1);
                      }}
                      pageSizeOptions={[10, 25, 50]}
                      isLoading={loading}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ESCALATED REQUESTS */}
          {activeTab === 'escalated' && (
            <div className="space-y-4">
              {filterList(escalated).length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No Escalated Requests</p>
                  <p className="text-xs text-slate-400 mt-1">All requests are within standard resolution deadlines.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filterList(escalated).map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-rose-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800">
                            {item.requestType}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{item.workerName}</span>
                          <span className="text-xs text-slate-500 font-mono">({item.employeeCode})</span>
                        </div>
                        <p className="text-xs text-slate-700 m-0">{item.summary}</p>
                        <p className="text-[11px] text-rose-700 font-semibold m-0 flex items-center gap-1">
                          <ErrorProfileIcon className="w-3 h-3" /> {item.escalationReason}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-medium mr-2">{item.age}</span>
                        {item.requestType === 'ATTENDANCE' && (
                          <button
                            onClick={() => handleApproveAttendance(item.id)}
                            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                          >
                            Approve Now
                          </button>
                        )}
                        {item.requestType === 'LEAVE' && (
                          <button
                            onClick={() => handleApproveLeave(item.id)}
                            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                          >
                            Approve Leave
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── MODALS ─── */}

      {/* 1. Rejection Modal (Mandatory Reason) */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={selectedForReject?.type === 'attendance' ? 'Reject Attendance Verification' : 'Reject Leave Request'}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            A mandatory reason is required to reject this request. This will be preserved in the audit log and visible
            to the worker.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Provide reason (e.g., Worker was not visible at site location during shift inspection)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={submitting || !rejectReason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Clarification Modal */}
      <Modal isOpen={clarifyModalOpen} onClose={() => setClarifyModalOpen(false)} title="Request Worker Clarification">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Send an official inquiry notification to the worker regarding this request.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Inquiry / Message <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Please clarify why clock-in was recorded at 09:45 AM instead of 08:00 AM..."
              value={clarifyMessage}
              onChange={(e) => setClarifyMessage(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setClarifyModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleClarificationSubmit}
              disabled={submitting || !clarifyMessage.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <EmailSentIcon className="w-3.5 h-3.5" /> Send Inquiry
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Exception Resolution Modal */}
      <Modal isOpen={resolveModalOpen} onClose={() => setResolveModalOpen(false)} title="Resolve Attendance Exception">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Resolution Outcome</label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-white"
            >
              <option value="EXCUSED_ABSENCE">Excused Absence (Permitted Leave / Medical)</option>
              <option value="UNEXCUSED_ABSENCE">Confirmed Unexcused Absence</option>
              <option value="APPROVED_LEAVE">Converted to Approved Leave</option>
              <option value="CORRECTION_REQUIRED">Attendance Correction Required</option>
              <option value="LATE_ARRIVAL">Late Arrival / Partial Attendance</option>
              <option value="CONFIGURATION_ERROR">Assignment / Roster Configuration Error</option>
              <option value="DUPLICATE_INVALID">Duplicate / Invalid Record</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Resolution Note & Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="State the findings and reason for this resolution outcome..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setResolveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveExceptionSubmit}
              disabled={submitting || !resolutionNote.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
            >
              Resolve Exception
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Manual Escalation Modal */}
      <Modal isOpen={escalateModalOpen} onClose={() => setEscalateModalOpen(false)} title="Escalate Request">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Escalate this request to the fallback supervisor or the admin exception queue for immediate management intervention.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Escalation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Explain why this request is being escalated (e.g. Disputed hours, supervisor travelling)..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEscalateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleManualEscalateSubmit}
              disabled={submitting || !escalateReason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
            >
              Confirm Escalation
            </button>
          </div>
        </div>
      </Modal>

      {/* 5. Inspection Modal (Selfie & Geofence Evidence) */}
      <Modal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        title={`Inspection: ${inspectItem?.workerName}`}
      >
        {inspectItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-center bg-slate-900 rounded-2xl overflow-hidden p-2">
              <img
                src={inspectItem.photoUrl}
                alt="Selfie Evidence"
                className="max-h-72 w-auto object-contain rounded-xl"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Worksite:</span>
                <span className="font-semibold text-slate-800">{inspectItem.worksiteName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Shift:</span>
                <span className="font-semibold text-slate-800">
                  {inspectItem.workDate} ({inspectItem.shiftName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Geofence Distance:</span>
                <span className={`font-semibold ${inspectItem.isWithinGeofence ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {Math.round(inspectItem.calculatedDistanceMeters)} meters
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clock-in Time:</span>
                <span className="font-semibold text-slate-800">
                  {inspectItem.clockInTime ? new Date(inspectItem.clockInTime).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleApproveAttendance(inspectItem.id)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer shadow-xs"
              >
                Approve Clock-In
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

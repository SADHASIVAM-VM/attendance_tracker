import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  FileEdit,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Search,
  RefreshCw,
  Check,
  X,
  Building2,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { SupervisorWorksite } from '../../types/supervisor';

type RegularizationFilter = 'approved' | 'pending' | 'rejected' | 'all';

interface SupervisorRegularizationViewProps {
  currentWorksite?: SupervisorWorksite;
}

export const SupervisorRegularizationView: React.FC<SupervisorRegularizationViewProps> = ({
  currentWorksite,
}) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<RegularizationFilter>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [targetRequest, setTargetRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load requests from backend
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all requests for supervisor scope
      const data = await apiRequest<any>('/regularization/requests');
      const list = Array.isArray(data) ? data : data?.requests || [];
      setRequests(list);
    } catch (err: any) {
      console.error('Failed to load regularization requests:', err);
      setMessage({ text: err.message || 'Failed to load regularizations', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Derived KPI Stat Card Counts from real backend data
  const statCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    requests.forEach((r) => {
      const st = (r.status || '').toUpperCase();
      if (st === 'PENDING') pending++;
      else if (st === 'APPROVED') approved++;
      else if (st === 'REJECTED') rejected++;
    });

    return {
      all: requests.length,
      pending,
      approved,
      rejected,
    };
  }, [requests]);

  // Filter requests based on selected tab and search query
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Status Filter: { approved, pending, rejected, all }
      const st = (r.status || '').toUpperCase();
      if (statusFilter === 'approved' && st !== 'APPROVED') return false;
      if (statusFilter === 'pending' && st !== 'PENDING') return false;
      if (statusFilter === 'rejected' && st !== 'REJECTED') return false;

      // 2. Search Query (worker name, emp code, worksite, reason)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const workerMatch = r.workerName?.toLowerCase().includes(q);
        const codeMatch = r.employeeCode?.toLowerCase().includes(q);
        const siteMatch = r.worksiteName?.toLowerCase().includes(q);
        const reasonMatch = r.reason?.toLowerCase().includes(q);
        const typeMatch = r.correctionType?.toLowerCase().includes(q);
        if (!workerMatch && !codeMatch && !siteMatch && !reasonMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  // Approve handler
  const handleApprove = async (id: string, workerName: string) => {
    try {
      setIsSubmitting(true);
      // Optimistic state update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'APPROVED', reviewNote: 'Approved by site supervisor' }
            : r
        )
      );

      await apiRequest(`/regularization/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: 'Approved by site supervisor' }),
      });

      setMessage({
        text: `Regularization request for ${workerName} was approved. Attendance and overtime updated.`,
        type: 'success',
      });
      loadRequests();
    } catch (err: any) {
      setMessage({ text: err.message || 'Approval failed', type: 'error' });
      loadRequests();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open rejection modal
  const openRejectModal = (request: any) => {
    setTargetRequest(request);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  // Confirm rejection
  const handleConfirmReject = async () => {
    if (!targetRequest) return;
    const trimmed = rejectReason.trim();
    if (!trimmed || trimmed.length < 3) {
      alert('A mandatory reason of at least 3 characters is required to reject a regularization.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Optimistic state update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === targetRequest.id
            ? { ...r, status: 'REJECTED', reviewNote: trimmed }
            : r
        )
      );

      await apiRequest(`/regularization/${targetRequest.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: trimmed }),
      });

      setMessage({
        text: `Regularization request for ${targetRequest.workerName} rejected. Original attendance record preserved.`,
        type: 'success',
      });
      setRejectModalOpen(false);
      setTargetRequest(null);
      loadRequests();
    } catch (err: any) {
      setMessage({ text: err.message || 'Rejection failed', type: 'error' });
      loadRequests();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-20">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 m-0 flex items-center gap-2">
            <FileEdit className="w-6 h-6 text-indigo-600" />
            Worker Attendance Regularization
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review and adjudicate clock-in and clock-out adjustment requests submitted by workers for the current month.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Flash Alert ──────────────────────────────────────────────────────── */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border flex items-center justify-between shadow-xs transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-[11px] font-bold uppercase tracking-wider underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── STAT CARDS (Total, Pending, Approved, Rejected) ──────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Approved */}
        <button
          type="button"
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'approved'
              ? 'bg-[#E6F7EF] border-2 border-[#12A66A] shadow-xs ring-1 ring-[#12A66A]'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#0E8F5B] tabular-nums">{statCounts.approved}</div>
          <span className="text-[10px] text-emerald-600/80 font-medium mt-1">Adjustments applied</span>
        </button>

        {/* 2. Pending */}
        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'pending'
              ? 'bg-amber-50 border-2 border-amber-500 shadow-xs ring-1 ring-amber-400'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 tabular-nums">{statCounts.pending}</div>
          <span className="text-[10px] text-amber-600/80 font-medium mt-1">Awaiting decision</span>
        </button>

        {/* 3. Rejected */}
        <button
          type="button"
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'rejected'
              ? 'bg-rose-50 border-2 border-rose-500 shadow-xs ring-1 ring-rose-400'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 tabular-nums">{statCounts.rejected}</div>
          <span className="text-[10px] text-rose-600/80 font-medium mt-1">Requests declined</span>
        </button>

        {/* 4. All */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'all'
              ? 'bg-indigo-50 border-2 border-indigo-600 shadow-xs ring-1 ring-indigo-500'
              : 'bg-white border border-[#E8EEF4] hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">All</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-900 tabular-nums">{statCounts.all}</div>
          <span className="text-[10px] text-indigo-600/80 font-medium mt-1">Total requests</span>
        </button>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Tab Switcher: { approved, pending, rejected, all } */}
        <div className="flex p-1 bg-slate-100 rounded-xl gap-1 w-full sm:w-auto overflow-x-auto">
          {(
            [
              { id: 'approved', label: 'Approved', count: statCounts.approved },
              { id: 'pending', label: 'Pending', count: statCounts.pending },
              { id: 'rejected', label: 'Rejected', count: statCounts.rejected },
              { id: 'all', label: 'All', count: statCounts.all },
            ] as const
          ).map(({ id, label, count }) => {
            const isActive = statusFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search worker, site, reason..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── REGULARIZATION CARDS GRID ────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-16 bg-slate-100 rounded-xl" />
              <div className="h-8 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs space-y-2">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-slate-900 text-base">
            No {statusFilter !== 'all' ? statusFilter : ''} regularization requests
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No requests match "${searchQuery}". Try clearing your search query.`
              : `There are currently no ${statusFilter} regularization requests in your supervisor queue.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((item) => {
            const isPending = item.status === 'PENDING';
            const isApproved = item.status === 'APPROVED';
            const isRejected = item.status === 'REJECTED';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-3.5 flex flex-col justify-between"
              >
                {/* Header: Worker Name + Emp ID + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base m-0 flex items-center gap-1.5">
                      {item.workerName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">{item.employeeCode}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {item.worksiteName}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {/* Details Box: Work Date, Correction Type, Timestamps */}
                <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Work Date:</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {item.workDate}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Correction Type:</span>
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {(item.correctionType || 'INCORRECT_HOURS').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="border-t border-slate-200/80 pt-2 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Proposed Clock In:</span>
                      <span className="font-semibold text-indigo-900 tabular-nums">
                        {item.proposedClockInTime
                          ? new Date(item.proposedClockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Unchanged'}
                        {item.originalClockInTime && (
                          <span className="text-slate-400 text-[11px] ml-1.5 font-normal">
                            (was {new Date(item.originalClockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Proposed Clock Out:</span>
                      <span className="font-semibold text-indigo-900 tabular-nums">
                        {item.proposedClockOutTime
                          ? new Date(item.proposedClockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Unchanged'}
                        {item.originalClockOutTime && (
                          <span className="text-slate-400 text-[11px] ml-1.5 font-normal">
                            (was {new Date(item.originalClockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Worker Justification */}
                <div className="text-xs p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-amber-950">
                  <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-800">
                    Worker Justification
                  </span>
                  <p className="mt-1 font-medium leading-relaxed">{item.reason}</p>
                </div>

                {/* Evidence Link if provided */}
                {item.supportingEvidenceUrl && (
                  <div className="text-xs">
                    <a
                      href={item.supportingEvidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Supporting Document / Evidence
                    </a>
                  </div>
                )}

                {/* Reviewer Note (if already decided) */}
                {(isApproved || isRejected) && item.reviewNote && (
                  <div
                    className={`text-xs p-3 rounded-xl border ${
                      isApproved
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-950'
                        : 'bg-rose-50 border-rose-100 text-rose-950'
                    }`}
                  >
                    <span className="font-bold block text-[10px] uppercase tracking-wider">
                      Supervisor Decision Note
                    </span>
                    <p className="mt-1">{item.reviewNote}</p>
                    {item.reviewedAt && (
                      <span className="text-[10px] opacity-75 mt-1 block">
                        Reviewed on {new Date(item.reviewedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons for Pending */}
                {isPending && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleApprove(item.id, item.workerName)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Approve Correction
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => openRejectModal(item)}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── REJECTION MODAL (Mandatory Reason) ────────────────────────────────── */}
      {rejectModalOpen && targetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Reject Regularization Request
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are rejecting the attendance correction for{' '}
              <strong className="text-slate-900">{targetRequest.workerName}</strong> on{' '}
              <strong className="text-slate-900">{targetRequest.workDate}</strong>. The original attendance record will remain unchanged.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Mandatory Explanation / Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this regularization cannot be accepted (min. 3 characters)..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
              <span className="text-[11px] text-slate-400">
                This note will be communicated directly to the employee.
              </span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || rejectReason.trim().length < 3}
                onClick={handleConfirmReject}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

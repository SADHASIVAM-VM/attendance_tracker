import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const qStatus = (searchParams.get('status') || 'pending').toLowerCase() as RegularizationFilter;
  const statusFilter: RegularizationFilter = ['approved', 'pending', 'rejected', 'all'].includes(qStatus)
    ? qStatus
    : 'pending';

  const setStatusFilter = (st: RegularizationFilter) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('status', st);
      return next;
    });
    setPage(1);
  };

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pagination fixed at default 10 per page
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

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

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRequests.slice(start, start + limit);
  }, [filteredRequests, page, limit]);

  const formatPunchTime = (timeStr?: string | null) => {
    if (!timeStr) return null;
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? timeStr : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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

      {/* ── REGULARIZATION TABLE ────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#12A66A] mb-2" />
          <span>Loading regularization requests...</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Worker</th>
                  <th className="py-3 px-4">Work Date</th>
                  <th className="py-3 px-4">Worksite</th>
                  <th className="py-3 px-4">Correction Type</th>
                  <th className="py-3 px-4">Requested Times</th>
                  <th className="py-3 px-4">Worker Justification</th>
                  <th className="py-3 px-4">Supervisor Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedRequests.map((item) => {
                  const isPending = item.status === 'PENDING';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Worker */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.workerAvatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.workerName || 'Worker')}&background=0D8ABC&color=fff`
                            }
                            alt={item.workerName}
                            className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{item.workerName}</span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {item.employeeCode || 'EMP-NA'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Work Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.workDate}</span>
                        </div>
                      </td>

                      {/* 3. Worksite */}
                      <td className="py-3 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.worksiteName || 'Assigned Site'}</span>
                        </div>
                      </td>

                      {/* 4. Correction Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-50 text-purple-800 border border-purple-200">
                          {(item.correctionType || 'OTHER').replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* 5. Requested Times */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-0.5 text-xs font-mono">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-sans mr-1">In:</span>
                            <span className="font-semibold text-emerald-700">
                              {formatPunchTime(item.proposedClockInTime) || 'Unchanged'}
                            </span>
                            {item.originalClockInTime && (
                              <span className="text-slate-400 text-[10px] ml-1 font-normal font-sans">
                                (was {formatPunchTime(item.originalClockInTime)})
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-sans mr-1">Out:</span>
                            <span className="font-semibold text-blue-700">
                              {formatPunchTime(item.proposedClockOutTime) || 'Unchanged'}
                            </span>
                            {item.originalClockOutTime && (
                              <span className="text-slate-400 text-[10px] ml-1 font-normal font-sans">
                                (was {formatPunchTime(item.originalClockOutTime)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 6. Worker Justification */}
                      <td className="py-3 px-4 max-w-xs text-xs">
                        <span className="text-slate-800 font-medium block truncate" title={item.reason}>
                          {item.reason || '—'}
                        </span>
                        {item.supportingEvidenceUrl && (
                          <a
                            href={item.supportingEvidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-[10px] font-semibold inline-flex items-center gap-1 underline mt-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Evidence</span>
                          </a>
                        )}
                      </td>

                      {/* 7. Supervisor Notes */}
                      <td className="py-3 px-4 max-w-xs text-xs">
                        {item.reviewNote ? (
                          <div className="space-y-0.5">
                            <span className="text-slate-800 font-medium block truncate" title={item.reviewNote}>
                              {item.reviewNote}
                            </span>
                            {item.reviewedAt && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {new Date(item.reviewedAt).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                                {' • '}
                                {new Date(item.reviewedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(item.id, item.workerName)}
                                disabled={isSubmitting}
                                title="Approve"
                                aria-label="Approve"
                                className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 disabled:opacity-50"
                              >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openRejectModal(item)}
                                disabled={isSubmitting}
                                title="Reject"
                                aria-label="Reject"
                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 disabled:opacity-50"
                              >
                                <X className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DataTablePagination
            metadata={{
              total: filteredRequests.length,
              page,
              limit,
              offset: (page - 1) * limit,
              totalPages: Math.ceil(filteredRequests.length / limit) || 1,
            }}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            isLoading={loading}
          />
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
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
  Calendar,
  Filter,
  Eye,
  MapPin,
  ShieldCheck,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';

export type RegularizationFilterTab = 'pending' | 'approved' | 'rejected' | 'all';

export const AdminRegularizationView: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<RegularizationFilterTab>('pending');

  // Filters
  const [selectedWorksite, setSelectedWorksite] = useState<string>('ALL');
  const [selectedCorrectionType, setSelectedCorrectionType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [approveModalTarget, setApproveModalTarget] = useState<any | null>(null);
  const [approveNote, setApproveNote] = useState<string>('Approved by administrator');
  const [isSubmittingApprove, setIsSubmittingApprove] = useState<boolean>(false);

  const [rejectModalTarget, setRejectModalTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  const [detailsModalTarget, setDetailsModalTarget] = useState<any | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Load Requests and Worksites
  const loadRequests = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const [data, wsData] = await Promise.all([
        apiRequest<any>('/regularization/requests'),
        apiRequest<any>('/worksites').catch(() => []),
      ]);

      const list = Array.isArray(data) ? data : data?.requests || [];
      setRequests(list);

      const wsList = Array.isArray(wsData) ? wsData : wsData?.data || [];
      setWorksites(wsList);
    } catch (err: any) {
      console.error('Failed to load regularization requests:', err);
      showToast(err.message || 'Failed to load regularisation requests', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Derived KPI Counts
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

  // Filter requests based on status tab, worksite, correction type, and search
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Status Filter
      const st = (r.status || '').toUpperCase();
      if (activeTab === 'pending' && st !== 'PENDING') return false;
      if (activeTab === 'approved' && st !== 'APPROVED') return false;
      if (activeTab === 'rejected' && st !== 'REJECTED') return false;

      // 2. Worksite Filter
      if (selectedWorksite !== 'ALL') {
        if (r.worksiteId !== selectedWorksite) return false;
      }

      // 3. Correction Type Filter
      if (selectedCorrectionType !== 'ALL') {
        if (r.correctionType !== selectedCorrectionType) return false;
      }

      // 4. Search Query
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
  }, [requests, activeTab, selectedWorksite, selectedCorrectionType, searchQuery]);

  // Pagination slice
  const paginatedRequests = useMemo(() => {
    const startIdx = (page - 1) * limit;
    return filteredRequests.slice(startIdx, startIdx + limit);
  }, [filteredRequests, page, limit]);

  const paginationMeta: PaginationMetadata = useMemo(() => {
    return {
      total: filteredRequests.length,
      page,
      limit,
      offset: (page - 1) * limit,
      totalPages: Math.max(1, Math.ceil(filteredRequests.length / limit)),
    };
  }, [filteredRequests.length, page, limit]);

  // Handle Approve
  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveModalTarget) return;

    try {
      setIsSubmittingApprove(true);
      await apiRequest(`/regularization/${approveModalTarget.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          reviewNote: approveNote.trim() || 'Approved by administrator',
        }),
      });

      showToast(`Regularisation request for ${approveModalTarget.workerName} approved.`);
      setApproveModalTarget(null);
      loadRequests(true);
    } catch (err: any) {
      console.error('Approval failed:', err);
      alert(err.message || 'Failed to approve request');
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  // Handle Reject
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalTarget) return;

    const trimmed = rejectReason.trim();
    if (!trimmed || trimmed.length < 3) {
      alert('A mandatory reason of at least 3 characters is required to reject a regularisation request.');
      return;
    }

    try {
      setIsSubmittingReject(true);
      await apiRequest(`/regularization/${rejectModalTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason: trimmed,
        }),
      });

      showToast(`Regularisation request for ${rejectModalTarget.workerName} rejected.`);
      setRejectModalTarget(null);
      loadRequests(true);
    } catch (err: any) {
      console.error('Rejection failed:', err);
      alert(err.message || 'Failed to reject request');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Format Helper
  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '—';
    try {
      if (timeStr.includes(':') && timeStr.length <= 8) {
        return timeStr;
      }
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold border transition-all animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success'
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

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 p-5 rounded-2xl text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <FileEdit className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
              Attendance Regularisation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-500 text-white shadow-2xs">
              Admin Approvals
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Review, approve, or reject employee attendance correction requests, missing punch regularisations, and hours adjustments across all worksites.
          </p>
        </div>

        <button
          onClick={() => loadRequests(true)}
          disabled={isRefreshing || loading}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50 flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          title="All Requests"
          value={statCounts.all}
          icon={FileCheck2}
          badge="Total History"
        />
        <StatCard
          title="Pending Review"
          value={statCounts.pending}
          icon={Clock}
          badge={statCounts.pending > 0 ? 'Action Needed' : 'All Clear'}
          badgeColor="text-amber-800 bg-amber-100 border-amber-200"
        />
        <StatCard
          title="Approved"
          value={statCounts.approved}
          icon={CheckCircle2}
          badge="Updated"
          badgeColor="text-emerald-700 bg-emerald-50 border-emerald-200"
        />
        <StatCard
          title="Rejected"
          value={statCounts.rejected}
          icon={XCircle}
          badge="Declined"
          badgeColor="text-rose-700 bg-rose-50 border-rose-200"
        />
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('pending');
                setPage(1);
              }}
              className={`px-5 py-2.5 rounded-full text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-[#1E1F24] text-white font-bold shadow-xs'
                  : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] font-semibold shadow-2xs'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending Review</span>
              {statCounts.pending > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pending' ? 'bg-amber-400/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                }`}>
                  {statCounts.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('approved');
                setPage(1);
              }}
              className={`px-5 py-2.5 rounded-full text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'approved'
                  ? 'bg-[#1E1F24] text-white font-bold shadow-xs'
                  : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] font-semibold shadow-2xs'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#01B075]" />
              <span>Approved</span>
              <span className={`text-[10px] font-semibold ${activeTab === 'approved' ? 'text-white/70' : 'text-[#94A3B8]'}`}>
                ({statCounts.approved})
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('rejected');
                setPage(1);
              }}
              className={`px-5 py-2.5 rounded-full text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'rejected'
                  ? 'bg-[#1E1F24] text-white font-bold shadow-xs'
                  : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] font-semibold shadow-2xs'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Rejected</span>
              <span className={`text-[10px] font-semibold ${activeTab === 'rejected' ? 'text-white/70' : 'text-[#94A3B8]'}`}>
                ({statCounts.rejected})
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('all');
                setPage(1);
              }}
              className={`px-5 py-2.5 rounded-full text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-[#1E1F24] text-white font-bold shadow-xs'
                  : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] font-semibold shadow-2xs'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>All Requests</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredRequests.length}</strong> matching request(s)
          </div>
        </div>

        {/* Secondary Filter Line */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Worksite Filter */}
          <div className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWorksite}
              onChange={(e) => {
                setSelectedWorksite(e.target.value);
                setPage(1);
              }}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Worksites</option>
              {worksites.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.code || 'Site'})
                </option>
              ))}
            </select>
          </div>

          {/* Correction Type Filter */}
          <select
            value={selectedCorrectionType}
            onChange={(e) => {
              setSelectedCorrectionType(e.target.value);
              setPage(1);
            }}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="ALL">All Correction Types</option>
            <option value="MISSING_CLOCK_IN">Missing Clock-In</option>
            <option value="MISSING_CLOCK_OUT">Missing Clock-Out</option>
            <option value="INCORRECT_CLOCK_IN">Incorrect Clock-In</option>
            <option value="INCORRECT_CLOCK_OUT">Incorrect Clock-Out</option>
            <option value="INCORRECT_HOURS">Incorrect Hours</option>
            <option value="INCORRECT_SITE">Incorrect Site</option>
            <option value="OTHER">Other Reason</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search worker name, code, worksite, reason..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-full border border-[#E8EEF4] bg-white text-[#1E1F24] placeholder-[#94A3B8] shadow-2xs hover:border-[#CBD5E1] focus:outline-none focus:border-[#01B075] focus:ring-1 focus:ring-[#01B075] transition-all"
            />
          </div>

          {(selectedWorksite !== 'ALL' || selectedCorrectionType !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedWorksite('ALL');
                setSelectedCorrectionType('ALL');
                setSearchQuery('');
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Worker</th>
                <th className="py-3.5 px-4">Worksite</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Correction Type</th>
                <th className="py-3.5 px-4">Original Punch</th>
                <th className="py-3.5 px-4">Proposed Punch</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-2" />
                    <span>Loading regularisation requests...</span>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    <FileCheck2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <span className="font-semibold text-slate-700 block text-sm">No regularisation requests</span>
                    <span>No requests found matching the current tab and filters.</span>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((r) => {
                  const isPending = (r.status || '').toUpperCase() === 'PENDING';
                  const isApproved = (r.status || '').toUpperCase() === 'APPROVED';
                  const isRejected = (r.status || '').toUpperCase() === 'REJECTED';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Worker */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              r.workerAvatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(r.workerName || 'Worker')}&background=0D8ABC&color=fff`
                            }
                            alt={r.workerName}
                            className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{r.workerName}</span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {r.employeeCode || 'EMP-NA'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Worksite */}
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{r.worksiteName || 'Assigned Site'}</span>
                        </div>
                      </td>

                      {/* 3. Date */}
                      <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{r.workDate}</span>
                        </div>
                      </td>

                      {/* 4. Correction Type */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-50 text-purple-800 border border-purple-200">
                          {(r.correctionType || 'OTHER').replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* 5. Original Punch */}
                      <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                        <div>
                          In: {formatTime(r.originalClockInTime)}
                        </div>
                        <div>
                          Out: {formatTime(r.originalClockOutTime)}
                        </div>
                      </td>

                      {/* 6. Proposed Punch */}
                      <td className="py-3 px-4 text-xs font-mono">
                        <div className="text-emerald-700 font-semibold">
                          In: {formatTime(r.proposedClockInTime)}
                        </div>
                        <div className="text-blue-700 font-semibold">
                          Out: {formatTime(r.proposedClockOutTime)}
                        </div>
                      </td>

                      {/* 7. Reason */}
                      <td className="py-3 px-4 text-xs max-w-xs">
                        <span className="font-medium text-slate-800 block truncate" title={r.reason}>
                          "{r.reason || 'No reason specified'}"
                        </span>
                        {r.reviewNote && (
                          <span className="text-[10px] text-slate-400 italic block mt-0.5 truncate" title={r.reviewNote}>
                            Note: {r.reviewNote}
                          </span>
                        )}
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setApproveModalTarget(r);
                                  setApproveNote('Approved by administrator');
                                }}
                                title="Approve"
                                aria-label="Approve"
                                className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                              >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalTarget(r);
                                  setRejectReason('');
                                }}
                                title="Reject"
                                aria-label="Reject"
                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                              >
                                <X className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDetailsModalTarget(r)}
                              title="View Details"
                              aria-label="Details"
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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

      {/* ── APPROVE CONFIRMATION MODAL ────────────────────────────────────── */}
      {approveModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold m-0 text-white">Approve Regularisation</h3>
              </div>
              <button
                onClick={() => setApproveModalTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmApprove} className="p-5 space-y-4 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block text-sm">{approveModalTarget.workerName}</span>
                <span className="text-xs text-slate-500 block">
                  Date: {approveModalTarget.workDate} • {approveModalTarget.worksiteName}
                </span>
                <span className="text-xs text-purple-700 font-semibold block">
                  Correction: {(approveModalTarget.correctionType || '').replace(/_/g, ' ')}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <span className="font-bold block">Proposed Timestamps to Apply:</span>
                <div className="flex items-center gap-4 font-mono font-semibold">
                  <span>Clock In: {formatTime(approveModalTarget.proposedClockInTime)}</span>
                  <span>Clock Out: {formatTime(approveModalTarget.proposedClockOutTime)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Optional Approval Remarks
                </label>
                <textarea
                  rows={2}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="e.g. Verified with site supervisor logs..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApproveModalTarget(null)}
                  disabled={isSubmittingApprove}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApprove}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#12A66A] hover:bg-[#0f8a58] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmittingApprove ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REJECT CONFIRMATION MODAL ─────────────────────────────────────── */}
      {rejectModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold m-0 text-white">Reject Regularisation</h3>
              </div>
              <button
                onClick={() => setRejectModalTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-5 space-y-4 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block text-sm">{rejectModalTarget.workerName}</span>
                <span className="text-xs text-slate-500 block">
                  Date: {rejectModalTarget.workDate} • {rejectModalTarget.worksiteName}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a mandatory reason why this regularisation is rejected (min 3 characters)..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalTarget(null)}
                  disabled={isSubmittingReject}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReject}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  {isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAILS MODAL ─────────────────────────────────────────────────── */}
      {detailsModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold m-0 text-white">Regularisation Request Details</h3>
              </div>
              <button
                onClick={() => setDetailsModalTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-left text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Worker</span>
                  <span className="font-bold text-slate-900 text-sm">{detailsModalTarget.workerName}</span>
                  <span className="text-slate-500 font-mono text-[11px] block">{detailsModalTarget.employeeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Location</span>
                  <span className="font-semibold text-slate-800">{detailsModalTarget.worksiteName}</span>
                  <span className="text-slate-500 block">Date: {detailsModalTarget.workDate}</span>
                </div>
              </div>

              {/* Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Original Timestamps</span>
                  <div className="font-mono text-slate-700">
                    <div>Clock In: {formatTime(detailsModalTarget.originalClockInTime)}</div>
                    <div>Clock Out: {formatTime(detailsModalTarget.originalClockOutTime)}</div>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-purple-800 block">Requested Timestamps</span>
                  <div className="font-mono text-purple-900 font-semibold">
                    <div>Clock In: {formatTime(detailsModalTarget.proposedClockInTime)}</div>
                    <div>Clock Out: {formatTime(detailsModalTarget.proposedClockOutTime)}</div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">Worker Reason</span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-medium">
                  "{detailsModalTarget.reason || 'No explanation provided'}"
                </div>
              </div>

              {/* Reviewer Note */}
              {detailsModalTarget.reviewNote && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">Supervisor / Admin Remarks</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 italic">
                    "{detailsModalTarget.reviewNote}"
                  </div>
                </div>
              )}

              {/* Supporting Evidence Image if any */}
              {detailsModalTarget.supportingEvidenceUrl && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">Supporting Evidence</span>
                  <a
                    href={detailsModalTarget.supportingEvidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Evidence File</span>
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailsModalTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRegularizationView;

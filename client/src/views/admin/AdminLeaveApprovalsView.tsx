import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
import {
  Check,
  X,
  ShieldCheck,
  CalendarDays,
  Search,
  RefreshCw,
  User,
  AlertTriangle,
  RotateCcw,
  Clock,
  Star,
  CheckCircle2,
  Calendar,
  Eye,
  Building,
  Mail,
  FileText,
} from 'lucide-react';

type LeaveFilterTab = 'all-pending' | 'supervisors' | 'workers' | 'approved' | 'rejected' | 'all';

export const AdminLeaveApprovalsView: React.FC = () => {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<LeaveFilterTab>('all-pending');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pagination states using shadcn DataTablePagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Leave Details Modal State
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState<any | null>(null);

  // Approval Confirmation Modal State
  const [confirmApproveModal, setConfirmApproveModal] = useState<any | null>(null);
  const [approveNote, setApproveNote] = useState<string>('');

  // Rejection Confirmation Modal State
  const [confirmRejectModal, setConfirmRejectModal] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Revocation Confirmation Modal State
  const [confirmRevokeModal, setConfirmRevokeModal] = useState<any | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaves();
  }, []);

  // Reset to page 1 whenever tab or search filter changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      // Fetch both pending and team leaves to have complete visibility
      const [teamRes, pendingRes] = await Promise.allSettled([
        apiRequest('/leave/requests/team'),
        apiRequest('/leave/requests/pending'),
      ]);

      let combined: any[] = [];
      if (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)) {
        combined = teamRes.value;
      }

      // If pending has records not in teamRes, merge them
      if (pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value)) {
        const existingIds = new Set(combined.map((c) => c.id));
        pendingRes.value.forEach((p) => {
          if (!existingIds.has(p.id)) {
            combined.push(p);
          }
        });
      }

      // Ensure unique by ID
      const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());
      setLeaves(unique);

      // If details modal is open, refresh its data
      if (selectedLeaveDetails) {
        const updated = unique.find((item) => item.id === selectedLeaveDetails.id);
        if (updated) setSelectedLeaveDetails(updated);
      }
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to load leave records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open Approval Confirmation
  const handleOpenApproveModal = (leave: any) => {
    const isSupervisor = leave.requesterRole === 'SUPERVISOR';
    setConfirmApproveModal(leave);
    setApproveNote(
      isSupervisor
        ? 'Approved by Administrator per executive staffing plan'
        : 'Approved per company leave policy'
    );
  };

  // Confirm Approval
  const handleConfirmApprove = async () => {
    if (!confirmApproveModal) return;
    try {
      setActionLoading(true);
      await apiRequest(`/leave/requests/${confirmApproveModal.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: approveNote.trim() || 'Approved by Administrator' }),
      });
      setToastMessage({
        text: `Leave request for ${confirmApproveModal.workerName} approved successfully.`,
        type: 'success',
      });
      setConfirmApproveModal(null);
      await loadLeaves();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to approve leave request', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Rejection Confirmation
  const handleOpenRejectModal = (leave: any) => {
    setConfirmRejectModal(leave);
    setRejectReason('');
    setRejectError(null);
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!confirmRejectModal) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectError('Please enter a rejection reason before confirming.');
      return;
    }

    try {
      setActionLoading(true);
      setRejectError(null);
      await apiRequest(`/leave/requests/${confirmRejectModal.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: trimmed }),
      });
      setToastMessage({
        text: `Leave request for ${confirmRejectModal.workerName} rejected.`,
        type: 'success',
      });
      setConfirmRejectModal(null);
      await loadLeaves();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to reject leave request', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Revocation Confirmation
  const handleOpenRevokeModal = (leave: any) => {
    setConfirmRevokeModal(leave);
    setRevokeReason('');
    setRevokeError(null);
  };

  // Confirm Revocation
  const handleConfirmRevoke = async () => {
    if (!confirmRevokeModal) return;
    const trimmed = revokeReason.trim();
    if (trimmed.length < 3) {
      setRevokeError('Please enter a valid revocation reason of at least 3 characters.');
      return;
    }

    try {
      setActionLoading(true);
      setRevokeError(null);
      await apiRequest(`/leave/requests/${confirmRevokeModal.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ revocationReason: trimmed }),
      });
      setToastMessage({
        text: `Approved leave for ${confirmRevokeModal.workerName} has been revoked.`,
        type: 'success',
      });
      setConfirmRevokeModal(null);
      await loadLeaves();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to revoke leave');
    } finally {
      setActionLoading(false);
    }
  };

  // KPI Calculations
  const supervisorPending = leaves.filter(
    (l) => l.status === 'PENDING' && l.requesterRole === 'SUPERVISOR'
  );
  const workerPending = leaves.filter(
    (l) => l.status === 'PENDING' && l.requesterRole !== 'SUPERVISOR'
  );
  const totalPending = leaves.filter((l) => l.status === 'PENDING');
  const totalApproved = leaves.filter((l) => l.status === 'APPROVED');
  const totalRejected = leaves.filter((l) => l.status === 'REJECTED' || l.status === 'REVOKED');

  // Filtered dataset
  const filteredLeaves = leaves.filter((l) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (l.workerName || '').toLowerCase().includes(q);
      const matchCode = (l.employeeCode || '').toLowerCase().includes(q);
      const matchType = (l.leaveTypeName || '').toLowerCase().includes(q);
      const matchReason = (l.reason || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchType && !matchReason) return false;
    }

    // Tab filter
    if (activeTab === 'all-pending') return l.status === 'PENDING';
    if (activeTab === 'supervisors') return l.requesterRole === 'SUPERVISOR' && l.status === 'PENDING';
    if (activeTab === 'workers') return l.requesterRole !== 'SUPERVISOR' && l.status === 'PENDING';
    if (activeTab === 'approved') return l.status === 'APPROVED';
    if (activeTab === 'rejected') return l.status === 'REJECTED' || l.status === 'REVOKED';
    return true; // 'all'
  });

  // Client-side pagination metadata using shadcn
  const total = filteredLeaves.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const paginatedLeaves = filteredLeaves.slice(offset, offset + limit);

  const paginationMetadata: PaginationMetadata = {
    total,
    page,
    limit,
    offset,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border shadow-sm transition-all duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8EEF4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#E6F7EF] text-[#12A66A]">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 m-0">Leave Approvals & Records</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review, approve, or reject employee and supervisor leave requests with complete audit logs
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Refresh Button */}
          <button
            onClick={loadLeaves}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[#E8EEF4] bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#12A66A]' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Cards View
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Pending Queue"
          value={totalPending.length}
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          subtitle="Awaiting admin action"
        />
        <StatCard
          title="Supervisor Requests"
          value={supervisorPending.length}
          icon={ShieldCheck}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          subtitle="Admin tier review"
        />
        <StatCard
          title="Approved Requests"
          value={totalApproved.length}
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-[#12A66A]"
          subtitle="Excused leave roster"
        />
        <StatCard
          title="Rejected / Revoked"
          value={totalRejected.length}
          icon={AlertTriangle}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-600"
          subtitle="Declined or cancelled"
        />
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E8EEF4] shadow-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('all-pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all-pending'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all-pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {totalPending.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('supervisors')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'supervisors'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Supervisor Requests</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'supervisors' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
              }`}
            >
              {supervisorPending.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workers')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'workers'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Worker Requests</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'workers' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {workerPending.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'approved'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approved</span>
            <span className="text-[10px] text-slate-400">({totalApproved.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rejected'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Rejected / Revoked</span>
            <span className="text-[10px] text-slate-400">({totalRejected.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[#12A66A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>All Records</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, code, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-[#E8EEF4] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-900 shadow-2xs"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E8EEF4] p-12 text-center text-slate-400 text-xs shadow-2xs">
          <RefreshCw className="w-6 h-6 animate-spin text-[#12A66A] mx-auto mb-2" />
          Loading leave applications and records...
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8EEF4] p-12 text-center text-slate-500 shadow-2xs">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-slate-900 text-sm">No Leave Requests Found</p>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === 'supervisors'
              ? 'No pending supervisor leave requests in queue.'
              : 'No leave applications matching the selected filter criteria.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* SIMPLE & CLEAN TABLE LIST VIEW */
        <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E8EEF4] text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Leave Type</th>
                  <th className="py-3.5 px-4">Dates & Duration</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-slate-700">
                {paginatedLeaves.map((l) => {
                  const isSupervisor = l.requesterRole === 'SUPERVISOR';
                  const isPending = l.status === 'PENDING';
                  const isApproved = l.status === 'APPROVED';

                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedLeaveDetails(l)}
                      className={`hover:bg-emerald-50/20 cursor-pointer transition-colors ${
                        isSupervisor && isPending ? 'bg-purple-50/20' : ''
                      }`}
                    >
                      {/* 1. Employee / Applicant */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSupervisor
                                ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                                : 'bg-[#E6F7EF] text-[#12A66A]'
                            }`}
                          >
                            {l.workerName ? l.workerName.slice(0, 2).toUpperCase() : 'EM'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight text-xs hover:text-[#12A66A] transition-colors">
                              {l.workerName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block leading-tight mt-0.5">
                              {l.employeeCode || 'EMP-—'} {l.workerEmail ? `• ${l.workerEmail}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Role / Tier */}
                      <td className="py-3.5 px-4">
                        {isSupervisor ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1 shadow-2xs">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            <span>Supervisor</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                            {l.requesterRole || 'Worker'}
                          </span>
                        )}
                      </td>

                      {/* 3. Leave Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 inline-block">
                            {l.leaveTypeCode || 'CL'}
                          </span>
                          <span className="text-xs text-slate-700 font-medium truncate max-w-[140px]">
                            {l.leaveTypeName || 'Standard'}
                          </span>
                        </div>
                      </td>

                      {/* 4. Dates & Duration */}
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                          {l.isHalfDay ? `Half Day (${l.halfDayPeriod || '1st'})` : 'Full Day'}
                        </span>
                      </td>

                      {/* 5. Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={l.status || 'PENDING'} />
                      </td>

                      {/* 6. Necessary Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details Eye Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeaveDetails(l);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="View Full Leave Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Details</span>
                          </button>

                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenApproveModal(l);
                                }}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-[#12A66A] hover:bg-[#0f8a58] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                                title="Approve Leave Request"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRejectModal(l);
                                }}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                title="Reject Leave Request"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : isApproved ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRevokeModal(l);
                              }}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                              title="Revoke Approved Leave"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 bg-slate-50 rounded-md">
                              Closed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* shadcn DataTablePagination Component */}
          <DataTablePagination
            metadata={paginationMetadata}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedLeaves.map((l) => {
              const isSupervisor = l.requesterRole === 'SUPERVISOR';
              const isPending = l.status === 'PENDING';
              const isApproved = l.status === 'APPROVED';

              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedLeaveDetails(l)}
                  className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer group ${
                    isSupervisor
                      ? 'border-purple-200 ring-1 ring-purple-100 hover:shadow-md'
                      : 'border-[#E8EEF4] hover:border-[#12A66A]/40 hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm m-0 truncate group-hover:text-[#12A66A] transition-colors">
                            {l.workerName}
                          </h3>
                          {isSupervisor && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-purple-600" />
                              <span>Supervisor</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono">{l.employeeCode || 'EMP-—'}</span>
                          {l.workerEmail && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[140px]">{l.workerEmail}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={l.status || 'PENDING'} />
                        <button
                          type="button"
                          onClick={() => setSelectedLeaveDetails(l)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Supervisor Callout Alert */}
                    {isSupervisor && isPending && (
                      <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 text-[11px] text-purple-800 flex items-start gap-2">
                        <Star className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-purple-900">Administrator Review Tier</span>
                          <span>This supervisor absence requires Admin approval before site reallocation.</span>
                        </div>
                      </div>
                    )}

                    {/* Details Box */}
                    <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Leave Type:</span>
                        <span className="font-bold text-slate-900">
                          {l.leaveTypeName || 'Standard'} ({l.leaveTypeCode || 'CL'})
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Dates Requested:</span>
                        <span className="font-semibold text-slate-800">
                          {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Duration:</span>
                        <span className="font-semibold text-slate-800">
                          {l.isHalfDay ? `Half Day (${l.halfDayPeriod || 'First Half'})` : 'Full Day'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedLeaveDetails(l)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                    >
                      Details
                    </button>

                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenApproveModal(l)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg bg-[#12A66A] hover:bg-[#0f8a58] text-white text-xs font-semibold flex items-center gap-1 shadow-xs disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRejectModal(l)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : isApproved ? (
                      <button
                        type="button"
                        onClick={() => handleOpenRevokeModal(l)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* shadcn DataTablePagination Component */}
          <DataTablePagination
            metadata={paginationMetadata}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* ── 1. SELECT RECORD DETAILS DIALOG ──────────────────────────── */}
      {selectedLeaveDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Calendar className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0 leading-tight">
                    Leave Request Details
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0 font-mono">
                    ID: #{selectedLeaveDetails.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedLeaveDetails.status || 'PENDING'} />
                <button
                  type="button"
                  onClick={() => setSelectedLeaveDetails(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Applicant Profile Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      selectedLeaveDetails.requesterRole === 'SUPERVISOR'
                        ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                        : 'bg-[#E6F7EF] text-[#12A66A]'
                    }`}
                  >
                    {selectedLeaveDetails.workerName
                      ? selectedLeaveDetails.workerName.slice(0, 2).toUpperCase()
                      : 'EM'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedLeaveDetails.workerName}
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {selectedLeaveDetails.employeeCode || 'EMP-—'}
                    </span>
                    {selectedLeaveDetails.workerEmail && (
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {selectedLeaveDetails.workerEmail}
                      </span>
                    )}
                  </div>
                </div>

                {selectedLeaveDetails.requesterRole === 'SUPERVISOR' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Supervisor</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedLeaveDetails.requesterRole || 'Worker'}
                  </span>
                )}
              </div>

              {/* Leave Specifications Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Leave Type
                  </span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedLeaveDetails.leaveTypeName || 'Standard'} ({selectedLeaveDetails.leaveTypeCode || 'CL'})
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Schedule
                  </span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedLeaveDetails.isHalfDay
                      ? `Half Day (${selectedLeaveDetails.halfDayPeriod || '1st'})`
                      : 'Full Day'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Dates Requested
                  </span>
                  <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#12A66A]" />
                    <span>
                      {selectedLeaveDetails.startDate}{' '}
                      {selectedLeaveDetails.startDate !== selectedLeaveDetails.endDate
                        ? `to ${selectedLeaveDetails.endDate}`
                        : ''}
                    </span>
                  </div>
                </div>

                {selectedLeaveDetails.createdAt && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                      Submission Timestamp
                    </span>
                    <span className="font-medium text-slate-700 mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(selectedLeaveDetails.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Reason for Absence */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Reason for Absence
                </span>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedLeaveDetails.reason || 'No reason provided by applicant.'}"
                </div>
              </div>

              {/* Review & Decision Audit */}
              {(selectedLeaveDetails.decisionNote || selectedLeaveDetails.reviewerName) && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Review Decision</span>
                  </div>
                  {selectedLeaveDetails.reviewerName && (
                    <p className="text-[11px] text-emerald-800 m-0">
                      Decided by: <strong>{selectedLeaveDetails.reviewerName}</strong>
                    </p>
                  )}
                  {selectedLeaveDetails.decisionNote && (
                    <p className="text-[11px] text-emerald-800 m-0 italic">
                      Decision Note: "{selectedLeaveDetails.decisionNote}"
                    </p>
                  )}
                  {selectedLeaveDetails.decidedAt && (
                    <p className="text-[10px] text-emerald-700 m-0">
                      Decided on: {new Date(selectedLeaveDetails.decidedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Revocation Details */}
              {selectedLeaveDetails.status === 'REVOKED' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
                    <span>Revocation Details</span>
                  </div>
                  {selectedLeaveDetails.revocationReason && (
                    <p className="text-[11px] text-rose-800 m-0 italic">
                      Reason: "{selectedLeaveDetails.revocationReason}"
                    </p>
                  )}
                  {selectedLeaveDetails.revokedByName && (
                    <p className="text-[11px] text-rose-700 m-0">
                      Revoked by: {selectedLeaveDetails.revokedByName}
                    </p>
                  )}
                  {selectedLeaveDetails.revokedAt && (
                    <p className="text-[10px] text-rose-600 m-0">
                      Revoked on: {new Date(selectedLeaveDetails.revokedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedLeaveDetails(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedLeaveDetails.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(selectedLeaveDetails)}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenApproveModal(selectedLeaveDetails)}
                      className="px-4 py-2 rounded-xl bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </>
                )}

                {selectedLeaveDetails.status === 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => handleOpenRevokeModal(selectedLeaveDetails)}
                    className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Revoke Leave</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. APPROVAL CONFIRMATION DIALOG ──────────────────────────── */}
      {confirmApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-2xs">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0">
                    Confirm Leave Approval
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">
                    {confirmApproveModal.requesterRole === 'SUPERVISOR'
                      ? 'Administrator tier approval'
                      : 'Approve employee absence'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmApproveModal(null)}
                disabled={actionLoading}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-bold text-slate-900">
                    {confirmApproveModal.workerName} ({confirmApproveModal.employeeCode || 'EMP-—'})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Leave Type:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmApproveModal.leaveTypeName || 'Standard'} ({confirmApproveModal.leaveTypeCode || 'CL'})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dates:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmApproveModal.startDate} to {confirmApproveModal.endDate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Schedule:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmApproveModal.isHalfDay
                      ? `Half Day (${confirmApproveModal.halfDayPeriod || '1st'})`
                      : 'Full Day'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Decision Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="e.g. Approved per company policy"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-900 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmApproveModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Confirm Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. REJECTION CONFIRMATION DIALOG ─────────────────────────── */}
      {confirmRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs">
                  <X className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0">
                    Confirm Leave Rejection
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">
                    Decline leave request
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRejectModal(null)}
                disabled={actionLoading}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-bold text-slate-900">
                    {confirmRejectModal.workerName} ({confirmRejectModal.employeeCode || 'EMP-—'})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dates:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmRejectModal.startDate} to {confirmRejectModal.endDate}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  placeholder="Explain why this request is being rejected..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 resize-none"
                />
                {rejectError && (
                  <p className="text-[11px] text-rose-600 font-medium m-0">
                    {rejectError}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRejectModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. REVOCATION CONFIRMATION DIALOG ────────────────────────── */}
      {confirmRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2.5 text-amber-800 font-bold text-sm">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Revoke Approved Leave</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRevokeModal(null)}
                disabled={actionLoading}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-bold text-slate-900">
                    {confirmRevokeModal.workerName} ({confirmRevokeModal.employeeCode || 'EMP-—'})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dates:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmRevokeModal.startDate} to {confirmRevokeModal.endDate}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Revocation Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={revokeReason}
                  onChange={(e) => {
                    setRevokeReason(e.target.value);
                    if (revokeError) setRevokeError(null);
                  }}
                  placeholder="Explain why this approved leave is being revoked (minimum 3 characters)..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 resize-none"
                />
                {revokeError && (
                  <p className="text-[11px] text-rose-600 font-medium m-0">
                    {revokeError}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRevokeModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={actionLoading || revokeReason.trim().length < 3}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Revocation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

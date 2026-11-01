import React, { useState, useEffect, useMemo } from 'react';
import { WorkerLeaveItem, LeaveFilter } from '../../types/supervisor';
import { LeaveCard } from '#components/supervisor/LeaveCard';
import { StatusPill } from '#components/supervisor/StatusPill';
import { StatCard } from '../../components/common/StatCard';
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
  CloseIcon,
  CheckIcon,
  EyeIcon,
  SecuritySafeIcon,
  CloseCircleIcon,
  TreeIcon,
} from '@astraicons/react/linear';
import { Loader2, Table, LayoutGrid } from 'lucide-react';

interface SupervisorLeavesTabProps {
  leaves: WorkerLeaveItem[];
  isLoading?: boolean;
  onApproveLeave?: (leaveId: string, note?: string) => void;
  onRejectLeave?: (leaveId: string, reason?: string) => void;
  onRefresh?: () => void;
}

export const SupervisorLeavesTab: React.FC<SupervisorLeavesTabProps> = ({
  leaves,
  isLoading = false,
  onApproveLeave,
  onRejectLeave,
  onRefresh,
}) => {
  const [activeFilter, setActiveFilter] = useState<LeaveFilter>('Today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Selected Record Details Modal State
  const [selectedLeaveForDetails, setSelectedLeaveForDetails] = useState<WorkerLeaveItem | null>(null);

  // Approval Modal State
  const [selectedLeaveForApprove, setSelectedLeaveForApprove] = useState<WorkerLeaveItem | null>(null);
  const [approveNote, setApproveNote] = useState<string>('Approved by supervisor');

  // Rejection Modal State
  const [selectedLeaveForReject, setSelectedLeaveForReject] = useState<WorkerLeaveItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Revocation Modal State
  const [selectedLeaveForRevoke, setSelectedLeaveForRevoke] = useState<WorkerLeaveItem | null>(null);
  const [revocationReason, setRevocationReason] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Stat Strip counts for assigned team
  const onLeaveTodayCount = leaves.filter((l) => {
    return l.status === 'APPROVED' && l.startDate <= todayStr && l.endDate >= todayStr;
  }).length;

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedMonthCount = leaves.filter((l) => l.status === 'APPROVED').length;
  const revokedCount = leaves.filter((l) => l.status === 'REVOKED').length;

  // Filter leaves for team
  const filteredLeaves = leaves.filter((l) => {
    if (
      searchQuery &&
      !l.workerName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !l.leaveType.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    if (activeFilter === 'Today') {
      return (
        l.status === 'APPROVED' &&
        l.startDate <= todayStr &&
        l.endDate >= todayStr
      );
    }
    if (activeFilter === 'Pending') return l.status === 'PENDING';
    if (activeFilter === 'Approved') return l.status === 'APPROVED';
    if (activeFilter === 'Rejected') return l.status === 'REJECTED';
    if (activeFilter === 'Revoked') return l.status === 'REVOKED';
    return true;
  });

  // Reset page to 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  // Check if an approved leave is eligible for supervisor revocation
  const isLeaveEligibleForRevoke = (leave: WorkerLeaveItem) => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
    const currentMonthStr = `${todayYear}-${todayMonth}`;

    const isApproved = leave.status === 'APPROVED';
    const isFuture = leave.startDate > todayStr;
    const startMonth = leave.startDate.substring(0, 7);
    const endMonth = leave.endDate.substring(0, 7);
    const isSameMonth = startMonth === endMonth;
    const isCurrentMonth = startMonth === currentMonthStr && isSameMonth;
    return isApproved && isFuture && isCurrentMonth;
  };

  // Paginated leaves based on current view settings
  const paginatedLeaves = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeaves.slice(start, start + pageSize);
  }, [filteredLeaves, currentPage, pageSize]);

  // Open Actions
  const handleOpenApproveModal = (leave: WorkerLeaveItem) => {
    setSelectedLeaveForApprove(leave);
    setApproveNote('Approved by supervisor');
  };

  const handleOpenRejectModal = (leave: WorkerLeaveItem) => {
    setSelectedLeaveForReject(leave);
    setRejectReason('Site operational demands and scheduling constraints');
    setRejectError(null);
  };

  const handleOpenRevokeModal = (leave: WorkerLeaveItem) => {
    setSelectedLeaveForRevoke(leave);
    setRevocationReason('');
    setRevokeError(null);
  };

  // Confirm Approval
  const handleConfirmApprove = async () => {
    if (!selectedLeaveForApprove) return;
    setIsSubmittingAction(true);
    try {
      if (onApproveLeave) {
        await onApproveLeave(selectedLeaveForApprove.id, approveNote.trim() || 'Approved by supervisor');
      } else {
        await apiRequest(`/leave/requests/${selectedLeaveForApprove.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ decisionNote: approveNote.trim() || 'Approved by supervisor' }),
        });
      }
      setToastMessage({
        text: `Leave request for ${selectedLeaveForApprove.workerName} approved successfully.`,
        type: 'success',
      });
      setSelectedLeaveForApprove(null);
      setSelectedLeaveForDetails(null);
      if (onRefresh) onRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage({
        text: err.message || 'Failed to approve leave request.',
        type: 'error',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!selectedLeaveForReject) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectError('Please specify a rejection reason before confirming.');
      return;
    }
    setIsSubmittingAction(true);
    setRejectError(null);
    try {
      if (onRejectLeave) {
        await onRejectLeave(selectedLeaveForReject.id, trimmed);
      } else {
        await apiRequest(`/leave/requests/${selectedLeaveForReject.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ decisionNote: trimmed }),
        });
      }
      setToastMessage({
        text: `Leave request for ${selectedLeaveForReject.workerName} rejected.`,
        type: 'success',
      });
      setSelectedLeaveForReject(null);
      setSelectedLeaveForDetails(null);
      if (onRefresh) onRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage({
        text: err.message || 'Failed to reject leave request.',
        type: 'error',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Confirm Revocation
  const handleConfirmRevoke = async () => {
    if (!selectedLeaveForRevoke) return;
    const trimmed = revocationReason.trim();
    if (trimmed.length < 3) {
      setRevokeError('Please enter a valid revocation reason of at least 3 characters.');
      return;
    }

    setIsSubmittingAction(true);
    setRevokeError(null);

    try {
      await apiRequest(`/leave/requests/${selectedLeaveForRevoke.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ revocationReason: trimmed }),
      });

      setToastMessage({
        text: `Leave for ${selectedLeaveForRevoke.workerName} (${selectedLeaveForRevoke.startDate} to ${selectedLeaveForRevoke.endDate}) has been revoked.`,
        type: 'success',
      });
      setSelectedLeaveForRevoke(null);
      setSelectedLeaveForDetails(null);
      setRevocationReason('');
      if (onRefresh) onRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      const msg = err.message || err.error || 'Failed to revoke leave request.';
      setRevokeError(msg);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-20">
      {/* ── Toast Notification ────────────────────────────────────────── */}
      {toastMessage && (
        <div
          className={`px-4 py-3 rounded-[14px] flex items-center justify-between shadow-sm animate-in fade-in duration-200 border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {toastMessage.type === 'success' ? (
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ErrorProfileIcon className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 1. HEADER BANNER ────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[18px] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F7EF] text-[#01B075] flex items-center justify-center shadow-2xs">
            <CalenderIcon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">
              Worker Leave Requests
            </h2>
            <p className="text-xs text-slate-500">
              Review, approve, reject, or revoke future leave applications for your assigned workers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#0E8F5B]">
            <GroupIcon className="w-3.5 h-3.5" />
            <span>{leaves.length} Total Requests</span>
          </span>
        </div>
      </div>

      {/* ── 2. STANDARD STAT CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          title="On Leave Today"
          value={onLeaveTodayCount}
          icon={CalenderIcon}
          badge="Workers Off-Site"
          chartType="sparkline"
        />
        <StatCard
          title="Pending Approval"
          value={pendingCount}
          icon={ClockIcon}
          badge={pendingCount > 0 ? 'Awaiting Action' : 'All Clear'}
          badgeColor="text-amber-800 bg-amber-100 border-amber-200"
          chartType="ring"
          percentage={leaves.length > 0 ? Math.round((pendingCount / leaves.length) * 100) : 0}
        />
        <StatCard
          title="Approved Month"
          value={approvedMonthCount}
          icon={CheckCircleIcon}
          badge="Active Leaves"
          badgeColor="text-emerald-700 bg-emerald-50 border-emerald-200"
          chartType="bar"
          percentage={leaves.length > 0 ? Math.round((approvedMonthCount / leaves.length) * 100) : 0}
        />
        <StatCard
          title="Revoked"
          value={revokedCount}
          icon={ErrorProfileIcon}
          badge="Cancelled"
          badgeColor="text-rose-700 bg-rose-50 border-rose-200"
          chartType="ring"
          percentage={leaves.length > 0 ? Math.round((revokedCount / leaves.length) * 100) : 0}
        />
      </div>

      {/* ── 3. SEARCH & FILTER CHIPS ─────────────────────────────────── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: 'Today', label: 'On Leave Today', count: onLeaveTodayCount, icon: CalenderIcon },
              { id: 'Pending', label: 'Pending Approval', count: pendingCount, icon: ClockIcon },
              { id: 'Approved', label: 'Approved', count: approvedMonthCount, icon: CheckCircleIcon },
              {
                id: 'Rejected',
                label: 'Rejected',
                count: leaves.filter((l) => l.status === 'REJECTED').length,
                icon: ErrorProfileIcon,
              },
              {
                id: 'Revoked',
                label: 'Revoked',
                count: revokedCount,
                icon: ErrorProfileIcon,
              },
            ] as const
          ).map((chip) => {
            const isSelected = activeFilter === chip.id;
            const IconComponent = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className={`cursor-pointer whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#1E1F24] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-2'
                    : 'bg-white text-[#464853] border border-[#E8EEF4] hover:bg-[#F8FAFC] px-5 py-2.5 rounded-full text-xs font-semibold shadow-2xs flex items-center gap-2'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-[#01B075]' : 'text-[#8C90A0]'}`} />
                <span>{chip.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#464853]'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search bar & View Mode Switcher */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <SearchIcon className="w-4 h-4 text-[#8C90A0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search worker or leave type..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-[#E8EEF4] rounded-full text-[#1E1F24] placeholder-[#8C90A0] focus:outline-none focus:border-[#01B075] focus:ring-1 focus:ring-[#01B075] shadow-2xs transition-all font-medium"
            />
          </div>

          {/* View toggle (Default: Table) */}
          <div className="flex items-center bg-[#F4F6F8] p-1 rounded-full border border-[#E8EEF4] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View (Standard)"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. LEAVES LIST: TABLE STANDARD ───────────────────────────── */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden p-5 space-y-3.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-36 h-3.5 bg-slate-200 rounded" />
                <div className="w-20 h-2.5 bg-slate-100 rounded" />
              </div>
              <div className="w-24 h-6 bg-slate-100 rounded-lg hidden sm:block" />
              <div className="w-32 h-6 bg-slate-100 rounded-lg hidden md:block" />
              <div className="w-24 h-4 bg-slate-100 rounded hidden lg:block" />
              <div className="w-16 h-6 bg-slate-100 rounded-full" />
              <div className="w-24 h-7 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#E6F7EF] text-[#01B075] flex items-center justify-center mx-auto">
            <TreeIcon className="w-6 h-6" />
          </div>
          <h4 className="text-sm sm:text-base font-bold text-slate-800">
            {activeFilter === 'Today'
              ? 'No Workers on Leave Today'
              : `No ${activeFilter.toLowerCase()} leave requests`}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeFilter === 'Today'
              ? 'All assigned workers are scheduled and active on site today.'
              : 'There are no leave requests matching this filter.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E8EEF4] text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Dates & Duration</th>
                    <th className="py-3 px-4">Applied On</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-slate-700">
                  {paginatedLeaves.map((leave) => {
                    const isEligibleForRevoke = isLeaveEligibleForRevoke(leave);
                    const isPending = leave.status === 'PENDING';

                    return (
                      <tr
                        key={leave.id}
                        onClick={() => setSelectedLeaveForDetails(leave)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* 1. Worker Profile */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={leave.workerAvatar}
                              alt={leave.workerName}
                              className="w-9 h-9 rounded-xl object-cover border border-[#E8EEF4] shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="%23E6F7EF"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="%2312A66A">${encodeURIComponent(leave.workerName?.charAt(0).toUpperCase() || 'W')}</text></svg>`;
                              }}
                            />
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight hover:text-[#12A66A] transition-colors">
                                {leave.workerName}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                                {leave.workerRole || 'Field Worker'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Leave Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/20 inline-block">
                            {leave.leaveType}
                          </span>
                        </td>

                        {/* 3. Dates & Duration */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 tabular-nums">
                              <CalenderIcon className="w-3.5 h-3.5 text-[#01B075] shrink-0" />
                              <span>
                                {leave.startDate} {leave.startDate !== leave.endDate ? `– ${leave.endDate}` : ''}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 text-[10px] inline-block">
                              {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                            </span>
                          </div>
                        </td>

                        {/* 4. Applied On */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{leave.appliedOn || '—'}</span>
                          </div>
                        </td>

                        {/* 5. Reason */}
                        <td className="py-3.5 px-4 max-w-[200px] xl:max-w-[260px]">
                          <p className="text-xs text-slate-600 truncate m-0" title={leave.reason}>
                            {leave.reason ? `"${leave.reason}"` : <span className="text-slate-400 italic">No reason specified</span>}
                          </p>
                          {leave.status === 'REVOKED' && leave.revocationReason && (
                            <span
                              className="text-[10px] text-rose-600 block truncate mt-0.5 font-medium"
                              title={`Revocation: ${leave.revocationReason}`}
                            >
                              Revoked: {leave.revocationReason}
                            </span>
                          )}
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusPill status={leave.status} size="sm" />
                        </td>

                        {/* 7. Actions */}
                        <td
                          className="py-3.5 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLeaveForDetails(leave)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="View Full Leave Details"
                            >
                              <EyeIcon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Details</span>
                            </button>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenApproveModal(leave)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                                  title="Approve Leave Request"
                                >
                                  <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectModal(leave)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Reject Leave Request"
                                >
                                  <CloseIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {isEligibleForRevoke && (
                              <button
                                type="button"
                                onClick={() => handleOpenRevokeModal(leave)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Revoke Approved Leave"
                              >
                                <CloseCircleIcon className="w-3.5 h-3.5 text-amber-700" />
                                <span>Revoke</span>
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
          {filteredLeaves.length > 0 && (
            <div className="pt-2">
              <DataTablePagination
                metadata={{
                  total: filteredLeaves.length,
                  page: currentPage,
                  limit: pageSize,
                  offset: (currentPage - 1) * pageSize,
                  totalPages: Math.ceil(filteredLeaves.length / pageSize),
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
      ) : (
        /* Cards View (if toggled) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedLeaves.map((leave) => (
              <LeaveCard
                key={leave.id}
                leave={leave}
                onSelect={setSelectedLeaveForDetails}
                onApprove={handleOpenApproveModal}
                onReject={handleOpenRejectModal}
                onRevoke={handleOpenRevokeModal}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {filteredLeaves.length > 0 && (
            <div className="pt-2">
              <DataTablePagination
                metadata={{
                  total: filteredLeaves.length,
                  page: currentPage,
                  limit: pageSize,
                  offset: (currentPage - 1) * pageSize,
                  totalPages: Math.ceil(filteredLeaves.length / pageSize),
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

      {/* ── 5. RECORD DETAILS MODAL ──────────────────────────────────── */}
      {selectedLeaveForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[22px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CalenderIcon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0 leading-tight">
                    Leave Request Details
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0 font-mono">
                    ID: #{selectedLeaveForDetails.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={selectedLeaveForDetails.status} size="sm" />
                <button
                  type="button"
                  onClick={() => setSelectedLeaveForDetails(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Worker Profile Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-3.5">
                <img
                  src={selectedLeaveForDetails.workerAvatar}
                  alt={selectedLeaveForDetails.workerName}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="%23E6F7EF"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="%2312A66A">${encodeURIComponent(selectedLeaveForDetails.workerName?.charAt(0).toUpperCase() || 'W')}</text></svg>`;
                  }}
                />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {selectedLeaveForDetails.workerName}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedLeaveForDetails.workerRole || 'Field Worker'}
                  </p>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Leave Type
                  </span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedLeaveForDetails.leaveType}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Duration
                  </span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedLeaveForDetails.daysCount} {selectedLeaveForDetails.daysCount === 1 ? 'day' : 'days'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Leave Period
                  </span>
                  <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                    <CalenderIcon className="w-3.5 h-3.5 text-[#01B075]" />
                    <span>
                      {selectedLeaveForDetails.startDate} to {selectedLeaveForDetails.endDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reason for Leave */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Reason for Absence
                </span>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedLeaveForDetails.reason || 'No reason specified by worker.'}"
                </div>
              </div>

              {/* Review Audit Details if applicable */}
              {(selectedLeaveForDetails.decisionNote || selectedLeaveForDetails.reviewerName) && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                    <SecuritySafeIcon className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Review Decision</span>
                  </div>
                  {selectedLeaveForDetails.reviewerName && (
                    <p className="text-[11px] text-emerald-800 m-0">
                      Reviewed by: <strong>{selectedLeaveForDetails.reviewerName}</strong>
                    </p>
                  )}
                  {selectedLeaveForDetails.decisionNote && (
                    <p className="text-[11px] text-emerald-800 m-0 italic">
                      Note: "{selectedLeaveForDetails.decisionNote}"
                    </p>
                  )}
                </div>
              )}

              {/* Revocation Details if Revoked */}
              {selectedLeaveForDetails.status === 'REVOKED' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                    <CloseCircleIcon className="w-3.5 h-3.5 text-rose-700" />
                    <span>Revocation Record</span>
                  </div>
                  {selectedLeaveForDetails.revocationReason && (
                    <p className="text-[11px] text-rose-800 m-0 italic">
                      Reason: "{selectedLeaveForDetails.revocationReason}"
                    </p>
                  )}
                  {selectedLeaveForDetails.revokedByName && (
                    <p className="text-[11px] text-rose-700 m-0">
                      Revoked by: {selectedLeaveForDetails.revokedByName}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedLeaveForDetails(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedLeaveForDetails.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(selectedLeaveForDetails)}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenApproveModal(selectedLeaveForDetails)}
                      className="px-4 py-2 rounded-xl bg-[#01B075] hover:bg-[#00925f] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckIcon className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </>
                )}

                {selectedLeaveForDetails.status === 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => handleOpenRevokeModal(selectedLeaveForDetails)}
                    className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CloseCircleIcon className="w-3.5 h-3.5 text-amber-700" />
                    <span>Revoke Leave</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. APPROVAL CONFIRMATION DIALOG ──────────────────────────── */}
      {selectedLeaveForApprove && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[22px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E6F7EF] text-[#01B075] flex items-center justify-center shadow-2xs">
                  <CheckIcon className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0">
                    Confirm Leave Approval
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">
                    Approve worker absence request
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaveForApprove(null)}
                disabled={isSubmittingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Worker:</span>
                  <span className="font-bold text-slate-900">{selectedLeaveForApprove.workerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dates:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLeaveForApprove.startDate} to {selectedLeaveForApprove.endDate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLeaveForApprove.daysCount} {selectedLeaveForApprove.daysCount === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Leave Type:</span>
                  <span className="font-semibold text-slate-800">{selectedLeaveForApprove.leaveType}</span>
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
                  placeholder="e.g. Approved per crew coverage plan"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-900 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedLeaveForApprove(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-xl bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Confirm Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. REJECTION CONFIRMATION DIALOG ─────────────────────────── */}
      {selectedLeaveForReject && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[22px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs">
                  <CloseIcon className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0">
                    Confirm Leave Rejection
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">
                    Decline worker leave application
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaveForReject(null)}
                disabled={isSubmittingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Worker:</span>
                  <span className="font-bold text-slate-900">{selectedLeaveForReject.workerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dates:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLeaveForReject.startDate} to {selectedLeaveForReject.endDate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLeaveForReject.daysCount} {selectedLeaveForReject.daysCount === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reason for Rejection <span className="text-rose-500">*</span>
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
                onClick={() => setSelectedLeaveForReject(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingAction || !rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <CloseIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. REVOCATION CONFIRMATION DIALOG ────────────────────────── */}
      {selectedLeaveForRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[22px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2.5 text-amber-800 font-bold text-sm">
                <CloseCircleIcon className="w-4 h-4 text-amber-600" />
                <span>Revoke Approved Leave</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaveForRevoke(null)}
                disabled={isSubmittingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-[14px] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Worker:</span>
                  <span className="font-bold text-slate-800">{selectedLeaveForRevoke.workerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Leave Dates:</span>
                  <span className="font-bold text-slate-800">
                    {selectedLeaveForRevoke.startDate} to {selectedLeaveForRevoke.endDate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Duration:</span>
                  <span className="font-bold text-slate-800">
                    {selectedLeaveForRevoke.daysCount} {selectedLeaveForRevoke.daysCount === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <ErrorProfileIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Notice:</strong> Revoking this leave will cancel the worker's approved leave. The dates will no longer be excused.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Revocation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={revocationReason}
                  onChange={(e) => {
                    setRevocationReason(e.target.value);
                    if (revokeError) setRevokeError(null);
                  }}
                  placeholder="Explain why this approved leave is being revoked (minimum 3 characters)..."
                  rows={3}
                  disabled={isSubmittingAction}
                  className="w-full text-xs p-3 bg-white border border-slate-200 rounded-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
                {revokeError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-[10px] text-xs">
                    {revokeError}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedLeaveForRevoke(null)}
                disabled={isSubmittingAction}
                className="px-3.5 py-2 rounded-[10px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isSubmittingAction || revocationReason.trim().length < 3}
                className="px-4 py-2 rounded-[10px] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <>
                    <CloseCircleIcon className="w-3.5 h-3.5" />
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

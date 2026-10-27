import React, { useState } from 'react';
import { WorkerLeaveItem, LeaveFilter } from '../../types/supervisor';
import {
  CalendarDays,
  Search,
  Palmtree,
  Users,
  Ban,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  Check,
  Eye,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { LeaveCard } from '#components/supervisor/LeaveCard';
import { StatusPill } from '#components/supervisor/StatusPill';
import { apiRequest } from '../../lib/api';

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
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 1. HEADER BANNER ────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[18px] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-2xs">
            <CalendarDays className="w-5 h-5 stroke-[2.2]" />
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
            <Users className="w-3.5 h-3.5" />
            <span>{leaves.length} Total Requests</span>
          </span>
        </div>
      </div>

      {/* ── 2. STAT STRIP ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            On Leave Today
          </span>
          <span className="text-xl font-black text-[#12A66A] tabular-nums block mt-0.5">
            {onLeaveTodayCount}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Workers off-site</span>
        </div>

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[16px] p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#B45309] uppercase tracking-wider block">
            Pending Approval
          </span>
          <span className="text-xl font-black text-[#92400E] tabular-nums block mt-0.5">
            {pendingCount}
          </span>
          <span className="text-[10px] text-[#B45309] font-medium">Awaiting decision</span>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Approved Month
          </span>
          <span className="text-xl font-black text-slate-900 tabular-nums block mt-0.5">
            {approvedMonthCount}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Active approved</span>
        </div>

        <div className="bg-rose-50/50 border border-rose-200 rounded-[16px] p-3 text-center shadow-xs">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
            Revoked
          </span>
          <span className="text-xl font-black text-rose-700 tabular-nums block mt-0.5">
            {revokedCount}
          </span>
          <span className="text-[10px] text-rose-600 font-medium">Revoked leaves</span>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTER CHIPS ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search worker or leave type..."
            className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-[#E8EEF4] rounded-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {(
            [
              { id: 'Today', label: 'On Leave Today', count: onLeaveTodayCount },
              { id: 'Pending', label: 'Pending Approval', count: pendingCount },
              { id: 'Approved', label: 'Approved', count: approvedMonthCount },
              {
                id: 'Rejected',
                label: 'Rejected',
                count: leaves.filter((l) => l.status === 'REJECTED').length,
              },
              {
                id: 'Revoked',
                label: 'Revoked',
                count: revokedCount,
              },
            ] as const
          ).map((chip) => {
            const isSelected = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#12A66A] text-white shadow-xs'
                    : 'bg-white border border-[#E8EEF4] text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. LEAVES LIST: CARDS ────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#E8EEF4] rounded-[16px] p-4 animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-[12px]" />
                <div className="w-32 h-4 bg-slate-200 rounded" />
              </div>
              <div className="h-8 bg-slate-100 rounded-[10px]" />
            </div>
          ))}
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
            <Palmtree className="w-6 h-6" />
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaves.map((leave) => (
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
      )}

      {/* ── 5. RECORD DETAILS MODAL ──────────────────────────────────── */}
      {selectedLeaveForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[22px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4 stroke-[2.2]" />
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
                  <X className="w-4 h-4" />
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
                    <Calendar className="w-3.5 h-3.5 text-[#12A66A]" />
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
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
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
                    <Ban className="w-3.5 h-3.5 text-rose-700" />
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
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenApproveModal(selectedLeaveForDetails)}
                      className="px-4 py-2 rounded-xl bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
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
                    <Ban className="w-3.5 h-3.5 text-amber-700" />
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
                <div className="w-9 h-9 rounded-xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-2xs">
                  <Check className="w-5 h-5 stroke-[2.5]" />
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
                <X className="w-4 h-4" />
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
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
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
                  <X className="w-5 h-5 stroke-[2.5]" />
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
                <X className="w-4 h-4" />
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
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
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
                <Ban className="w-4 h-4 text-amber-600" />
                <span>Revoke Approved Leave</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeaveForRevoke(null)}
                disabled={isSubmittingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
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
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
                    <Ban className="w-3.5 h-3.5" />
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

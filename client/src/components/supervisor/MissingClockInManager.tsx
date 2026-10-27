import React, { useState, useMemo } from 'react';
import { MissingClockInCase, AttendanceFlagStatus } from '../../types/supervisor';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  MessageSquare,
  User,
  Calendar,
  Building2,
  ArrowRight,
  Filter,
  Check,
  X,
  Phone,
  Info,
  FileEdit,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { DataTablePagination } from '../ui/data-table-pagination';

interface MissingClockInManagerProps {
  cases: MissingClockInCase[];
  isLoading: boolean;
  onRefresh: () => void;
  selectedDate: string;
}

export const MissingClockInManager: React.FC<MissingClockInManagerProps> = ({
  cases,
  isLoading,
  onRefresh,
  selectedDate,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED'>('ALL');
  const [selectedCaseForReview, setSelectedCaseForReview] = useState<MissingClockInCase | null>(null);
  const [flagDecision, setFlagDecision] = useState<AttendanceFlagStatus>('APPROVED');
  const [flagReason, setFlagReason] = useState<string>('Transit / Traffic Delay');
  const [customReason, setCustomReason] = useState<string>('');
  const [flagNote, setFlagNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Pagination fixed at default 10 per page
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  const openReviewModal = (item: MissingClockInCase, initialDecision?: AttendanceFlagStatus) => {
    setSelectedCaseForReview(item);
    setFlagDecision(initialDecision || item.flagStatus || 'APPROVED');
    setFlagReason(item.reason || (initialDecision === 'REJECTED' ? 'Unexcused Absence' : 'Transit / Traffic Delay'));
    setCustomReason('');
    setFlagNote(item.note || '');
  };

  const closeReviewModal = () => {
    setSelectedCaseForReview(null);
    setIsSubmitting(false);
  };

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForReview) return;

    setIsSubmitting(true);
    try {
      const finalReason = flagReason === 'Other' ? customReason.trim() : flagReason.trim();
      if (!finalReason || finalReason.length < 3) {
        alert('A meaningful non-empty reason is mandatory before applying an attendance flag.');
        setIsSubmitting(false);
        return;
      }
      await apiRequest(`/attendance/missing-clock-ins/${selectedCaseForReview.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          action: flagDecision === 'APPROVED' ? 'MARK_PRESENT' : flagDecision === 'REJECTED' ? 'MARK_ABSENT' : 'KEEP_PENDING',
          decision: flagDecision === 'APPROVED' ? 'PRESENT' : flagDecision === 'REJECTED' ? 'ABSENT' : 'PENDING',
          status: flagDecision,
          reason: finalReason,
          note: flagNote.trim() || undefined,
        }),
      });

      setActionSuccessMessage(`Flag successfully set to ${flagDecision.replace('_', ' ')} for ${selectedCaseForReview.workerName}`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
      closeReviewModal();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to apply attendance flag:', err);
      alert(err?.message || 'Failed to submit flag decision');
      setIsSubmitting(false);
    }
  };

  // Filter cases to strictly ONLY today's missing date
  const todayOnlyCases = useMemo(() => {
    return cases.filter((c) => {
      if (c.isYesterday) return false;
      if (c.workDate) {
        const wDate = c.workDate.split('T')[0];
        if (selectedDate && wDate !== selectedDate) return false;
      }
      return true;
    });
  }, [cases, selectedDate]);

  const filteredCases = useMemo(() => {
    return todayOnlyCases.filter((c) => {
      if (filter === 'ALL') return true;
      if (filter === 'RESOLVED') return c.resolvedByClockIn;
      if (filter === 'PENDING_REVIEW') return c.flagStatus === 'PENDING_REVIEW' && !c.resolvedByClockIn;
      if (filter === 'APPROVED') return c.flagStatus === 'APPROVED';
      if (filter === 'REJECTED') return c.flagStatus === 'REJECTED';
      return true;
    });
  }, [todayOnlyCases, filter]);

  const paginatedCases = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredCases.slice(start, start + limit);
  }, [filteredCases, page, limit]);

  const pendingReviewCount = todayOnlyCases.filter((c) => c.flagStatus === 'PENDING_REVIEW' && !c.resolvedByClockIn).length;
  const approvedCount = todayOnlyCases.filter((c) => c.flagStatus === 'APPROVED').length;
  const rejectedCount = todayOnlyCases.filter((c) => c.flagStatus === 'REJECTED').length;
  const resolvedCount = todayOnlyCases.filter((c) => c.resolvedByClockIn).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ── Status Banner Alert ────────────────────────────────────────────── */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-[18px] p-4 flex items-start gap-3 shadow-xs">
        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs">
          <h4 className="font-bold text-amber-900 text-sm">Supervisor Missing Clock-In Review</h4>
          <p className="text-amber-700 mt-0.5 leading-relaxed">
            Workers listed here have not clocked in past their scheduled start time + 15 min grace period for today ({selectedDate}), with no approved leave on file.
            Supervisors review these cases to flag explanations as <strong>Approved</strong> or <strong>Rejected</strong>.
          </p>
          <div className="mt-2 text-[11px] font-semibold text-amber-800 bg-amber-100/60 rounded-lg p-2 border border-amber-200 inline-block">
            ℹ️ <strong>Policy Guardrail:</strong> Attendance flags register supervisor case assessments. They never create artificial clock-ins or modify physical attendance records.
          </div>
        </div>
      </div>

      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[14px] text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button type="button" onClick={() => setActionSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Summary Counters ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Approve</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{approvedCount}</div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Absent</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{rejectedCount}</div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Pending</span>
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{pendingReviewCount}</div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Clocked In Later</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{resolvedCount}</div>
        </div>
      </div>

      {/* ── Filter Chips ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'ALL', label: 'All Cases', count: todayOnlyCases.length },
          { id: 'APPROVED', label: 'Approve', count: approvedCount },
          { id: 'REJECTED', label: 'Absent', count: rejectedCount },
          { id: 'PENDING_REVIEW', label: 'Pending', count: pendingReviewCount },
          { id: 'RESOLVED', label: 'Clocked In Later', count: resolvedCount },
        ].map((tab) => {
          const isSelected = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8EEF4] text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Table of Missing Clock-In Cases ───────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white border border-[#E8EEF4] rounded-[18px] p-10 text-center text-slate-400 text-xs">
          <Clock className="w-6 h-6 animate-spin mx-auto text-[#12A66A] mb-2" />
          <span>Evaluating today's missing clock-ins...</span>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="p-10 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-2">
          <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Missing Clock-Ins For Today</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All assigned workers for today have either clocked in, have approved leave, or their shift grace period has not yet expired.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden">
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
                {paginatedCases.map((item) => {
                  const isResolved = item.resolvedByClockIn;
                  const isPending = item.flagStatus === 'PENDING_REVIEW' && !isResolved;
                  const missedDateObj = item.workDate ? new Date(item.workDate) : new Date(selectedDate);
                  const missedDateFormatted = isNaN(missedDateObj.getTime())
                    ? selectedDate
                    : missedDateObj.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                  const resolvedTimestamp = item.resolvedAt || item.reviewedAt;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Worker */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {item.workerAvatar || item.avatar ? (
                              <img src={item.workerAvatar || item.avatar} alt={item.workerName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{item.workerName}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {(item.workerCode || item.employeeCode) && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                                  {item.workerCode || item.employeeCode}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {item.workerRole || item.employmentType || 'Worker'}
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
                          <span>{item.worksiteName || '—'}</span>
                        </div>
                      </td>

                      {/* 4. Notes */}
                      <td className="py-3 px-4 max-w-xs text-xs">
                        {item.reason || item.note ? (
                          <div className="space-y-0.5">
                            {item.reason && (
                              <span className="font-semibold text-slate-800 block truncate" title={item.reason}>
                                {item.reason}
                              </span>
                            )}
                            {item.note && (
                              <span className="text-[11px] text-slate-500 italic block truncate" title={item.note}>
                                "{item.note}"
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
                                {item.reviewedByName || item.reviewerName ? ` by ${item.reviewedByName || item.reviewerName}` : ''}
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
                                onClick={() => openReviewModal(item, 'APPROVED')}
                                className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                title="Approve"
                                aria-label="Approve"
                              >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openReviewModal(item, 'REJECTED')}
                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                                title="Absent / Reject"
                                aria-label="Absent"
                              >
                                <X className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openReviewModal(item, 'PENDING_REVIEW')}
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
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                  item.flagStatus === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : item.flagStatus === 'REJECTED'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {item.flagStatus === 'APPROVED'
                                  ? 'Flag: Approve'
                                  : item.flagStatus === 'REJECTED'
                                  ? 'Flag: Absent'
                                  : 'Flag: Pending'}
                              </span>
                              <button
                                type="button"
                                onClick={() => openReviewModal(item)}
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
                })}
              </tbody>
            </table>
          </div>

          <DataTablePagination
            metadata={{
              total: filteredCases.length,
              page,
              limit,
              offset: (page - 1) * limit,
              totalPages: Math.ceil(filteredCases.length / limit) || 1,
            }}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      )}

      {/* ── FLAG REVIEW MODAL / DRAWER ────────────────────────────────────────── */}
      {selectedCaseForReview && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[22px] max-w-md w-full p-5 space-y-4 shadow-2xl border border-[#E8EEF4]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Missing Clock-In Review</h3>
                <p className="text-xs text-slate-500">Set attendance flag decision and explanation</p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Worker Summary Box */}
            <div className="bg-slate-50 rounded-[14px] p-3 text-xs flex items-center justify-between border border-slate-100">
              <div>
                <div className="font-bold text-slate-900">{selectedCaseForReview.workerName}</div>
                <div className="text-[11px] text-slate-500">
                  {selectedCaseForReview.shiftName} • Scheduled: {selectedCaseForReview.shiftStartTime}
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                {selectedCaseForReview.timeElapsedFormatted || selectedCaseForReview.elapsedLabel || 'Past Grace Period'}
              </span>
            </div>

            <form onSubmit={handleSubmitFlag} className="space-y-4">
              {/* Decision Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Supervisor Flag Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFlagDecision('APPROVED')}
                    className={`py-2 px-1 rounded-[12px] text-xs font-bold border transition-all text-center cursor-pointer ${
                      flagDecision === 'APPROVED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlagDecision('REJECTED')}
                    className={`py-2 px-1 rounded-[12px] text-xs font-bold border transition-all text-center cursor-pointer ${
                      flagDecision === 'REJECTED'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Absent
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlagDecision('PENDING_REVIEW')}
                    className={`py-2 px-1 rounded-[12px] text-xs font-bold border transition-all text-center cursor-pointer ${
                      flagDecision === 'PENDING_REVIEW'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reason / Explanation Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-[12px] p-2.5 bg-white text-slate-800 focus:outline-hidden focus:border-[#12A66A]"
                >
                  <option value="Transit / Traffic Delay">Transit / Traffic Delay</option>
                  <option value="Field Assignment Relocation">Field Assignment Relocation</option>
                  <option value="Medical / Personal Emergency">Medical / Personal Emergency</option>
                  <option value="Authorized Site Work Offsite">Authorized Site Work Offsite</option>
                  <option value="Technical / Network Issue">Technical / Network Issue</option>
                  <option value="Unreachable / No Show">Unreachable / No Show</option>
                  <option value="Other">Other (Specify Below)</option>
                </select>
              </div>

              {flagReason === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Specify Reason
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter custom explanation..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-[12px] p-2.5 bg-white text-slate-800 focus:outline-hidden focus:border-[#12A66A]"
                  />
                </div>
              )}

              {/* Supervisor Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Supervisor Notes / Context <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  placeholder="e.g. Spoke to worker at 9:35 AM; bus breakdown at ring road junction."
                  className="w-full text-xs border border-slate-200 rounded-[12px] p-2.5 bg-white text-slate-800 focus:outline-hidden focus:border-[#12A66A]"
                />
              </div>

              {/* Policy Guardrail Notice */}
              <div className="p-2.5 rounded-[12px] bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-normal">
                🛡️ <strong>Note:</strong> Applying this flag will save your supervisor decision and notify the worker. It does <em>not</em> mark attendance present or alter physical GPS logs.
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-[12px] border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-[12px] bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold shadow-md shadow-[#12A66A]/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

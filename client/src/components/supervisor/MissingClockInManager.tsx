import React, { useState } from 'react';
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
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

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

  const openReviewModal = (item: MissingClockInCase) => {
    setSelectedCaseForReview(item);
    setFlagDecision(item.flagStatus || 'APPROVED');
    setFlagReason(item.reason || 'Transit / Traffic Delay');
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
      await apiRequest(`/attendance/missing-clock-ins/${selectedCaseForReview.id}/flag`, {
        method: 'POST',
        body: JSON.stringify({
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

  const filteredCases = cases.filter((c) => {
    if (filter === 'ALL') return true;
    if (filter === 'RESOLVED') return c.resolvedByClockIn;
    if (filter === 'PENDING_REVIEW') return c.flagStatus === 'PENDING_REVIEW' && !c.resolvedByClockIn;
    if (filter === 'APPROVED') return c.flagStatus === 'APPROVED';
    if (filter === 'REJECTED') return c.flagStatus === 'REJECTED';
    return true;
  });

  const pendingReviewCount = cases.filter((c) => c.flagStatus === 'PENDING_REVIEW' && !c.resolvedByClockIn).length;
  const approvedCount = cases.filter((c) => c.flagStatus === 'APPROVED').length;
  const rejectedCount = cases.filter((c) => c.flagStatus === 'REJECTED').length;
  const resolvedCount = cases.filter((c) => c.resolvedByClockIn).length;

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
            Workers listed here have not clocked in past their scheduled start time + 15 min grace period, with no approved leave on file.
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
            <span className="text-[11px] font-semibold">Pending Review</span>
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{pendingReviewCount}</div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Approved Flags</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{approvedCount}</div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Rejected Flags</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{rejectedCount}</div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold">Resolved Later</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{resolvedCount}</div>
        </div>
      </div>

      {/* ── Filter Chips ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'ALL', label: 'All Cases', count: cases.length },
          { id: 'PENDING_REVIEW', label: 'Needs Review', count: pendingReviewCount },
          { id: 'APPROVED', label: 'Approved Flags', count: approvedCount },
          { id: 'REJECTED', label: 'Rejected Flags', count: rejectedCount },
          { id: 'RESOLVED', label: 'Clocked In Later', count: resolvedCount },
        ].map((tab) => {
          const isSelected = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
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

      {/* ── List of Missing Clock-In Cases ───────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white border border-[#E8EEF4] rounded-[16px] p-4 animate-pulse h-28" />
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="p-10 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-2">
          <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Missing Clock-Ins</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All assigned workers have either clocked in, have approved leave, or their shift grace period has not yet expired for this date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCases.map((item) => {
            const isResolved = item.resolvedByClockIn;
            const hasPendingLeave = item.leaveStatus === 'PENDING_LEAVE';

            return (
              <div
                key={item.id}
                className="bg-white border border-[#E8EEF4] hover:border-slate-300 rounded-[18px] p-4 shadow-xs transition-all flex flex-col justify-between gap-3"
              >
                {/* Header: Worker Details & Status Pill */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {item.workerAvatar || item.avatar ? (
                        <img src={item.workerAvatar || item.avatar} alt={item.workerName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{item.workerName}</h4>
                        {(item.workerCode || item.employeeCode) && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.workerCode || item.employeeCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{item.workerRole || item.employmentType || 'Field Worker'}</p>
                    </div>
                  </div>

                  {/* Flag Status Pill */}
                  <div className="shrink-0 text-right">
                    {item.flagStatus === 'APPROVED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Flag: Approved
                      </span>
                    )}
                    {item.flagStatus === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3" />
                        Flag: Rejected
                      </span>
                    )}
                    {item.flagStatus === 'PENDING_REVIEW' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <HelpCircle className="w-3 h-3" />
                        Pending Review
                      </span>
                    )}
                  </div>
                </div>

                {/* Shift & Elapsed Info */}
                <div className="bg-slate-50 rounded-[12px] p-2.5 text-xs space-y-1.5 border border-slate-100">
                  <div className="flex items-center justify-between text-slate-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {item.shiftName} ({item.shiftStartTime})
                    </span>
                    <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded text-[10px]">
                      {item.timeElapsedFormatted || item.elapsedLabel || 'Past Grace Period'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {item.worksiteName}
                    </span>
                    <span>Grace: {item.gracePeriodMinutes}m</span>
                  </div>
                </div>

                {/* Pending Leave Banner if applied */}
                {hasPendingLeave && (
                  <div className="p-2 rounded-[10px] bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-medium flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                    <span>Worker has submitted a leave request pending approval.</span>
                  </div>
                )}

                {/* Resolved Later Banner */}
                {isResolved && (
                  <div className="p-2 rounded-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Worker punched in later. Historical flag preserved.
                    </span>
                    {item.resolvedAt && (
                      <span className="text-[10px] text-emerald-600 tabular-nums">
                        {new Date(item.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Existing Review Explanation / Notes if set */}
                {(item.reason || item.note) && (
                  <div className="text-[11px] text-slate-600 bg-white border border-slate-200/80 rounded-[10px] p-2 space-y-0.5">
                    {item.reason && (
                      <div className="font-semibold text-slate-800">
                        Reason: <span className="font-normal">{item.reason}</span>
                      </div>
                    )}
                    {item.note && (
                      <div className="italic text-slate-500">
                        "{item.note}"
                      </div>
                    )}
                    {(item.reviewedByName || item.reviewerName) && (
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        Reviewed by {item.reviewedByName || item.reviewerName}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  {item.workerPhone ? (
                    <a
                      href={`tel:${item.workerPhone}`}
                      className="px-2.5 py-1.5 rounded-[10px] border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>Call</span>
                    </a>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={() => openReviewModal(item)}
                    className="px-3.5 py-1.5 rounded-[10px] bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{item.flagStatus === 'PENDING_REVIEW' ? 'Review & Flag' : 'Update Flag'}</span>
                  </button>
                </div>
              </div>
            );
          })}
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
                    Approved
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
                    Rejected
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
                    Pending Review
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

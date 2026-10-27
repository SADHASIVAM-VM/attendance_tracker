import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import {
  ErrorProfileIcon,
  ClockIcon,
  EditProfileIcon,
  CloseCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  CheckCircleIcon,
  RotateCwIcon,
  ArrowUpRightIcon,
} from '@astraicons/react/linear';

interface AttendanceExceptionsSectionProps {
  worksiteId?: string;
  onNavigateToExceptions: (category?: string) => void;
  onRefreshParent?: () => void;
}

export const AttendanceExceptionsSection: React.FC<AttendanceExceptionsSectionProps> = ({
  worksiteId,
  onNavigateToExceptions,
  onRefreshParent,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'missing' | 'pending-reg' | 'rejected-reg'>('missing');
  const [loading, setLoading] = useState<boolean>(true);
  const [missingCases, setMissingCases] = useState<any[]>([]);
  const [pendingRegs, setPendingRegs] = useState<any[]>([]);
  const [rejectedRegs, setRejectedRegs] = useState<any[]>([]);
  const [counts, setCounts] = useState<{
    missingAttendanceCount: number;
    pendingRegularisationCount: number;
    rejectedRegularisationCount: number;
    totalExceptionsCount: number;
  }>({
    missingAttendanceCount: 0,
    pendingRegularisationCount: 0,
    rejectedRegularisationCount: 0,
    totalExceptionsCount: 0,
  });

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchExceptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('includeYesterday', 'true');
      if (worksiteId) params.append('worksiteId', worksiteId);

      const [summaryRes, missingRes, pendingRes, rejectedRes] = await Promise.allSettled([
        apiRequest('/attendance/exceptions/summary'),
        apiRequest(`/attendance/missing-clock-ins?${params.toString()}`),
        apiRequest('/regularization/requests?status=PENDING'),
        apiRequest('/regularization/requests?status=REJECTED'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setCounts(summaryRes.value);
      }

      if (missingRes.status === 'fulfilled' && missingRes.value?.cases) {
        setMissingCases(missingRes.value.cases);
      }

      if (pendingRes.status === 'fulfilled') {
        const list = Array.isArray(pendingRes.value)
          ? pendingRes.value
          : pendingRes.value?.requests || [];
        setPendingRegs(list);
      }

      if (rejectedRes.status === 'fulfilled') {
        const list = Array.isArray(rejectedRes.value)
          ? rejectedRes.value
          : rejectedRes.value?.requests || [];
        setRejectedRegs(list);
      }
    } catch (err) {
      console.warn('Failed to load exceptions section data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [worksiteId]);

  // Handle Quick Missing Decision
  const handleQuickMissingDecision = async (caseId: string, flagStatus: 'APPROVED' | 'REJECTED') => {
    try {
      await apiRequest(`/attendance/missing-clock-ins/${caseId}/flag`, {
        method: 'POST',
        body: JSON.stringify({
          flagStatus,
          reason: flagStatus === 'APPROVED' ? 'Excused absence approved by supervisor' : 'Unexcused absence',
        }),
      });
      setActionSuccess(`Case marked as ${flagStatus === 'APPROVED' ? 'Excused' : 'Unexcused'}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchExceptions();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      console.error('Failed to resolve missing case:', err);
    }
  };

  // Handle Quick Regularisation Decision
  const handleQuickRegDecision = async (id: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      const endpoint = decision === 'APPROVE' ? `/regularization/${id}/approve` : `/regularization/${id}/reject`;
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          reason: decision === 'APPROVE' ? 'Approved by supervisor' : 'Discrepancy not verified',
          reviewNote: decision === 'APPROVE' ? 'Approved by supervisor' : 'Discrepancy not verified',
        }),
      });
      setActionSuccess(`Regularisation ${decision === 'APPROVE' ? 'approved' : 'rejected'}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchExceptions();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      console.error('Failed to update regularisation:', err);
    }
  };

  const pendingMissingCases = missingCases.filter((c) => c.flagStatus === 'PENDING_REVIEW');
  const yesterdayPendingCount = missingCases.filter((c) => c.isYesterday && c.flagStatus === 'PENDING_REVIEW').length;

  return (
    <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ErrorProfileIcon className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 leading-tight m-0">
                Attendance Exceptions
              </h3>
              {(pendingMissingCases.length > 0 || pendingRegs.length > 0) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {pendingMissingCases.length + pendingRegs.length} Unresolved
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Yesterday&apos;s unresolved records stay visible here until handled.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToExceptions(selectedCategory === 'missing' ? 'missing' : selectedCategory === 'pending-reg' ? 'pending-regularisation' : 'rejected-regularisation')}
          className="text-xs font-bold text-[#12A66A] hover:underline flex items-center gap-1 cursor-pointer shrink-0 self-end sm:self-auto"
        >
          <span>Open Exceptions Center</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Category Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8EEF4] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSelectedCategory('missing')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === 'missing'
              ? 'bg-amber-100/80 text-amber-900 border border-amber-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
          <span>Missing Attendance</span>
          {pendingMissingCases.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-950 font-black">
              {pendingMissingCases.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('pending-reg')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === 'pending-reg'
              ? 'bg-blue-100/80 text-blue-900 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <EditProfileIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>Pending Regularisation</span>
          {pendingRegs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-200 text-blue-950 font-black">
              {pendingRegs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('rejected-reg')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === 'rejected-reg'
              ? 'bg-rose-100/80 text-rose-900 border border-rose-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CloseCircleIcon className="w-3.5 h-3.5 text-rose-600" />
          <span>Rejected Regularisation</span>
          {rejectedRegs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-950 font-black">
              {rejectedRegs.length}
            </span>
          )}
        </button>
      </div>

      {/* Content for Selected Category */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RotateCwIcon className="w-4 h-4 animate-spin text-[#12A66A]" />
          <span>Loading exception category...</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* CATEGORY 1: MISSING ATTENDANCE */}
          {selectedCategory === 'missing' && (
            <>
              {yesterdayPendingCount > 0 && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ErrorProfileIcon className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold">
                      {yesterdayPendingCount} unresolved missing attendance record{yesterdayPendingCount > 1 ? 's' : ''} carried over from yesterday.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Action Required</span>
                </div>
              )}

              {pendingMissingCases.length === 0 ? (
                <div className="p-6 text-center bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No Missing Attendance Cases</p>
                  <p className="text-[11px] text-slate-500">
                    Yesterday&apos;s and today&apos;s scheduled workers are all accounted for.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingMissingCases.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        c.isYesterday ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={c.avatar}
                          alt={c.workerName}
                          className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{c.workerName}</span>
                            {c.employeeCode && (
                              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200/70 text-slate-700 font-semibold">
                                {c.employeeCode}
                              </span>
                            )}
                            {c.isYesterday ? (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                Yesterday ({c.workDate})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                Today
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                            Shift: <strong className="text-slate-700">{c.shiftName}</strong> ({c.shiftStartTime}) • {c.timeElapsedFormatted}
                          </p>
                        </div>
                      </div>

                      {/* Quick inline buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickMissingDecision(c.id, 'APPROVED')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <CheckIcon className="w-3 h-3" />
                          <span>Excuse</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickMissingDecision(c.id, 'REJECTED')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <CloseIcon className="w-3 h-3" />
                          <span>Unexcused</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {pendingMissingCases.length > 4 && (
                    <button
                      type="button"
                      onClick={() => onNavigateToExceptions('missing')}
                      className="w-full py-2 text-center text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100/70 rounded-xl transition-colors cursor-pointer"
                    >
                      View all {pendingMissingCases.length} missing attendance cases →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* CATEGORY 2: PENDING REGULARISATION */}
          {selectedCategory === 'pending-reg' && (
            <>
              {pendingRegs.length === 0 ? (
                <div className="p-6 text-center bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl space-y-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No Pending Regularisations</p>
                  <p className="text-[11px] text-slate-500">
                    All worker regularization requests have been reviewed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRegs.slice(0, 4).map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-blue-50/30 border border-blue-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{r.workerName}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            {r.correctionType || 'CORRECTION'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Shift: {r.workDate}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 m-0 mt-1 italic">
                          &ldquo;{r.reason}&rdquo;
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickRegDecision(r.id, 'APPROVE')}
                          className="px-2.5 py-1 rounded-lg bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <CheckIcon className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickRegDecision(r.id, 'REJECT')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <CloseIcon className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {pendingRegs.length > 4 && (
                    <button
                      type="button"
                      onClick={() => onNavigateToExceptions('pending-regularisation')}
                      className="w-full py-2 text-center text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100/70 rounded-xl transition-colors cursor-pointer"
                    >
                      View all {pendingRegs.length} pending regularisations →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* CATEGORY 3: REJECTED REGULARISATION */}
          {selectedCategory === 'rejected-reg' && (
            <>
              {rejectedRegs.length === 0 ? (
                <div className="p-6 text-center bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl space-y-1">
                  <p className="text-xs font-bold text-slate-700">No Rejected Regularisations</p>
                  <p className="text-[11px] text-slate-500">
                    No requests have been rejected recently.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rejectedRegs.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-rose-50/20 border border-rose-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{r.workerName}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            REJECTED
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Date: {r.workDate}
                          </span>
                        </div>
                        {r.reviewNote && (
                          <p className="text-[11px] text-rose-900 m-0 mt-1">
                            Reason: {r.reviewNote}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateToExceptions('rejected-regularisation')}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition-colors cursor-pointer self-end sm:self-auto shrink-0 flex items-center gap-1"
                      >
                        <ArrowUpRightIcon className="w-3 h-3 text-slate-400" />
                        <span>Audit Record</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

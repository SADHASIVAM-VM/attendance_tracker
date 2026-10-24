import React, { useState, useEffect, useCallback } from 'react';
import { SupervisorWorkerAttendance, SupervisorWorksite, MissingClockInCase } from '../../types/supervisor';
import { WorkerRow } from '../../components/supervisor/WorkerRow';
import { ReviewSheet } from '../../components/supervisor/ReviewSheet';
import { SupervisorPersonalAttendance } from '../../components/supervisor/SupervisorPersonalAttendance';
import { MissingClockInManager } from '../../components/supervisor/MissingClockInManager';
import { apiRequest } from '../../lib/api';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  User,
  Users,
} from 'lucide-react';

interface SupervisorAttendanceTabProps {
  workers: SupervisorWorkerAttendance[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onApproveWorker: (worker: SupervisorWorkerAttendance) => void;
  onRejectWorker: (worker: SupervisorWorkerAttendance, reason: string) => void;
  onClockOutWorker?: (worker: SupervisorWorkerAttendance, reason: string) => void | Promise<void>;
  onBulkApprove: (workerIds: string[]) => void;
  onUndoLastAction?: () => void;
  undoAvailable?: { message: string } | null;
  isLoading?: boolean;
  currentWorksite?: SupervisorWorksite;
  initialSection?: 'my-attendance' | 'team-attendance' | 'missing-clock-in';
}

type FilterType = 'All' | 'Pending' | 'Approved' | 'Not Yet In' | 'Absent' | 'Rejected';

export const SupervisorAttendanceTab: React.FC<SupervisorAttendanceTabProps> = ({
  workers,
  selectedDate,
  onSelectDate,
  onApproveWorker,
  onRejectWorker,
  onClockOutWorker,
  onBulkApprove,
  onUndoLastAction,
  undoAvailable,
  isLoading = false,
  currentWorksite,
  initialSection = 'my-attendance',
}) => {
  const [section, setSection] = useState<'my-attendance' | 'team-attendance' | 'missing-clock-in'>(initialSection);
  const [missingCases, setMissingCases] = useState<MissingClockInCase[]>([]);
  const [isLoadingMissing, setIsLoadingMissing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [selectedWorkerForReview, setSelectedWorkerForReview] =
    useState<SupervisorWorkerAttendance | null>(null);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState<boolean>(false);

  const loadMissingClockIns = useCallback(async () => {
    setIsLoadingMissing(true);
    try {
      const wsQuery = currentWorksite?.id ? `&worksiteId=${encodeURIComponent(currentWorksite.id)}` : '';
      const res = await apiRequest<any>(`/attendance/missing-clock-ins?date=${selectedDate}${wsQuery}`);
      const list = Array.isArray(res) ? res : res?.cases || [];
      setMissingCases(list);
    } catch (err) {
      console.error('Error fetching missing clock-in cases:', err);
      setMissingCases([]);
    } finally {
      setIsLoadingMissing(false);
    }
  }, [selectedDate, currentWorksite?.id]);

  useEffect(() => {
    loadMissingClockIns();
  }, [loadMissingClockIns]);

  // Filter workers based on active filter chip
  const filteredWorkers = workers.filter((w) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Pending') return w.status === 'PENDING';
    if (activeFilter === 'Approved') return w.status === 'APPROVED';
    if (activeFilter === 'Rejected') return w.status === 'REJECTED';
    if (activeFilter === 'Not Yet In') {
      return (
        w.status === 'NOT_YET_IN' ||
        (!w.clockInTime && !w.hasAppliedLeave && w.status !== 'ABSENT' && w.status !== 'ON_LEAVE')
      );
    }
    if (activeFilter === 'Absent') {
      return w.status === 'ABSENT' || w.status === 'ON_LEAVE' || w.hasAppliedLeave;
    }
    return true;
  });

  // Filter counts
  const pendingCount = workers.filter((w) => w.status === 'PENDING').length;
  const approvedCount = workers.filter((w) => w.status === 'APPROVED').length;
  const rejectedCount = workers.filter((w) => w.status === 'REJECTED').length;
  const notYetInCount = workers.filter(
    (w) =>
      w.status === 'NOT_YET_IN' ||
      (!w.clockInTime && !w.hasAppliedLeave && w.status !== 'ABSENT' && w.status !== 'ON_LEAVE')
  ).length;
  const absentCount = workers.filter(
    (w) => w.status === 'ABSENT' || w.status === 'ON_LEAVE' || w.hasAppliedLeave
  ).length;

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onSelectDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onSelectDate(d.toISOString().split('T')[0]);
  };

  const handleToggleWorkerSelect = (worker: SupervisorWorkerAttendance) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(worker.id) ? prev.filter((id) => id !== worker.id) : [...prev, worker.id]
    );
  };

  const handleSelectAllPending = () => {
    const pendingIds = filteredWorkers
      .filter((w) => w.status === 'PENDING')
      .map((w) => w.id);
    if (selectedWorkerIds.length === pendingIds.length) {
      setSelectedWorkerIds([]);
    } else {
      setSelectedWorkerIds(pendingIds);
    }
  };

  const handleConfirmBulkApprove = () => {
    onBulkApprove(selectedWorkerIds);
    setSelectedWorkerIds([]);
    setMultiSelectMode(false);
    setShowBulkConfirmModal(false);
  };

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const pendingMissingCount = missingCases.filter((c) => c.flagStatus === 'PENDING_REVIEW' && !c.resolvedByClockIn).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-24">
      {/* ── Sub-Section Switcher: Team Reviews vs Missing Clock-Ins vs My Attendance ─────────────── */}
      <div className="flex p-1 bg-white border border-[#E8EEF4] rounded-[16px] shadow-xs gap-1">
        <button
          type="button"
          onClick={() => setSection('team-attendance')}
          className={`flex-1 py-2.5 px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            section === 'team-attendance'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="truncate">Team Attendance ({workers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('missing-clock-in')}
          className={`flex-1 py-2.5 px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            section === 'missing-clock-in'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">Missing Clock-Ins</span>
          {missingCases.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                section === 'missing-clock-in'
                  ? 'bg-white/25 text-white'
                  : pendingMissingCount > 0
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {missingCases.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSection('my-attendance')}
          className={`flex-1 py-2.5 px-2 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            section === 'my-attendance'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate">My Attendance</span>
        </button>
      </div>

      {/* ── SECTION: MISSING CLOCK-IN ATTENDANCE FLAGS ──────────────────────── */}
      {section === 'missing-clock-in' && (
        <MissingClockInManager
          cases={missingCases}
          isLoading={isLoadingMissing}
          onRefresh={loadMissingClockIns}
          selectedDate={selectedDate}
        />
      )}

      {/* ── SECTION 1: MY ATTENDANCE & CLOCK-IN (Supervisor radius bypass & calendar) ── */}
      {section === 'my-attendance' && (
        <SupervisorPersonalAttendance
          currentWorksite={
            currentWorksite || {
              id: 'ws_blr_alpha',
              name: 'Metro Line 4 - Gate 3 Worksite',
              code: 'ML4-G3',
              address: 'Ring Road Junction, Pillar 240',
              radiusMeters: 20,
            }
          }
        />
      )}

      {/* ── SECTION 2: TEAM ATTENDANCE & APPROVALS (Worker reviews) ───────────── */}
      {section === 'team-attendance' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* 1. TOP CONTROLS: Responsive Date Selector & Filter Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Date Selector */}
        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-2.5 sm:px-4 shadow-xs flex items-center justify-between sm:justify-start gap-3">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#12A66A]" />
            <span className="text-xs sm:text-sm font-bold text-[#111827] tabular-nums">
              {formattedDate}
            </span>
            {selectedDate === new Date().toISOString().split('T')[0] && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#0E8F5B]">
                Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-select toggle button */}
        {pendingCount > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setMultiSelectMode(!multiSelectMode);
                setSelectedWorkerIds([]);
              }}
              className={`px-3 py-2 rounded-[12px] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                multiSelectMode
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white border border-[#E8EEF4] text-[#12A66A] hover:bg-[#E6F7EF]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{multiSelectMode ? 'Cancel Selection' : 'Multi-Select Mode'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. FILTER CHIPS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            { id: 'All', label: 'All', count: workers.length },
            { id: 'Pending', label: 'Pending', count: pendingCount },
            { id: 'Approved', label: 'Approved', count: approvedCount },
            { id: 'Not Yet In', label: 'Not Yet In', count: notYetInCount },
            { id: 'Absent', label: 'Absent', count: absentCount },
            { id: 'Rejected', label: 'Rejected', count: rejectedCount },
          ] as const
        ).map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#12A66A] text-white shadow-xs'
                  : 'bg-white border border-[#E8EEF4] text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Missing Clock-In Prompt Banner when workers haven't clocked in */}
      {activeFilter === 'Not Yet In' && missingCases.length > 0 && (
        <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-[14px] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {missingCases.length} worker(s) have exceeded their 15m shift grace period without clocking in.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSection('missing-clock-in')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[10px] font-bold shrink-0 transition-colors cursor-pointer"
          >
            Review Missing Flags →
          </button>
        </div>
      )}

      {/* 3. MULTI-SELECT ACTIONS BAR (WHEN ACTIVE) */}
      {multiSelectMode && (
        <div className="p-3 bg-[#E6F7EF] border border-[#12A66A]/30 rounded-[14px] flex items-center justify-between animate-in fade-in duration-150">
          <button
            type="button"
            onClick={handleSelectAllPending}
            className="flex items-center gap-2 text-xs font-bold text-[#0E8F5B] cursor-pointer"
          >
            {selectedWorkerIds.length > 0 &&
            selectedWorkerIds.length ===
              filteredWorkers.filter((w) => w.status === 'PENDING').length ? (
              <CheckSquare className="w-4 h-4 fill-[#12A66A] text-white" />
            ) : (
              <Square className="w-4 h-4 text-[#12A66A]" />
            )}
            <span>Select All Pending ({pendingCount})</span>
          </button>

          <span className="text-xs font-semibold text-slate-700">
            {selectedWorkerIds.length} selected
          </span>
        </div>
      )}

      {/* 4. WORKERS ATTENDANCE LIST: 1-col on mobile, 2-col on md+ */}
      {isLoading ? (
        // Loading Skeletons
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#E8EEF4] rounded-[16px] p-4 flex items-center gap-3 animate-pulse"
            >
              <div className="w-11 h-11 bg-slate-200 rounded-[14px]" />
              <div className="flex-1 space-y-2">
                <div className="w-32 h-4 bg-slate-200 rounded-md" />
                <div className="w-48 h-3 bg-slate-100 rounded-md" />
              </div>
              <div className="w-16 h-6 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        // Empty State
        <div className="p-12 text-center bg-white border border-[#E8EEF4] rounded-[20px] shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h4 className="text-sm sm:text-base font-bold text-slate-800">
            {activeFilter === 'Pending'
              ? 'All Caught Up!'
              : `No ${activeFilter.toLowerCase()} records`}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeFilter === 'Pending'
              ? 'All worker punches for this shift have been reviewed and approved.'
              : 'There are no attendance sessions matching this filter criteria for the selected date.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredWorkers.map((worker) => (
            <WorkerRow
              key={worker.id}
              worker={worker}
              onSelect={(w) => setSelectedWorkerForReview(w)}
              onQuickApprove={(w, e) => {
                e.stopPropagation();
                onApproveWorker(w);
              }}
              onQuickReject={(w, e) => {
                e.stopPropagation();
                setSelectedWorkerForReview(w);
              }}
              multiSelectMode={multiSelectMode}
              isSelected={selectedWorkerIds.includes(worker.id)}
              onToggleSelect={handleToggleWorkerSelect}
            />
          ))}
        </div>
      )}

      {/* 5. STICKY BULK APPROVE BAR (When Multi-Select has selected items) */}
      {multiSelectMode && selectedWorkerIds.length > 0 && (
        <div className="fixed bottom-20 inset-x-4 max-w-md mx-auto z-40 bg-white border border-[#12A66A] rounded-[18px] p-3 shadow-xl flex items-center justify-between animate-in slide-in-from-bottom duration-150">
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              {selectedWorkerIds.length} workers selected
            </span>
            <span className="text-[11px] text-slate-500">Fast batch attendance approval</span>
          </div>

          <button
            type="button"
            onClick={() => setShowBulkConfirmModal(true)}
            className="px-4 py-2.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-[12px] text-xs font-bold shadow-md shadow-[#12A66A]/20 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve Selected</span>
          </button>
        </div>
      )}

      {/* 6. UNDO ACTION TOAST */}
      {undoAvailable && (
        <div className="fixed bottom-20 inset-x-4 max-w-md mx-auto z-40 bg-slate-900 text-white rounded-[14px] p-3 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-[#12A66A]" />
            <span>{undoAvailable.message}</span>
          </div>
          {onUndoLastAction && (
            <button
              type="button"
              onClick={onUndoLastAction}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 px-2 py-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
          )}
        </div>
      )}

      {/* 7. CONFIRMATION MODAL BEFORE BULK APPROVAL */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[20px] max-w-xs w-full p-5 space-y-4 shadow-2xl border border-[#E8EEF4]">
            <div className="w-11 h-11 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-slate-900">Approve All Selected?</h4>
              <p className="text-xs text-slate-600">
                You are approving attendance for <strong>{selectedWorkerIds.length} workers</strong>.
                Their shifts will be marked verified for payroll.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="flex-1 py-2.5 rounded-[12px] border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkApprove}
                className="flex-1 py-2.5 rounded-[12px] bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold shadow-md shadow-[#12A66A]/20 transition-colors"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. REVIEW BOTTOM SHEET */}
      <ReviewSheet
        worker={selectedWorkerForReview}
        isOpen={Boolean(selectedWorkerForReview)}
        onClose={() => setSelectedWorkerForReview(null)}
        onApprove={(w) => {
          onApproveWorker(w);
          setSelectedWorkerForReview(null);
        }}
        onReject={(w, reason) => {
          onRejectWorker(w, reason);
          setSelectedWorkerForReview(null);
        }}
        onClockOutWorker={onClockOutWorker}
      />
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { SupervisorWorkerAttendance } from '../../types/supervisor';
import { StatusPill } from './StatusPill';
import {
  CloseIcon,
  CheckIcon,
  LocationIcon,
  ClockIcon,
  ErrorProfileIcon,
  SearchZoomInIcon,
  SecuritySafeIcon,
  NoteTextIcon,
  Logout2Icon,
} from '@astraicons/react/linear';

interface ReviewSheetProps {
  worker: SupervisorWorkerAttendance | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (worker: SupervisorWorkerAttendance) => void;
  onReject: (worker: SupervisorWorkerAttendance, reason: string) => void;
  onClockOutWorker?: (worker: SupervisorWorkerAttendance, reason: string) => void | Promise<void>;
}

const QUICK_REASONS = [
  'Photo unclear',
  'Wrong location',
  'Late without notice',
  'Other',
];

export const ReviewSheet: React.FC<ReviewSheetProps> = ({
  worker,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onClockOutWorker,
}) => {
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [selectedQuickReason, setSelectedQuickReason] = useState<string>('Photo unclear');
  const [customReason, setCustomReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Supervisor-assisted clock-out modal state
  const [showClockOutModal, setShowClockOutModal] = useState<boolean>(false);
  const [clockOutReason, setClockOutReason] = useState<string>('Shift concluded - assisted clock-out');
  const [clockOutSubmitting, setClockOutSubmitting] = useState<boolean>(false);
  const [clockOutError, setClockOutError] = useState<string>('');

  const currentMonthStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const isCurrentMonth = React.useMemo(() => {
    if (!worker?.date) return true;
    return worker.date.substring(0, 7) === currentMonthStr;
  }, [worker?.date, currentMonthStr]);

  if (!isOpen || !worker) return null;

  const handleConfirmReject = () => {
    let finalReason = selectedQuickReason;
    if (selectedQuickReason === 'Other') {
      if (!customReason.trim()) {
        setErrorMsg('Please specify a rejection reason for worker feedback.');
        return;
      }
      finalReason = customReason.trim();
    }
    setErrorMsg('');
    setShowRejectForm(false);
    onReject(worker, finalReason);
  };

  const handleConfirmClockOut = async () => {
    if (!clockOutReason.trim() || clockOutReason.trim().length < 3) {
      setClockOutError('Please provide a reason (minimum 3 characters) for this clock-out.');
      return;
    }
    setClockOutError('');
    setClockOutSubmitting(true);
    try {
      if (onClockOutWorker) {
        await onClockOutWorker(worker, clockOutReason.trim());
      }
      setShowClockOutModal(false);
      onClose();
    } catch (err: any) {
      setClockOutError(err.message || 'Failed to clock out worker.');
    } finally {
      setClockOutSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={() => {
          if (!zoomedPhoto) onClose();
        }}
      />

      {/* Sheet Container (Mobile Bottom Sheet / Desktop Modal) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attendance Review Sheet"
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-full z-50 bg-white rounded-t-[24px] sm:rounded-[20px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        {/* Drag Handle (Mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3.5 border-b border-[#E8EEF4] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={worker.avatar}
              alt={worker.name}
              className="w-10 h-10 rounded-[12px] object-cover border border-[#E8EEF4]"
            />
            <div>
              <h3 className="text-base font-bold text-[#111827] leading-tight">
                {worker.name}
              </h3>
              <span className="text-xs text-[#6B7280]">
                {worker.role} • ID: {worker.workerId.slice(0, 8)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill status={worker.status} size="sm" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          {/* Verification Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                <SecuritySafeIcon className="w-4 h-4 text-[#12A66A]" />
                Selfie Verification Proofs
              </span>
              <span className="text-[11px] text-[#64748B]">Tap photo to zoom</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Clock-in photo */}
              <div
                onClick={() => setZoomedPhoto(worker.inPhotoUrl)}
                className="group relative aspect-4/3 rounded-[14px] overflow-hidden bg-slate-100 border border-[#E8EEF4] cursor-pointer shadow-xs hover:border-[#12A66A]"
              >
                <img
                  src={worker.inPhotoUrl}
                  alt="Clock-in proof"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                  <span className="text-[10px] uppercase font-bold tracking-wider block text-emerald-300">
                    Clock-In
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {worker.clockInTime || '--:--'}
                  </span>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-xs p-1 rounded-full text-white opacity-80 group-hover:opacity-100">
                  <SearchZoomInIcon className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Clock-out photo or pending slot */}
              <div
                onClick={() => worker.outPhotoUrl && setZoomedPhoto(worker.outPhotoUrl)}
                className={`group relative aspect-4/3 rounded-[14px] overflow-hidden border border-[#E8EEF4] flex flex-col items-center justify-center ${
                  worker.outPhotoUrl ? 'cursor-pointer hover:border-[#12A66A]' : 'bg-slate-50'
                }`}
              >
                {worker.outPhotoUrl ? (
                  <>
                    <img
                      src={worker.outPhotoUrl}
                      alt="Clock-out proof"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                      <span className="text-[10px] uppercase font-bold tracking-wider block text-amber-300">
                        Clock-Out
                      </span>
                      <span className="text-xs font-semibold tabular-nums">
                        {worker.clockOutTime || '--:--'}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-xs p-1 rounded-full text-white opacity-80 group-hover:opacity-100">
                      <SearchZoomInIcon className="w-3.5 h-3.5" />
                    </div>
                  </>
                ) : (
                  <div className="text-center p-3">
                    <ClockIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <span className="text-xs font-bold text-slate-500 block">In Progress</span>
                    <span className="text-[10px] text-slate-400">Shift not yet punched out</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Time & Duration summary */}
          <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] border border-[#E8EEF4] rounded-[14px] p-3 text-center">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Clock In</span>
              <strong className="text-xs text-slate-900 tabular-nums">
                {worker.clockInTime || 'Not clocked in'}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Clock Out</span>
              <strong className="text-xs text-slate-900 tabular-nums">
                {worker.clockOutTime || 'Ongoing'}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Hours</span>
              <strong className="text-xs text-[#12A66A] tabular-nums font-black">
                {worker.totalHours ? `${worker.totalHours} hrs` : '--'}
              </strong>
            </div>
          </div>

          {/* Location & Geofence Details */}
          <div className="bg-white border border-[#E8EEF4] rounded-[14px] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                <LocationIcon className="w-4 h-4 text-[#12A66A]" />
                Location & Geofence Audit
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  worker.isWithinRadius
                    ? 'bg-[#E6F7EF] text-[#0E8F5B]'
                    : 'bg-[#FEE2E2] text-[#DC2626]'
                }`}
              >
                {worker.distanceMeters} m from site
              </span>
            </div>

            <p className="text-xs text-[#475569]">
              <strong>Worksite:</strong> {worker.worksiteName}
            </p>

            {worker.isWithinRadius ? (
              <div className="flex items-center gap-2 p-2 bg-[#F0FDF4] rounded-[10px] text-xs text-[#166534]">
                <SecuritySafeIcon className="w-4 h-4 flex-shrink-0 text-[#12A66A]" />
                <span>Worker verified within the authorized 100m geofence perimeter.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-[#FEF2F2] rounded-[10px] text-xs text-[#991B1B]">
                <ErrorProfileIcon className="w-4 h-4 flex-shrink-0 text-[#DC2626]" />
                <span>Flagged: Worker punched {worker.distanceMeters}m away from site.</span>
              </div>
            )}
          </div>

          {/* Worker Note or Supervisor Decision note */}
          {(worker.note || worker.decisionNote) && (
            <div className="bg-slate-50 border border-[#E8EEF4] rounded-[14px] p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <NoteTextIcon className="w-3.5 h-3.5 text-slate-400" />
                Notes & Comments
              </span>
              {worker.note && (
                <p className="text-xs text-slate-700 italic">Worker: "{worker.note}"</p>
              )}
              {worker.decisionNote && (
                <p className="text-xs text-slate-700">Supervisor Note: {worker.decisionNote}</p>
              )}
            </div>
          )}

          {/* Rejection Form Drawer / Dropdown */}
          {showRejectForm && (
            <div className="p-4 bg-[#FFF5F5] border border-rose-200 rounded-[16px] space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#DC2626] flex items-center gap-1.5">
                  <ErrorProfileIcon className="w-4 h-4" />
                  Select Reason for Rejection
                </span>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>

              {/* Quick Pick Reason Chips */}
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((reason) => {
                  const isSelected = selectedQuickReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedQuickReason(reason)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-[#DC2626] text-white shadow-xs'
                          : 'bg-white border border-rose-200 text-slate-700 hover:bg-rose-50'
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>

              {selectedQuickReason === 'Other' && (
                <div>
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter detailed reason for the worker..."
                    className="w-full text-xs p-2.5 bg-white border border-rose-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>
              )}

              <button
                type="button"
                onClick={handleConfirmReject}
                className="w-full py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-[12px] text-xs font-bold transition-colors active:scale-98"
              >
                Confirm Rejection
              </button>
            </div>
          )}
        </div>

        {/* Sticky Action Bar */}
        <div className="p-4 border-t border-[#E8EEF4] bg-white sticky bottom-0 inset-x-0 space-y-2.5">
          {!isCurrentMonth ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[14px] text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
              <ErrorProfileIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950 m-0">Non-Current Month Record ({worker.date ? worker.date.substring(0, 7) : 'Prior'})</p>
                <p className="mt-0.5 text-[11px] text-amber-800 m-0">
                  Supervisors can only edit current month's records ({currentMonthStr}). Prior month modifications must use the Worker Regularisation or Admin Attendance Correction workflow.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* If worker is clocked in and not clocked out, show Clock Out Worker button */}
              {worker.clockInTime && !worker.clockOutTime && onClockOutWorker && (
                <button
                  type="button"
                  onClick={() => setShowClockOutModal(true)}
                  className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-[14px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Logout2Icon className="w-4 h-4 text-amber-700" />
                  <span>Clock Out Worker (Assisted Punch)</span>
                </button>
              )}

              {/* Approve / Reject buttons displayed ONLY when status is PENDING */}
              {worker.status === 'PENDING' ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectForm(!showRejectForm);
                    }}
                    className="flex-1 py-3 border-2 border-[#DC2626] hover:bg-rose-50 text-[#DC2626] rounded-[14px] text-xs font-bold transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CloseIcon className="w-4 h-4 stroke-[2.5]" />
                    Reject Attendance
                  </button>

                  <button
                    type="button"
                    onClick={() => onApprove(worker)}
                    className="flex-1 py-3 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-[14px] text-xs font-bold transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-md shadow-[#12A66A]/20 cursor-pointer"
                  >
                    <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                    Approve Attendance
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-[14px] flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Attendance Decision Recorded</span>
                  <StatusPill status={worker.status} size="sm" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Supervisor Assisted Clock-Out Confirmation Modal */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Logout2Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Confirm Assisted Clock-Out
                </h3>
                <p className="text-xs text-slate-500">
                  Supervisor-initiated shift conclusion
                </p>
              </div>
            </div>

            {/* Worker Details Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Worker:</span>
                <span className="font-bold text-slate-900">{worker.name} ({worker.role})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clock-In Time:</span>
                <span className="font-bold text-slate-900">{worker.clockInTime || 'Recorded today'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Worksite:</span>
                <span className="font-semibold text-slate-700">{worker.worksiteName || 'Assigned Site'}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200/60 text-amber-800 bg-amber-50/60 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
                <span className="font-bold block text-[11px]">Notice:</span>
                This will record a verified server-recorded clock-out timestamp under your supervisor actor ID (SUPERVISOR_ASSISTED) and notify the worker.
              </div>
            </div>

            {/* Reason input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason / Note for Clock-Out <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={clockOutReason}
                onChange={(e) => setClockOutReason(e.target.value)}
                placeholder="e.g. Worker completed scheduled tasks, shift ended..."
                className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {clockOutError && (
                <p className="text-xs text-rose-600 font-medium mt-1">{clockOutError}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowClockOutModal(false);
                  setClockOutError('');
                }}
                disabled={clockOutSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClockOut}
                disabled={clockOutSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {clockOutSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <span>Record Clock-Out</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Zoom Modal */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setZoomedPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 backdrop-blur-md"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
          <img
            src={zoomedPhoto}
            alt="Zoomed selfie audit"
            className="max-h-[85vh] max-w-full rounded-[16px] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-white/70 text-xs mt-3">High-resolution verification capture</p>
        </div>
      )}
    </>
  );
};

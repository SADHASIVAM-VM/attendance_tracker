import React from 'react';
import { SupervisorWorkerAttendance } from '../../types/supervisor';
import { StatusPill } from './StatusPill';
import { CheckIcon, CloseIcon, ClockIcon, LocationIcon, CheckCircleIcon } from '@astraicons/react/linear';

interface WorkerRowProps {
  worker: SupervisorWorkerAttendance;
  onSelect: (worker: SupervisorWorkerAttendance) => void;
  onQuickApprove?: (worker: SupervisorWorkerAttendance, e: React.MouseEvent) => void;
  onQuickReject?: (worker: SupervisorWorkerAttendance, e: React.MouseEvent) => void;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (worker: SupervisorWorkerAttendance) => void;
}

export const WorkerRow: React.FC<WorkerRowProps> = ({
  worker,
  onSelect,
  onQuickApprove,
  onQuickReject,
  multiSelectMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const isPending = worker.status === 'PENDING';

  return (
    <div
      onClick={() => {
        if (multiSelectMode && onToggleSelect) {
          onToggleSelect(worker);
        } else {
          onSelect(worker);
        }
      }}
      className={`relative group bg-white border rounded-[16px] p-3.5 transition-all duration-150 flex items-center gap-3 cursor-pointer shadow-xs ${
        isSelected
          ? 'border-[#12A66A] bg-[#F0FDF4]'
          : 'border-[#E8EEF4] hover:border-[#12A66A]/40 hover:shadow-sm'
      }`}
    >
      {/* Multi-select checkbox */}
      {multiSelectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(worker);
          }}
          className="text-[#12A66A] p-1 -ml-1 transition-transform active:scale-90"
        >
          {isSelected ? (
            <CheckCircleIcon className="w-5 h-5 text-[#12A66A]" />
          ) : (
            <div className="w-4 h-4 rounded border-2 border-slate-300" />
          )}
        </button>
      )}

      {/* Avatar with photo thumbnail indicator */}
      <div className="relative flex-shrink-0">
        <img
          src={worker.avatar}
          alt={worker.name}
          className="w-11 h-11 rounded-[14px] object-cover border border-[#E8EEF4]"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="%23E6F7EF"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="%2312A66A">${encodeURIComponent(worker.name?.charAt(0).toUpperCase() || 'W')}</text></svg>`;
          }}
        />
        {/* Verification selfie badge indicator if photo present */}
        {worker.inPhotoUrl && (
          <div
            title="Verified Selfie Attached"
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#12A66A] border-2 border-white flex items-center justify-center text-[8px] text-white font-bold"
          >
            ✓
          </div>
        )}
      </div>

      {/* Worker Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h4 className="text-sm font-bold text-[#111827] truncate leading-snug">
            {worker.name}
          </h4>
          {worker.employeeCode && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
              {worker.employeeCode}
            </span>
          )}
          <span className="text-[11px] text-[#6B7280] font-medium hidden sm:inline">
            • {worker.role}
          </span>
          {worker.worksiteName && (
            <span className="text-[10px] text-slate-400 font-medium hidden md:inline truncate max-w-[120px]">
              • {worker.worksiteName}
            </span>
          )}
        </div>

        {/* Times & Distance */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-xs text-[#64748B]">
          <span className="flex items-center gap-1 font-medium tabular-nums">
            <ClockIcon className="w-3.5 h-3.5 text-[#12A66A]" />
            {worker.clockInTime ? worker.clockInTime : 'Not clocked in'}
            {worker.clockOutTime && ` – ${worker.clockOutTime}`}
          </span>

          {worker.clockInTime && (
            <span
              className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                worker.isWithinRadius ? 'text-[#0E8F5B]' : 'text-[#DC2626]'
              }`}
            >
              <LocationIcon className="w-3 h-3" />
              {worker.distanceMeters}m {worker.isWithinRadius ? 'on site' : 'outside'}
            </span>
          )}

          {/* Supervisor Remarks / Reason */}
          {(worker.rejectionReason || worker.flagReason || (worker.note && worker.note !== 'Not yet clocked in' && worker.note !== 'Not yet in' && worker.note !== 'Scheduled on shift roster')) && (
            <span className="w-full text-[11px] text-slate-500 truncate block mt-0.5">
              {worker.rejectionReason ? `Reason: ${worker.rejectionReason}` : (worker.flagReason || worker.note)}
            </span>
          )}
        </div>
      </div>

      {/* Right side: Status Pill or Quick Action Buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isPending && !multiSelectMode && (onQuickApprove || onQuickReject) ? (
          <div className="flex items-center gap-1">
            {onQuickReject && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickReject(worker, e);
                }}
                title="Quick Reject"
                className="w-8 h-8 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[#DC2626] flex items-center justify-center transition-colors active:scale-95"
              >
                <CloseIcon className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
            {onQuickApprove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickApprove(worker, e);
                }}
                title="Quick Approve"
                className="w-8 h-8 rounded-full bg-[#12A66A] hover:bg-[#0E8F5B] text-white flex items-center justify-center shadow-xs transition-colors active:scale-95"
              >
                <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        ) : (
          <StatusPill status={worker.status} size="sm" />
        )}
      </div>
    </div>
  );
};

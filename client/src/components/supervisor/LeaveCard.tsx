import React, { useState } from 'react';
import { WorkerLeaveItem } from '../../types/supervisor';
import { StatusPill } from './StatusPill';
import { Calendar, ChevronDown, ChevronUp, ShieldCheck, Clock, Ban, AlertCircle, Eye } from 'lucide-react';

interface LeaveCardProps {
    leave: WorkerLeaveItem;
    onApprove?: (leave: WorkerLeaveItem) => void;
    onReject?: (leave: WorkerLeaveItem) => void;
    onRevoke?: (leave: WorkerLeaveItem) => void;
    onSelect?: (leave: WorkerLeaveItem) => void;
}

export const LeaveCard: React.FC<LeaveCardProps> = ({ leave, onApprove, onReject, onRevoke, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

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
    // Section 1: Eligible only when APPROVED, not started (> today), within current month, not cross-month
    const isEligibleForRevoke = isApproved && isFuture && isCurrentMonth;

    return (
        <div 
            onClick={() => onSelect?.(leave)}
            className="bg-white border border-[#E8EEF4] rounded-[16px] p-4 shadow-xs transition-all duration-150 hover:border-[#12A66A]/40 hover:shadow-sm space-y-3 cursor-pointer group"
        >
            {/* Header: Avatar, Name, Status Pill & Details Action */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <img
                        src={leave.workerAvatar}
                        alt={leave.workerName}
                        className="w-10 h-10 rounded-[12px] object-cover border border-[#E8EEF4]"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src =
                                `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="%23E6F7EF"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="%2312A66A">${encodeURIComponent(leave.workerName?.charAt(0).toUpperCase() || 'W')}</text></svg>`;
                        }}
                    />
                    <div>
                        <h4 className="text-sm font-bold text-[#111827] leading-tight group-hover:text-[#12A66A] transition-colors">
                            {leave.workerName}
                        </h4>
                        <span className="text-xs text-[#6B7280]">
                            {leave.workerRole} • {leave.leaveType}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <StatusPill status={leave.status} size="sm" />
                    {onSelect && (
                        <button
                            type="button"
                            onClick={() => onSelect(leave)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="View Leave Details"
                        >
                            <Eye className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Date Range & Duration Badge */}
            <div className="flex items-center justify-between bg-[#F8FAFC] rounded-[12px] p-2.5 text-xs text-[#334155]">
                <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#12A66A]" />
                    <span>
                        {leave.startDate} – {leave.endDate}
                    </span>
                </div>
                <span className="px-2 py-0.5 rounded-full font-bold bg-[#E6F7EF] text-[#0E8F5B] text-[11px]">
                    {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                </span>
            </div>

            {/* Expandable Reason Section */}
            <div>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-[#64748B] hover:text-[#111827] transition-colors py-0.5"
                >
                    <span>Reason for leave</span>
                    <span className="flex items-center gap-0.5 text-[#12A66A] text-[11px]">
                        {isExpanded ? 'Hide' : 'View'}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                </button>

                {isExpanded && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-100 rounded-[10px] text-xs text-slate-700 leading-relaxed animate-in fade-in duration-150">
                        "{leave.reason}"
                    </div>
                )}
            </div>

            {/* Revoked Details Section */}
            {leave.status === 'REVOKED' && (
                <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-[10px] text-xs space-y-1">
                    <div className="flex items-center justify-between text-rose-800 font-bold text-[11px]">
                        <span className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Revocation Details
                        </span>
                        {leave.revokedAt && (
                            <span className="text-[10px] font-normal text-rose-600">
                                {new Date(leave.revokedAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    {leave.revocationReason && (
                        <p className="text-[11px] text-rose-700 m-0 leading-snug">
                            <strong>Reason:</strong> "{leave.revocationReason}"
                        </p>
                    )}
                    {leave.revokedByName && (
                        <span className="text-[10px] text-rose-600 block">
                            Revoked by: {leave.revokedByName}
                        </span>
                    )}
                </div>
            )}

            {/* Actions for pending leave requests */}
            {leave.status === 'PENDING' && (onApprove || onReject) && (
                <div className="pt-2 border-t border-[#F1F5F9] flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {onApprove && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onApprove(leave);
                            }}
                            className="flex-1 py-1.5 px-3 rounded-[10px] bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold transition-colors cursor-pointer text-center"
                        >
                            Approve
                        </button>
                    )}
                    {onReject && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReject(leave);
                            }}
                            className="flex-1 py-1.5 px-3 rounded-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer text-center"
                        >
                            Reject
                        </button>
                    )}
                </div>
            )}

            {/* Revoke Action for eligible approved future leave */}
            {isEligibleForRevoke && onRevoke && (
                <div className="pt-2 border-t border-[#F1F5F9]" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRevoke(leave);
                        }}
                        className="w-full py-1.5 px-3 rounded-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <Ban className="w-3.5 h-3.5 text-amber-700" />
                        <span>Revoke Leave</span>
                    </button>
                </div>
            )}

            {/* Status footer */}
            <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Applied on {leave.appliedOn}
                </span>
                <span className="flex items-center gap-1 font-semibold text-[#12A66A]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {leave.status === 'APPROVED'
                        ? leave.isApprovedByAdmin
                            ? 'Approved (Admin)'
                            : 'Approved (Supervisor)'
                        : leave.status === 'REJECTED'
                            ? 'Rejected'
                            : leave.status === 'REVOKED'
                                ? 'Revoked'
                                : 'Pending decision'}
                </span>
            </div>
        </div>
    );
};


import React, { useState } from 'react';
import { WorkerLeaveItem } from '../../types/supervisor';
import { StatusPill } from './StatusPill';
import { Calendar, ChevronDown, ChevronUp, ShieldCheck, Clock, User } from 'lucide-react';

interface LeaveCardProps {
    leave: WorkerLeaveItem;
    onApprove?: (leave: WorkerLeaveItem) => void;
    onReject?: (leave: WorkerLeaveItem) => void;
}

export const LeaveCard: React.FC<LeaveCardProps> = ({ leave, onApprove, onReject }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    return (
        <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-4 shadow-xs transition-all duration-150 hover:border-[#12A66A]/30 space-y-3">
            {/* Header: Avatar, Name, Status Pill */}
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
                        <h4 className="text-sm font-bold text-[#111827] leading-tight">
                            {leave.workerName}
                        </h4>
                        <span className="text-xs text-[#6B7280]">
                            {leave.workerRole} • {leave.leaveType}
                        </span>
                    </div>
                </div>

                <StatusPill status={leave.status} size="sm" />
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

            {/* View-only admin note */}
            <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Applied on {leave.appliedOn}
                </span>
                <span className="flex items-center gap-1 font-semibold text-[#12A66A]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {leave.status === 'APPROVED'
                        ? 'Approved by admin'
                        : leave.status === 'REJECTED'
                            ? 'Rejected by admin'
                            : 'Pending admin approval'}
                </span>
            </div>
        </div>
    );
};

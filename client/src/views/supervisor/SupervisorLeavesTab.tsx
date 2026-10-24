import React, { useState } from 'react';
import { WorkerLeaveItem, LeaveFilter } from '../../types/supervisor';

import { WorkerLeaveView } from '../worker/WorkerLeaveView';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ShieldCheck,
  Palmtree,
  User,
  Users,
  FileText,
} from 'lucide-react';
import { LeaveCard } from '#components/supervisor/LeaveCard';

interface SupervisorLeavesTabProps {
  leaves: WorkerLeaveItem[];
  isLoading?: boolean;
  onApproveLeave?: (leaveId: string) => void;
  onRejectLeave?: (leaveId: string) => void;
}

export const SupervisorLeavesTab: React.FC<SupervisorLeavesTabProps> = ({
  leaves,
  isLoading = false,
  onApproveLeave,
  onRejectLeave,
}) => {
  const [activeSection, setActiveSection] = useState<'my-leaves' | 'team-leaves'>('my-leaves');
  const [activeFilter, setActiveFilter] = useState<LeaveFilter>('Today');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Stat Strip counts for assigned team
  const onLeaveTodayCount = leaves.filter((l) => {
    return l.status === 'APPROVED' && l.startDate <= todayStr && l.endDate >= todayStr;
  }).length;

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedMonthCount = leaves.filter((l) => l.status === 'APPROVED').length;

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
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-20">
      {/* ── Sub-Section Switcher: My Leaves vs Team Leaves ─────────────────── */}
      <div className="flex p-1 bg-white border border-[#E8EEF4] rounded-[16px] shadow-xs">
        <button
          type="button"
          onClick={() => setActiveSection('my-leaves')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activeSection === 'my-leaves'
            ? 'bg-[#12A66A] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <User className="w-4 h-4" />
          <span>My Leaves & Balances</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('team-leaves')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${activeSection === 'team-leaves'
            ? 'bg-[#12A66A] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Leave Roster ({leaves.length})</span>
        </button>
      </div>

      {/* ── SECTION 1: MY LEAVES (Supervisor's own leaves -> goes to Admin) ────────── */}
      {activeSection === 'my-leaves' && (
        <div className="animate-in fade-in duration-150">
          <WorkerLeaveView />
        </div>
      )}

      {/* ── SECTION 2: TEAM LEAVE ROSTER (Worker leaves -> assigned to Supervisor) ── */}
      {activeSection === 'team-leaves' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* 1. STAT STRIP AT TOP */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
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
              <span className="text-[10px] text-[#B45309] font-medium">Awaiting your decision</span>
            </div>

            <div className="bg-white border border-[#E8EEF4] rounded-[16px] p-3 text-center shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Approved Month
              </span>
              <span className="text-xl font-black text-slate-900 tabular-nums block mt-0.5">
                {approvedMonthCount}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">This month</span>
            </div>
          </div>

          {/* 2. SEARCH & FILTER CHIPS */}
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
                ] as const
              ).map((chip) => {
                const isSelected = activeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setActiveFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                      ? 'bg-[#12A66A] text-white shadow-xs'
                      : 'bg-white border border-[#E8EEF4] text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. LEAVES LIST: 1-col on mobile, 2-col on md, 3-col on lg */}
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
                  onApprove={onApproveLeave ? (item) => onApproveLeave(item.id) : undefined}
                  onReject={onRejectLeave ? (item) => onRejectLeave(item.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

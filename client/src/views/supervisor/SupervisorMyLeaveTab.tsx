import React from 'react';
import { WorkerLeaveView } from '../worker/WorkerLeaveView';
import { TreeIcon, SecuritySafeIcon } from '@astraicons/react/linear';

export const SupervisorMyLeaveTab: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-20">
      {/* Header Banner - Distinct for Personal Leaves */}
      <div className="bg-white border border-[#E8EEF4] rounded-[18px] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F7EF] text-[#01B075] flex items-center justify-center shadow-2xs">
            <TreeIcon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">
              My Leaves & Balances
            </h2>
            <p className="text-xs text-slate-500">
              Manage your personal leave quotas, submit leave requests to Administrator, and check approval status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <SecuritySafeIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>Admin Review Tier</span>
          </span>
        </div>
      </div>

      {/* Personal Leave Balances & History */}
      <WorkerLeaveView />
    </div>
  );
};

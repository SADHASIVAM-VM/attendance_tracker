import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import {
  CloseIcon,
  ShieldIcon,
  CalenderIcon,
  LocationIcon,
  ErrorProfileIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@astraicons/react/linear';
import { RefreshCcw } from 'lucide-react';

interface DelegationItem {
  id: string;
  worksiteId: string;
  worksiteName: string;
  worksiteCode: string;
  primarySupervisorId: string;
  primarySupervisorName: string;
  delegatedSupervisorId?: string | null;
  delegatedSupervisorName?: string | null;
  assignmentType: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  isUncovered: boolean;
  fallbackAdminId?: string | null;
  fallbackAdminName?: string | null;
  reason: string;
  notes?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

interface DelegationHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export const DelegationHistoryDrawer: React.FC<DelegationHistoryDrawerProps> = ({
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [kpis, setKpis] = useState<any>({
    totalDelegations: 0,
    activeDelegations: 0,
    uncoveredDelegations: 0,
    scheduledDelegations: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen) {
      loadDelegations();
    }
  }, [isOpen, statusFilter, typeFilter]);

  const loadDelegations = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (typeFilter !== 'ALL') query.set('assignmentType', typeFilter);

      const res = await apiRequest<any>(`/admin/delegations?${query.toString()}`);
      if (res) {
        setDelegations(res.delegations || []);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (err: any) {
      toast.error('Failed to load delegation history', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLifecycle = async () => {
    setSyncing(true);
    try {
      const res = await apiRequest<any>('/admin/delegations/sync', { method: 'POST' });
      toast.success(
        `Lifecycle synced: ${res.summary?.activatedCount || 0} activated, ${res.summary?.completedCount || 0} completed.`,
        'Success'
      );
      loadDelegations();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast.error(err.message || 'Sync failed', 'Error');
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E8EEF4] animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E8EEF4] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-xs">
              <ShieldIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111827] m-0">Supervisor Delegation & Reassignment Audit</h2>
              <p className="text-xs text-[#64748B] m-0 mt-0.5">
                Complete historical record of supervisor leave coverages, admin reassignments, and fallbacks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncLifecycle}
              disabled={syncing}
              className="px-3 py-2 rounded-xl border border-[#E8EEF4] text-xs font-bold text-[#475569] hover:bg-white hover:text-[#111827] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Run lifecycle check to activate scheduled and expire concluded delegations"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#12A66A]' : ''}`} />
              Sync Lifecycle
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#64748B] hover:text-[#111827] hover:bg-[#E8EEF4] transition-colors cursor-pointer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Mini-cards */}
        <div className="grid grid-cols-4 gap-3 px-6 py-4 bg-[#F8FAFC] border-b border-[#E8EEF4]">
          <div className="p-3 rounded-2xl bg-white border border-[#E8EEF4] shadow-2xs">
            <p className="text-[11px] font-bold text-[#64748B] m-0">Total Delegations</p>
            <p className="text-lg font-black text-[#111827] m-0 mt-0.5">{kpis.totalDelegations}</p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-[#E8EEF4] shadow-2xs">
            <p className="text-[11px] font-bold text-[#12A66A] m-0">Active Coverages</p>
            <p className="text-lg font-black text-[#12A66A] m-0 mt-0.5">{kpis.activeDelegations}</p>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-[#E8EEF4] shadow-2xs">
            <p className="text-[11px] font-bold text-[#D97706] m-0">Scheduled Future</p>
            <p className="text-lg font-black text-[#D97706] m-0 mt-0.5">{kpis.scheduledDelegations}</p>
          </div>
          <div className={`p-3 rounded-2xl border shadow-2xs ${kpis.uncoveredDelegations > 0 ? 'bg-[#FEF2F2] border-[#FCA5A5]' : 'bg-white border-[#E8EEF4]'
            }`}>
            <p className="text-[11px] font-bold text-[#DC2626] m-0">Uncovered Fallbacks</p>
            <p className="text-lg font-black text-[#DC2626] m-0 mt-0.5">{kpis.uncoveredDelegations}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-[#E8EEF4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B]">Status:</span>
            {['ALL', 'ACTIVE', 'SCHEDULED', 'COMPLETED', 'SUPERSEDED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === st
                    ? 'bg-[#12A66A] text-white'
                    : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#111827]'
                  }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-xs font-bold text-[#475569] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Assignment Types</option>
            <option value="LEAVE_COVERAGE">Leave Coverage</option>
            <option value="PERMANENT_REASSIGNMENT">Permanent Reassignment</option>
            <option value="TEMPORARY_REASSIGNMENT">Temporary Reassignment</option>
          </select>
        </div>

        {/* Audit Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <RefreshCcw className="w-8 h-8 text-[#12A66A] animate-spin mx-auto" />
              <p className="text-xs font-bold text-[#64748B]">Loading audit logs...</p>
            </div>
          ) : delegations.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <ShieldIcon className="w-10 h-10 text-[#94A3B8] mx-auto" />
              <h3 className="text-sm font-extrabold text-[#111827] m-0">No Delegation Records</h3>
              <p className="text-xs text-[#64748B]">No supervisor delegations or reassignments match your filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {delegations.map((d) => {
                const isAct = d.status === 'ACTIVE';
                const isSup = d.status === 'SUPERSEDED';
                const isCanc = d.status === 'CANCELLED';
                const isComp = d.status === 'COMPLETED';

                return (
                  <div
                    key={d.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${d.isUncovered
                        ? 'bg-[#FFF5F5] border-[#FED7D7]'
                        : isAct
                          ? 'bg-white border-[#A7F3D0] shadow-xs'
                          : 'bg-white border-[#E8EEF4]'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#111827]">{d.worksiteName}</span>
                          <span className="font-mono text-[11px] font-bold text-[#64748B] px-1.5 py-0.5 rounded bg-[#F1F5F9]">
                            {d.worksiteCode}
                          </span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${d.assignmentType === 'PERMANENT_REASSIGNMENT'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : d.assignmentType === 'LEAVE_COVERAGE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                            {d.assignmentType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] m-0">
                          Primary: <span className="font-bold text-[#111827]">{d.primarySupervisorName}</span>
                          {' → '}
                          {d.isUncovered ? (
                            <span className="font-extrabold text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FCA5A5]">
                              ⚠️ Uncovered (Admin Fallback: {d.fallbackAdminName || 'Org Admin'})
                            </span>
                          ) : (
                            <span className="font-bold text-[#12A66A]">
                              Covering: {d.delegatedSupervisorName || 'Assigned'}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${isAct
                            ? 'bg-[#E6F7EF] text-[#0E8F5B] border border-[#A7F3D0]'
                            : isComp
                              ? 'bg-slate-100 text-slate-700'
                              : isSup
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : isCanc
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                          {d.status}
                        </span>
                        <p className="text-[11px] font-mono text-[#64748B] mt-1 m-0">
                          {d.startDate} {d.endDate ? `to ${d.endDate}` : '(Permanent)'}
                        </p>
                      </div>
                    </div>

                    {/* Reason & Audit Notes */}
                    <div className="p-3 bg-[#F8FAFC] rounded-xl text-xs space-y-1">
                      <p className="text-[#334155] m-0">
                        <span className="font-bold text-[#111827]">Reason:</span> {d.reason}
                      </p>
                      {d.notes && (
                        <p className="text-[#64748B] text-[11px] m-0 italic">
                          <span className="font-bold">System Note:</span> {d.notes}
                        </p>
                      )}
                      <p className="text-[10px] text-[#94A3B8] m-0 pt-1">
                        Recorded by {d.createdByName || 'Admin'} on {new Date(d.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

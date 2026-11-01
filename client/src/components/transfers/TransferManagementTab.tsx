import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Plus,
  History,
  X,
  User,
  ShieldAlert,
} from 'lucide-react';
import { ScheduleTransferModal, WorkerOption, WorksiteOption } from './ScheduleTransferModal';
import { CancelTransferModal } from './CancelTransferModal';
import { WorkerTransferHistoryDrawer } from './WorkerTransferHistoryDrawer';

interface TransferItem {
  id: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  workerEmployeeCode?: string;
  sourceWorksiteId: string;
  sourceWorksiteName: string;
  sourceWorksiteCode: string;
  destinationWorksiteId: string;
  destinationWorksiteName: string;
  destinationWorksiteCode: string;
  effectiveDate: string;
  reason: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  initiatorName: string;
  lastModifiedByName?: string;
  cancelledByName?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  executedBy?: string;
  completedAt?: string;
  failureReason?: string;
  createdAt: string;
}

interface TransferManagementTabProps {
  workersList: WorkerOption[];
  worksitesList: WorksiteOption[];
  onRefreshParent?: () => void;
}

export const TransferManagementTab: React.FC<TransferManagementTabProps> = ({
  workersList,
  worksitesList,
  onRefreshParent,
}) => {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [kpis, setKpis] = useState({
    total: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [reconciling, setReconciling] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [worksiteFilter, setWorksiteFilter] = useState<string>('ALL');

  // Modals & Drawers
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [targetWorkerForModal, setTargetWorkerForModal] = useState<WorkerOption | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [transferToCancel, setTransferToCancel] = useState<TransferItem | null>(null);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState<boolean>(false);
  const [historyWorker, setHistoryWorker] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadTransfers();
  }, [statusFilter, worksiteFilter]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      if (worksiteFilter !== 'ALL') queryParams.set('worksiteId', worksiteFilter);

      const res = await apiRequest<any>(`/worker-transfers?${queryParams.toString()}`);
      if (res) {
        setTransfers(res.transfers || []);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualReconcile = async () => {
    try {
      setReconciling(true);
      const res = await apiRequest<any>('/worker-transfers/reconcile', { method: 'POST' });
      toast.success(
        `Executed ${res.executedCount || 0} due transfer(s).`,
        'Reconciliation Completed'
      );
      loadTransfers();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      console.error('Manual reconcile error:', err);
      toast.error(
        err.message || 'Failed to reconcile due transfers',
        'Reconciliation Error'
      );
    } finally {
      setReconciling(false);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.workerName?.toLowerCase().includes(q) ||
      t.workerEmployeeCode?.toLowerCase().includes(q) ||
      t.sourceWorksiteName?.toLowerCase().includes(q) ||
      t.destinationWorksiteName?.toLowerCase().includes(q) ||
      t.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Controls & KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Transfers
          </span>
          <p className="text-xl font-black text-slate-900 mt-1 m-0">{kpis.total}</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Scheduled Future
          </span>
          <p className="text-xl font-black text-amber-800 mt-1 m-0">{kpis.scheduled}</p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
          <p className="text-xl font-black text-emerald-800 mt-1 m-0">{kpis.completed}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
          <p className="text-xl font-black text-slate-700 mt-1 m-0">{kpis.cancelled}</p>
        </div>
      </div>

      {/* Action Header & Search Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff, location, reason..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Worksite Filter */}
          <select
            value={worksiteFilter}
            onChange={(e) => setWorksiteFilter(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Worksites</option>
            {worksitesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Pills & Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            {['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualReconcile}
            disabled={reconciling}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Execute due transfers whose effective date has arrived"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin text-emerald-600' : ''}`} />
            Sync Due
          </button>

          <button
            onClick={() => {
              setTargetWorkerForModal(null);
              setScheduleModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Schedule Transfer
          </button>
        </div>
      </div>

      {/* Transfers Table / Cards */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading worker transfer records...</p>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-extrabold text-slate-900 m-0">No Transfer Records Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL' || worksiteFilter !== 'ALL'
              ? 'No transfer records matched your search or status filter criteria.'
              : 'No worker transfers have been scheduled yet. Click "Schedule Transfer" to relocate staff.'}
          </p>
          <button
            onClick={() => {
              setTargetWorkerForModal(null);
              setScheduleModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Schedule Transfer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((t) => {
            const isScheduled = t.status === 'SCHEDULED';
            const isCompleted = t.status === 'COMPLETED';
            const isCancelled = t.status === 'CANCELLED';
            const isFailed = t.status === 'FAILED';

            return (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border bg-white shadow-2xs hover:shadow-md transition-all space-y-3 ${
                  isScheduled
                    ? 'border-amber-200'
                    : isCompleted
                    ? 'border-emerald-200'
                    : isCancelled
                    ? 'border-slate-200 bg-slate-50/50'
                    : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Worker & Sites Route */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{t.workerName}</span>
                      {t.workerEmployeeCode && (
                        <span className="font-mono text-[11px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
                          {t.workerEmployeeCode}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>{t.sourceWorksiteName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-emerald-700 font-extrabold">
                          {t.destinationWorksiteName}
                        </span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 m-0">
                      Reason: <span className="text-slate-800 font-medium italic">"{t.reason}"</span>
                    </p>
                  </div>

                  {/* Status & Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                        isScheduled
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isCancelled
                          ? 'bg-slate-200 text-slate-700 border border-slate-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {isScheduled && <Clock className="w-3 h-3" />}
                      {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      {isCancelled && <XCircle className="w-3 h-3" />}
                      {isFailed && <AlertTriangle className="w-3 h-3" />}
                      {t.status}
                    </span>

                    {/* Cancel action if scheduled */}
                    {isScheduled && (
                      <button
                        onClick={() => {
                          setTransferToCancel(t);
                          setCancelModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                        title="Cancel this scheduled transfer"
                      >
                        Cancel
                      </button>
                    )}

                    {/* View full history for this worker */}
                    <button
                      onClick={() => {
                        setHistoryWorker({ id: t.workerId, name: t.workerName });
                        setHistoryDrawerOpen(true);
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="View worker transfer audit trail"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Info Bar */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      Effective: <span className="font-mono font-bold">{t.effectiveDate}</span>
                    </span>
                    <span>Initiated by {t.initiatorName || 'Admin'}</span>
                  </div>

                  {isCompleted && (
                    <span className="text-emerald-700 font-semibold">
                      Executed on {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'Due date'}
                    </span>
                  )}

                  {isCancelled && t.cancellationReason && (
                    <span className="text-rose-700 font-medium italic">
                      Cancelled: "{t.cancellationReason}"
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Transfer Modal */}
      <ScheduleTransferModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSuccess={() => {
          loadTransfers();
          if (onRefreshParent) onRefreshParent();
        }}
        initialWorker={targetWorkerForModal}
        workersList={workersList}
        worksitesList={worksitesList}
      />

      {/* Cancel Transfer Modal */}
      <CancelTransferModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setTransferToCancel(null);
        }}
        onSuccess={() => {
          loadTransfers();
          if (onRefreshParent) onRefreshParent();
        }}
        transfer={transferToCancel}
      />

      {/* Worker History Drawer */}
      <WorkerTransferHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => {
          setHistoryDrawerOpen(false);
          setHistoryWorker(null);
        }}
        workerId={historyWorker?.id}
        workerName={historyWorker?.name}
      />
    </div>
  );
};

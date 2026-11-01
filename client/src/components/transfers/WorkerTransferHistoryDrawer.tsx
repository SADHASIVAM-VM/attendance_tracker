import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import {
  X,
  History,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  User,
  ArrowRight,
} from 'lucide-react';

interface TransferAuditRecord {
  id: string;
  workerId: string;
  workerName: string;
  workerEmployeeCode?: string;
  sourceWorksiteName: string;
  sourceWorksiteCode: string;
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

interface WorkerTransferHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workerId?: string;
  workerName?: string;
}

export const WorkerTransferHistoryDrawer: React.FC<WorkerTransferHistoryDrawerProps> = ({
  isOpen,
  onClose,
  workerId,
  workerName,
}) => {
  const [history, setHistory] = useState<TransferAuditRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, workerId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const url = workerId
        ? `/worker-transfers/workers/${workerId}/history`
        : `/worker-transfers`;
      const data = await apiRequest<any>(url);
      const list = Array.isArray(data) ? data : (data?.transfers || []);
      setHistory(list);
    } catch (err: any) {
      console.error('Failed to load transfer history:', err);
      toast.error(err.message || 'Failed to load transfer history', 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0 shadow-xs">
              <History className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                {workerName ? `${workerName} • Transfer History` : 'Worker Transfer Audit History'}
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Immutable chronological log of worksite relocations and status events
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadHistory}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Loading transfer history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-extrabold text-slate-800 m-0">No Transfer Records</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No worksite transfer requests or relocation events have been recorded for this staff member yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {history.map((record) => {
                const isScheduled = record.status === 'SCHEDULED';
                const isCompleted = record.status === 'COMPLETED';
                const isCancelled = record.status === 'CANCELLED';
                const isFailed = record.status === 'FAILED';

                return (
                  <div
                    key={record.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isScheduled
                        ? 'bg-amber-50/40 border-amber-200'
                        : isCompleted
                        ? 'bg-white border-emerald-200 shadow-2xs'
                        : isCancelled
                        ? 'bg-slate-50/60 border-slate-200'
                        : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    {/* Header Row: Sites & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">
                            {record.sourceWorksiteName}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-extrabold text-sm text-emerald-700">
                            {record.destinationWorksiteName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 m-0 flex items-center gap-1.5 font-mono">
                          <span>{record.sourceWorksiteCode}</span>
                          <span>&rarr;</span>
                          <span>{record.destinationWorksiteCode}</span>
                        </p>
                      </div>

                      {/* Status Pill */}
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1 ${
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
                        {record.status}
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-white/70 border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                          Effective Date
                        </span>
                        <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {record.effectiveDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                          Initiated By
                        </span>
                        <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {record.initiatorName || 'Admin'}
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">
                        Transfer Reason
                      </span>
                      <p className="text-slate-700 m-0 leading-relaxed italic bg-white/50 p-2 rounded-lg border border-slate-100">
                        "{record.reason}"
                      </p>
                    </div>

                    {/* Cancellation details if applicable */}
                    {isCancelled && record.cancellationReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-0.5">
                        <span className="font-bold block text-[10px] uppercase tracking-wide text-rose-900">
                          Cancellation Reason (by {record.cancelledByName || 'Admin'}):
                        </span>
                        <p className="m-0 italic">"{record.cancellationReason}"</p>
                      </div>
                    )}

                    {/* Completion details if applicable */}
                    {isCompleted && (
                      <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-[11px] text-emerald-800 flex items-center justify-between">
                        <span className="font-semibold">Reallocation Executed:</span>
                        <span className="font-mono font-bold">
                          {record.completedAt ? new Date(record.completedAt).toLocaleString() : 'Automated'}
                        </span>
                      </div>
                    )}

                    {/* Failure details if applicable */}
                    {isFailed && record.failureReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                        <span className="font-bold block text-[10px] uppercase">Execution Failure:</span>
                        <p className="m-0 font-mono text-[11px]">{record.failureReason}</p>
                      </div>
                    )}

                    {/* Footer Timestamps */}
                    <div className="pt-2 border-t border-slate-100/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Created: {new Date(record.createdAt).toLocaleDateString()}</span>
                      {record.lastModifiedByName && (
                        <span>Modified by {record.lastModifiedByName}</span>
                      )}
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

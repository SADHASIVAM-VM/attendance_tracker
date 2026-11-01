import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import {
  X,
  ArrowRight,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  UserCheck,
  RefreshCw,
  Info,
} from 'lucide-react';

export interface WorkerOption {
  id: string;
  fullName: string;
  email: string;
  employeeCode?: string;
  currentWorksiteId?: string;
  currentWorksiteName?: string;
  currentWorksiteCode?: string;
  hasScheduledTransfer?: boolean;
  scheduledTransfer?: any;
}

export interface WorksiteOption {
  id: string;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  radiusMeters?: number;
}

interface ScheduleTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWorker?: WorkerOption | null;
  workersList: WorkerOption[];
  worksitesList: WorksiteOption[];
}

export const ScheduleTransferModal: React.FC<ScheduleTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialWorker = null,
  workersList = [],
  worksitesList = [],
}) => {
  // Tomorrow's date string as minimum allowed date
  const minFutureDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, []);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [destinationWorksiteId, setDestinationWorksiteId] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync initial worker when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialWorker) {
        setSelectedWorkerId(initialWorker.id);
      } else if (workersList.length > 0) {
        setSelectedWorkerId(workersList[0].id);
      }
      setDestinationWorksiteId('');
      setEffectiveDate(minFutureDate);
      setReason('');
    }
  }, [isOpen, initialWorker, workersList, minFutureDate]);

  // Current selected worker object
  const currentWorker = useMemo(() => {
    return workersList.find((w) => w.id === selectedWorkerId) || null;
  }, [workersList, selectedWorkerId]);

  // Eligible destination worksites (must be active and different from current worker's site)
  const eligibleDestinationSites = useMemo(() => {
    const currentSiteId = currentWorker?.currentWorksiteId;
    return worksitesList.filter(
      (s) => s.isActive !== false && (!currentSiteId || s.id !== currentSiteId)
    );
  }, [worksitesList, currentWorker]);

  // Auto-select first eligible destination site if none selected
  useEffect(() => {
    if (eligibleDestinationSites.length > 0 && !destinationWorksiteId) {
      setDestinationWorksiteId(eligibleDestinationSites[0].id);
    }
  }, [eligibleDestinationSites, destinationWorksiteId]);

  const selectedDestinationSite = useMemo(() => {
    return worksitesList.find((s) => s.id === destinationWorksiteId) || null;
  }, [worksitesList, destinationWorksiteId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkerId) {
      toast.error('Please select a worker to transfer.', 'Transfer Validation');
      return;
    }

    if (!destinationWorksiteId) {
      toast.error('Please select an eligible destination worksite.', 'Transfer Validation');
      return;
    }

    if (!effectiveDate || effectiveDate < minFutureDate) {
      toast.error('Effective date must be in the future (tomorrow or later).', 'Transfer Validation');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      toast.error('Please provide a meaningful transfer reason of at least 5 characters.', 'Transfer Validation');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/worker-transfers', {
        method: 'POST',
        body: JSON.stringify({
          workerId: selectedWorkerId,
          destinationWorksiteId,
          effectiveDate,
          reason: reason.trim(),
        }),
      });

      toast.success(
        `Successfully scheduled transfer for ${currentWorker?.fullName || 'worker'} to ${selectedDestinationSite?.name || 'new worksite'} on ${effectiveDate}.`,
        'Transfer Scheduled'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to schedule transfer:', err);
      toast.error(err.message || 'Failed to schedule worker worksite transfer.', 'Transfer Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0 shadow-xs">
              <ArrowRight className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">Schedule Worksite Transfer</h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Plan a future worker relocation while preserving current active assignment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Worker Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Select Worker <span className="text-rose-500">*</span>
            </label>
            {initialWorker ? (
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-slate-900 m-0">{initialWorker.fullName}</p>
                  <p className="text-[11px] text-slate-500 m-0">
                    {initialWorker.employeeCode || initialWorker.email}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  Assigned
                </span>
              </div>
            ) : (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                required
              >
                <option value="">Select an active worker...</option>
                {workersList.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.hasScheduledTransfer}>
                    {w.fullName} ({w.employeeCode || w.email}){' '}
                    {w.currentWorksiteName ? `• Currently: ${w.currentWorksiteName}` : ''}
                    {w.hasScheduledTransfer ? ' (Already has pending transfer)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Current Site Preview Card */}
          {currentWorker && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Current Assigned Worksite
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Active Today
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-900 m-0 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                {currentWorker.currentWorksiteName || 'Direct Site Assignment'}
                {currentWorker.currentWorksiteCode && (
                  <span className="text-[10px] font-mono text-slate-500 font-normal">
                    ({currentWorker.currentWorksiteCode})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 m-0 leading-relaxed">
                The worker remains actively assigned here until the scheduled transfer date takes effect.
              </p>
            </div>
          )}

          {/* Destination Worksite */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Destination Worksite <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-slate-400">Excludes current worksite</span>
            </label>
            <select
              value={destinationWorksiteId}
              onChange={(e) => setDestinationWorksiteId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            >
              <option value="">Select destination worksite...</option>
              {eligibleDestinationSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) {s.address ? `• ${s.address}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Future Effective Date */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Transfer Effective Date <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold">Must be in the future</span>
            </label>
            <input
              type="date"
              min={minFutureDate}
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1 m-0">
              On this date, the system automatically closes the old assignment and activates the worker at the destination worksite.
            </p>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Transfer Reason <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-slate-400">Min 5 characters</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Project redeployment, skilled electrical work required at new location, worker request..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
              required
            />
          </div>

          {/* Transfer Summary Review Box */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[11px] uppercase tracking-wide text-indigo-900 m-0">
                Summary & Integrity Protection
              </p>
              <p className="text-[11px] text-slate-600 m-0 leading-relaxed">
                Historical attendance, clock-in GPS records, and supervisor approvals prior to{' '}
                <span className="font-semibold text-slate-900">{effectiveDate || 'effective date'}</span> remain
                unaltered and attributed to the original worksite.
              </p>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !selectedWorkerId ||
              !destinationWorksiteId ||
              !effectiveDate ||
              reason.trim().length < 5
            }
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Confirm & Schedule Transfer
          </button>
        </div>
      </div>
    </div>
  );
};

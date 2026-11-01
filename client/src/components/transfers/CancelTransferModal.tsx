import React, { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';

interface CancelTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transfer: any | null;
}

export const CancelTransferModal: React.FC<CancelTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  transfer,
}) => {
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen || !transfer) return null;

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 3) {
      toast.error('Please provide a cancellation reason (at least 3 characters).', 'Validation Error');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest(`/worker-transfers/${transfer.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });

      toast.success(
        `Scheduled transfer for ${transfer.workerName} has been cancelled.`,
        'Transfer Cancelled'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel transfer:', err);
      toast.error(err.message || 'Failed to cancel scheduled transfer.', 'Cancellation Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">Cancel Scheduled Transfer</h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Revoke scheduled relocation for {transfer.workerName}
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

        {/* Content */}
        <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Worker:</span>
              <span className="font-extrabold text-slate-900">{transfer.workerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Target Worksite:</span>
              <span className="font-bold text-slate-900">{transfer.destinationWorksiteName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Scheduled Effective Date:</span>
              <span className="font-mono font-bold text-slate-900">{transfer.effectiveDate}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Schedule revised, worker required on existing site, project delayed..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 resize-none"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 3}
              className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

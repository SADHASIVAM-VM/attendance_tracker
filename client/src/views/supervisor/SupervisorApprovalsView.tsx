import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  UserCheck,
  Check,
  X,
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRightLeft,
  Eye,
} from 'lucide-react';

export const SupervisorApprovalsView: React.FC = () => {
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Selected item for selfie inspection
  const [inspectItem, setInspectItem] = useState<any | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedForReject, setSelectedForReject] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);
  const [selectedForTransfer, setSelectedForTransfer] = useState<any | null>(null);
  const [transferSupervisorId, setTransferSupervisorId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadPending();
    loadSupervisors();
  }, []);

  const loadPending = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/attendance/pending-approvals');
      setPendingList(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load approvals queue', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadSupervisors = async () => {
    try {
      const data = await apiRequest('/users');
      const sups = data.filter((u: any) => u.roles.includes('SUPERVISOR'));
      setSupervisors(sups);
      if (sups.length > 0) setTransferSupervisorId(sups[0].id);
    } catch (err) {
      // ignore
    }
  };

  const handleApprove = async (sessionId: string) => {
    try {
      setSubmitting(true);
      await apiRequest(`/attendance/${sessionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Selfie and location verified by supervisor' }),
      });
      setMessage({ text: 'Clock-in approved successfully.', type: 'success' });
      setInspectItem(null);
      loadPending();
    } catch (err: any) {
      setMessage({ text: err.message || 'Approval failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectModal = (item: any) => {
    setSelectedForReject(item);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedForReject || !rejectReason.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest(`/attendance/${selectedForReject.sessionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setMessage({ text: 'Clock-in rejected with recorded reason.', type: 'success' });
      setRejectModalOpen(false);
      setInspectItem(null);
      loadPending();
    } catch (err: any) {
      setMessage({ text: err.message || 'Rejection failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const openTransferModal = (item: any) => {
    setSelectedForTransfer(item);
    setTransferReason('');
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async () => {
    if (!selectedForTransfer || !transferSupervisorId || !transferReason.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest(`/attendance/${selectedForTransfer.sessionId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          newSupervisorId: transferSupervisorId,
          reason: transferReason,
        }),
      });
      setMessage({ text: 'Clock-in transferred to replacement supervisor with full audit entry.', type: 'success' });
      setTransferModalOpen(false);
      loadPending();
    } catch (err: any) {
      setMessage({ text: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Pending Clock-In Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review worker selfies and location verification evidence for your assigned shifts.
          </p>
        </div>
        <button
          onClick={loadPending}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer"
        >
          Refresh Queue
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Loading approval queue...</div>
      ) : pendingList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">All Caught Up!</p>
          <p className="text-xs text-slate-500 mt-1">No pending clock-in requests awaiting your review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingList.map((item) => (
            <div
              key={item.sessionId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base m-0">{item.workerName}</h3>
                  <span className="text-xs font-mono text-slate-500">{item.employeeCode}</span>
                </div>
                <StatusBadge status="PENDING" />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{item.worksiteName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {item.shiftName} ({item.shiftStartTime} - {item.shiftEndTime})
                  </span>
                </div>
                {item.clockInEvent && (
                  <div className="pt-1.5 border-t border-slate-200 flex justify-between font-semibold">
                    <span className="text-emerald-700">Distance: {Math.round(item.clockInEvent.calculatedDistanceMeters)}m</span>
                    <span className="text-slate-500">Accuracy: +/-{Math.round(item.clockInEvent.reportedAccuracyMeters)}m</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setInspectItem(item)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspect
                </button>
                <button
                  onClick={() => handleApprove(item.sessionId)}
                  disabled={submitting}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  title="Approve Clock-In"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openRejectModal(item)}
                  disabled={submitting}
                  className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  title="Reject Clock-In"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openTransferModal(item)}
                  disabled={submitting}
                  className="p-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  title="Transfer to Alternate Supervisor"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INSPECT MODAL */}
      <Modal
        isOpen={inspectItem !== null}
        onClose={() => setInspectItem(null)}
        title="Inspect Attendance Evidence"
        description="Verify attendance selfie, GPS coordinate precision, and calculate proximity."
        maxWidth="lg"
        footer={
          inspectItem && (
            <div className="flex justify-end gap-2 w-full">
              <button
                onClick={() => openRejectModal(inspectItem)}
                className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold"
              >
                Reject Request
              </button>
              <button
                onClick={() => handleApprove(inspectItem.sessionId)}
                className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" />
                Approve Verified Attendance
              </button>
            </div>
          )
        }
      >
        {inspectItem && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selfie Photo */}
            <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
              {inspectItem.clockInEvent?.photoUrl ? (
                <img
                  src={inspectItem.clockInEvent.photoUrl}
                  alt="Worker Selfie"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-slate-500">No Photo Available</span>
              )}
            </div>

            {/* Evidence Data */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-500 block uppercase font-semibold text-[10px]">Worker</span>
                <span className="text-sm font-bold text-slate-900">{inspectItem.workerName}</span>
                <span className="text-slate-500 block">{inspectItem.workerEmail} ({inspectItem.employeeCode})</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-500 block uppercase font-semibold text-[10px]">Worksite</span>
                <span className="font-bold text-slate-900">{inspectItem.worksiteName}</span>
                <span className="text-slate-500 block">{inspectItem.worksiteAddress}</span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1 text-emerald-900">
                <span className="text-emerald-700 block uppercase font-semibold text-[10px]">Geolocation Evidence</span>
                <div className="flex justify-between">
                  <span>Calculated Proximity:</span>
                  <span className="font-bold">{Math.round(inspectItem.clockInEvent?.calculatedDistanceMeters || 0)}m</span>
                </div>
                <div className="flex justify-between">
                  <span>GPS Precision:</span>
                  <span className="font-bold">+/- {Math.round(inspectItem.clockInEvent?.reportedAccuracyMeters || 0)}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Submission Time:</span>
                  <span className="font-bold">{new Date(inspectItem.clockInTime).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Clock-In Submission"
        description="Provide a mandatory non-empty reason for rejecting this attendance event."
        footer={
          <>
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={submitting || !rejectReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50"
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">
            Mandatory Rejection Note <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why clock-in was rejected (e.g. unrecognizable selfie, worker absent from station, incorrect shift)..."
            rows={3}
            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </Modal>

      {/* TRANSFER SUPERVISOR MODAL */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Approval Authority"
        description="Re-route this attendance request to a replacement supervisor with an audit log."
        footer={
          <>
            <button
              onClick={() => setTransferModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleTransferSubmit}
              disabled={submitting || !transferReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50"
            >
              Execute Transfer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Select Replacement Supervisor
            </label>
            <select
              value={transferSupervisorId}
              onChange={(e) => setTransferSupervisorId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
            >
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Mandatory Transfer Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g. Reliever supervisor assigned due to shift rotation..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

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
  RefreshCw,
  Maximize2,
} from 'lucide-react';

export const SupervisorApprovalsView: React.FC = () => {
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Selected item for selfie inspection
  const [inspectItem, setInspectItem] = useState<any | null>(null);
  const [approvalNote, setApprovalNote] = useState<string>('Selfie and location verified by supervisor');

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

  const handleApprove = async (sessionId: string, customNote?: string) => {
    try {
      setSubmitting(true);
      const noteToSend = customNote || approvalNote || 'Selfie and location verified by supervisor';
      await apiRequest(`/attendance/${sessionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: noteToSend }),
      });
      setMessage({ text: 'Clock-in approved successfully. Worker notified.', type: 'success' });
      setInspectItem(null);
      await loadPending();
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
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setMessage({ text: 'Clock-in rejected with recorded reason. Worker notified.', type: 'success' });
      setRejectModalOpen(false);
      setInspectItem(null);
      await loadPending();
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
          reason: transferReason.trim(),
        }),
      });
      setMessage({ text: 'Clock-in transferred to replacement supervisor with full audit entry.', type: 'success' });
      setTransferModalOpen(false);
      setInspectItem(null);
      await loadPending();
    } catch (err: any) {
      setMessage({ text: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Pending Clock-In Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review live worker selfies from the server image store and verify physical GPS proximity.
          </p>
        </div>
        <button
          onClick={loadPending}
          disabled={loading}
          className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
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
          <button onClick={() => setMessage(null)} className="text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
          Loading approval queue from database...
        </div>
      ) : pendingList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-900 text-base">All Caught Up!</p>
          <p className="text-xs text-slate-500 mt-1">No pending clock-in requests awaiting your review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingList.map((item) => (
            <div
              key={item.sessionId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {/* Photo thumbnail */}
                  <div
                    onClick={() => {
                      setInspectItem(item);
                      setApprovalNote('Selfie and location verified by supervisor');
                    }}
                    className="w-13 h-13 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 cursor-pointer relative group flex items-center justify-center"
                    title="Click to inspect selfie"
                  >
                    {item.clockInEvent?.photoUrl ? (
                      <>
                        <img
                          src={item.clockInEvent.photoUrl}
                          alt={item.workerName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <UserCheck className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-bold text-slate-900 text-base m-0 truncate">{item.workerName}</h3>
                      <StatusBadge status="PENDING" />
                    </div>
                    <span className="text-xs font-mono text-slate-500 block">{item.employeeCode}</span>
                    <span className="text-[11px] text-slate-400 truncate block">{item.workerEmail}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{item.worksiteName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
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
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setInspectItem(item);
                    setApprovalNote('Selfie and location verified by supervisor');
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Inspect
                </button>
                <button
                  onClick={() => handleApprove(item.sessionId)}
                  disabled={submitting}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                  title="Quick Approve Clock-In"
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
        description="Verify stored attendance selfie, GPS coordinate precision, and calculate proximity."
        maxWidth="lg"
        footer={
          inspectItem && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
              <div className="text-xs text-slate-500 w-full sm:w-auto">
                Assigned Supervisor: <strong>You</strong>
              </div>
              <div className="flex justify-end gap-2 w-full sm:w-auto">
                <button
                  onClick={() => openRejectModal(inspectItem)}
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Reject Request
                </button>
                <button
                  onClick={() => handleApprove(inspectItem.sessionId, approvalNote)}
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Approve Verified Attendance
                </button>
              </div>
            </div>
          )
        }
      >
        {inspectItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selfie Photo from Server Image Store */}
              <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative shadow-inner">
                {inspectItem.clockInEvent?.photoUrl ? (
                  <img
                    src={inspectItem.clockInEvent.photoUrl}
                    alt="Worker Selfie"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-500">No Photo Available in Storage</span>
                )}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                  Server Image Store
                </div>
              </div>

              {/* Evidence Data */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-slate-500 block uppercase font-semibold text-[10px]">Worker Profile</span>
                  <span className="text-sm font-bold text-slate-900 block">{inspectItem.workerName}</span>
                  <span className="text-slate-500 block">{inspectItem.workerEmail} • {inspectItem.employeeCode}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-slate-500 block uppercase font-semibold text-[10px]">Worksite & Shift</span>
                  <span className="font-bold text-slate-900 block">{inspectItem.worksiteName}</span>
                  <span className="text-slate-500 block">{inspectItem.worksiteAddress}</span>
                  <span className="text-slate-600 block font-medium mt-1">
                    {inspectItem.shiftName} ({inspectItem.shiftStartTime} - {inspectItem.shiftEndTime})
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1.5 text-emerald-900">
                  <span className="text-emerald-700 block uppercase font-semibold text-[10px]">Geolocation Evidence</span>
                  <div className="flex justify-between">
                    <span>Calculated Proximity:</span>
                    <span className="font-bold">{Math.round(inspectItem.clockInEvent?.calculatedDistanceMeters || 0)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reported GPS Precision:</span>
                    <span className="font-bold">+/- {Math.round(inspectItem.clockInEvent?.reportedAccuracyMeters || 0)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Submission Timestamp:</span>
                    <span className="font-bold">{inspectItem.clockInTime ? new Date(inspectItem.clockInTime).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Supervisor Approval Note */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Supervisor Approval Note (Optional)
              </label>
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="e.g. Identity and location verified on shift start"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={submitting || !rejectReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">
            Mandatory Rejection Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why clock-in was rejected (e.g. unrecognizable selfie, worker absent from assigned station, incorrect shift timing)..."
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
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleTransferSubmit}
              disabled={submitting || !transferReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
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

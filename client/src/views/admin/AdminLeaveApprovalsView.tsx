import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Check, X, ShieldCheck, FileText } from 'lucide-react';

export const AdminLeaveApprovalsView: React.FC = () => {
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/leave/requests/pending');
      setPendingLeaves(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load leave review queue', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const note = prompt('Optional decision note for approval:', 'Approved per organizational policy');
    try {
      await apiRequest(`/leave/requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: note || undefined }),
      });
      setMessage({ text: 'Leave request approved.', type: 'success' });
      loadPending();
    } catch (err: any) {
      setMessage({ text: err.message || 'Approval failed', type: 'error' });
    }
  };

  const handleReject = async (id: string) => {
    const note = prompt('Mandatory rejection note:');
    if (!note) return;

    try {
      await apiRequest(`/leave/requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: note }),
      });
      setMessage({ text: 'Leave request rejected.', type: 'success' });
      loadPending();
    } catch (err: any) {
      setMessage({ text: err.message || 'Rejection failed', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Leave Approvals Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Direct administrative queue for reviewing workforce absence requests independently of daily supervisors.
          </p>
        </div>
        <button
          onClick={loadPending}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
        >
          Refresh Queue
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${message.type === 'success'
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
        <div className="p-8 text-center text-slate-400 text-sm">Loading leave requests...</div>
      ) : pendingLeaves.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">All Leave Requests Handled</p>
          <p className="text-xs text-slate-500 mt-1">No pending employee leave applications in the queue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingLeaves.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base m-0">{l.workerName}</h3>
                  <span className="text-xs   text-slate-500">{l.employeeCode}</span>
                </div>
                <StatusBadge status="PENDING" />
              </div>

              <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Leave Type:</span>
                  <span className="font-bold text-slate-900">{l.leaveTypeName} ({l.leaveTypeCode})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dates Requested:</span>
                  <span className="font-semibold text-slate-800">
                    {l.startDate} to {l.endDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-semibold text-slate-800">
                    {l.isHalfDay ? `Half Day (${l.halfDayPeriod})` : 'Full Day'}
                  </span>
                </div>
              </div>

              <div className="text-xs p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-amber-700">Worker Reason</span>
                <p className="mt-1">{l.reason}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleApprove(l.id)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Approve Leave
                </button>
                <button
                  onClick={() => handleReject(l.id)}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Check, X, ShieldCheck, Clock } from 'lucide-react';

export const SupervisorRegularizationView: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/regularization/pending');
      setRequests(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load regularizations', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiRequest(`/regularization/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: 'Approved by supervisor' }),
      });
      setMessage({ text: 'Regularization request approved and attendance updated.', type: 'success' });
      loadRequests();
    } catch (err: any) {
      setMessage({ text: err.message || 'Approval failed', type: 'error' });
    }
  };

  const handleReject = async (id: string) => {
    const note = prompt('Please enter the reason for rejecting this regularization:');
    if (!note) return;

    try {
      await apiRequest(`/regularization/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote: note }),
      });
      setMessage({ text: 'Regularization rejected.', type: 'success' });
      loadRequests();
    } catch (err: any) {
      setMessage({ text: err.message || 'Rejection failed', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Regularization Review</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and adjust proposed clock-in and clock-out timestamp corrections from workers.
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
        >
          Refresh
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
        <div className="p-8 text-center text-slate-400 text-sm">Loading regularization queue...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-900">No Pending Requests</p>
          <p className="text-xs text-slate-500 mt-1">No attendance adjustment requests awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base m-0">{item.workerName}</h3>
                  <span className="text-xs   text-slate-500">{item.employeeCode}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Work Date:</span>
                  <span className="font-semibold text-slate-900">{item.workDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Worksite:</span>
                  <span className="font-semibold text-slate-900">{item.worksiteName}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">Proposed Clock In:</span>
                  <span className="font-semibold text-blue-700">
                    {item.proposedClockInTime ? new Date(item.proposedClockInTime).toLocaleTimeString() : 'Unchanged'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proposed Clock Out:</span>
                  <span className="font-semibold text-blue-700">
                    {item.proposedClockOutTime ? new Date(item.proposedClockOutTime).toLocaleTimeString() : 'Unchanged'}
                  </span>
                </div>
              </div>

              <div className="text-xs p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-amber-700">Worker Justification</span>
                <p className="mt-1">{item.reason}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleApprove(item.id)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Approve Correction
                </button>
                <button
                  onClick={() => handleReject(item.id)}
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

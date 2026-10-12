import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Calendar, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export const WorkerLeaveView: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);

  // Form State
  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<string>('FIRST_HALF');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [types, reqs] = await Promise.all([
        apiRequest('/leave/types'),
        apiRequest('/leave/requests/me'),
      ]);
      setLeaveTypes(types);
      setLeaveRequests(reqs);
      if (types.length > 0) {
        setLeaveTypeId(types[0].id);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load leave records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
      setMessage({ text: 'Please fill in all required leave fields', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId,
          startDate,
          endDate,
          isHalfDay,
          halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
          reason,
        }),
      });

      setMessage({ text: 'Leave request submitted directly to Admin queue.', type: 'success' });
      setShowForm(false);
      setReason('');
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit leave request', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this leave request?')) return;
    try {
      await apiRequest(`/leave/requests/${id}/cancel`, { method: 'POST' });
      setMessage({ text: 'Leave request withdrawn.', type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to cancel leave', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Apply for planned absences and review administrative leave decisions.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close Form' : 'Apply for Leave'}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Apply Leave Form */}
      {showForm && (
        <form
          onSubmit={handleApply}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 m-0">Submit New Leave Application</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Leave Type</label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="rounded text-slate-900 focus:ring-slate-900"
              />
              Half Day Leave
            </label>

            {isHalfDay && (
              <select
                value={halfDayPeriod}
                onChange={(e) => setHalfDayPeriod(e.target.value)}
                className="text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="FIRST_HALF">First Half (Morning)</option>
                <option value="SECOND_HALF">Second Half (Afternoon)</option>
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Required Reason / Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the reason for taking leave..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Send to Admin Queue'}
            </button>
          </div>
        </form>
      )}

      {/* Leave Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 m-0">Leave Request History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Admin Decision Note</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {leaveRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No leave applications found.
                  </td>
                </tr>
              ) : (
                leaveRequests.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {l.leaveTypeName}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {l.isHalfDay ? `Half Day (${l.halfDayPeriod})` : 'Full Day'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {l.reason}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {l.decisionNote || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {l.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancel(l.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                        >
                          Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

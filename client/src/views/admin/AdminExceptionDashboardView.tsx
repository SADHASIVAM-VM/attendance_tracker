import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  CalendarDays,
  UserCheck,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  RefreshCw,
  ArrowRightLeft,
  Sliders,
  ShieldAlert,
  FileText,
  UserX,
  Play,
  Check,
  X,
  Building2,
  Flag,
} from 'lucide-react';

export const AdminExceptionDashboardView: React.FC = () => {
  // KPI Overview Metrics
  const [summary, setSummary] = useState({
    pendingAttendance: 0,
    pendingLeave: 0,
    missingAttendance: 0,
    missingClockOuts: 0,
    pendingCorrections: 0,
    escalatedRequests: 0,
    awaitingAdminReassignment: 0,
  });

  // Exceptions list
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [worksitesList, setWorksitesList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningJob, setRunningJob] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [searchWorker, setSearchWorker] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterWorksite, setFilterWorksite] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Modals & Drawers
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Reassignment Modal
  const [reassignModalOpen, setReassignModalOpen] = useState<boolean>(false);
  const [reassignItem, setReassignItem] = useState<any | null>(null);
  const [targetApproverId, setTargetApproverId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  // Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [overrideItem, setOverrideItem] = useState<any | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideClockIn, setOverrideClockIn] = useState<string>('');
  const [overrideClockOut, setOverrideClockOut] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadDashboardData();
    loadSupervisors();
    loadWorksites();
  }, [filterType, filterStatus, filterWorksite, filterStartDate, filterEndDate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType) params.append('exceptionType', filterType);
      if (filterStatus) params.append('status', filterStatus);
      if (filterWorksite) params.append('worksiteId', filterWorksite);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const [summaryRes, listRes] = await Promise.all([
        apiRequest('/admin/exceptions/summary'),
        apiRequest(`/admin/exceptions?${params.toString()}`),
      ]);

      if (summaryRes) setSummary(summaryRes);
      if (Array.isArray(listRes)) setExceptions(listRes);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load exception dashboard', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadSupervisors = async () => {
    try {
      const res = await apiRequest('/users');
      const list = Array.isArray(res) ? res : res?.data || [];
      const sups = list.filter((u: any) => u.roles && (u.roles.includes('SUPERVISOR') || u.roles.includes('ADMIN')));
      setSupervisors(sups);
      if (sups.length > 0) setTargetApproverId(sups[0].id);
    } catch (err) {
      // ignore
    }
  };

  const loadWorksites = async () => {
    try {
      const res = await apiRequest('/worksites');
      const list = Array.isArray(res) ? res : res?.data || [];
      setWorksitesList(list);
    } catch (err) {
      // ignore
    }
  };

  const handleRunEscalationJob = async () => {
    try {
      setRunningJob(true);
      const res = await apiRequest('/admin/escalation/run', { method: 'POST', body: JSON.stringify({}) });
      setMessage({
        text: `Automated detection completed. Created: ${res.summary?.missingAttendanceCreated || 0} missing attendance, ${res.summary?.missingClockOutsCreated || 0} missing clock-outs, ${res.summary?.attendanceEscalated || 0} escalated.`,
        type: 'success',
      });
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Escalation job execution failed', type: 'error' });
    } finally {
      setRunningJob(false);
    }
  };

  const handleViewDetail = async (exceptionId: string) => {
    try {
      setDetailLoading(true);
      const data = await apiRequest(`/admin/exceptions/${exceptionId}`);
      setSelectedCaseDetail(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load case detail', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReassignSubmit = async () => {
    if (!reassignItem || !targetApproverId || !reassignReason.trim()) return;

    try {
      setSubmitting(true);
      await apiRequest(`/admin/exceptions/${reassignItem.id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          targetApproverId,
          reason: reassignReason.trim(),
        }),
      });
      setMessage({ text: 'Request reassigned successfully.', type: 'success' });
      setReassignModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Reassignment failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideItem || !overrideReason.trim()) return;

    try {
      setSubmitting(true);
      const sessionId = overrideItem.sessionId || overrideItem.id;
      const body: any = {
        status: overrideStatus,
        reason: overrideReason.trim(),
      };
      if (overrideClockIn) body.clockInTime = new Date(overrideClockIn).toISOString();
      if (overrideClockOut) body.clockOutTime = new Date(overrideClockOut).toISOString();

      await apiRequest(`/admin/attendance/${sessionId}/override`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setMessage({ text: 'Administrative override applied with audit log.', type: 'success' });
      setOverrideModalOpen(false);
      setSelectedCaseDetail(null);
      loadDashboardData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Override failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter list by worker name/ID
  const filteredExceptions = exceptions.filter((ex) => {
    if (!searchWorker.trim()) return true;
    const q = searchWorker.toLowerCase();
    return (
      (ex.workerName && ex.workerName.toLowerCase().includes(q)) ||
      (ex.employeeCode && ex.employeeCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">
            Attendance Exceptions & Escalations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Centrally investigate missing clock-ins, missing clock-outs, leave conflicts, and handle administrative overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunEscalationJob}
            disabled={runningJob}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-xs transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningJob ? 'animate-spin' : ''}`} />
            <span>{runningJob ? 'Running Checks...' : 'Run Escalation Checks'}</span>
          </button>

          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="cursor-pointer text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 7 OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pending Att.</span>
          <span className="text-xl font-extrabold text-slate-900 block mt-1">{summary.pendingAttendance}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pending Leaves</span>
          <span className="text-xl font-extrabold text-slate-900 block mt-1">{summary.pendingLeave}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Missing Clock-In</span>
          <span className="text-xl font-extrabold text-rose-700 block mt-1">{summary.missingAttendance}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Missing Clock-Out</span>
          <span className="text-xl font-extrabold text-amber-700 block mt-1">{summary.missingClockOuts}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Corrections</span>
          <span className="text-xl font-extrabold text-indigo-700 block mt-1">{summary.pendingCorrections}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">Escalated</span>
          <span className="text-xl font-extrabold text-purple-700 block mt-1">{summary.escalatedRequests}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Awaiting Reassign</span>
          <span className="text-xl font-extrabold text-slate-900 block mt-1">{summary.awaitingAdminReassignment}</span>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search worker by name or code..."
              value={searchWorker}
              onChange={(e) => setSearchWorker(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-emerald-600"
          >
            <option value="">All Exception Types</option>
            <option value="MISSING_CLOCK_IN">Missing Clock-In</option>
            <option value="MISSING_CLOCK_OUT">Missing Clock-Out</option>
            <option value="LEAVE_ATTENDANCE_CONFLICT">Leave & Attendance Conflict</option>
            <option value="OVERDUE_APPROVAL">Overdue Approval</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-emerald-600"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="ESCALATED">Escalated</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={filterWorksite}
            onChange={(e) => setFilterWorksite(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-emerald-600"
          >
            <option value="">All Worksites</option>
            {worksitesList.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600"
            />
            <span>to</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-emerald-600"
            />
          </div>
        </div>

        {(filterType || filterStatus || filterWorksite || filterStartDate || filterEndDate || searchWorker) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
              setFilterWorksite('');
              setFilterStartDate('');
              setFilterEndDate('');
              setSearchWorker('');
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* EXCEPTION TABLE */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold">Loading Attendance Exceptions...</p>
        </div>
      ) : filteredExceptions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No Exceptions Found</p>
          <p className="text-xs text-slate-400 mt-1">There are no exceptions matching the applied criteria.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Worker</th>
                  <th className="py-3 px-4">Worksite</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Exception Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Primary Sup.</th>
                  <th className="py-3 px-4">Current Approver</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredExceptions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{item.workerName}</div>
                      <span className="text-[10px] text-slate-400 font-normal">ID: {item.employeeCode}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.worksiteName || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono text-[11px]">{item.workDate}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          item.exceptionType === 'MISSING_CLOCK_IN'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : item.exceptionType === 'MISSING_CLOCK_OUT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {item.exceptionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.severity === 'HIGH'
                            ? 'bg-rose-100 text-rose-800'
                            : item.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-600 text-[11px]">{item.status}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.primarySupervisorName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold text-[11px] ${
                          item.isEscalated ? 'text-rose-700 font-bold' : 'text-slate-600'
                        }`}
                      >
                        {item.currentApproverName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetail(item.id)}
                        className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer"
                      >
                        Inspect
                      </button>

                      <button
                        onClick={() => {
                          setReassignItem(item);
                          setReassignReason('');
                          setReassignModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-pointer"
                      >
                        Reassign
                      </button>

                      {item.sessionId && (
                        <button
                          onClick={() => {
                            setOverrideItem(item);
                            setOverrideReason('');
                            setOverrideStatus('APPROVED');
                            setOverrideModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer"
                        >
                          Override
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}

      {/* 1. Case Detail Drawer / Modal */}
      <Modal
        isOpen={Boolean(selectedCaseDetail)}
        onClose={() => setSelectedCaseDetail(null)}
        title="Case Detail & Routing Timeline"
      >
        {selectedCaseDetail && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">{selectedCaseDetail.exception.workerName}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                  {selectedCaseDetail.exception.exceptionType}
                </span>
              </div>
              <div className="text-slate-600">
                Worksite: <strong>{selectedCaseDetail.exception.worksiteName}</strong> ({selectedCaseDetail.exception.workDate})
              </div>
              {selectedCaseDetail.exception.escalationReason && (
                <div className="bg-rose-50 text-rose-800 p-2 rounded border border-rose-200">
                  <strong>Escalation Detail:</strong> {selectedCaseDetail.exception.escalationReason}
                </div>
              )}
            </div>

            {/* Attendance Session Snapshot */}
            {selectedCaseDetail.session && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-800 block text-xs">Attendance Record</span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-700">{selectedCaseDetail.session.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Clock-In:</span>
                  <span className="font-mono">
                    {selectedCaseDetail.session.clockInTime
                      ? new Date(selectedCaseDetail.session.clockInTime).toLocaleTimeString()
                      : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Clock-Out:</span>
                  <span className="font-mono">
                    {selectedCaseDetail.session.clockOutTime
                      ? new Date(selectedCaseDetail.session.clockOutTime).toLocaleTimeString()
                      : 'None'}
                  </span>
                </div>
              </div>
            )}

            {/* Audit History Timeline */}
            <div>
              <span className="font-bold text-slate-800 block text-xs mb-2">Audit & Routing Timeline</span>
              {selectedCaseDetail.auditHistory?.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No previous audit records.</p>
              ) : (
                <div className="space-y-2">
                  {selectedCaseDetail.auditHistory.map((log: any) => (
                    <div key={log.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] space-y-1">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>{log.action}</span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        Actor: {log.actorNameSnapshot || 'System'} ({log.actorRole || 'SYSTEM'})
                      </div>
                      {log.reason && <div className="text-slate-500 italic">"{log.reason}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Reassignment Modal */}
      <Modal isOpen={reassignModalOpen} onClose={() => setReassignModalOpen(false)} title="Reassign Request">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Reassign this pending request or exception to an authorized supervisor or administrative reviewer.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">New Approver / Reviewer</label>
            <select
              value={targetApproverId}
              onChange={(e) => setTargetApproverId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-white"
            >
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.roles?.join(', ') || 'Supervisor'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Reassignment Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="State the justification for reassigning this request..."
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setReassignModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleReassignSubmit}
              disabled={submitting || !reassignReason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
            >
              Reassign Approver
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Administrative Override Modal */}
      <Modal isOpen={overrideModalOpen} onClose={() => setOverrideModalOpen(false)} title="Administrative Override">
        <div className="space-y-4">
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 inline mr-1 text-amber-600" />
            <strong>Administrative Action:</strong> This operation directly overrides official attendance status.
            All old and new values will be immutably recorded in the security audit trail.
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">New Attendance Status</label>
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value as any)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-white"
            >
              <option value="APPROVED">APPROVED (Verified)</option>
              <option value="REJECTED">REJECTED (Denied)</option>
              <option value="PENDING">PENDING (Re-open for Review)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Mandatory Override Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="State the formal administrative reason for overriding this attendance record..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setOverrideModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleOverrideSubmit}
              disabled={submitting || !overrideReason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
            >
              Confirm Override
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
import {
  Clock,
  Calendar,
  CalendarDays,
  Check,
  X,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Users,
  MapPin,
  Eye,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export const AdminAttendanceOverrideView: React.FC = () => {
  // Form state for Record Missing Attendance
  const [workerId, setWorkerId] = useState<string>('');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [clockInTime, setClockInTime] = useState<string>('08:00');
  const [clockOutTime, setClockOutTime] = useState<string>('17:00');
  const [resolutionStatus, setResolutionStatus] = useState<'APPROVED' | 'PENDING'>('APPROVED');
  const [reason, setReason] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reference lists
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [worksitesList, setWorksitesList] = useState<any[]>([]);

  // Overrides log list state
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Details Modal
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadReferences();
    loadOverridesLog();
  }, []);

  const loadReferences = async () => {
    try {
      const [usersRes, worksitesRes] = await Promise.allSettled([
        apiRequest<any>('/users?limit=150'),
        apiRequest<any>('/worksites'),
      ]);

      if (usersRes.status === 'fulfilled') {
        const u = usersRes.value;
        const list = Array.isArray(u) ? u : u?.users || u?.data || [];
        setWorkersList(list);
      }

      if (worksitesRes.status === 'fulfilled') {
        const w = worksitesRes.value;
        const list = Array.isArray(w) ? w : w?.data || [];
        setWorksitesList(list);
      }
    } catch (err) {
      console.error('Failed to load references:', err);
    }
  };

  const loadOverridesLog = async () => {
    try {
      setLoadingLog(true);
      const res = await apiRequest<any>('/admin/corrections?limit=50');
      const list = Array.isArray(res) ? res : res?.data || [];
      setOverrides(list);
    } catch (err: any) {
      console.error('Failed to load overrides log:', err);
    } finally {
      setLoadingLog(false);
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!workerId) {
      setFormError('Please select a worker.');
      return;
    }
    if (!worksiteId) {
      setFormError('Please select a worksite.');
      return;
    }
    if (!workDate) {
      setFormError('Please select a shift date.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      setFormError('Mandatory administrative justification must be at least 5 characters.');
      return;
    }

    try {
      setFormSubmitting(true);
      await apiRequest('/admin/corrections/create-missing-attendance', {
        method: 'POST',
        body: JSON.stringify({
          workerId,
          worksiteId,
          workDate,
          clockInTime: clockInTime ? new Date(`${workDate}T${clockInTime}:00`).toISOString() : undefined,
          clockOutTime: clockOutTime ? new Date(`${workDate}T${clockOutTime}:00`).toISOString() : undefined,
          reason: reason.trim(),
          status: resolutionStatus,
        }),
      });

      const selectedWorker = workersList.find((w) => w.id === workerId);
      setToastMessage({
        text: `Attendance override recorded successfully for ${selectedWorker?.fullName || 'worker'}.`,
        type: 'success',
      });

      // Reset form
      setReason('');
      setClockInTime('08:00');
      setClockOutTime('17:00');
      loadOverridesLog();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record attendance override.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filtered log
  const filteredOverrides = overrides.filter((item) => {
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.workerName || '').toLowerCase().includes(q);
      const matchCode = (item.employeeCode || '').toLowerCase().includes(q);
      const matchSite = (item.worksiteName || '').toLowerCase().includes(q);
      const matchReason = (item.reason || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchSite && !matchReason) return false;
    }
    return true;
  });

  // Calculate duration helper for preview
  const getDurationPreview = () => {
    if (!clockInTime || !clockOutTime) return null;
    const [inH, inM] = clockInTime.split(':').map(Number);
    const [outH, outM] = clockOutTime.split(':').map(Number);
    let diffMinutes = outH * 60 + outM - (inH * 60 + inM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Next day
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const approvedCount = overrides.filter((o) => o.status === 'APPROVED').length;
  const pendingCount = overrides.filter((o) => o.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border shadow-sm transition-all duration-200 ${toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8EEF4] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
              <FileEdit className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 m-0">Attendance Override</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Record missing attendance, resolve absent records, and apply authorized retroactive shift overrides
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadReferences();
              loadOverridesLog();
            }}
            disabled={loadingLog}
            className="px-3.5 py-2 rounded-xl border border-[#E8EEF4] bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLog ? 'animate-spin text-[#12A66A]' : ''}`} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Overrides"
          value={overrides.length}
          icon={FileEdit}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          subtitle="All recorded overrides"
        />
        <StatCard
          title="Instant Approved"
          value={approvedCount}
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-[#12A66A]"
          subtitle="Applied directly to payroll"
        />
        <StatCard
          title="Pending Supervisor Review"
          value={pendingCount}
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          subtitle="Requires field verification"
        />
        <StatCard
          title="Active Worksites"
          value={worksitesList.length}
          icon={MapPin}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          subtitle="Locations available"
        />
      </div>

      {/* ── SECTION 1: DEDICATED RECORD MISSING ATTENDANCE FORM ─────────────── */}
      <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#12A66A] flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 m-0">
                Record Missing Attendance Entry
              </h2>
              <p className="text-[11px] text-slate-500 m-0">
                Create an explicit, audited attendance correction for an employee who did not punch in or out
              </p>
            </div>
          </div>

          {getDurationPreview() && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#0E8F5B] border border-emerald-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Calculated: {getDurationPreview()}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleRecordSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Worker Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Worker / Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              >
                <option value="">Select Employee</option>
                {workersList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.fullName} ({w.employeeCode || 'Worker'}) {w.roles ? `[${w.roles[0] || 'WORKER'}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Worksite Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Worksite / Project Location <span className="text-rose-500">*</span>
              </label>
              <select
                value={worksiteId}
                onChange={(e) => setWorksiteId(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              >
                <option value="">Select Worksite</option>
                {worksitesList.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.code || 'SITE'})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Shift Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Shift Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              />
            </div>

            {/* 4. Clock In Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Actual Clock-In Time
              </label>
              <input
                type="time"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              />
            </div>

            {/* 5. Clock Out Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Actual Clock-Out Time
              </label>
              <input
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              />
            </div>

            {/* 6. Resolution Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Resolution Workflow Status
              </label>
              <select
                value={resolutionStatus}
                onChange={(e: any) => setResolutionStatus(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              >
                <option value="APPROVED">APPROVED (Apply Instantly to Timesheet)</option>
                <option value="PENDING">PENDING (Route to Supervisor for Review)</option>
                <option value="REJECTED">REJECTED (Mark Rejected Decision)</option>
                <option value="ABSENT">ABSENT (Confirm Verified Absence)</option>
                <option value="MISSING">MISSING (Record Unverified Missing Attendance)</option>
                <option value="LEAVE">LEAVE (Record Authorized Leave)</option>
              </select>
            </div>
          </div>

          {/* 7. Mandatory Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mandatory Administrative Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Worker was verified on site by site supervisor; mobile device battery depleted; physical muster roll cross-verified."
              required
              className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-900 resize-none"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              Minimum 5 characters. This justification is permanently logged in the audit trail.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setReason('');
                setFormError(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2.5 text-xs font-bold bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              {formSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording Override...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Record & Apply Attendance Override</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 2: ATTENDANCE OVERRIDES & CORRECTIONS LOG ─────────────── */}
      <div className="bg-white rounded-2xl border border-[#E8EEF4] shadow-xs overflow-hidden">
        {/* Table Header & Search Filter */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 m-0">
              Recent Attendance Overrides & Corrections Log
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              Traceable history of all administrative corrections and authorized overrides
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Status */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${filterStatus === st
                      ? 'bg-[#12A66A] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search overrides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loadingLog ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-[#12A66A] mx-auto mb-2" />
            Loading attendance overrides history...
          </div>
        ) : filteredOverrides.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm">No Attendance Overrides Found</p>
            <p className="text-slate-400 mt-0.5">
              No correction records match the selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E8EEF4] text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Worker</th>
                  <th className="py-3.5 px-4">Worksite</th>
                  <th className="py-3.5 px-4">Shift Date</th>
                  <th className="py-3.5 px-4">Override Times</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Justification</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-slate-700">
                {filteredOverrides
                  .slice((page - 1) * limit, page * limit)
                  .map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRecord(row)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Worker */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center font-bold text-xs shrink-0">
                            {row.workerName ? row.workerName.slice(0, 2).toUpperCase() : 'WK'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block leading-tight">
                              {row.workerName || 'Worker'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {row.employeeCode || 'EMP-—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Worksite */}
                      <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                        {row.worksiteName || 'Site Location'}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-xs whitespace-nowrap text-slate-700 font-medium">
                        {row.workDate ? String(row.workDate).split('T')[0] : '—'}
                      </td>

                      {/* Clock In / Out */}
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className="font-semibold text-slate-900">
                          {row.clockInTime ? new Date(row.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:00'}
                        </span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="font-semibold text-slate-900">
                          {row.clockOutTime ? new Date(row.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '17:00'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={row.status || 'APPROVED'} />
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 text-xs max-w-xs truncate text-slate-600 italic">
                        "{row.reason || 'Administrative override'}"
                      </td>

                      {/* Action */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(row)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer ml-auto shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredOverrides.length > 0 && (
          <DataTablePagination
            metadata={{
              total: filteredOverrides.length,
              page,
              limit,
              offset: (page - 1) * limit,
              totalPages: Math.ceil(filteredOverrides.length / limit),
            }}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            isLoading={loadingLog}
          />
        )}
      </div>

      {/* ── RECORD DETAILS MODAL ─────────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <FileEdit className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm m-0 leading-tight">
                    Attendance Override Details
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0 font-mono">
                    ID: #{selectedRecord.id?.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedRecord.status || 'APPROVED'} />
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center font-bold text-sm shrink-0">
                  {selectedRecord.workerName ? selectedRecord.workerName.slice(0, 2).toUpperCase() : 'WK'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight">
                    {selectedRecord.workerName}
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedRecord.employeeCode || 'EMP-—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Worksite
                  </span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedRecord.worksiteName || 'Site Location'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Shift Date
                  </span>
                  <span className="font-bold text-slate-900 mt-1 block">
                    {selectedRecord.workDate ? String(selectedRecord.workDate).split('T')[0] : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Clock-In / Clock-Out
                  </span>
                  <div className="font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#12A66A]" />
                    <span>
                      {selectedRecord.clockInTime ? new Date(selectedRecord.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:00'}{' '}
                      to{' '}
                      {selectedRecord.clockOutTime ? new Date(selectedRecord.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '17:00'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Administrative Justification
                </span>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                  "{selectedRecord.reason || 'Authorized retroactive attendance entry.'}"
                </div>
              </div>

              {selectedRecord.createdAt && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                  Recorded on: {new Date(selectedRecord.createdAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import {
  Download,
  Calendar,
  Filter,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    loadReports();
    loadWorksites();
  }, [startDate, endDate, worksiteId, status]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);
      if (status) params.append('status', status);

      const data = await apiRequest(`/reports/attendance?${params.toString()}`);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorksites = async () => {
    try {
      const data = await apiRequest('/worksites');
      setWorksites(data);
    } catch (err) {
      // ignore
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const blob = await apiRequest('/reports/attendance/export');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const total = records.length;
  const approved = records.filter((r) => r.status === 'APPROVED').length;
  const pending = records.filter((r) => r.status === 'PENDING').length;
  const rejected = records.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Historical Reports & Exports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Historical attendance tracking preserving original date-specific supervisor routing.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={isExporting}
          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Generating CSV...' : 'Export to CSV'}
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Submissions" value={total} icon={Users} />
        <StatCard title="Approved" value={approved} icon={CheckCircle} badge={`${total ? Math.round((approved / total) * 100) : 0}%`} />
        <StatCard title="Pending Review" value={pending} icon={Clock} />
        <StatCard title="Rejected" value={rejected} icon={AlertTriangle} badgeColor="text-rose-600 bg-rose-50" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
          <Filter className="w-3.5 h-3.5" />
          Filters:
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Start Date"
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="End Date"
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        />

        <select
          value={worksiteId}
          onChange={(e) => setWorksiteId(e.target.value)}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        >
          <option value="">All Worksites</option>
          {worksites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        >
          <option value="">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {(startDate || endDate || worksiteId || status) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setWorksiteId('');
              setStatus('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Worker</th>
                <th className="py-3 px-4">Worksite</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Historical Supervisor</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    Loading report rows...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{r.workDate}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {r.workerName}
                      <span className="block text-[11px] font-mono text-slate-400 font-normal">
                        {r.employeeCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">{r.worksiteName}</td>
                    <td className="py-3 px-4 text-xs">{r.shiftName}</td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {r.historicalSupervisorName}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                        r.missingClockOut ? (
                          <span className="text-amber-600 font-medium">Missing Out</span>
                        ) : '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
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

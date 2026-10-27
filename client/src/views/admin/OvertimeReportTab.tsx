import React, { useState, useEffect } from 'react';
import { apiRequest, downloadFile } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Filter,
  Users,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export const OvertimeReportTab: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [otStatus, setOtStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  useEffect(() => {
    loadWorksites();
  }, []);

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, worksiteId, otStatus]);

  const loadWorksites = async () => {
    try {
      const res = await apiRequest('/worksites');
      setWorksites(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to load worksites:', err);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);
      if (otStatus) params.append('otStatus', otStatus);

      const res = await apiRequest(`/reports/attendance-overtime?${params.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load overtime report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportOvertime = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);
      if (otStatus) params.append('otStatus', otStatus);

      await downloadFile(
        `/exports/overtime?${params.toString()}`,
        `overtime_report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const formatHoursMinutes = (totalMinutes: number) => {
    const mins = totalMinutes || 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0 && m === 0) return '0h';
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const metrics = data?.metrics || {
    totalSessions: 0,
    totalStandardMinutes: 0,
    totalWorkedMinutes: 0,
    totalCalculatedOtMinutes: 0,
    totalApprovedOtMinutes: 0,
    incompleteSessions: 0,
    missingPunches: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 m-0">Overtime & Net Hours Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">
            Centralized overtime engine calculations (9h standard baseline, break deductions, and supervisor audits).
          </p>
        </div>

        <button
          onClick={handleExportOvertime}
          disabled={isExporting}
          className="px-4 py-2.5 bg-[#12A66A] text-white rounded-xl text-xs font-semibold hover:bg-[#0f8a58] transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Generating Excel...' : 'Export Overtime (.xlsx)'}
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled Standard Hours"
          value={formatHoursMinutes(metrics.totalStandardMinutes)}
          icon={Calendar}
        />
        <StatCard
          title="Net Worked Hours"
          value={formatHoursMinutes(metrics.totalWorkedMinutes)}
          icon={Clock}
          badge={`${metrics.totalSessions} sessions`}
        />
        <StatCard
          title="Calculated Overtime"
          value={formatHoursMinutes(metrics.totalCalculatedOtMinutes)}
          icon={Sparkles}
          badgeColor="text-amber-700 bg-amber-50"
        />
        <StatCard
          title="Approved Overtime"
          value={formatHoursMinutes(metrics.totalApprovedOtMinutes)}
          icon={CheckCircle}
          badgeColor="text-emerald-700 bg-emerald-50"
        />
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
          value={otStatus}
          onChange={(e) => setOtStatus(e.target.value)}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        >
          <option value="">All Overtime Statuses</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {(startDate || endDate || worksiteId || otStatus) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setWorksiteId('');
              setOtStatus('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Worker Summaries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900 m-0">Worker Overtime Totals</h3>
          </div>
          <span className="text-xs text-slate-500">
            {data?.workerSummaries?.length || 0} active workers in period
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Worker</th>
                <th className="py-3 px-4">Employee Code</th>
                <th className="py-3 px-4">Worked Days</th>
                <th className="py-3 px-4">Net Worked Hours</th>
                <th className="py-3 px-4">Standard Hours</th>
                <th className="py-3 px-4">Calculated OT</th>
                <th className="py-3 px-4">Approved OT</th>
                <th className="py-3 px-4">Incomplete / Exceptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    Calculating overtime aggregates...
                  </td>
                </tr>
              ) : !data?.workerSummaries || data.workerSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No worker overtime records found for this criteria.
                  </td>
                </tr>
              ) : (
                data.workerSummaries
                  .slice((page - 1) * limit, page * limit)
                  .map((w: any) => (
                  <tr key={w.workerId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{w.workerName}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">{w.employeeCode || '—'}</td>
                    <td className="py-3 px-4 text-xs">{w.workedDays} days</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{formatHoursMinutes(w.totalWorkedMinutes)}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatHoursMinutes(w.totalStandardMinutes)}</td>
                    <td className="py-3 px-4 font-semibold text-amber-700">{formatHoursMinutes(w.totalCalculatedOtMinutes)}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">{formatHoursMinutes(w.totalApprovedOtMinutes)}</td>
                    <td className="py-3 px-4 text-xs">
                      {w.incompleteCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {w.incompleteCount} missing punch
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.workerSummaries?.length > 0 && (
          <DataTablePagination
            metadata={{
              total: data.workerSummaries.length,
              page,
              limit,
              offset: (page - 1) * limit,
              totalPages: Math.ceil(data.workerSummaries.length / limit),
            }}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            isLoading={loading}
          />
        )}
      </div>

      {/* Site Summaries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900 m-0">Worksite Aggregate Totals</h3>
          </div>
          <span className="text-xs text-slate-500">
            {data?.siteSummaries?.length || 0} active worksites
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Worksite</th>
                <th className="py-3 px-4">Total Sessions</th>
                <th className="py-3 px-4">Standard Hours</th>
                <th className="py-3 px-4">Net Worked Hours</th>
                <th className="py-3 px-4">Calculated OT</th>
                <th className="py-3 px-4">Approved OT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Loading worksite summaries...
                  </td>
                </tr>
              ) : !data?.siteSummaries || data.siteSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No worksite summaries available.
                  </td>
                </tr>
              ) : (
                data.siteSummaries.map((s: any) => (
                  <tr key={s.worksiteId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{s.worksiteName}</td>
                    <td className="py-3 px-4 text-xs">{s.totalSessions}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatHoursMinutes(s.totalStandardMinutes)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{formatHoursMinutes(s.totalWorkedMinutes)}</td>
                    <td className="py-3 px-4 font-semibold text-amber-700">{formatHoursMinutes(s.totalCalculatedOtMinutes)}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">{formatHoursMinutes(s.totalApprovedOtMinutes)}</td>
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

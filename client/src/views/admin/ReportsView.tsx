import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
import {
  Download,
  Calendar,
  Filter,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  MapPin,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

import { SupervisorAttendanceAuditView } from './SupervisorAttendanceAuditView';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workers' | 'supervisors'>('workers');
  const [records, setRecords] = useState<any[]>([]);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination state (limit options: 10, 25, 50)
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    limit: 10,
    offset: 0,
    totalPages: 1,
  });

  // Sorting filter (sort based on name, asc, desc, newest first use createdAt)
  const [sortFilter, setSortFilter] = useState<string>('createdAt_desc');

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab === 'workers') {
      loadReports();
      loadWorksites();
    }
  }, [startDate, endDate, worksiteId, status, page, limit, sortFilter, activeTab]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [sortBy, sortOrder] = sortFilter.split('_');
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);
      if (status) params.append('status', status);

      // Query-based offset and limit + sorting
      const offset = (page - 1) * limit;
      params.append('page', String(page));
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await apiRequest(`/reports/attendance?${params.toString()}`);
      if (res && res.data && res.pagination) {
        setRecords(res.data);
        setPagination(res.pagination);
      } else if (Array.isArray(res)) {
        setRecords(res);
        setPagination({
          total: res.length,
          page: 1,
          limit: res.length || 10,
          offset: 0,
          totalPages: 1,
        });
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
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

  const total = pagination.total || records.length;
  const approved = records.filter((r) => r.status === 'APPROVED').length;
  const pending = records.filter((r) => r.status === 'PENDING').length;
  const rejected = records.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Tab Switcher: Worker Attendance vs Supervisor Attendance & Location Audit */}
      <div className="flex items-center gap-2 bg-white border border-[#E8EEF4] p-1.5 rounded-2xl w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('workers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'workers'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Worker Attendance Reports</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('supervisors')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'supervisors'
              ? 'bg-[#12A66A] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Supervisor Attendance & Location Audit</span>
        </button>
      </div>

      {activeTab === 'supervisors' ? (
        <SupervisorAttendanceAuditView />
      ) : (
        <>
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
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        >
          <option value="">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {/* Sort Filter: Name (asc/desc), CreatedAt (newest first/oldest) */}
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Sort:</span>
          <select
            value={sortFilter}
            onChange={(e) => {
              setSortFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800"
          >
            <option value="createdAt_desc">Newest First (Created Date)</option>
            <option value="createdAt_asc">Oldest First (Created Date)</option>
            <option value="name_asc">Worker Name (A to Z)</option>
            <option value="name_desc">Worker Name (Z to A)</option>
            <option value="workDate_desc">Work Date (Latest First)</option>
            <option value="workDate_asc">Work Date (Earliest First)</option>
          </select>
        </div>

        {(startDate || endDate || worksiteId || status) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setWorksiteId('');
              setStatus('');
              setPage(1);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table & Pagination Container */}
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
                <th className="py-3 px-4">Location & Geofence</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    Loading report rows...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{r.workDate}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {r.workerName}
                      <span className="block text-[11px] text-slate-400 font-normal">
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
                    <td className="py-3 px-4 text-xs">
                      {r.isLocationBypassed ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                            Location Bypassed
                          </span>
                          <span className="block text-[11px] text-slate-500 font-medium">
                            {r.distanceMeters != null ? `${Math.round(r.distanceMeters)}m from site` : 'Roaming mode'}
                          </span>
                          {r.latitude != null && r.longitude != null && (
                            <a
                              href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 hover:underline"
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              <span>View GPS Pin</span>
                            </a>
                          )}
                        </div>
                      ) : r.latitude != null ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                            Verified On-Site
                          </span>
                          <span className="block text-[11px] text-slate-500 font-medium">
                            {r.distanceMeters != null ? `${Math.round(r.distanceMeters)}m (±${Math.round(r.accuracyMeters || 10)}m)` : 'Inside geofence'}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5 hover:underline"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            <span>GPS Location</span>
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
                      {r.isAutoApproved && (
                        <span className="block text-[10px] font-black text-emerald-700 mt-1 flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Auto-Approved</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Shadcn Table Pagination with { 10, 25, 50 } and Metadata */}
        <DataTablePagination
          metadata={pagination}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50]}
          isLoading={loading}
        />
      </div>
        </>
      )}
    </div>
  );
};

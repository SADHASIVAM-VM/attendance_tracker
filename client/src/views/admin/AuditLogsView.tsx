import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
import { History, ShieldAlert, Clock, ArrowUpDown } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
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

  // Sorting filter
  const [sortFilter, setSortFilter] = useState<string>('createdAt_desc');

  useEffect(() => {
    loadLogs();
  }, [page, limit, sortFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const [sortBy, sortOrder] = sortFilter.split('_');
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        offset: String(offset),
        sortBy,
        sortOrder,
      });

      const res = await apiRequest(`/audit-logs?${params.toString()}`);
      if (res && res.data && res.pagination) {
        setLogs(res.data);
        setPagination(res.pagination);
      } else if (Array.isArray(res)) {
        setLogs(res);
        setPagination({
          total: res.length,
          page: 1,
          limit: res.length || 10,
          offset: 0,
          totalPages: 1,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Security & Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable log of user operations, clock-ins, approvals, transfers, and system overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Sort:</span>
            <select
              value={sortFilter}
              onChange={(e) => {
                setSortFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="createdAt_desc">Newest First (Timestamp)</option>
              <option value="createdAt_asc">Oldest First (Timestamp)</option>
              <option value="name_asc">Actor Name (A to Z)</option>
              <option value="name_desc">Actor Name (Z to A)</option>
            </select>
          </div>

          <button
            onClick={loadLogs}
            className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer shadow-2xs"
          >
            Refresh Trail
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Changes (Before / After)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(l.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{l.actorName || l.actorNameSnapshot || 'System'}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            l.actorRole === 'SYSTEM'
                              ? 'bg-slate-200 text-slate-700'
                              : l.actorRole === 'ADMIN'
                              ? 'bg-rose-100 text-rose-800'
                              : l.actorRole === 'SUPERVISOR'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {l.actorRole || 'SYSTEM'}
                        </span>
                      </div>
                      <span className="block text-[10px] text-slate-400">{l.actorEmail || l.ipAddress || ''}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold text-[11px]">{l.entityType}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                      {l.reason ? <span className="italic text-slate-700">"{l.reason}"</span> : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[10px] max-w-xs truncate">
                      {l.afterValues ? l.afterValues : l.beforeValues ? l.beforeValues : '—'}
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
    </div>
  );
};

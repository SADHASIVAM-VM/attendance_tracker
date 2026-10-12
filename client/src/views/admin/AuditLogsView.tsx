import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { History, ShieldAlert, Clock } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/audit-logs');
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Security & Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable log of user operations, clock-ins, approvals, transfers, and system overrides.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
        >
          Refresh Trail
        </button>
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
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
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
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(l.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">
                      {l.actorName || 'System'}
                      <span className="block text-[10px] text-slate-400 font-mono">{l.actorEmail}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{l.entityType}</td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-[120px]">{l.entityId || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 font-sans text-[11px] max-w-xs truncate">
                      {l.afterValues ? l.afterValues : (l.beforeValues ? l.beforeValues : '—')}
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

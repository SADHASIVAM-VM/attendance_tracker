import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Calendar,
  Building2,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Filter,
  User,
  History,
  ArrowRightLeft,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Search,
} from 'lucide-react';

export const SupervisorAttendanceAuditView: React.FC = () => {
  const [reportData, setReportData] = useState<any[]>([]);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedWorksiteId, setSelectedWorksiteId] = useState<string>('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, selectedSupervisorId, selectedWorksiteId]);

  const loadFilters = async () => {
    try {
      const [wsData, usersData] = await Promise.all([
        apiRequest<any>('/worksites').catch(() => []),
        apiRequest<any>('/users').catch(() => []),
      ]);
      const wsList = Array.isArray(wsData) ? wsData : wsData?.data || [];
      setWorksites(wsList);

      const uList = Array.isArray(usersData) ? usersData : usersData?.data || [];
      const supList = uList.filter(
        (u: any) =>
          Array.isArray(u.roles) &&
          (u.roles.includes('SUPERVISOR') || u.roles.includes('ADMIN'))
      );
      setSupervisors(supList);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedSupervisorId) params.append('supervisorId', selectedSupervisorId);
      if (selectedWorksiteId) params.append('worksiteId', selectedWorksiteId);

      const res = await apiRequest<any>(`/reports/supervisor-attendance?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setReportData(list);
      if (list.length > 0 && !expandedSessionId) {
        setExpandedSessionId(list[0].sessionId);
      }
    } catch (err) {
      console.error('Failed to load supervisor attendance report:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header Strip ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Supervisor Attendance & Location Audit
            </h2>
            <span className="bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/20 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#12A66A]" />
              Auto-Approval Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Audit supervisor clock-ins, location sessions, site switches, server durations, and GPS supplementary coordinates.
          </p>
        </div>
      </div>

      {/* ── Filters Strip ── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Supervisor Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Supervisor
          </label>
          <select
            value={selectedSupervisorId}
            onChange={(e) => setSelectedSupervisorId(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12A66A] cursor-pointer"
          >
            <option value="">All Supervisors</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.employeeCode})
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            From Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12A66A] cursor-pointer"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            To Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12A66A] cursor-pointer"
          />
        </div>

        {/* Worksite Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Location
          </label>
          <select
            value={selectedWorksiteId}
            onChange={(e) => setSelectedWorksiteId(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#12A66A] cursor-pointer"
          >
            <option value="">All Worksites</option>
            {worksites.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Sessions List & Timeline ── */}
      {loading ? (
        <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-12 text-center text-slate-400 text-xs">
          Loading supervisor attendance records...
        </div>
      ) : reportData.length === 0 ? (
        <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-12 text-center text-slate-400 text-xs">
          No supervisor attendance sessions found matching the selected filters.
        </div>
      ) : (
        <div className="space-y-5">
          {reportData.map((session) => {
            const isExpanded = expandedSessionId === session.sessionId;
            return (
              <div
                key={session.sessionId}
                className="bg-white border border-[#E8EEF4] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-5 transition-all"
              >
                {/* 1. Header: Supervisor & Session Summary */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0 shadow-xs font-black text-sm">
                      {session.supervisorName ? session.supervisorName.charAt(0) : 'S'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">
                          {session.supervisorName}
                        </h3>
                        <span className="text-xs font-semibold text-slate-400">
                          ({session.employeeCode})
                        </span>
                        <span className="bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/20 px-2 py-0.5 rounded-full text-[10px] font-black">
                          {session.approvalSource || 'SYSTEM_AUTO_APPROVAL'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Shift Date:{' '}
                        <strong>
                          {new Date(session.workDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </strong>{' '}
                        • Total Time: <strong>{session.formattedTotalDuration}</strong> (
                        {session.totalHoursDecimal} hrs)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSessionId(isExpanded ? null : session.sessionId)
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E8EEF4] text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Full Timeline'}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 2. Key Session Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[18px] p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Clock-In Time
                    </span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
                      {session.clockInTime
                        ? new Date(session.clockInTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '—'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {session.clockInGps
                        ? `GPS: ±${Math.round(session.clockInGps.accuracy || 10)}m`
                        : 'GPS: Not Captured (Optional)'}
                    </span>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[18px] p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Clock-Out Time
                    </span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
                      {session.clockOutTime
                        ? new Date(session.clockOutTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Active / Not Clocked Out'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {session.clockOutGps
                        ? `GPS: ±${Math.round(session.clockOutGps.accuracy || 10)}m`
                        : 'GPS: Not Captured'}
                    </span>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[18px] p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Auto-Approval State
                    </span>
                    <span className="text-sm font-black text-[#0E8F5B] block mt-0.5">
                      Approved by System
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {session.approvedAt
                        ? new Date(session.approvedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Timestamp recorded'}
                    </span>
                  </div>

                  <div className="bg-[#E6F7EF]/50 border border-[#12A66A]/20 rounded-[18px] p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E8F5B] block">
                      Total Working Duration
                    </span>
                    <span className="text-base font-black text-[#0E8F5B] block mt-0.5 tabular-nums">
                      {session.formattedTotalDuration}
                    </span>
                    <span className="text-[11px] text-[#12A66A] font-semibold block mt-0.5">
                      {session.totalHoursDecimal} hours tracked
                    </span>
                  </div>
                </div>

                {/* 3. Location Totals Breakdown */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Aggregated Location Durations:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {session.locationTotals.length === 0 ? (
                      <span className="text-xs text-slate-400">
                        No location-specific sessions recorded for this day.
                      </span>
                    ) : (
                      session.locationTotals.map((lt: any) => (
                        <div
                          key={lt.locationId}
                          className="p-3 bg-[#F8FAFC] border border-[#E8EEF4] rounded-2xl flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="w-4 h-4 text-[#12A66A] shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-extrabold text-slate-900 block truncate">
                                {lt.locationName}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {lt.visitCount} visit{lt.visitCount === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-slate-900 block">
                              {lt.formattedDuration}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {lt.hoursDecimal} hrs
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. Expanded Chronological Location Visit Timeline */}
                {isExpanded && (
                  <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <History className="w-4 h-4 text-[#12A66A]" />
                      <span>Chronological Location Visit Timeline</span>
                    </h4>

                    <div className="space-y-3">
                      {session.locationVisits.length === 0 ? (
                        <div className="text-xs text-slate-400">No location visits recorded.</div>
                      ) : (
                        session.locationVisits.map((visit: any, idx: number) => {
                          const prevVisit = idx > 0 ? session.locationVisits[idx - 1] : null;
                          return (
                            <div
                              key={visit.id}
                              className="relative pl-6 border-l-2 border-slate-200 pb-4 last:pb-0"
                            >
                              <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-[#12A66A] ring-2 ring-[#12A66A]/20" />
                              <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-2xl p-4 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-900">
                                        Session {idx + 1}: {visit.locationName}
                                      </span>
                                      {prevVisit && (
                                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                                          Switched from {prevVisit.locationName}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 block mt-0.5">
                                      Start:{' '}
                                      <strong>
                                        {new Date(visit.startedAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </strong>{' '}
                                      — End:{' '}
                                      <strong>
                                        {visit.endedAt
                                          ? new Date(visit.endedAt).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })
                                          : 'Ongoing visit'}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="text-left sm:text-right">
                                    <span className="text-xs font-black text-slate-900 block tabular-nums">
                                      {visit.formattedDuration}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Visit duration
                                    </span>
                                  </div>
                                </div>

                                {/* Supplementary GPS coordinates details */}
                                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                                  <span>
                                    Location ID:{' '}
                                    <code className="bg-white px-1.5 py-0.5 rounded text-[10px] border border-slate-200 text-slate-700">
                                      {visit.locationId.slice(0, 8)}...
                                    </code>
                                  </span>
                                  <span>
                                    Start GPS:{' '}
                                    {visit.startGps ? (
                                      <strong className="text-slate-800">
                                        {visit.startGps.latitude.toFixed(4)},{' '}
                                        {visit.startGps.longitude.toFixed(4)} (±
                                        {Math.round(visit.startGps.accuracy || 10)}m)
                                      </strong>
                                    ) : (
                                      <span className="text-slate-400">Unavailable (Optional)</span>
                                    )}
                                  </span>
                                  <span>
                                    End GPS:{' '}
                                    {visit.endGps ? (
                                      <strong className="text-slate-800">
                                        {visit.endGps.latitude.toFixed(4)},{' '}
                                        {visit.endGps.longitude.toFixed(4)}
                                      </strong>
                                    ) : (
                                      <span className="text-slate-400">Unavailable</span>
                                    )}
                                  </span>
                                  <span className="ml-auto text-[#0E8F5B] font-bold">
                                    Outcome: Successful visit
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  ShieldAlert,
  ShieldCheck,
  Building2,
  RefreshCw,
  Search,
  CheckCircle2,
  Repeat,
} from 'lucide-react';

export const SupervisorTodayRosterView: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchWorker, setSearchWorker] = useState<string>('');

  useEffect(() => {
    loadSupervisorRoster();
  }, [selectedDate, user?.id]);

  const loadSupervisorRoster = async () => {
    try {
      setLoading(false);
      // Supervisors view assignments where they are assigned or all for their site
      const data = await apiRequest(`/assignments?date=${selectedDate}`);
      // Filter for assignments assigned to this supervisor
      const myAssignments = data.filter((a: any) => a.supervisorId === user?.id);
      setAssignments(myAssignments.length > 0 ? myAssignments : data);
    } catch (err) {
      console.error('Failed to load supervisor roster:', err);
    } finally {
      setLoading(false);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">
              Assigned Workforce & Schedule
            </h1>
            {isToday && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Today
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review site assignments, shift schedules, and field staff assigned under your supervision.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium shadow-2xs"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Go to Today
          </button>
        </div>
      </div>

      {/* Admin Central Management Notice */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">Central Administrator Scheduling</span>
          <span>
            Daily assignments and regional groups are scheduled and published exclusively by Super Admin and Admin. As a supervisor, your role is to oversee attendance approvals and verify workforce check-ins at your assigned location.
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
          Loading assigned roster...
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-2xs">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-900 text-base">No Assigned Schedule for {selectedDate}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You do not have an active worksite group assigned for this date. The administrator has not scheduled or published assignments for this date yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {assignments.map((assignment) => {
            const workers = assignment.workers || [];
            const filteredWorkers = workers.filter((w: any) =>
              w.fullName?.toLowerCase().includes(searchWorker.toLowerCase()) ||
              w.employeeCode?.toLowerCase().includes(searchWorker.toLowerCase())
            );

            return (
              <div
                key={assignment.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {assignment.groupName || 'Regional Group'}
                        </span>
                        <StatusBadge status={assignment.status} />
                        {assignment.carryForward !== false && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            {assignment.isCarriedForward || assignment.workDate !== selectedDate
                              ? `Carried Forward (${String(assignment.workDate).split('T')[0]})`
                              : 'Daily Carry-Forward'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg mt-1 mb-0">
                        {assignment.worksiteName}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {assignment.worksiteAddress}
                      </p>
                    </div>
                  </div>

                  {/* Shift details */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100 mt-4">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Shift Timing</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {assignment.shiftStartTime} - {assignment.shiftEndTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Geofence Radius</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {assignment.worksiteRadius || 20} meters
                      </span>
                    </div>
                  </div>

                  {/* Assigned Workers */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        Assigned Workers ({workers.length})
                      </span>
                      {workers.length > 5 && (
                        <div className="relative w-36">
                          <input
                            type="text"
                            value={searchWorker}
                            onChange={(e) => setSearchWorker(e.target.value)}
                            placeholder="Filter worker..."
                            className="text-[11px] px-2 py-1 border border-slate-200 rounded-lg w-full bg-slate-50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {filteredWorkers.length > 0 ? (
                        filteredWorkers.map((w: any) => (
                          <div
                            key={w.workerId}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                                {w.fullName?.charAt(0) || 'W'}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-800 block leading-tight">
                                  {w.fullName}
                                </span>
                                <span className="text-[10px] text-slate-400  ">
                                  {w.employeeCode}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Assigned
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 block py-2 text-center">
                          {workers.length === 0
                            ? 'No workers assigned to this group yet.'
                            : 'No workers matching filter.'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    Status:{' '}
                    <strong className="text-slate-600 uppercase">
                      {assignment.status}
                    </strong>
                  </span>
                  <span>Supervisor: {assignment.supervisorName}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  ClockIcon,
  CheckCircleIcon,
  CalenderIcon,
  SearchIcon,
  Building1Icon,
  GroupIcon,
  SecuritySafeIcon,
  RotateCwIcon,
  LocationIcon,
  SunIcon,
  ArrowRightIcon,
  Profile2Icon,
  EmailIcon,
} from '@astraicons/react/linear';

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
        <SecuritySafeIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
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
          <RotateCwIcon className="w-4 h-4 animate-spin text-slate-400" />
          Loading assigned roster...
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-2xs">
          <CalenderIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-900 text-base">No Assigned Schedule for {selectedDate}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You do not have an active worksite group assigned for this date. The administrator has not scheduled or published assignments for this date yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {assignments.map((assignment) => {
            const workers = assignment.workers || [];
            const filteredWorkers = workers.filter((w: any) =>
              w.fullName?.toLowerCase().includes(searchWorker.toLowerCase()) ||
              w.employeeCode?.toLowerCase().includes(searchWorker.toLowerCase())
            );

            return (
              <div
                key={assignment.id}
                className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6 transition-all hover:shadow-sm"
              >
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Building Icon & Worksite Title */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/60 text-indigo-600 flex items-center justify-center shrink-0">
                      <Building1Icon className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {assignment.worksiteName}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 font-medium mt-1">
                        <LocationIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{assignment.worksiteAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Badges Row */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:self-start">
                    {/* Shift Pill */}
                    <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs">
                      <SunIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{assignment.groupName || assignment.shiftName || 'Morning Shift'}</span>
                    </div>

                    {/* Published / Status Pill */}
                    <div
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border shadow-2xs ${
                        assignment.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : assignment.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : assignment.status === 'COMPLETED'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          assignment.status === 'PUBLISHED'
                            ? 'bg-emerald-500'
                            : assignment.status === 'DRAFT'
                              ? 'bg-amber-500'
                              : assignment.status === 'COMPLETED'
                                ? 'bg-blue-500'
                                : 'bg-rose-500'
                        }`}
                      />
                      <span>
                        {assignment.status === 'PUBLISHED'
                          ? 'Published'
                          : assignment.status === 'DRAFT'
                            ? 'Draft'
                            : assignment.status === 'COMPLETED'
                              ? 'Completed'
                              : 'Cancelled'}
                      </span>
                    </div>

                    {/* Carried Forward Pill */}
                    {assignment.carryForward !== false && (
                      <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-indigo-50/90 text-indigo-700 border border-indigo-100 shadow-2xs">
                        <CalenderIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          {assignment.isCarriedForward || assignment.workDate !== selectedDate
                            ? `Carried Forward (${String(assignment.workDate).split('T')[0]})`
                            : 'Carried Forward'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle Banner (Carried Forward) */}
                {(assignment.isCarriedForward || (assignment.carryForward !== false && assignment.workDate !== selectedDate)) && assignment.status !== 'CANCELLED' && (
                  <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                        <CalenderIcon className="w-5 h-5 text-sky-600" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm">
                          Carried forward from {String(assignment.workDate).split('T')[0]}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Location, supervisor, and all {workers.length} assigned workers carry forward daily until cancelled.
                        </p>
                      </div>
                    </div>
                    <ArrowRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>
                )}

                {/* Middle 2-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left Card: Supervisor & Assigned Users */}
                  <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between space-y-6">
                    {/* Supervisor Details */}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center shrink-0">
                        <Profile2Icon className="w-7 h-7 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-400 block tracking-wide uppercase">
                          Assigned Supervisor
                        </span>
                        <h4 className="text-lg font-bold text-slate-900 truncate mt-0.5">
                          {assignment.supervisorName || user?.fullName || 'Assigned Supervisor'}
                        </h4>
                        <span className="text-xs font-medium text-slate-500 block">Site Supervisor</span>
                        {assignment.supervisorEmail && (
                          <span className="text-xs text-slate-600 flex items-center gap-1.5 mt-1 truncate">
                            <EmailIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{assignment.supervisorEmail}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assigned Users Bar */}
                    <div className="space-y-3 pt-4 border-t border-slate-200/70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GroupIcon className="w-5 h-5 text-slate-600 shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-slate-500 block">
                              Assigned Users
                            </span>
                            <div className="flex items-center gap-1 text-2xl font-bold text-slate-900">
                              <span>{workers.length}</span>
                            </div>
                          </div>
                        </div>

                        <div className="h-8 w-px bg-slate-200 mx-2"></div>

                        {/* Stacked user avatar icons */}
                        <div className="flex items-center">
                          {workers.length > 0 ? (
                            <>
                              {workers.slice(0, 4).map((w: any, idx: number) => (
                                <div
                                  key={w.workerId || idx}
                                  title={`${w.fullName} (${w.employeeCode || ''})`}
                                  className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-white text-indigo-600 flex items-center justify-center text-xs font-semibold -ml-2.5 first:ml-0 shadow-2xs"
                                >
                                  <Profile2Icon className="w-4 h-4 text-indigo-600" />
                                </div>
                              ))}
                              {workers.length > 4 && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white text-indigo-700 flex items-center justify-center text-[11px] font-bold -ml-2.5 shadow-2xs">
                                  +{workers.length - 4}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No users assigned</span>
                          )}
                        </div>
                      </div>

                      {/* Worker Filter Search Bar if more than 4 workers */}
                      {workers.length > 4 && (
                        <div className="pt-2 relative">
                          <SearchIcon className="w-3.5 h-3.5 text-[#8C90A0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={searchWorker}
                            onChange={(e) => setSearchWorker(e.target.value)}
                            placeholder="Filter assigned workers by name or code..."
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-[#E8EEF4] rounded-full text-[#1E1F24] placeholder-[#8C90A0] focus:outline-none focus:border-[#01B075] focus:ring-1 focus:ring-[#01B075] shadow-2xs transition-all font-medium"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Card: Shift Timing & Geofence (Mint Green Card) */}
                  <div className="bg-emerald-50/30 border border-emerald-100/70 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                        <ClockIcon className="w-7 h-7 text-emerald-600" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 block tracking-wide uppercase">
                        Shift Timing
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                        {assignment.shiftStartTime || '08:00'} – {assignment.shiftEndTime || '17:00'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mt-4">
                      <LocationIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Radius: {assignment.worksiteRadius || 20}m geofence</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <CalenderIcon className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="leading-tight">
                      <span className="text-[11px] text-slate-400 block font-medium">Published</span>
                      <span className="text-xs font-semibold text-slate-700 block">
                        {assignment.publishedAt
                          ? new Date(assignment.publishedAt).toLocaleTimeString()
                          : assignment.status === 'PUBLISHED'
                            ? '4:00:34 PM'
                            : assignment.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Supervisor Verified On-Site</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

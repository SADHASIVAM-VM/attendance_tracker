import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  MapPin,
  Clock,
  UserCheck,
  CalendarDays,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  LogOut,
  RefreshCw,
  FileText,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface WorkerDashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const WorkerDashboardView: React.FC<WorkerDashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [todaySession, setTodaySession] = useState<any | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [clockingOut, setClockingOut] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Fetch Today's Assignment
      const assignData = await apiRequest('/workers/me/assignments').catch(() => []);
      setAssignments(assignData);
      if (assignData.length > 0) {
        setSelectedAssignment(assignData[0]);
      }

      // 2. Fetch Attendance Records
      const attendanceData = await apiRequest('/attendance/me').catch(() => []);
      setAttendanceHistory(attendanceData.slice(0, 5));
      const today = attendanceData.find((r: any) => r.workDate === todayStr);
      if (today) {
        setTodaySession(today);
      }
    } catch (err: any) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickClockOut = async () => {
    if (!todaySession) return;
    try {
      setClockingOut(true);
      await apiRequest(`/attendance/${todaySession.id}/clock-out`, { method: 'POST' });
      setMessage('Clocked out successfully for the day.');
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Clock out failed');
    } finally {
      setClockingOut(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#64748B] text-sm">
        <RefreshCw className="w-6 h-6 animate-spin text-[#356DF3] mb-3" />
        <span>Loading your workforce workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* 1. GREETING & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E5EAF2]">
        <div>
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block">
            {formattedDate}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#17243B] m-0">
            {getGreeting()}, {user?.fullName?.split(' ')[0] || 'Worker'}!
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#356DF3] border border-blue-100">
            <span className="w-2 h-2 rounded-full bg-[#356DF3] animate-pulse" />
            {user?.employeeCode || 'EMP'}
          </span>
          <button
            onClick={loadDashboardData}
            title="Refresh Dashboard"
            className="p-2 text-[#64748B] hover:text-[#17243B] hover:bg-white rounded-xl border border-transparent hover:border-[#E5EAF2] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-50 text-[#16A36A] border border-emerald-200 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* 2. TODAY'S ATTENDANCE STATUS HERO CARD */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#356DF3]" />
            Today's Attendance Status
          </span>
          {todaySession ? (
            <StatusBadge status={todaySession.status} size="md" />
          ) : (
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-[#64748B] border border-[#E5EAF2]">
              Not Clocked In
            </span>
          )}
        </div>

        {/* State A: No session yet */}
        {!todaySession && (
          <div className="space-y-4">
            <div className="bg-[#F6F8FC] p-4 rounded-xl border border-[#E5EAF2] space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                    Assigned Worksite
                  </span>
                  <span className="text-base font-bold text-[#17243B] block">
                    {selectedAssignment?.worksiteName || 'No assignment published today'}
                  </span>
                  <span className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedAssignment?.worksiteAddress || 'Contact your site administrator for scheduling'}
                  </span>
                </div>
                {selectedAssignment && (
                  <span className="text-xs font-bold text-[#356DF3] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 shrink-0">
                    {selectedAssignment.shiftStartTime} - {selectedAssignment.shiftEndTime}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => onNavigate('clock-in')}
              className="w-full py-3.5 bg-[#356DF3] hover:bg-[#2A5CD9] text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Clock className="w-4 h-4" />
              Clock In with Camera & Location
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}

        {/* State B: Session exists and is PENDING */}
        {todaySession && todaySession.status === 'PENDING' && (
          <div className="space-y-4">
            <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#E9A23B]">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Clock-In Under Review</span>
              </div>
              <p className="m-0 leading-relaxed text-[#17243B]">
                Your selfie and location evidence were submitted at{' '}
                <strong>{todaySession.clockInTime ? new Date(todaySession.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</strong>.
                Waiting for approval by assigned supervisor <strong>{todaySession.supervisorName || selectedAssignment?.supervisorName}</strong>.
              </p>
            </div>

            <button
              onClick={() => onNavigate('clock-in')}
              className="w-full py-2.5 bg-white border border-[#E5EAF2] hover:bg-slate-50 text-[#17243B] rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              View Clock-In Details & Geofence
            </button>
          </div>
        )}

        {/* State C: Session is APPROVED */}
        {todaySession && todaySession.status === 'APPROVED' && (
          <div className="space-y-4">
            <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-[#16A36A]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Clock-In Verified & Approved</span>
                </div>
                <span className="font-semibold text-emerald-800">
                  Clocked In: {todaySession.clockInTime ? new Date(todaySession.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </span>
              </div>
              <p className="m-0 text-slate-700">
                Verified at <strong>{todaySession.worksiteName || selectedAssignment?.worksiteName}</strong> by supervisor{' '}
                <strong>{todaySession.supervisorName || selectedAssignment?.supervisorName}</strong>.
              </p>
            </div>

            {!todaySession.clockOutTime ? (
              <button
                onClick={handleQuickClockOut}
                disabled={clockingOut}
                className="w-full py-3.5 bg-[#14213D] hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {clockingOut ? 'Clocking Out...' : 'Clock Out for the Day'}
              </button>
            ) : (
              <div className="p-3 bg-blue-50 text-[#356DF3] text-xs font-semibold rounded-xl border border-blue-100 text-center">
                Shift completed! You clocked out at {new Date(todaySession.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </div>
            )}
          </div>
        )}

        {/* State D: Session is REJECTED */}
        {todaySession && todaySession.status === 'REJECTED' && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-[#DC4545]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Clock-In Rejected by Supervisor</span>
              </div>
              <p className="m-0 text-slate-800">
                Reason: <strong>{todaySession.rejectionReason || 'No specific note provided'}</strong>
              </p>
            </div>

            <button
              onClick={() => onNavigate('clock-in')}
              className="w-full py-3 bg-[#356DF3] text-white rounded-xl font-bold text-xs shadow-xs hover:bg-[#2A5CD9] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              Re-submit Clock-In with New Selfie
            </button>
          </div>
        )}
      </div>

      {/* 3. QUICK ACTIONS GRID (Thumb-friendly mobile cards) */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B] mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('clock-in')}
            className="p-4 bg-white rounded-2xl border border-[#E5EAF2] hover:border-[#356DF3]/40 hover:shadow-xs transition-all text-left flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#356DF3] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-[#17243B] block">Clock In / Out</span>
              <span className="text-[11px] text-[#64748B]">GPS & Camera</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('my-attendance')}
            className="p-4 bg-white rounded-2xl border border-[#E5EAF2] hover:border-[#356DF3]/40 hover:shadow-xs transition-all text-left flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16A36A] flex items-center justify-center group-hover:scale-105 transition-transform">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-[#17243B] block">My Attendance</span>
              <span className="text-[11px] text-[#64748B]">Monthly logs</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('leave-apply')}
            className="p-4 bg-white rounded-2xl border border-[#E5EAF2] hover:border-[#356DF3]/40 hover:shadow-xs transition-all text-left flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#E9A23B] flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-[#17243B] block">Apply Leave</span>
              <span className="text-[11px] text-[#64748B]">Casual & Medical</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('my-leave')}
            className="p-4 bg-white rounded-2xl border border-[#E5EAF2] hover:border-[#356DF3]/40 hover:shadow-xs transition-all text-left flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-[#17243B] block">Leave Status</span>
              <span className="text-[11px] text-[#64748B]">Approval tracking</span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. RECENT ATTENDANCE HISTORY LIST */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#17243B] m-0">Recent Attendance Logs</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Your last recorded shift entries</p>
          </div>
          <button
            onClick={() => onNavigate('my-attendance')}
            className="text-xs font-bold text-[#356DF3] hover:text-[#2A5CD9] flex items-center gap-1 cursor-pointer"
          >
            View Full History
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {attendanceHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748B] bg-[#F6F8FC] rounded-xl border border-[#E5EAF2]">
            No past attendance sessions found. Clock in for your assigned shift above!
          </div>
        ) : (
          <div className="divide-y divide-[#E5EAF2]">
            {attendanceHistory.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#17243B] text-sm">
                      {new Date(item.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-[#64748B]">({item.shiftName || 'Standard'})</span>
                  </div>
                  <div className="text-[11px] text-[#64748B] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{item.worksiteName}</span>
                    {item.clockInTime && (
                      <>
                        <span className="mx-1">•</span>
                        <span>In: {new Date(item.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    )}
                  </div>
                </div>

                <StatusBadge status={item.status} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

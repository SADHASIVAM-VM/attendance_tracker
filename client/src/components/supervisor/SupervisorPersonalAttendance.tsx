import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SupervisorWorksite } from '../../types/supervisor';
import { apiRequest } from '../../lib/api';
import {
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Check,
  Building2,
  ChevronRight,
  Info,
  Timer,
  Navigation,
  Loader2,
  ArrowRightLeft,
  History,
  X,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { WorkerAttendanceView } from '@/views/worker/WorkerAttendanceView';

interface LocationVisit {
  id: string;
  locationId: string;
  locationNameSnapshot: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  formattedDuration: string;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
}

interface LocationTotal {
  locationId: string;
  locationName: string;
  totalSeconds: number;
  formattedDuration: string;
  visitCount: number;
  isActive: boolean;
}

interface SupervisorPersonalAttendanceProps {
  currentWorksite?: SupervisorWorksite;
}

export const SupervisorPersonalAttendance: React.FC<SupervisorPersonalAttendanceProps> = ({
  currentWorksite,
}) => {
  const { user } = useAuth();

  // Shift & Attendance states
  const [shiftStatus, setShiftStatus] = useState<'NOT_CLOCKED_IN' | 'WORKING' | 'SHIFT_DONE'>('NOT_CLOCKED_IN');
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [rawClockInTime, setRawClockInTime] = useState<string | null>(null);
  const [rawClockOutTime, setRawClockOutTime] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalShiftStr, setTotalShiftStr] = useState<string>('00h 00m 00s');
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Location & Assigned Locations
  const [assignedLocations, setAssignedLocations] = useState<any[]>([]);
  const [activeLocation, setActiveLocation] = useState<{
    locationId: string;
    locationNameSnapshot: string;
    startedAt: string;
    elapsedSeconds: number;
  } | null>(null);
  const [locationVisits, setLocationVisits] = useState<LocationVisit[]>([]);
  const [locationTotals, setLocationTotals] = useState<LocationTotal[]>([]);
  const [unallocatedSeconds, setUnallocatedSeconds] = useState<number>(0);

  // Switching Modal State
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState<boolean>(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Optional GPS tracking (Non-blocking supplementary evidence)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'ACQUIRING' | 'AVAILABLE' | 'UNAVAILABLE'>('ACQUIRING');

  // Success / info alert banner
  const [alertBanner, setAlertBanner] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Live timers
  const [overallElapsedSeconds, setOverallElapsedSeconds] = useState<number>(0);
  const [locationElapsedSeconds, setLocationElapsedSeconds] = useState<number>(0);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins
      .toString()
      .padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  // 1. Capture Optional GPS in Background
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('UNAVAILABLE');
      return;
    }
    setGpsStatus('ACQUIRING');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus('AVAILABLE');
      },
      (err) => {
        console.warn('Supervisor GPS optional check note:', err.message);
        setGpsStatus('UNAVAILABLE');
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  }, []);

  // 2. Fetch Active Session from Server (restores state on page refresh)
  const fetchActiveSession = useCallback(async () => {
    try {
      setIsLoadingSession(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const data = await apiRequest<any>(`/attendance/supervisor/active-session?date=${todayStr}`).catch(() => null);

      if (data && data.hasSession && data.session) {
        setSessionId(data.session.id);
        const s = data.session;
        setRawClockInTime(s.clockInTime);
        setRawClockOutTime(s.clockOutTime);

        if (s.clockInTime) {
          setClockInTime(new Date(s.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }

        if (s.clockOutTime) {
          setShiftStatus('SHIFT_DONE');
          setClockOutTime(new Date(s.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          const totalSecs = s.totalDurationSeconds || 0;
          setTotalShiftStr(formatTimer(totalSecs));
          setOverallElapsedSeconds(totalSecs);
          setActiveLocation(null);
        } else {
          setShiftStatus('WORKING');
          setClockOutTime(null);
          const elapsed = Math.max(0, Math.floor((Date.now() - new Date(s.clockInTime).getTime()) / 1000));
          setOverallElapsedSeconds(elapsed);
        }

        if (data.activeLocation) {
          setActiveLocation(data.activeLocation);
          const locElapsed = Math.max(
            0,
            Math.floor((Date.now() - new Date(data.activeLocation.startedAt).getTime()) / 1000)
          );
          setLocationElapsedSeconds(locElapsed);
        } else {
          setActiveLocation(null);
          setLocationElapsedSeconds(0);
        }

        setLocationVisits(data.visits || []);
        setLocationTotals(data.locationTotals || []);
        setUnallocatedSeconds(data.unallocatedDurationSeconds || 0);
      } else {
        setShiftStatus('NOT_CLOCKED_IN');
        setSessionId(null);
        setClockInTime(null);
        setClockOutTime(null);
        setRawClockInTime(null);
        setRawClockOutTime(null);
        setActiveLocation(null);
        setLocationVisits([]);
        setLocationTotals([]);
        setOverallElapsedSeconds(0);
        setLocationElapsedSeconds(0);
      }

      if (data && Array.isArray(data.assignedLocations)) {
        setAssignedLocations(data.assignedLocations);
        if (data.assignedLocations.length > 0 && !selectedDestinationId) {
          setSelectedDestinationId(data.assignedLocations[0].id);
        }
      }
    } catch (err) {
      console.warn('Could not fetch supervisor active session:', err);
    } finally {
      setIsLoadingSession(false);
    }
  }, [selectedDestinationId]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  // 3. Live Timers (Calculate live duration from server timestamps without duplicate DB writes)
  useEffect(() => {
    if (shiftStatus !== 'WORKING' || !rawClockInTime) return;

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const inMs = new Date(rawClockInTime).getTime();
      if (!isNaN(inMs)) {
        setOverallElapsedSeconds(Math.max(0, Math.floor((nowMs - inMs) / 1000)));
      }

      if (activeLocation?.startedAt) {
        const locMs = new Date(activeLocation.startedAt).getTime();
        if (!isNaN(locMs)) {
          setLocationElapsedSeconds(Math.max(0, Math.floor((nowMs - locMs) / 1000)));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [shiftStatus, rawClockInTime, activeLocation?.startedAt]);

  // 4. Supervisor Clock-In Action
  const handleClockIn = async (initialLocId?: string) => {
    setIsSubmitting(true);
    setAlertBanner(null);
    try {
      const payload = {
        worksiteId: initialLocId || (assignedLocations.length > 0 ? assignedLocations[0].id : undefined),
        latitude: userCoords?.lat ?? null,
        longitude: userCoords?.lng ?? null,
        reportedAccuracyMeters: gpsAccuracy ?? null,
        clientDeviceInfo: navigator.userAgent,
      };

      const res = await apiRequest<any>('/attendance/supervisor/clock-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAlertBanner({
        type: 'success',
        message: res.message || 'Clocked in successfully. Attendance auto-approved by system policy.',
      });

      await fetchActiveSession();
    } catch (err: any) {
      console.error('Supervisor clock-in error:', err);
      setAlertBanner({
        type: 'error',
        message: err.message || 'Failed to clock in. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Supervisor Location Selection / Switch Action
  const handleSwitchLocation = async (destId: string) => {
    if (!destId) return;
    setIsSubmitting(true);
    setSwitchError(null);
    try {
      const payload = {
        destinationLocationId: destId,
        sessionId: sessionId || undefined,
        latitude: userCoords?.lat ?? null,
        longitude: userCoords?.lng ?? null,
        reportedAccuracyMeters: gpsAccuracy ?? null,
        clientDeviceInfo: navigator.userAgent,
      };

      const res = await apiRequest<any>('/attendance/supervisor/location-switch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsSwitchModalOpen(false);
      setAlertBanner({
        type: 'success',
        message: res.message || 'Location updated successfully.',
      });

      await fetchActiveSession();
    } catch (err: any) {
      console.error('Supervisor location switch error:', err);
      setSwitchError(err.message || 'Failed to switch location. Verify assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Supervisor Clock-Out Action
  const handleClockOut = async () => {
    if (!window.confirm('Are you sure you want to clock out and complete your supervisor shift for today?')) {
      return;
    }
    setIsSubmitting(true);
    setAlertBanner(null);
    try {
      const payload = {
        sessionId: sessionId || undefined,
        latitude: userCoords?.lat ?? null,
        longitude: userCoords?.lng ?? null,
        reportedAccuracyMeters: gpsAccuracy ?? null,
        clientDeviceInfo: navigator.userAgent,
      };

      const res = await apiRequest<any>('/attendance/supervisor/clock-out', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAlertBanner({
        type: 'success',
        message: res.message || 'Clocked out successfully. Location sessions finalized and auto-approved.',
      });

      await fetchActiveSession();
    } catch (err: any) {
      console.error('Supervisor clock-out error:', err);
      setAlertBanner({
        type: 'error',
        message: err.message || 'Failed to clock out. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Notification Banner ── */}
      {alertBanner && (
        <div
          className={`p-4 rounded-[20px] flex items-start gap-3 border shadow-xs animate-in slide-in-from-top-2 ${
            alertBanner.type === 'success'
              ? 'bg-[#E6F7EF] border-[#12A66A]/30 text-[#065F46]'
              : alertBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {alertBanner.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#12A66A] shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-extrabold text-sm block">
              {alertBanner.type === 'success' ? 'Confirmed Action' : 'Notice'}
            </span>
            <span className="text-xs block mt-0.5 leading-relaxed font-medium">
              {alertBanner.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAlertBanner(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 1. MAIN HERO ATTENDANCE CARD ── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-5 sm:p-6 shadow-xs space-y-6">
        {/* Top Header: Shift Status & Auto-Approval Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Supervisor Shift Lifecycle
                </span>
                <span className="bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/20 px-2 py-0.2 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#12A66A]" />
                  Auto-Approved Policy
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                {shiftStatus === 'WORKING'
                  ? 'Shift In Progress'
                  : shiftStatus === 'SHIFT_DONE'
                  ? 'Shift Completed Today'
                  : 'Ready to Clock In'}
              </h3>
            </div>
          </div>

          {/* GPS Status Indicator (Supplementary) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E8EEF4] text-xs self-start sm:self-auto">
            <MapPin
              className={`w-4 h-4 ${
                gpsStatus === 'AVAILABLE'
                  ? 'text-[#12A66A]'
                  : gpsStatus === 'ACQUIRING'
                  ? 'text-amber-500 animate-pulse'
                  : 'text-slate-400'
              }`}
            />
            <span className="text-slate-600 text-[11px] font-semibold">
              {gpsStatus === 'AVAILABLE'
                ? `GPS Captured (±${gpsAccuracy}m)`
                : gpsStatus === 'ACQUIRING'
                ? 'Acquiring GPS...'
                : 'GPS Optional (Unavailable)'}
            </span>
          </div>
        </div>

        {/* ── Shift Metrics Overview ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[18px] p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Clock In Time
            </span>
            <span className="text-xl font-black text-slate-900 tabular-nums block mt-1">
              {clockInTime || '— : —'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {clockInTime ? 'Auto-approved on clock-in' : 'Start your working day'}
            </span>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E8EEF4] rounded-[18px] p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Clock Out Time
            </span>
            <span className="text-xl font-black text-slate-900 tabular-nums block mt-1">
              {clockOutTime || '— : —'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {clockOutTime ? 'Day finalized & recorded' : 'Active working session'}
            </span>
          </div>

          <div className="bg-[#E6F7EF]/50 border border-[#12A66A]/20 rounded-[18px] p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E8F5B] block flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-[#12A66A]" />
              Total Shift Duration
            </span>
            <span className="text-xl font-black text-[#0E8F5B] tabular-nums block mt-1">
              {shiftStatus === 'WORKING'
                ? formatTimer(overallElapsedSeconds)
                : shiftStatus === 'SHIFT_DONE'
                ? totalShiftStr
                : '00h 00m 00s'}
            </span>
            <span className="text-[11px] text-[#12A66A] font-semibold">
              {shiftStatus === 'WORKING' ? 'Live server-calculated timer' : 'Total workday tracked'}
            </span>
          </div>
        </div>

        {/* ── 2. ACTIVE LOCATION SECTION & SWITCHING (Core Feature) ── */}
        {shiftStatus === 'WORKING' && (
          <div className="space-y-4 pt-2">
            {activeLocation ? (
              /* Active Location Box */
              <div className="bg-gradient-to-r from-[#F0FDF4] via-white to-[#F0FDF4] border border-[#12A66A]/30 rounded-[20px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(18,166,106,0.3)]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E8F5B] bg-[#E6F7EF] px-2 py-0.5 rounded-full">
                        Active Location Session
                      </span>
                      <span className="w-2 h-2 rounded-full bg-[#12A66A] animate-ping" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-1">
                      {activeLocation.locationNameSnapshot}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Started tracking at{' '}
                      <strong>
                        {new Date(activeLocation.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Live Duration at this Location + Switch Button */}
                <div className="flex items-center gap-4 self-start md:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Time at this location
                    </span>
                    <span className="text-lg font-black text-slate-900 tabular-nums">
                      {formatTimer(locationElapsedSeconds)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSwitchError(null);
                      setIsSwitchModalOpen(true);
                    }}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 bg-white border border-[#12A66A] hover:bg-[#E6F7EF] text-[#0E8F5B] rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-[#12A66A]" />
                    <span>Switch Location</span>
                  </button>
                </div>
              </div>
            ) : (
              /* No Location Selected Prompt */
              <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-5 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-900">
                      Working Location Not Selected
                    </h4>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      You are clocked in, but location-specific time tracking has not started.
                      Please select which of your assigned locations you are currently working at.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <select
                    value={selectedDestinationId}
                    onChange={(e) => setSelectedDestinationId(e.target.value)}
                    className="flex-1 bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {assignedLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.code ? `(${loc.code})` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleSwitchLocation(selectedDestinationId)}
                    disabled={isSubmitting || !selectedDestinationId}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm Working Location</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. CLOCK IN / CLOCK OUT CONTROLS ── */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {shiftStatus === 'NOT_CLOCKED_IN' && (
            <button
              type="button"
              onClick={() => handleClockIn()}
              disabled={isSubmitting}
              className="flex-1 py-4 bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 text-white rounded-[18px] font-black text-sm shadow-[0_4px_16px_rgba(18,166,106,0.35)] transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Clock className="w-5 h-5 stroke-[2.5]" />
              )}
              <span>Clock In Now (Supervisor Auto-Approval)</span>
            </button>
          )}

          {shiftStatus === 'WORKING' && (
            <button
              type="button"
              onClick={handleClockOut}
              disabled={isSubmitting}
              className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 disabled:opacity-50 text-white rounded-[18px] font-black text-sm shadow-[0_4px_16px_rgba(225,29,72,0.3)] transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
              <span>Clock Out Shift ({formatTimer(overallElapsedSeconds)} worked)</span>
            </button>
          )}

          {shiftStatus === 'SHIFT_DONE' && (
            <div className="flex-1 p-3.5 bg-blue-50 border border-blue-200 rounded-[18px] text-blue-900 text-xs font-bold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <span>
                  Today's supervisor shift finalized at {clockOutTime} (Total: {totalShiftStr})
                </span>
              </div>
              <span className="text-[11px] bg-blue-200/60 text-blue-900 px-2.5 py-0.5 rounded-full font-extrabold">
                Auto-Approved
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. LOCATION TIME BREAKDOWN & VISIT TIMELINE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card A: Aggregated Duration Per Location */}
        <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#12A66A]" />
                <span>Aggregated Time Per Location</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Total hours spent at each assigned location across all visits today
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {locationTotals.length} location{locationTotals.length === 1 ? '' : 's'}
            </span>
          </div>

          {locationTotals.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No location sessions recorded yet today. Clock in and select a location.
            </div>
          ) : (
            <div className="space-y-3">
              {locationTotals.map((item) => (
                <div
                  key={item.locationId}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    item.isActive
                      ? 'bg-[#E6F7EF]/40 border-[#12A66A]/30'
                      : 'bg-[#F8FAFC] border-[#E8EEF4]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.isActive
                          ? 'bg-[#12A66A] text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900 block">
                          {item.locationName}
                        </span>
                        {item.isActive && (
                          <span className="bg-[#12A66A] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {item.visitCount} visit{item.visitCount === 1 ? '' : 's'} today
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 tabular-nums block">
                      {item.isActive
                        ? formatTimer(item.totalSeconds + (locationElapsedSeconds > 0 ? 0 : 0))
                        : item.formattedDuration}
                    </span>
                    <span className="text-[10px] text-slate-400">Aggregated duration</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card B: Chronological Location Visit Timeline */}
        <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[#12A66A]" />
                <span>Visit Sessions Timeline</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chronological list of switches and visits recorded on the server
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {locationVisits.length} session{locationVisits.length === 1 ? '' : 's'}
            </span>
          </div>

          {locationVisits.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No visits recorded yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {locationVisits.map((v, idx) => {
                const isCurrentActive = !v.endedAt && shiftStatus === 'WORKING';
                return (
                  <div
                    key={v.id || idx}
                    className="relative pl-5 border-l-2 border-slate-200 pb-3 last:pb-0"
                  >
                    <div
                      className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                        isCurrentActive ? 'bg-[#12A66A] ring-2 ring-[#12A66A]/20' : 'bg-slate-400'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          Visit {idx + 1}: {v.locationNameSnapshot}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(v.startedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          —{' '}
                          {v.endedAt
                            ? new Date(v.endedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Currently Active'}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-black tabular-nums ${
                            isCurrentActive ? 'text-[#12A66A]' : 'text-slate-800'
                          }`}
                        >
                          {isCurrentActive ? formatTimer(locationElapsedSeconds) : v.formattedDuration}
                        </span>
                        {v.gpsAccuracyMeters && (
                          <span className="text-[9px] text-slate-400 block">
                            GPS ±{v.gpsAccuracyMeters}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. LOCATION SWITCH MODAL ── */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E8EEF4] rounded-[24px] max-w-md w-full p-6 shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Switch Working Location</h3>
                  <span className="text-xs text-slate-500 block">
                    Select your next assigned location
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {switchError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {switchError}
              </div>
            )}

            {/* Current Active Location Info */}
            {activeLocation && (
              <div className="p-3 bg-[#F8FAFC] border border-[#E8EEF4] rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span>Closing current visit at:</span>
                <strong className="text-slate-900">{activeLocation.locationNameSnapshot}</strong>
              </div>
            )}

            {/* Assigned Locations Destination List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Choose Destination Worksite:
              </label>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {assignedLocations.map((loc) => {
                  const isCurrent = activeLocation?.locationId === loc.id;
                  const isSelected = selectedDestinationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSelectedDestinationId(loc.id)}
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-[#12A66A] bg-[#E6F7EF]/50 shadow-2xs'
                          : 'border-[#E8EEF4] bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2
                          className={`w-4 h-4 ${isSelected ? 'text-[#12A66A]' : 'text-slate-400'}`}
                        />
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 block">
                            {loc.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {loc.address || loc.code}
                          </span>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      ) : isSelected ? (
                        <Check className="w-4 h-4 text-[#12A66A]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                className="flex-1 py-3 bg-white border border-[#E8EEF4] hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLocation(selectedDestinationId)}
                disabled={isSubmitting || !selectedDestinationId}
                className="flex-1 py-3 bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                <span>Confirm Switch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. SUPERVISOR ATTENDANCE CALENDAR (Embedded worker attendance view) ── */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#12A66A]" />
              <span>Monthly Attendance History & Regularization</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Full monthly shift log, color-coded days, and personal record
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-4 sm:p-5 shadow-xs">
          <WorkerAttendanceView />
        </div>
      </div>
    </div>
  );
};

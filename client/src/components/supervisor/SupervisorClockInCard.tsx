import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SupervisorWorksite } from '../../types/supervisor';
import { apiRequest } from '../../lib/api';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Loader2,
  LogOut,
  PlayCircle,
  ShieldCheck,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/alert-dialog';

interface SupervisorClockInCardProps {
  worksites: SupervisorWorksite[];
  selectedWorksite: SupervisorWorksite;
  onSelectWorksite: (worksite: SupervisorWorksite) => void;
  onClockInSuccess?: () => void;
}

const getLocalTodayDateString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
};

/** Format total seconds as HH:MM:SS */
const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
};

export const SupervisorClockInCard: React.FC<SupervisorClockInCardProps> = ({
  worksites,
  selectedWorksite,
  onSelectWorksite,
  onClockInSuccess,
}) => {
  // Shift status
  const [shiftStatus, setShiftStatus] = useState<'NOT_CLOCKED_IN' | 'WORKING' | 'SHIFT_DONE'>(
    'NOT_CLOCKED_IN'
  );
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [rawClockInTime, setRawClockInTime] = useState<string | null>(null);
  const [rawClockOutTime, setRawClockOutTime] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalShiftStr, setTotalShiftStr] = useState<string>('00:00:00');
  const [overallElapsedSeconds, setOverallElapsedSeconds] = useState<number>(0);

  // Assigned Locations & Active Location
  const [assignedLocations, setAssignedLocations] = useState<any[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [isConfirmClockOutOpen, setIsConfirmClockOutOpen] = useState<boolean>(false);
  const [extraWorksites, setExtraWorksites] = useState<SupervisorWorksite[]>([]);
  const [alertBanner, setAlertBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // GPS Coordinates (Non-blocking supplementary evidence)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // 1. Capture Optional GPS in Background
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
      },
      (err) => {
        console.warn('GPS check note:', err.message);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  }, []);

  // Fetch master worksites list as supplementary fallback to guarantee all site options are visible
  useEffect(() => {
    apiRequest<any>('/worksites')
      .then((res) => {
        const raw = Array.isArray(res) ? res : res?.data || [];
        if (raw.length > 0) {
          const mapped: SupervisorWorksite[] = raw
            .filter((s: any) => s.isActive !== false)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              code: s.code || 'SITE',
              address: s.address || '',
              radiusMeters: Number(s.radiusMeters || 30),
              latitude: s.latitude,
              longitude: s.longitude,
            }));
          setExtraWorksites(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Authoritative Active Session Fetch
  const fetchActiveSession = useCallback(async () => {
    try {
      const todayStr = getLocalTodayDateString();
      const data = await apiRequest<any>(`/attendance/supervisor/active-session?date=${todayStr}`).catch(
        () => null
      );

      if (data && data.hasSession && data.session) {
        setSessionId(data.session.id);
        const s = data.session;
        setRawClockInTime(s.clockInTime);
        setRawClockOutTime(s.clockOutTime);

        if (s.clockInTime) {
          setClockInTime(
            new Date(s.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
        }

        if (s.clockOutTime) {
          setShiftStatus('SHIFT_DONE');
          setClockOutTime(
            new Date(s.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
          const totalSecs = s.totalDurationSeconds || 0;
          setTotalShiftStr(formatDuration(totalSecs));
          setOverallElapsedSeconds(totalSecs);
        } else {
          setShiftStatus('WORKING');
          setClockOutTime(null);
          const elapsed = Math.max(0, Math.floor((Date.now() - new Date(s.clockInTime).getTime()) / 1000));
          setOverallElapsedSeconds(elapsed);
        }
      } else {
        setShiftStatus('NOT_CLOCKED_IN');
        setSessionId(null);
        setClockInTime(null);
        setClockOutTime(null);
        setRawClockInTime(null);
        setRawClockOutTime(null);
        setOverallElapsedSeconds(0);
      }

      if (data && Array.isArray(data.assignedLocations)) {
        setAssignedLocations(data.assignedLocations);
      }
    } catch (err) {
      console.warn('Could not fetch supervisor active session:', err);
    }
  }, []);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  // 3. Live Timer when WORKING
  useEffect(() => {
    if (shiftStatus !== 'WORKING' || !rawClockInTime) return;

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const inMs = new Date(rawClockInTime).getTime();
      if (!isNaN(inMs)) {
        setOverallElapsedSeconds(Math.max(0, Math.floor((nowMs - inMs) / 1000)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [shiftStatus, rawClockInTime]);

  // Combined worksite options guaranteed to be comprehensive & visible
  const allWorksites = useMemo(() => {
    const list = [...worksites];
    extraWorksites.forEach((w) => {
      if (!list.some((existing) => existing.id === w.id)) {
        list.push(w);
      }
    });
    assignedLocations.forEach((loc) => {
      if (!list.some((w) => w.id === loc.id)) {
        list.push({
          id: loc.id,
          name: loc.name,
          code: loc.code || 'SITE',
          address: loc.address || '',
          radiusMeters: loc.radiusMeters || 30,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      }
    });
    return list;
  }, [worksites, extraWorksites, assignedLocations]);

  // 4. Clock In Handler
  const handleClockIn = async () => {
    setIsSubmitting(true);
    setAlertBanner(null);
    try {
      const payload = {
        worksiteId: selectedWorksite?.id || undefined,
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
        message: res.message || `Clocked in at ${selectedWorksite?.name || 'site'}. Auto-approved.`,
      });

      await fetchActiveSession();
      if (onClockInSuccess) onClockInSuccess();
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

  // 5. Clock Out Execution
  const executeClockOut = async () => {
    setIsSubmitting(true);
    setAlertBanner(null);
    try {
      const payload = {
        sessionId: sessionId || undefined,
        latitude: userCoords?.lat ?? null,
        longitude: userCoords?.lng ?? null,
        reportedAccuracyMeters: gpsAccuracy != null && gpsAccuracy >= 0 ? gpsAccuracy : null,
        clientDeviceInfo: navigator.userAgent,
      };

      const res = await apiRequest<any>('/attendance/supervisor/clock-out', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAlertBanner({
        type: 'success',
        message: res.message || 'Shift clocked out and auto-approved.',
      });

      setIsConfirmClockOutOpen(false);
      await fetchActiveSession();
      if (onClockInSuccess) onClockInSuccess();
    } catch (err: any) {
      console.error('Supervisor clock-out error:', err);
      setAlertBanner({
        type: 'error',
        message: err.message || 'Failed to clock out. Please try again.',
      });
      setIsConfirmClockOutOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = () => {
    setIsConfirmClockOutOpen(true);
  };

  // 6. Change Location Handler
  const handleChangeLocation = async (worksite: SupervisorWorksite) => {
    setShowLocationPicker(false);
    onSelectWorksite(worksite);

    // If currently clocked in, also update live server location visit
    if (shiftStatus === 'WORKING') {
      setIsSubmitting(true);
      try {
        const payload = {
          destinationLocationId: worksite.id,
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

        setAlertBanner({
          type: 'success',
          message: res.message || `Switched active working location to ${worksite.name}.`,
        });

        await fetchActiveSession();
      } catch (err: any) {
        console.error('Location switch error:', err);
        setAlertBanner({
          type: 'error',
          message: err.message || 'Failed to switch working location session.',
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const isWorking = shiftStatus === 'WORKING';
  const isShiftDone = shiftStatus === 'SHIFT_DONE';

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Alert Banner if any */}
      {alertBanner && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-2xs ${
            alertBanner.type === 'success'
              ? 'bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/30'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#12A66A] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{alertBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertBanner(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MAIN CARD EXACTLY AS REFERENCED IN IMAGE ── */}
      <div className="relative bg-gradient-to-br from-[#12A66A] to-[#0E8F5B] text-white p-6 rounded-[22px] shadow-[0_12px_28px_-6px_rgba(18,166,106,0.4)] space-y-4">
        {/* Decorative SVG background curve clipped safely to rounded corners without clipping popups */}
        <div className="absolute inset-0 rounded-[22px] overflow-hidden pointer-events-none">
          <div className="absolute right-0 bottom-0 opacity-20">
            <svg width="220" height="120" viewBox="0 0 220 120" fill="none">
              <path
                d="M0 80 C 40 80, 60 20, 110 50 C 160 80, 180 10, 220 30 L 220 120 L 0 120 Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>
        </div>

        {/* ── Top Row: Status label + Date badge ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
              {isWorking ? (
                <PlayCircle className="w-5 h-5 text-white" />
              ) : isShiftDone ? (
                <ShieldCheck className="w-5 h-5 text-white" />
              ) : (
                <Clock className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/90 block leading-tight">
                {isWorking
                  ? `WORKING SINCE ${clockInTime || '--:--'}`
                  : isShiftDone
                  ? 'SHIFT COMPLETED TODAY'
                  : 'READY TO CLOCK IN'}
              </span>
              <span className="text-[11px] text-white/75 block">
                {isWorking
                  ? 'Live running shift timer'
                  : isShiftDone
                  ? 'Attendance recorded successfully'
                  : 'Supervisor Auto-Approval Policy'}
              </span>
            </div>
          </div>

          <div className="rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-[#12A66A] bg-white px-3.5 py-1.5 rounded-full shadow-xs">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* ── Middle: Large Timer Display & Quick Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-white drop-shadow-sm">
              {isWorking
                ? formatDuration(overallElapsedSeconds)
                : isShiftDone
                ? totalShiftStr
                : '00:00:00'}
            </div>

            {/* Sub-label */}
            <span className="text-[11px] text-white/80 font-medium mt-1 block">
              {isWorking
                ? '✓ Verified on-site GPS coordinates active'
                : isShiftDone
                ? `✓ Finalized at ${clockOutTime || '--:--'} • Auto-approved`
                : '✓ Instant 1-click punch • Auto-approved'}
            </span>
          </div>

          {/* Action Punch Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 relative z-10">
            {shiftStatus === 'NOT_CLOCKED_IN' && (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={isSubmitting}
                className="px-6 py-3 bg-white hover:bg-emerald-50 text-[#0E8F5B] rounded-2xl font-black text-sm shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0E8F5B]" />
                ) : (
                  <Clock className="w-4 h-4 stroke-[2.5] text-[#0E8F5B]" />
                )}
                <span>Clock In Now</span>
              </button>
            )}

            {shiftStatus === 'WORKING' && (
              <button
                type="button"
                onClick={handleClockOut}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-[0_4px_16px_rgba(225,29,72,0.35)] transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2 border border-rose-500"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <LogOut className="w-4 h-4 text-white" />
                )}
                <span>Clock Out</span>
              </button>
            )}

            {shiftStatus === 'SHIFT_DONE' && (
              <div className="px-4 py-2 bg-white/20 backdrop-blur-xs text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 border border-white/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Shift Done</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom: Location strip (with inline location changer) ── */}
        <div className="pt-3 border-t border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs relative z-10">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase text-white block tracking-wide">
                {selectedWorksite ? selectedWorksite.name : 'NO LOCATION ASSIGNED'}
              </span>
              <span className="text-[11px] text-white/75 block">
                {selectedWorksite?.address || selectedWorksite?.code || 'Assigned Worksite'}
              </span>
            </div>
          </div>

          {/* Change Location Button & Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-white/90" />
              <span>Change Location</span>
              <ChevronDown className="w-3 h-3 text-white/80" />
            </button>

            {/* Dropdown Menu - positioned visibly above button with high z-index and elevation */}
            {showLocationPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLocationPicker(false)}
                />
                <div className="absolute right-0 bottom-full mb-2 w-72 sm:w-80 bg-white text-slate-900 rounded-2xl shadow-2xl border border-[#E8EEF4] p-2 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Switch Worksite
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isWorking
                        ? 'Select new site to record location switch'
                        : 'Choose where you are clocking in today'}
                    </p>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 py-1">
                    {allWorksites.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-400 text-center">
                        No assigned worksites available
                      </p>
                    ) : (
                      allWorksites.map((ws) => {
                        const isCurrent = ws.id === selectedWorksite?.id;
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => handleChangeLocation(ws)}
                            className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-start justify-between gap-2 cursor-pointer ${
                              isCurrent
                                ? 'bg-[#E6F7EF] text-[#0E8F5B] font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold truncate block">{ws.name}</span>
                                {ws.code && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 bg-white rounded border border-slate-200 text-slate-500 shrink-0">
                                    {ws.code}
                                  </span>
                                )}
                              </div>
                              {ws.address && (
                                <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                                  {ws.address}
                                </span>
                              )}
                            </div>
                            {isCurrent && (
                              <CheckCircle2 className="w-4 h-4 text-[#12A66A] shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Shadcn Confirmation Dialog for Clock Out */}
      <AlertDialog open={isConfirmClockOutOpen} onOpenChange={setIsConfirmClockOutOpen}>
        <AlertDialogContent className="sm:max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
          <AlertDialogHeader className="text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
              <LogOut className="w-6 h-6 stroke-[2.2]" />
            </div>
            <AlertDialogTitle className="text-lg font-black text-slate-900 tracking-tight">
              End Shift & Clock Out?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-1">
              Are you sure you want to end your shift and clock out for today? Your total shift duration will be recorded and auto-approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={executeClockOut}
              disabled={isSubmitting}
              className="rounded-xl px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 shadow-sm cursor-pointer border border-rose-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Clocking Out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 text-white" />
                  <span>Clock Out</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { SupervisorWorksite } from '../../types/supervisor';
import { apiRequest } from '../../lib/api';
import {
  CheckCircleIcon,
  ErrorProfileIcon,
  CheckIcon,
  Building1Icon,
  RotateCwIcon,
  ArrowExchangeIcon,
  TransactionHistoryIcon,
  CloseIcon,
} from '@astraicons/react/linear';
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

export const SupervisorPersonalAttendance: React.FC<SupervisorPersonalAttendanceProps> = () => {

  // Shift & Attendance states
  const [shiftStatus, setShiftStatus] = useState<'NOT_CLOCKED_IN' | 'WORKING' | 'SHIFT_DONE'>('NOT_CLOCKED_IN');
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  // Switching Modal State
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState<boolean>(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Optional GPS tracking (Non-blocking supplementary evidence)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Success / info alert banner
  const [alertBanner, setAlertBanner] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Live timer for active location
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
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
      },
      (err) => {
        console.warn('Supervisor GPS optional check note:', err.message);
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

        if (s.clockOutTime) {
          setShiftStatus('SHIFT_DONE');
          setActiveLocation(null);
        } else {
          setShiftStatus('WORKING');
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
      } else {
        setShiftStatus('NOT_CLOCKED_IN');
        setSessionId(null);
        setActiveLocation(null);
        setLocationVisits([]);
        setLocationTotals([]);
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

  // 3. Live Timer for Active Location
  useEffect(() => {
    if (shiftStatus !== 'WORKING' || !activeLocation?.startedAt) return;

    const interval = setInterval(() => {
      const locMs = new Date(activeLocation.startedAt).getTime();
      if (!isNaN(locMs)) {
        setLocationElapsedSeconds(Math.max(0, Math.floor((Date.now() - locMs) / 1000)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [shiftStatus, activeLocation?.startedAt]);

  // 4. Supervisor Location Switch Action
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
            <CheckCircleIcon className="w-5 h-5 text-[#12A66A] shrink-0 mt-0.5" />
          ) : (
            <ErrorProfileIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
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
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoadingSession && locationTotals.length === 0 && (
        <div className="py-12 text-center flex flex-col items-center justify-center gap-2.5 text-slate-400">
          <RotateCwIcon className="w-6 h-6 text-[#12A66A] animate-spin" />
          <span className="text-xs font-semibold">Loading location sessions...</span>
        </div>
      )}

      {/* ── LOCATION TIME BREAKDOWN & VISIT TIMELINE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card A: Aggregated Duration Per Location */}
        <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Building1Icon className="w-4 h-4 text-[#12A66A]" />
                <span>Aggregated Time Per Location</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Total hours spent at each assigned location across all visits today
              </p>
            </div>
            <div className="flex items-center gap-3">
              {shiftStatus === 'WORKING' && assignedLocations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSwitchError(null);
                    setIsSwitchModalOpen(true);
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-[#E6F7EF] hover:bg-[#12A66A] text-[#0E8F5B] hover:text-white border border-[#12A66A]/30 rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowExchangeIcon className="w-3.5 h-3.5" />
                  <span>Switch Location</span>
                </button>
              )}
              <span className="text-xs font-bold text-slate-400">
                {locationTotals.length} location{locationTotals.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {locationTotals.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Building1Icon className="w-8 h-8 text-slate-300 stroke-1" />
              <span>No location sessions recorded yet today.</span>
              {shiftStatus === 'WORKING' && assignedLocations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSwitchError(null);
                    setIsSwitchModalOpen(true);
                  }}
                  className="mt-2 px-3.5 py-2 bg-[#12A66A] text-white rounded-xl text-xs font-bold hover:bg-[#0E8F5B] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowExchangeIcon className="w-3.5 h-3.5" />
                  <span>Select Working Location</span>
                </button>
              )}
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
                      <Building1Icon className="w-4 h-4" />
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
                <TransactionHistoryIcon className="w-4 h-4 text-[#12A66A]" />
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
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <TransactionHistoryIcon className="w-8 h-8 text-slate-300 stroke-1" />
              <span>No visits recorded yet.</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
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

      {/* ── LOCATION SWITCH MODAL ── */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E8EEF4] rounded-[24px] max-w-md w-full p-6 shadow-xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0">
                  <ArrowExchangeIcon className="w-5 h-5" />
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
                <CloseIcon className="w-5 h-5" />
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
                        <Building1Icon
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
                        <CheckIcon className="w-4 h-4 text-[#12A66A]" />
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
                {isSubmitting ? <RotateCwIcon className="w-4 h-4 animate-spin" /> : <ArrowExchangeIcon className="w-4 h-4" />}
                <span>Confirm Switch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPERVISOR ATTENDANCE & LEAVE CALENDAR ── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-4 sm:p-5 shadow-xs">
        <WorkerAttendanceView hideOvertimeCard={true} />
      </div>
    </div>
  );
};

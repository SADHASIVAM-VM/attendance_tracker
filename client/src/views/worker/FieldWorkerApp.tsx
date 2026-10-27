import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, uploadPhotoRequest } from '../../lib/api';
import { calculateHaversineDistance } from '../../lib/geo';
import { TRANSLATIONS } from '../../lib/translations';
import { toast } from '../../context/ToastContext';
import {
  WorkerStatus,
  LanguageCode,
  Worksite,
  AttendanceRecordItem,
  OfflineAction,
} from '../../types/fieldWorker';

// Views & Components
import { WorkerAttendanceView } from './WorkerAttendanceView';
import { WorkerLeaveView } from './WorkerLeaveView';
import { StatusHeroCard } from '../../components/field/StatusHeroCard';
import { LocationCheckCard } from '../../components/field/LocationCheckCard';
import { CameraScreen } from '../../components/field/CameraScreen';
import { PrimaryActionButton } from '../../components/field/PrimaryActionButton';
import { OfflineBanner } from '../../components/field/OfflineBanner';
import { EdgeStateDrawer, EdgeStateControls } from '../../components/field/EdgeStateDrawer';
import { HistoryRow } from '../../components/field/HistoryRow';
import { PermissionGate } from '../../components/field/PermissionGate';

import {
  Clock,
  CalendarDays,
  Palmtree,
  User,
  Sun,
  Sliders,
  LogOut,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  WifiOff,
} from 'lucide-react';

export const FieldWorkerApp: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from current route path
  const activeTab: 'clock-in' | 'attendance' | 'leaves' | 'profile' = useMemo(() => {
    const p = location.pathname.toLowerCase();
    if (p.includes('/attendance')) return 'attendance';
    if (p.includes('/leaves')) return 'leaves';
    if (p.includes('/profile')) return 'profile';
    return 'clock-in';
  }, [location.pathname]);

  const handleTabClick = (tab: 'clock-in' | 'attendance' | 'leaves' | 'profile') => {
    navigate(`/worker/${tab}`);
  };

  // Preferences & Accessibility
  const [language, setLanguage] = useState<LanguageCode>(() => {
    return (localStorage.getItem('worker_language') as LanguageCode) || 'en';
  });
  const [isSunlightMode, setIsSunlightMode] = useState<boolean>(() => {
    return localStorage.getItem('worker_sunlight_mode') === 'true';
  });

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Assignments & Worksite data
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState<boolean>(true);

  // Today's attendance session & history
  const [todaySession, setTodaySession] = useState<any | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecordItem[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(false);

  // GPS Geolocation state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isSimulatingLocation, setIsSimulatingLocation] = useState<boolean>(false);

  // Permission gate: true once camera AND location are both granted
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);

  // Camera & submission state
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState<boolean>(false);

  // Offline & Edge state simulation
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => {
    try {
      const saved = localStorage.getItem('worker_offline_punches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // Edge state testing drawer
  const [showEdgeDrawer, setShowEdgeDrawer] = useState<boolean>(false);
  const [edgeControls, setEdgeControls] = useState<EdgeStateControls>({
    mockGpsDenied: false,
    mockCameraDenied: false,
    mockOffline: false,
    mockOutsideLocation: false,
    mockStatusOverride: 'DEFAULT',
  });

  // Persist language
  const handleLanguageChange = (lang: LanguageCode) => {
    setLanguage(lang);
    localStorage.setItem('worker_language', lang);
  };

  // Toggle sunlight mode
  const handleToggleSunlight = () => {
    setIsSunlightMode((prev) => {
      const next = !prev;
      localStorage.setItem('worker_sunlight_mode', String(next));
      return next;
    });
  };

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save offline queue
  useEffect(() => {
    try {
      localStorage.setItem('worker_offline_punches', JSON.stringify(offlineQueue));
    } catch {
      // ignore
    }
  }, [offlineQueue]);

  // Load today's assignments
  const loadAssignments = useCallback(async () => {
    try {
      setIsLoadingAssignments(true);
      const data = await apiRequest<any[]>('/workers/me/assignments');
      if (Array.isArray(data)) {
        setAssignments(data);
        if (data.length > 0) {
          setSelectedAssignment(data[0]);
        }
      }
    } catch (err: any) {
      console.warn('Could not load worker assignments:', err.message);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, []);

  // Load worker attendance records
  const loadMyAttendance = useCallback(async () => {
    try {
      setIsLoadingAttendance(true);
      const records = await apiRequest<any[]>('/attendance/me');
      if (Array.isArray(records)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const currentToday = records.find(
          (r: any) => String(r.workDate).split('T')[0] === todayStr
        );
        if (currentToday) {
          setTodaySession(currentToday);
        }

        // Map into AttendanceRecordItem
        const formatted: AttendanceRecordItem[] = records.map((r: any) => ({
          id: r.id,
          workDate: String(r.workDate).split('T')[0],
          clockInTime: r.clockInTime
            ? new Date(r.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--:--',
          clockOutTime: r.clockOutTime
            ? new Date(r.clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null,
          worksiteName: r.worksiteName || 'Assigned Site',
          worksiteAddress: r.worksiteCode || '',
          status: r.status || 'APPROVED',
          inPhotoUrl: r.photoUrl || '',
          isOfflineSynced: Boolean(r.isOfflineSynced),
        }));
        setAttendanceHistory(formatted);
      }
    } catch (err) {
      console.warn('Could not load attendance:', err);
    } finally {
      setIsLoadingAttendance(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
    loadMyAttendance();
  }, [loadAssignments, loadMyAttendance]);

  // Normal worksite representation
  // IMPORTANT: Never silently fall back to 0 for coordinates — invalid coords
  // cause the map to display a random ocean location near 0°N 0°E.
  const activeWorksite: Worksite | null = useMemo(() => {
    if (!selectedAssignment) return null;

    const rawLat = Number(selectedAssignment.worksiteLatitude);
    const rawLng = Number(selectedAssignment.worksiteLongitude);

    // Validate before using – reject NaN, out-of-range, or exact 0,0 placeholder
    const validLat = isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 && rawLat !== 0;
    const validLng = isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 && rawLng !== 0;

    return {
      id: selectedAssignment.worksiteId || selectedAssignment.id,
      name: selectedAssignment.worksiteName || 'Assigned Worksite',
      code: selectedAssignment.worksiteCode || 'SITE',
      address: selectedAssignment.worksiteAddress || 'Works Location',
      // Use NaN if invalid so downstream code can detect and display an error
      latitude: validLat ? rawLat : NaN,
      longitude: validLng ? rawLng : NaN,
      radiusMeters: Number(selectedAssignment.worksiteRadius) || 50,
      maxAccuracyMeters: Number(selectedAssignment.worksiteMaxAccuracy) || 100,
    };
  }, [selectedAssignment]);

  // GPS Acquisition
  useEffect(() => {
    if (edgeControls.mockGpsDenied) {
      setGpsError(t.noGpsError);
      setUserCoords(null);
      return;
    }

    if (isSimulatingLocation || edgeControls.mockOutsideLocation) {
      if (activeWorksite) {
        if (edgeControls.mockOutsideLocation) {
          // Off by ~3km
          setUserCoords({
            lat: activeWorksite.latitude + 0.025,
            lng: activeWorksite.longitude + 0.025,
            accuracy: 8,
          });
        } else {
          // Exact site coords with 5m accuracy
          setUserCoords({
            lat: activeWorksite.latitude,
            lng: activeWorksite.longitude,
            accuracy: 5,
          });
        }
        setGpsError(null);
      }
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser device.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        // Validate coordinates strictly before storing – reject NaN/out-of-range
        if (
          isFinite(lat) && lat >= -90 && lat <= 90 &&
          isFinite(lng) && lng >= -180 && lng <= 180
        ) {
          setUserCoords({ lat, lng, accuracy });
          setGpsError(null);
        } else {
          setGpsError('Received invalid GPS coordinates. Please retry in an open area.');
        }
      },
      (err) => {
        setGpsError(`${err.message}. Please enable GPS location permission.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isSimulatingLocation, edgeControls.mockGpsDenied, edgeControls.mockOutsideLocation, activeWorksite, t.noGpsError]);

  // Distance computation – only run when all coords are valid (no NaN)
  useEffect(() => {
    if (
      userCoords &&
      activeWorksite &&
      isFinite(activeWorksite.latitude) &&
      isFinite(activeWorksite.longitude)
    ) {
      const dist = calculateHaversineDistance(
        userCoords.lat,
        userCoords.lng,
        activeWorksite.latitude,
        activeWorksite.longitude
      );
      setDistanceMeters(Math.round(dist));
    } else {
      setDistanceMeters(null);
    }
  }, [userCoords, activeWorksite]);

  // Compute status
  const effectiveStatus: WorkerStatus = useMemo(() => {
    if (edgeControls.mockStatusOverride !== 'DEFAULT') {
      return edgeControls.mockStatusOverride as WorkerStatus;
    }
    if (todaySession?.clockOutTime) {
      return 'SHIFT_DONE';
    }
    if (todaySession?.clockInTime) {
      return 'WORKING';
    }
    return 'NOT_CLOCKED_IN';
  }, [edgeControls.mockStatusOverride, todaySession]);

  // Is worker within geofence radius
  const isInsideGeofence = useMemo(() => {
    if (!activeWorksite || distanceMeters === null) return false;
    return distanceMeters <= activeWorksite.radiusMeters;
  }, [activeWorksite, distanceMeters]);

  // Is GPS accuracy acceptable
  const isAccuracyAcceptable = useMemo(() => {
    if (!activeWorksite || !userCoords) return false;
    return userCoords.accuracy <= activeWorksite.maxAccuracyMeters;
  }, [activeWorksite, userCoords]);

  // Clock in selfie trigger
  const handleStartClockIn = () => {
    if (effectiveStatus !== 'NOT_CLOCKED_IN') return;

    if (!activeWorksite) {
      toast.error('No worksite assignment found for today. Please contact your supervisor.');
      return;
    }

    if (!isInsideGeofence && !isSimulatingLocation) {
      toast.warning(
        `Outside geofence! You are ${distanceMeters}m away (max radius: ${activeWorksite.radiusMeters}m). Please reach the site to punch in.`,
        'Geofence Required'
      );
      return;
    }

    setCameraMode('CLOCK_IN');
    setShowCamera(true);
  };

  // Clock out selfie trigger
  const handleStartClockOut = () => {
    if (effectiveStatus !== 'WORKING') return;
    setCameraMode('CLOCK_OUT');
    setShowCamera(true);
  };

  // Selfie submission (handles both clock-in and clock-out)
  const handleCaptureSelfie = async (photoBlob: Blob, dataUrl: string) => {
    setShowCamera(false);
    setIsSubmitting(true);

    try {
      const effectiveOffline = isOffline || edgeControls.mockOffline;

      if (cameraMode === 'CLOCK_OUT') {
        // CLOCK OUT FLOW
        if (effectiveOffline) {
          const offlineAction: OfflineAction = {
            id: `off_out_${Date.now()}`,
            type: 'CLOCK_OUT',
            timestamp: new Date().toISOString(),
            worksiteId: activeWorksite?.id || '',
            latitude: userCoords?.lat || 0,
            longitude: userCoords?.lng || 0,
            accuracy: userCoords?.accuracy || 10,
            photoDataUrl: dataUrl,
            synced: false,
          };

          setOfflineQueue((prev) => [...prev, offlineAction]);
          setTodaySession((prev: any) => ({
            ...prev,
            clockOutTime: offlineAction.timestamp,
          }));

          toast.info(
            'Clock-out selfie saved offline. Will sync once your connection is restored.',
            'Saved Offline'
          );
          return;
        }

        // 1. Request short-lived photo upload auth
        const uploadAuth = await apiRequest('/attendance/photo-upload-auth', { method: 'POST' });

        // 2. Upload photo securely
        const uploadResult = await uploadPhotoRequest(photoBlob, uploadAuth);

        // 3. Submit clock-out with selfie photoObjectKey
        const sessionId = todaySession?.id || 'current';
        const payload = {
          latitude: userCoords?.lat || activeWorksite?.latitude,
          longitude: userCoords?.lng || activeWorksite?.longitude,
          reportedAccuracyMeters: userCoords?.accuracy || 5,
          photoObjectKey: uploadResult.photoObjectKey,
          clientDeviceInfo: `${navigator.userAgent} [FreshCart Field Portal]`,
        };

        await apiRequest(`/attendance/${sessionId}/clock-out`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        toast.success(t.clockOutSuccess, 'Shift Finished');
        await loadMyAttendance();
        return;
      }

      // CLOCK IN FLOW
      if (effectiveOffline) {
        // Offline punch storage
        const offlineAction: OfflineAction = {
          id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'CLOCK_IN',
          timestamp: new Date().toISOString(),
          worksiteId: activeWorksite?.id || '',
          latitude: userCoords?.lat || 0,
          longitude: userCoords?.lng || 0,
          accuracy: userCoords?.accuracy || 10,
          photoDataUrl: dataUrl,
          synced: false,
        };

        setOfflineQueue((prev) => [...prev, offlineAction]);
        setTodaySession({
          id: offlineAction.id,
          workDate: new Date().toISOString().split('T')[0],
          clockInTime: offlineAction.timestamp,
          status: 'PENDING',
          isOfflineSynced: true,
          worksiteName: activeWorksite?.name || 'Assigned Site',
        });

        toast.info(
          'Clock-in saved locally on phone. It will automatically upload when network is available.',
          'Saved Offline'
        );
        return;
      }

      // Online submission
      // 1. Request short-lived photo upload auth
      const uploadAuth = await apiRequest('/attendance/photo-upload-auth', { method: 'POST' });

      // 2. Upload photo securely
      const uploadResult = await uploadPhotoRequest(photoBlob, uploadAuth);

      // 3. Submit clock-in with geo coordinates and idempotency key
      const idempotencyKey = `clk_${user?.id}_${selectedAssignment?.id || 'site'}_${Date.now()}`;
      const payload = {
        assignmentId: selectedAssignment?.id,
        worksiteId: activeWorksite?.id,
        latitude: userCoords?.lat || activeWorksite?.latitude || 0,
        longitude: userCoords?.lng || activeWorksite?.longitude || 0,
        reportedAccuracyMeters: userCoords?.accuracy || 5,
        photoObjectKey: uploadResult.photoObjectKey,
        idempotencyKey,
        clientDeviceInfo: `${navigator.userAgent} [FreshCart Field Portal]`,
      };

      const res = await apiRequest('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(res.message || t.clockInSuccess, 'Shift Started');
      setTodaySession(res.session);
      await loadMyAttendance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit attendance selfie. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync offline queue
  const handleSyncOffline = async () => {
    if (offlineQueue.length === 0 || isOffline) return;
    setIsSyncingOffline(true);

    let syncedCount = 0;
    const remaining: OfflineAction[] = [];

    for (const item of offlineQueue) {
      try {
        if (item.type === 'CLOCK_IN') {
          // If we have photoDataUrl, turn it into Blob
          let photoBlob: Blob | null = null;
          if (item.photoDataUrl && item.photoDataUrl.startsWith('data:')) {
            const resBlob = await fetch(item.photoDataUrl).then((r) => r.blob());
            photoBlob = resBlob;
          }

          let photoObjectKey = 'offline_placeholder_key';
          if (photoBlob) {
            const uploadAuth = await apiRequest('/attendance/photo-upload-auth', { method: 'POST' });
            const uploadRes = await uploadPhotoRequest(photoBlob, uploadAuth);
            photoObjectKey = uploadRes.photoObjectKey;
          }

          await apiRequest('/attendance/clock-in', {
            method: 'POST',
            body: JSON.stringify({
              assignmentId: selectedAssignment?.id,
              worksiteId: item.worksiteId,
              latitude: item.latitude,
              longitude: item.longitude,
              reportedAccuracyMeters: item.accuracy,
              photoObjectKey,
              idempotencyKey: item.id,
              clientDeviceInfo: 'Offline Sync Queue',
            }),
          });
          syncedCount++;
        } else if (item.type === 'CLOCK_OUT') {
          await apiRequest('/attendance/current/clock-out', {
            method: 'POST',
            body: JSON.stringify({
              latitude: item.latitude,
              longitude: item.longitude,
              reportedAccuracyMeters: item.accuracy,
              clientDeviceInfo: 'Offline Sync Queue',
            }),
          });
          syncedCount++;
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    setOfflineQueue(remaining);
    setIsSyncingOffline(false);

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline record(s) to server successfully!`);
      await loadMyAttendance();
    }
  };

  // High contrast mode container styles
  const sunlightClass = isSunlightMode
    ? 'contrast-125 bg-black text-white select-none'
    : 'bg-[#F8FAFC] text-[#111827]';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 pb-20 ${sunlightClass}`}>
      {/* ─── 1. TOP HEADER APP BAR ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8EEF4] px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          {/* Worker Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <img
                src={
                  user?.photoUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user?.fullName || 'Worker'
                  )}&background=12A66A&color=fff&bold=true`
                }
                alt={user?.fullName || 'Worker'}
                className="w-10 h-10 rounded-2xl object-cover border-2 border-[#12A66A]/20 shadow-xs"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  effectiveStatus === 'WORKING'
                    ? 'bg-[#12A66A]'
                    : effectiveStatus === 'SHIFT_DONE'
                    ? 'bg-[#3B82F6]'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold text-[#111827] truncate leading-tight">
                  {user?.fullName || 'Field Worker'}
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E6F7EF] text-[#0E8F5B] shrink-0 uppercase tracking-wider">
                  Field
                </span>
              </div>
              <p className="text-xs text-[#64748B] truncate flex items-center gap-1 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#12A66A] shrink-0" />
                <span>{activeWorksite ? activeWorksite.name : 'No active site assigned'}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions (Find Worksite, Sunlight, Edge Drawer, Sign Out) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Find My Worksite button */}
            <button
              type="button"
              id="find-my-worksite-btn"
              aria-label="Find My Worksite"
              title={activeWorksite ? `Navigate to ${activeWorksite.name}` : 'No worksite assigned'}
              disabled={!activeWorksite}
              onClick={() => {
                if (!activeWorksite) return;
                const lat = activeWorksite.latitude;
                const lng = activeWorksite.longitude;
                const origin = userCoords
                  ? `&origin=${userCoords.lat},${userCoords.lng}`
                  : '';
                const url = isFinite(lat) && isFinite(lng)
                  ? `https://www.google.com/maps/dir/?api=1${origin}&destination=${lat},${lng}&travelmode=walking`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeWorksite.name)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeWorksite
                  ? 'bg-[#E6F7EF] hover:bg-[#C3F2DD] text-[#0E8F5B]'
                  : 'bg-[#F1F5F9] text-slate-300 cursor-not-allowed'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </button>

            {/* Sunlight Mode Toggle */}
            <button
              type="button"
              onClick={handleToggleSunlight}
              aria-label="Toggle Sunlight Mode"
              title={isSunlightMode ? t.standardMode : t.sunlightMode}
              className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSunlightMode
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                  : 'bg-[#F1F5F9] text-slate-700 hover:bg-[#E2E8F0]'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>

            {/* Simulation Edge States Drawer */}
            <button
              type="button"
              onClick={() => setShowEdgeDrawer(true)}
              aria-label="Open Edge State Simulator"
              title="Test edge states (GPS, camera, offline)"
              className="p-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-[#12A66A]" />
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Logout"
              title="Sign Out"
              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. MAIN CONTENT AREA (Based on active tab) ────────────────── */}
      <main className="max-w-3xl mx-auto w-full px-4 pt-4 pb-6 space-y-4">
        {/* Offline Banner if disconnected or items in queue */}
        <OfflineBanner
          isOffline={isOffline || edgeControls.mockOffline}
          pendingCount={offlineQueue.length}
          onSyncNow={handleSyncOffline}
          isSyncing={isSyncingOffline}
          language={language}
        />

        {/* TAB 1: CLOCK-IN / PUNCH HOME */}
        {activeTab === 'clock-in' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Permission Gate: shown as overlay if permissions not yet granted */}
            {!edgeControls.mockGpsDenied && !edgeControls.mockCameraDenied && (
              <PermissionGate
                simulateGranted={isSimulatingLocation || permissionsGranted}
                onAllGranted={(coords) => {
                  setPermissionsGranted(true);
                  // Seed the GPS state with the coords obtained during permission check
                  if (!userCoords) {
                    setUserCoords({
                      lat: coords.lat,
                      lng: coords.lng,
                      accuracy: coords.accuracy,
                    });
                  }
                }}
              />
            )}

            {/* Status Hero Card */}
            <StatusHeroCard
              status={effectiveStatus}
              clockInTime={
                todaySession?.clockInTime
                  ? new Date(todaySession.clockInTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
              }
              clockOutTime={
                todaySession?.clockOutTime
                  ? new Date(todaySession.clockOutTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
              }
              worksite={activeWorksite}
              language={language}
              rawClockInTime={todaySession?.clockInTime}
              rawClockOutTime={todaySession?.clockOutTime}
            />

            {/* Location Check Card */}
            <LocationCheckCard
              worksite={activeWorksite}
              distanceMeters={distanceMeters}
              accuracyMeters={userCoords?.accuracy || null}
              gpsError={gpsError}
              userCoords={userCoords}
              language={language}
              isSimulatingLocation={isSimulatingLocation}
              onToggleSimulateLocation={setIsSimulatingLocation}
            />

            {/* Primary Action Button (Big punch action) */}
            <div className="pt-2">
              {effectiveStatus === 'NOT_CLOCKED_IN' && (
                <PrimaryActionButton
                  label={t.clockIn}
                  subLabel={
                    !permissionsGranted && !isSimulatingLocation
                      ? 'Camera & GPS permissions required'
                      : isInsideGeofence || isSimulatingLocation
                      ? 'Selfie required • Coordinates verified'
                      : 'Step within worksite radius to activate punch'
                  }
                  icon={Clock}
                  variant="safety-green"
                  isLoading={isSubmitting}
                  disabled={
                    !activeWorksite ||
                    (!isInsideGeofence && !isSimulatingLocation) ||
                    (!permissionsGranted && !isSimulatingLocation)
                  }
                  onClick={handleStartClockIn}
                />
              )}

              {effectiveStatus === 'WORKING' && (
                <PrimaryActionButton
                  label={t.clockOut}
                  subLabel="End shift • Selfie verification required"
                  icon={LogOut}
                  variant="safety-red"
                  isLoading={isSubmitting}
                  onClick={handleStartClockOut}
                />
              )}

              {effectiveStatus === 'SHIFT_DONE' && (
                <div className="p-5 bg-[#E6F7EF] border-2 border-[#12A66A]/30 rounded-2xl flex items-center justify-between gap-3 text-[#0E8F5B]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#12A66A] text-white flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold uppercase tracking-wide">
                        {t.shiftDone}
                      </h4>
                      <p className="text-xs font-semibold text-[#0E8F5B]/80 mt-0.5">
                        Attendance recorded for today. Great work!
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-white rounded-full border border-[#12A66A]/30">
                    Done
                  </span>
                </div>
              )}
            </div>

            {/* Today's Shift & Supervisor Info strip */}
            {selectedAssignment && (
              <div className="bg-white border border-[#E8EEF4] rounded-2xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Assigned Shift
                  </span>
                  <span className="font-extrabold text-slate-800 mt-0.5 block">
                    {selectedAssignment.shiftName || 'General Shift'}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {selectedAssignment.shiftStartTime || '09:00'} –{' '}
                    {selectedAssignment.shiftEndTime || '18:00'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Supervisor
                  </span>
                  <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                    {selectedAssignment.supervisorName || 'Site Supervisor'}
                  </span>
                  <span className="text-slate-500 text-[11px] truncate block">
                    {selectedAssignment.supervisorEmail || 'Active'}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Geofence Radius
                  </span>
                  <span className="font-extrabold text-slate-800 mt-0.5 block">
                    {selectedAssignment.worksiteRadius || 50} meters
                  </span>
                  <span className="text-[#12A66A] font-semibold text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Strict Validation
                  </span>
                </div>
              </div>
            )}

            {/* Recent Attendance History snippet */}
            <div className="bg-white border border-[#E8EEF4] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#12A66A]" />
                  Recent Punches
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="text-xs font-bold text-[#12A66A] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  View Full Month
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {attendanceHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No previous attendance records recorded.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {attendanceHistory.slice(0, 3).map((rec) => (
                    <HistoryRow
                      key={rec.id}
                      record={rec}
                      language={language}
                      onSelect={() => setActiveTab('attendance')}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE CALENDAR & REGULARIZATION */}
        {activeTab === 'attendance' && (
          <div className="animate-in fade-in duration-200">
            <WorkerAttendanceView
              todayStatus={effectiveStatus}
              todayClockInTime={todaySession?.clockInTime}
              todayClockOutTime={todaySession?.clockOutTime}
              todayWorksite={activeWorksite}
              assignedShiftInfo={{
                shiftName: selectedAssignment?.shiftName,
                supervisorName: selectedAssignment?.supervisorName,
                shiftStartTime: selectedAssignment?.shiftStartTime,
                shiftEndTime: selectedAssignment?.shiftEndTime,
              }}
              onNavigateToday={() => handleTabClick('clock-in')}
            />
          </div>
        )}

        {/* TAB 3: LEAVES & LEAVE APPLICATION */}
        {activeTab === 'leaves' && (
          <div className="animate-in fade-in duration-200">
            <WorkerLeaveView />
          </div>
        )}

        {/* TAB 4: WORKER PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white border border-[#E8EEF4] rounded-2xl p-6 shadow-xs text-center space-y-3">
              <img
                src={
                  user?.photoUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user?.fullName || 'Worker'
                  )}&background=12A66A&color=fff&size=128&bold=true`
                }
                alt={user?.fullName || 'Worker'}
                className="w-20 h-20 rounded-3xl object-cover mx-auto border-4 border-[#E6F7EF] shadow-sm"
              />
              <div>
                <h2 className="text-lg font-black text-slate-900 leading-tight">
                  {user?.fullName || 'Field Worker'}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {user?.employeeCode ? `ID: ${user.employeeCode} • ` : ''}
                  {user?.employmentType || 'Field Operations'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-left">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Phone</span>
                  <span className="font-bold text-slate-800">{user?.phone || 'Not provided'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Email</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {user?.email || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* Preferences Card */}
            <div className="bg-white border border-[#E8EEF4] rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Portal Preferences
              </h3>

              {/* Language selection */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Portal Language</span>
                  <span className="text-[11px] text-slate-500">English, Tamil or Hindi</span>
                </div>
                <div className="flex items-center gap-1">
                  {(['en', 'ta', 'hi'] as LanguageCode[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleLanguageChange(code)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        language === code
                          ? 'bg-[#12A66A] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {code === 'en' ? 'EN' : code === 'ta' ? 'தமிழ்' : 'हिंदी'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sunlight High Contrast Mode */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Outdoor Sunlight Mode</span>
                  <span className="text-[11px] text-slate-500">
                    High contrast dark theme for direct outdoor sun
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSunlight}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                    isSunlightMode
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  {isSunlightMode ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Sign Out Action */}
            <button
              type="button"
              onClick={() => logout()}
              className="w-full p-4 rounded-2xl bg-rose-50 text-rose-700 font-extrabold text-sm border border-rose-200 hover:bg-rose-100 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of Field Portal
            </button>
          </div>
        )}
      </main>

      {/* ─── 3. MOBILE & DESKTOP STICKY BOTTOM NAVIGATION BAR ──────────── */}
      <nav
        aria-label="Worker Bottom Navigation"
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E8EEF4] z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md mx-auto flex items-stretch justify-around px-2 pt-1.5 pb-2">
          {[
            { id: 'clock-in', label: 'Punch In', icon: Clock },
            { id: 'attendance', label: 'Attendance', icon: CalendarDays },
            { id: 'leaves', label: 'Leaves', icon: Palmtree },
            { id: 'profile', label: 'Profile', icon: User },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabClick(id as any)}
                className={`flex flex-col items-center gap-0.5 min-w-0 flex-1 py-1 rounded-2xl transition-all cursor-pointer ${
                  isActive ? 'text-[#12A66A]' : 'text-[#94A3B8] hover:text-slate-600'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-11 h-8 rounded-full transition-all duration-150 ${
                    isActive ? 'bg-[#E6F7EF] text-[#12A66A]' : ''
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </span>
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? 'font-black text-[#12A66A]' : 'font-medium'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── 4. CAMERA SELFIE MODAL ─────────────────────────────────────── */}
      {showCamera && (
        <CameraScreen
          onCapture={handleCaptureSelfie}
          onClose={() => setShowCamera(false)}
          language={language}
          title={cameraMode === 'CLOCK_OUT' ? 'Take Clock-Out Selfie' : 'Take Attendance Selfie'}
          simulatedCameraDenied={edgeControls.mockCameraDenied}
        />
      )}

      {/* ─── 5. CLOCK-OUT CONFIRMATION MODAL ────────────────────────────── */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {t.confirmClockOut}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                A verified selfie is required to finish your shift and submit hours to supervisor.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClockOutConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClockOutConfirm(false);
                  handleStartClockOut();
                }}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>Capture Selfie</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. EDGE STATE SIMULATOR DRAWER ─────────────────────────────── */}
      <EdgeStateDrawer
        isOpen={showEdgeDrawer}
        onClose={() => setShowEdgeDrawer(false)}
        controls={edgeControls}
        onChange={setEdgeControls}
      />
    </div>
  );
};

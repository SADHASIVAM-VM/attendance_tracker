import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, uploadPhotoRequest } from '../../lib/api';
import { CameraCapture } from '../../components/attendance/CameraCapture';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  MapPin,
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Send,
  LogOut,
  RefreshCw,
  LocateFixed,
  ShieldCheck,
  XCircle,
  Camera,
  Lock,
  Unlock,
  Check,
  Info,
} from 'lucide-react';

export const WorkerClockInView: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Permission Flow State (Location & Camera onboarding on entry)
  const [locationPerm, setLocationPerm] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraPerm, setCameraPerm] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isRequestingPerms, setIsRequestingPerms] = useState<boolean>(false);
  const [showPermBanner, setShowPermBanner] = useState<boolean>(true);

  // GPS State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [simulatedOnSite, setSimulatedOnSite] = useState<boolean>(false);

  // Photo State
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active attendance session for today if exists
  const [todaySession, setTodaySession] = useState<any | null>(null);

  useEffect(() => {
    loadTodayAssignments();
    loadMyAttendance();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const locStatus = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPerm(locStatus.state as any);
          locStatus.onchange = () => setLocationPerm(locStatus.state as any);
        } catch (e) {}

        try {
          const camStatus = await navigator.permissions.query({ name: 'camera' as any });
          setCameraPerm(camStatus.state as any);
          camStatus.onchange = () => setCameraPerm(camStatus.state as any);
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Permissions query error:', err);
    }
  };

  const handleRequestAllPermissions = async () => {
    setIsRequestingPerms(true);
    setError(null);

    // 1. Request Geolocation Permission
    await new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        setLocationPerm('denied');
        setGpsError('Geolocation is not supported by this browser.');
        resolve();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationPerm('granted');
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
          setGpsError(null);
          resolve();
        },
        (err) => {
          console.warn('Geolocation permission prompt denied/failed:', err);
          setLocationPerm(err.code === 1 ? 'denied' : 'prompt');
          setGpsError(`GPS Access: ${err.message}.`);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    // 2. Request Camera Permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraPerm('granted');
        // Stop temporary check stream
        stream.getTracks().forEach((t) => t.stop());
      } else {
        setCameraPerm('denied');
      }
    } catch (err: any) {
      console.warn('Camera permission prompt denied/failed:', err);
      setCameraPerm('denied');
    } finally {
      setIsRequestingPerms(false);
    }
  };

  const loadTodayAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/workers/me/assignments');
      setAssignments(data);
      if (data.length > 0) {
        setSelectedAssignment(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const loadMyAttendance = async () => {
    try {
      const records = await apiRequest('/attendance/me');
      const todayStr = new Date().toISOString().split('T')[0];
      const today = records.find((r: any) => r.workDate === todayStr);
      if (today) {
        setTodaySession(today);
      }
    } catch (err) {
      // ignore
    }
  };

  // Obtain live browser coordinates
  const refreshGps = () => {
    if (simulatedOnSite && selectedAssignment) {
      setUserCoords({
        lat: selectedAssignment.worksiteLatitude,
        lng: selectedAssignment.worksiteLongitude,
        accuracy: 5,
      });
      setGpsError(null);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setLocationPerm('granted');
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsError(null);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) setLocationPerm('denied');
        setGpsError(`GPS Access: ${err.message}. Please enable location permissions.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    refreshGps();
  }, [simulatedOnSite, selectedAssignment]);

  // Compute Haversine distance
  useEffect(() => {
    if (userCoords && selectedAssignment) {
      const R = 6371000;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(selectedAssignment.worksiteLatitude - userCoords.lat);
      const dLon = toRad(selectedAssignment.worksiteLongitude - userCoords.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(userCoords.lat)) *
          Math.cos(toRad(selectedAssignment.worksiteLatitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = Math.round(R * c);
      setDistanceMeters(dist);
    }
  }, [userCoords, selectedAssignment]);

  const handleCapture = (blob: Blob, dataUrl: string) => {
    setCapturedBlob(blob);
    setCapturedDataUrl(dataUrl);
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    setCapturedDataUrl(null);
  };

  const handleClockInSubmit = async () => {
    if (!selectedAssignment || !userCoords || !capturedBlob) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. Request short-lived upload authorization
      const uploadAuth = await apiRequest('/attendance/photo-upload-auth', { method: 'POST' });

      // 2. Upload photo securely into server image store
      const uploadResult = await uploadPhotoRequest(capturedBlob, uploadAuth);

      // 3. Submit clock-in with coordinates, accuracy and idempotency key
      const idempotencyKey = `clk_${user?.id}_${selectedAssignment.id}_${Date.now()}`;
      const res = await apiRequest('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          latitude: userCoords.lat,
          longitude: userCoords.lng,
          reportedAccuracyMeters: userCoords.accuracy,
          photoObjectKey: uploadResult.photoObjectKey,
          idempotencyKey,
          clientDeviceInfo: navigator.userAgent,
        }),
      });

      setSuccessMessage(`Clock-in submitted successfully! Sent to supervisor (${selectedAssignment.supervisorName}) for verification.`);
      setTodaySession({
        ...res.session,
        supervisorName: selectedAssignment.supervisorName,
      });
      await loadMyAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to submit clock-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!todaySession) return;
    try {
      setIsSubmitting(true);
      await apiRequest(`/attendance/${todaySession.id}/clock-out`, { method: 'POST' });
      setSuccessMessage('Clocked out successfully!');
      loadMyAttendance();
    } catch (err: any) {
      setError(err.message || 'Clock out failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tolerance = userCoords
    ? Math.min(Math.max(userCoords.accuracy * 0.5, 10), Math.max((selectedAssignment?.worksiteRadius || 200) * 0.2, 35))
    : 0;

  const isWithinRadius =
    distanceMeters !== null &&
    selectedAssignment &&
    distanceMeters <= (selectedAssignment.worksiteRadius + tolerance);

  const isAccuracyGood =
    userCoords !== null &&
    selectedAssignment &&
    userCoords.accuracy <= Math.max(selectedAssignment.worksiteMaxAccuracy, 150);

  // Check if accessed over insecure origin (e.g. non-localhost HTTP on local Wi-Fi IP)
  const isInsecureNetworkOrigin =
    typeof window !== 'undefined' &&
    !window.isSecureContext &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const allPermissionsGranted = locationPerm === 'granted' && cameraPerm === 'granted';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Checking today's assignments and geofence status...
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Active Assignment Today</h3>
        <p className="text-sm text-slate-600 mb-6">
          You do not have a published roster assignment for today. Attendance submission is strictly locked until an administrator schedules and publishes your assignment.
        </p>
        <button
          onClick={loadTodayAssignments}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Check Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Location Verified Clock-In</h1>
        <p className="text-sm text-slate-500 mt-1">
          Validate live physical geofence, capture a camera selfie, and submit to your assigned supervisor.
        </p>
      </div>

      {/* PERMISSIONS ONBOARDING CARD (Appears on entry) */}
      {!todaySession && showPermBanner && (
        <div
          className={`rounded-2xl p-5 border transition-all ${
            allPermissionsGranted
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white shadow-md'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {allPermissionsGranted ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                )}
                <h3 className={`font-bold text-base m-0 ${allPermissionsGranted ? 'text-emerald-900' : 'text-white'}`}>
                  {allPermissionsGranted ? 'Permissions Enabled' : 'Permissions Required for Clock-In'}
                </h3>
              </div>
              <p className={`text-xs m-0 ${allPermissionsGranted ? 'text-emerald-700' : 'text-slate-300'}`}>
                {allPermissionsGranted
                  ? 'Live GPS location and camera permissions are verified and active.'
                  : 'To verify geofence perimeter and take your attendance selfie, grant access to location and camera.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Location Status Pill */}
              <div
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  locationPerm === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : locationPerm === 'denied'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-white/10 text-slate-200 border border-white/20'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                Location: {locationPerm === 'granted' ? 'Allowed ✓' : locationPerm === 'denied' ? 'Blocked ✕' : 'Prompt'}
              </div>

              {/* Camera Status Pill */}
              <div
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  cameraPerm === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : cameraPerm === 'denied'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-white/10 text-slate-200 border border-white/20'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Camera: {cameraPerm === 'granted' ? 'Allowed ✓' : cameraPerm === 'denied' ? 'Blocked ✕' : 'Prompt'}
              </div>

              {/* Action Button */}
              {!allPermissionsGranted && (
                <button
                  type="button"
                  onClick={handleRequestAllPermissions}
                  disabled={isRequestingPerms}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isRequestingPerms ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Prompting...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Allow Permissions
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* If permissions were blocked */}
          {(locationPerm === 'denied' || cameraPerm === 'denied') && (
            <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <strong>Permissions Blocked in Browser:</strong> Click the lock/settings icon in your browser's address bar to reset permissions, then click "Allow Permissions" above.
              </div>
            </div>
          )}

          {/* Notice if accessed over non-secure LAN IP on mobile */}
          {isInsecureNetworkOrigin && (
            <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong>Testing from Mobile over Wi-Fi:</strong> Mobile browsers block Camera & Location on plain HTTP over local network IPs. You can use the <em>"Upload Photo"</em> or <em>"Demo Snapshot"</em> tabs below for instant testing!
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications / Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <span className="font-semibold block">Submission Blocked:</span>
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <span className="font-semibold block">Success:</span>
            {successMessage}
          </div>
        </div>
      )}

      {/* Attendance Status Card */}
      {todaySession && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today's Attendance Status
            </span>
            <StatusBadge status={todaySession.status} size="md" />
          </div>

          {/* Specific Status Alert */}
          {todaySession.status === 'PENDING' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2 font-medium">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Clock-in submitted with photo & GPS evidence. Awaiting verification by assigned supervisor{' '}
                <strong>{todaySession.supervisorName || selectedAssignment?.supervisorName}</strong>.
              </span>
            </div>
          )}

          {todaySession.status === 'APPROVED' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Attendance Verified & Approved by supervisor{' '}
                <strong>{todaySession.supervisorName || selectedAssignment?.supervisorName}</strong>!
              </span>
            </div>
          )}

          {todaySession.status === 'REJECTED' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Clock-in Rejected by Supervisor:</span>
              </div>
              <p className="text-xs text-rose-700 pl-6 m-0 font-medium">
                {todaySession.rejectionReason || 'No specific reason provided.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-500 text-xs block">Clocked In At:</span>
              <span className="font-semibold text-slate-800">
                {todaySession.clockInTime ? new Date(todaySession.clockInTime).toLocaleTimeString() : 'Pending'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block">Assigned Supervisor:</span>
              <span className="font-semibold text-slate-800">{todaySession.supervisorName || selectedAssignment?.supervisorName}</span>
            </div>
          </div>

          {!todaySession.clockOutTime && todaySession.status !== 'REJECTED' && (
            <button
              onClick={handleClockOut}
              disabled={isSubmitting}
              className="w-full py-3 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Clock Out for the Day
            </button>
          )}

          {todaySession.clockOutTime && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-100 font-medium">
              You clocked out at {new Date(todaySession.clockOutTime).toLocaleTimeString()}. Day shift completed.
            </div>
          )}
        </div>
      )}

      {/* Assignment & Clock-In Form Card */}
      {(!todaySession || todaySession.status === 'REJECTED') && selectedAssignment && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 uppercase tracking-wider inline-block mb-2">
                Published Assignment
              </span>
              <h2 className="text-xl font-bold text-slate-900 m-0">{selectedAssignment.worksiteName}</h2>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {selectedAssignment.worksiteAddress}
              </p>
            </div>
            <StatusBadge status={selectedAssignment.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Shift</span>
              <span className="font-semibold text-slate-800">{selectedAssignment.shiftName}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {selectedAssignment.shiftStartTime} - {selectedAssignment.shiftEndTime}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Assigned Supervisor</span>
              <span className="font-semibold text-slate-800">{selectedAssignment.supervisorName}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">{selectedAssignment.supervisorEmail}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Required Geofence</span>
              <span className="font-semibold text-slate-800">{selectedAssignment.worksiteRadius}m radius</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Max accuracy: {selectedAssignment.worksiteMaxAccuracy}m
              </span>
            </div>
          </div>

          {/* STEP 1: LIVE GPS LOCATION VALIDATION */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900">Step 1: Live Geofence Validation</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={refreshGps}
                  disabled={isLocating}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-blue-600' : ''}`} />
                  Refresh Live GPS
                </button>

                {/* Developer / Testing Simulator Toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={simulatedOnSite}
                    onChange={(e) => setSimulatedOnSite(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  Simulate On-Site GPS (Demo)
                </label>
              </div>
            </div>

            {gpsError ? (
              <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
                {gpsError}
              </div>
            ) : userCoords && distanceMeters !== null ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Live Coordinates:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {userCoords.lat.toFixed(6)}, {userCoords.lng.toFixed(6)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Worksite Center:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {selectedAssignment.worksiteLatitude.toFixed(6)}, {selectedAssignment.worksiteLongitude.toFixed(6)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-600">Calculated distance to worksite perimeter:</span>
                  <span className="font-bold text-slate-900">{distanceMeters} meters</span>
                </div>
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-600">Reported GPS device accuracy:</span>
                  <span className="font-bold text-slate-900">+/- {userCoords.accuracy} meters</span>
                </div>

                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between font-medium ${
                    isWithinRadius && isAccuracyGood
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isWithinRadius && isAccuracyGood ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {isWithinRadius && isAccuracyGood
                        ? `Validated! You are within the ${selectedAssignment.worksiteRadius}m geofence perimeter (${distanceMeters}m from center).`
                        : !isWithinRadius
                        ? `Outside permitted perimeter! (${distanceMeters}m > ${selectedAssignment.worksiteRadius}m). Clock-in is restricted to the physical site.`
                        : `GPS accuracy (+/- ${userCoords.accuracy}m) exceeds maximum tolerance of ${selectedAssignment.worksiteMaxAccuracy}m.`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-2 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                Acquiring live GPS device coordinates...
              </div>
            )}
          </div>

          {/* STEP 2: CAMERA SELFIE CAPTURE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-slate-900">Step 2: Camera Attendance Selfie</span>
            </div>

            <CameraCapture
              onCapture={handleCapture}
              onRetake={handleRetake}
              capturedDataUrl={capturedDataUrl}
            />
          </div>

          {/* STEP 3: SUBMIT TO SUPERVISOR */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <span>Assigned Reviewer: <strong className="text-slate-700">{selectedAssignment.supervisorName}</strong></span>
            </div>

            <button
              onClick={handleClockInSubmit}
              disabled={!isWithinRadius || !isAccuracyGood || !capturedBlob || isSubmitting}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                isWithinRadius && isAccuracyGood && capturedBlob && !isSubmitting
                  ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Storing Image & Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Clock-In for Approval
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

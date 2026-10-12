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
} from 'lucide-react';

export const WorkerClockInView: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // GPS State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
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
  }, []);

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

  // Obtain browser coordinates
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    const fetchGps = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!simulatedOnSite) {
            setUserCoords({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            });
            setGpsError(null);
          }
        },
        (err) => {
          if (!simulatedOnSite) {
            setGpsError(`GPS Permission: ${err.message}. Please enable location access.`);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    fetchGps();
  }, [simulatedOnSite]);

  // Handle simulated coordinates toggle for easy testing
  useEffect(() => {
    if (simulatedOnSite && selectedAssignment) {
      // Set worker coordinates precisely at the worksite with 5m accuracy
      setUserCoords({
        lat: selectedAssignment.worksiteLatitude,
        lng: selectedAssignment.worksiteLongitude,
        accuracy: 5,
      });
      setGpsError(null);
    }
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

      // 2. Upload photo securely
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

      setSuccessMessage('Clock-in submitted successfully! Sent to supervisor for review.');
      setTodaySession(res.session);
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

  const isWithinRadius =
    distanceMeters !== null &&
    selectedAssignment &&
    distanceMeters <= selectedAssignment.worksiteRadius;

  const isAccuracyGood =
    userCoords !== null &&
    selectedAssignment &&
    userCoords.accuracy <= selectedAssignment.worksiteMaxAccuracy;

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
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
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
          Validate your physical worksite geofence, capture an attendance selfie, and route to your supervisor.
        </p>
      </div>

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

      {/* Already Clocked In State */}
      {todaySession && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today's Attendance Status
            </span>
            <StatusBadge status={todaySession.status} size="md" />
          </div>

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

          {!todaySession.clockOutTime && (
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

      {/* Assignment Card */}
      {!todaySession && selectedAssignment && (
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

          {/* STEP 1: GPS GEOLOCATION VALIDATION */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900">Step 1: Physical Geofence Validation</span>
              </div>

              {/* Developer / Testing Simulator Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={simulatedOnSite}
                  onChange={(e) => setSimulatedOnSite(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Simulate On-Site GPS (Demo)
              </label>
            </div>

            {gpsError ? (
              <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
                {gpsError}
              </div>
            ) : userCoords && distanceMeters !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Calculated distance to worksite reference coordinates:
                  </span>
                  <span className="font-bold text-slate-900">{distanceMeters} meters</span>
                </div>
                <div className="flex items-center justify-between text-xs">
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
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {isWithinRadius && isAccuracyGood
                        ? `Validated! You are within the ${selectedAssignment.worksiteRadius}m geofence perimeter.`
                        : !isWithinRadius
                        ? `Outside permitted perimeter! (${distanceMeters}m > ${selectedAssignment.worksiteRadius}m). Clock-in is restricted to the physical site.`
                        : `GPS accuracy (+/- ${userCoords.accuracy}m) is insufficient.`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Obtaining live device coordinates...
              </div>
            )}
          </div>

          {/* STEP 2: FRESH SELFIE CAPTURE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-slate-900">Step 2: Fresh Attendance Selfie</span>
            </div>

            <CameraCapture
              onCapture={handleCapture}
              onRetake={handleRetake}
              capturedDataUrl={capturedDataUrl}
            />
          </div>

          {/* STEP 3: SUBMISSION BUTTON */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleClockInSubmit}
              disabled={!isWithinRadius || !isAccuracyGood || !capturedBlob || isSubmitting}
              className={`px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${
                isWithinRadius && isAccuracyGood && capturedBlob && !isSubmitting
                  ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying & Submitting...
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

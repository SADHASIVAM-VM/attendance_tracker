import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  MapPin,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Shield,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'unavailable';

interface PermissionGateProps {
  /** Called only after both camera AND location permissions are confirmed. */
  onAllGranted: (coords: { lat: number; lng: number; accuracy: number }) => void;
  /** If true, skip real permission check and simulate "both granted" (dev mode). */
  simulateGranted?: boolean;
}

interface PermCheckState {
  camera: PermissionStatus;
  location: PermissionStatus;
  coords: { lat: number; lng: number; accuracy: number } | null;
  cameraError: string | null;
  locationError: string | null;
}

/**
 * PermissionGate
 * ─────────────
 * Checks camera + location before the worker can access attendance features.
 *
 * Behaviour:
 * - On mount: probes camera via getUserMedia then geolocation.
 * - Shows a clear blocking modal when either permission is denied.
 * - Provides "Try Again" (re-requests permission) and settings instructions.
 * - Releases camera tracks once confirmed (avoids holding the camera open).
 * - Only calls onAllGranted once both checks pass.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  onAllGranted,
  simulateGranted = false,
}) => {
  const [state, setState] = useState<PermCheckState>({
    camera: 'checking',
    location: 'checking',
    coords: null,
    cameraError: null,
    locationError: null,
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const calledRef = useRef(false);

  // ─── Check camera permission ───────────────────────────────────────────────
  const checkCamera = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({
        ...prev,
        camera: 'unavailable',
        cameraError: 'Camera API is not supported in this browser.',
      }));
      return false;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Release immediately – we only needed the prompt/grant signal.
      stream.getTracks().forEach((t) => t.stop());
      setState((prev) => ({ ...prev, camera: 'granted', cameraError: null }));
      return true;
    } catch (err: any) {
      stream?.getTracks().forEach((t) => t.stop());
      const name: string = err?.name ?? 'Unknown';
      let msg = 'Camera access was denied.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg =
          'Camera access was denied. Please tap Allow when the browser asks, or open your browser settings to enable it.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No camera was found on this device.';
      } else if (name === 'NotReadableError') {
        msg = 'Camera is in use by another application. Please close it and try again.';
      }
      setState((prev) => ({
        ...prev,
        camera: name === 'NotFoundError' ? 'unavailable' : 'denied',
        cameraError: msg,
      }));
      return false;
    }
  }, []);

  // ─── Check location permission ─────────────────────────────────────────────
  const checkLocation = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setState((prev) => ({
          ...prev,
          location: 'unavailable',
          locationError: 'Geolocation is not supported by this browser.',
        }));
        return resolve(false);
      }


      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos?.coords?.latitude;
          const lng = pos?.coords?.longitude;
          const accuracy = Math.round(pos?.coords?.accuracy || 0);

          console.log(lat, lng, "Location Checking /")

          // Validate coordinate ranges strictly – never accept 0,0 as real
          const validLat = isFinite(lat) && lat >= -90 && lat <= 90;
          const validLng = isFinite(lng) && lng >= -180 && lng <= 180;

          if (!validLat || !validLng) {
            setState((prev) => ({
              ...prev,
              location: 'denied',
              locationError: 'Received invalid GPS coordinates. Please retry in an open area.',
            }));
            return resolve(false);
          }

          setState((prev) => ({
            ...prev,
            location: 'granted',
            coords: { lat, lng, accuracy },
            locationError: null,
          }));
          resolve(true);
        },
        (err) => {
          let msg = 'Location access failed.';
          if (err.code === err.PERMISSION_DENIED) {
            msg =
              'Location access was denied. Please allow location in your browser/device settings and tap Try Again.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Location is currently unavailable. Move to an open area and try again.';
          } else if (err.code === err.TIMEOUT) {
            msg = 'GPS timed out. Move to an open area with clear sky and try again.';
          }
          setState((prev) => ({
            ...prev,
            location: 'denied',
            locationError: msg,
          }));
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  // ─── Run both checks ───────────────────────────────────────────────────────
  const runChecks = useCallback(async () => {
    calledRef.current = false;
    setState({
      camera: 'checking',
      location: 'checking',
      coords: null,
      cameraError: null,
      locationError: null,
    });

    const camOk = await checkCamera();
    const locOk = await checkLocation();

    if (camOk && locOk) {
      setState((prev) => {
        if (prev.coords && !calledRef.current) {
          calledRef.current = true;
          setTimeout(() => onAllGranted(prev.coords!), 0);
        }
        return prev;
      });
    }
  }, [checkCamera, checkLocation, onAllGranted]);

  useEffect(() => {

    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    await runChecks();
    setIsRetrying(false);
  };

  const { camera, location, cameraError, locationError } = state;

  const allChecking = camera === 'checking' || location === 'checking';
  const cameraDenied = camera === 'denied' || camera === 'unavailable';
  const locationDenied = location === 'denied' || location === 'unavailable';
  const hasError = cameraDenied || locationDenied;

  // Both granted – parent component will render children; hide gate
  if (!hasError && !allChecking) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Permissions required"
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* ── Header ── */}
        <div
          className={`px-6 pt-6 pb-4 flex flex-col items-center gap-3 ${hasError
            ? 'bg-gradient-to-br from-rose-50 to-red-50'
            : 'bg-gradient-to-br from-emerald-50 to-green-50'
            }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${hasError ? 'bg-rose-100' : 'bg-emerald-100'
              }`}
          >
            {allChecking ? (
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            ) : hasError ? (
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            ) : (
              <Shield className="w-8 h-8 text-emerald-600" />
            )}
          </div>
          <h2 className="text-lg font-black text-slate-900 text-center leading-tight">
            {allChecking
              ? 'Checking Permissions\u2026'
              : hasError
                ? 'Permission Required'
                : 'Permissions Granted'}
          </h2>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            {allChecking
              ? 'Please wait while we verify camera and location access.'
              : 'Camera and GPS location are required for attendance.'}
          </p>
        </div>

        {/* ── Permission rows ── */}
        <div className="px-5 py-4 space-y-3">
          <PermRow
            icon={Camera}
            label="Camera"
            desc="For your attendance selfie"
            status={camera}
            error={cameraError}
          />
          <PermRow
            icon={MapPin}
            label="Location (GPS)"
            desc=""
            status={location}
            error={locationError}
          />
        </div>

        {/* ── Actions ── */}
        {hasError && (
          <div className="px-5 pb-6 space-y-3">
            {/* Settings instruction */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">How to enable in browser settings:</p>
              <ol className="list-decimal list-inside space-y-0.5 font-medium leading-relaxed">
                <li>Tap the lock icon in your browser address bar.</li>
                <li>Select <strong>Site settings</strong> (or Permissions).</li>
                <li>
                  Set <strong>Camera</strong> and <strong>Location</strong> to{' '}
                  <strong>Allow</strong>.
                </li>
                <li>Come back and tap <strong>Try Again</strong> below.</li>
              </ol>
            </div>

            <button
              type="button"
              id="permission-gate-retry-btn"
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full py-3.5 bg-[#12A66A] hover:bg-[#0E8F5B] disabled:bg-[#12A66A]/60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isRetrying ? 'Checking\u2026' : 'Try Again'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Small status row inside the modal ────────────────────────────────────────
function PermRow({
  icon: Icon,
  label,
  desc,
  status,
  error,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  status: PermissionStatus;
  error: string | null;
}) {
  const isChecking = status === 'checking';
  const isGranted = status === 'granted';
  const isDenied = status === 'denied' || status === 'unavailable';

  return (
    <div
      className={`p-3 rounded-2xl border flex items-start gap-3 ${isDenied
        ? 'bg-rose-50 border-rose-200'
        : isGranted
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-slate-50 border-slate-200'
        }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDenied ? 'bg-rose-100' : isGranted ? 'bg-emerald-100' : 'bg-slate-100'
          }`}
      >
        <Icon
          className={`w-[18px] h-[18px] ${isDenied ? 'text-rose-600' : isGranted ? 'text-emerald-600' : 'text-slate-500'
            }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900">{label}</span>
          {isChecking && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
          {isGranted && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {isDenied && <X className="w-4 h-4 text-rose-500 shrink-0" />}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
        {isDenied && error && (
          <p className="text-[11px] text-rose-700 font-semibold mt-1 leading-snug">{error}</p>
        )}
      </div>
    </div>
  );
}

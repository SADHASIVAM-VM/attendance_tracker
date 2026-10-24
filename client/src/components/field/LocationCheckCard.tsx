import React from 'react';
import { Worksite, LanguageCode } from '../../types/fieldWorker';
import { TRANSLATIONS } from '../../lib/translations';
import {
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Building2,
  ExternalLink,
} from 'lucide-react';

interface LocationCheckCardProps {
  worksite: Worksite | null;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  gpsError: string | null;
  userCoords?: { lat: number; lng: number; accuracy?: number } | null;
  language?: LanguageCode;
  onFindMySite?: () => void;
  isSimulatingLocation?: boolean;
  onToggleSimulateLocation?: (simulate: boolean) => void;
}

export const LocationCheckCard: React.FC<LocationCheckCardProps> = ({
  worksite,
  distanceMeters,
  accuracyMeters,
  gpsError,
  userCoords,
  language = 'en',
  onFindMySite,
  isSimulatingLocation = false,
  onToggleSimulateLocation,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // ── No worksite assigned ───────────────────────────────────────────────────
  if (!worksite) {
    const mapsVerifyUrl =
      userCoords
        ? `https://www.google.com/maps?q=${userCoords.lat},${userCoords.lng}`
        : undefined;

    return (
      <div className="bg-white border-2 border-amber-300 rounded-[22px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
              NO LOCATION ASSIGNED TODAY
            </h3>
            <p className="text-[11px] text-amber-800 font-bold mt-0.5">
              PLEASE CONTACT ADMIN OR SUPERVISOR
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-3">
          <p className="font-semibold leading-relaxed">
            You do not have an active worksite assigned for today. Clock-in is
            geofence-enforced and disabled until an assignment is scheduled.
          </p>

          <div className="p-3 bg-white/95 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-amber-950">
              <span className="flex items-center gap-1.5 font-bold">
                <Navigation className="w-3.5 h-3.5 text-amber-600" />
                Device Detected Location:
              </span>
              <span className="font-semibold text-slate-700">
                ±{accuracyMeters ?? 8}m accuracy
              </span>
            </div>

            {userCoords ? (
              <div className="text-[11px] font-mono text-slate-800 bg-amber-100/50 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 border border-amber-200">
                <span>
                  Lat: <strong>{userCoords.lat.toFixed(6)}</strong>, Lng:{' '}
                  <strong>{userCoords.lng.toFixed(6)}</strong>
                </span>
                {mapsVerifyUrl && (
                  <a
                    href={mapsVerifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    Verify on Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-amber-800 italic">
                Acquiring GPS coordinates from browser…
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Compute geofence state ─────────────────────────────────────────────────
  const isWithinZone =
    distanceMeters !== null && distanceMeters <= worksite.radiusMeters;

  const workerAvatarUrl =
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRycG6Q3y5S3_Ntw6lxmzZyiGZVKuYmKfCO-DBd2h4Tmw&s=10';

  const siteLat = worksite.latitude;
  const siteLng = worksite.longitude;

  // Directions / GMap link using validated worker + site coords
  const originParam =
    userCoords ? `&origin=${userCoords.lat},${userCoords.lng}` : '';
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${siteLat},${siteLng}&travelmode=walking`;

  // Format distance label
  const distanceLabel =
    distanceMeters !== null
      ? distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${distanceMeters} m`
      : null;

  return (
    <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] space-y-3.5">

      {/* ── 1. Card Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827] leading-tight block">
              {worksite.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-[#6B7280]">
                Target Location • {worksite.radiusMeters}m Geofence
              </span>
              <span className="text-[#CBD5E0]">•</span>
              <button
                type="button"
                onClick={
                  onFindMySite ||
                  (() => window.open(gmapsUrl, '_blank', 'noopener,noreferrer'))
                }
                title="Navigate to worksite in Google Maps"
                className="text-[11px] font-semibold text-[#EA4335] hover:underline inline-flex items-center gap-0.5 cursor-pointer bg-transparent border-none p-0"
              >
                GMap
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status pill */}
        {gpsError ? (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#DC2626] flex items-center gap-1 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            No GPS Signal
          </span>
        ) : isWithinZone ? (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#12A66A] flex items-center gap-1.5 shadow-xs border border-[#12A66A]/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>You're at Site ({distanceMeters}m)</span>
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#FEE2E2] text-[#DC2626] flex items-center gap-1.5 shadow-xs border border-[#FCA5A5] animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>FAR FROM LOCATION</span>
          </span>
        )}
      </div>

      {/* ── 2. Static Map Overlay with Distance Label above the dashed line ── */}
      <div className="relative w-full h-64 sm:h-72 rounded-[18px] overflow-hidden border border-[#E8EEF4] select-none shadow-inner bg-[#F1F5F9]">

        {/* Static map background image */}
        <img
          src="/map_structured_bg.jpg"
          alt="Map background"
          className="absolute inset-0 w-full h-full object-cover opacity-90 filter contrast-[0.98] brightness-[1.01]"
        />

        {/* Soft vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/15 via-transparent to-transparent pointer-events-none" />

        {/* SVG overlay: geofence circle + dashed line between markers */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 600 360"
          preserveAspectRatio="none"
        >
          {/* Geofence circle around the work-site marker at (320, 190) */}
          <g transform="translate(320, 190)">
            <circle
              r="76"
              fill={isWithinZone ? '#12A66A' : '#38BDF8'}
              fillOpacity={isWithinZone ? '0.18' : '0.15'}
              stroke={isWithinZone ? '#12A66A' : '#0284C7'}
              strokeWidth="2"
              strokeDasharray={isWithinZone ? undefined : '5,5'}
            />
            {isWithinZone && (
              <circle
                r="76"
                fill="none"
                stroke="#12A66A"
                strokeWidth="1.5"
                opacity="0.3"
                className="animate-ping"
              />
            )}
          </g>

          {/* Dashed line from worker (140,90) → site (320,190) when outside */}
          {!isWithinZone && (
            <line
              x1="140"
              y1="90"
              x2="320"
              y2="190"
              stroke="#DC2626"
              strokeWidth="2.5"
              strokeDasharray="6,6"
              strokeOpacity="0.85"
            />
          )}
        </svg>

        {/* ── Distance badge centred ABOVE the dashed line ── */}
        {!isWithinZone && distanceLabel && (
          <div
            className="absolute pointer-events-none"
            style={{
              // Midpoint of line: x=(140+320)/2=230, y=(90+190)/2=140
              // Convert SVG 600×360 to percentage
              left: `${(230 / 600) * 100}%`,
              top: `${(140 / 360) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              {/* Callout badge */}
              <div className="bg-[#DC2626] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg shadow-[0_2px_8px_rgba(220,38,38,0.45)] whitespace-nowrap border border-white/30 flex items-center gap-1">
                <Navigation className="w-2.5 h-2.5 shrink-0" />
                {distanceLabel} away
              </div>
              {/* Small downward arrow pointing to the line */}
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#DC2626]" />
            </div>
          </div>
        )}

        {/* ── Work Site marker at (320, 190) ── */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: '53.3%', top: '52.7%' }}
        >
          <div className="flex flex-col items-center">
            <div className="bg-[#12A66A] text-white px-2.5 py-1 rounded-xl text-[10px] font-extrabold shadow-[0_4px_12px_rgba(18,166,106,0.4)] flex items-center gap-1.5 border border-white">
              <Building2 className="w-3 h-3 text-white" />
              <span>Work Site</span>
            </div>
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#12A66A]" />
          </div>
          <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#12A66A] flex items-center justify-center -mt-0.5 shadow-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-[#12A66A]" />
          </div>
          <span className="text-[9px] font-bold text-[#0E8F5B] bg-white/90 px-1.5 py-0.5 rounded-md shadow-2xs mt-1 border border-[#E8EEF4]">
            {worksite.radiusMeters}m Radius
          </span>
        </div>

        {/* ── Worker / "You" marker ── */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none transition-all duration-700 ease-out"
          style={
            isWithinZone
              ? { left: '56.5%', top: '56%' }   // inside circle
              : { left: '23.3%', top: '25%' }    // outside
          }
        >
          {isWithinZone && (
            <span className="absolute -inset-1 rounded-full bg-[#12A66A] animate-ping opacity-40 pointer-events-none" />
          )}

          <div
            className={`relative w-10 h-10 rounded-full p-0.5 bg-white border-2 shadow-[0_4px_14px_rgba(0,0,0,0.25)] flex items-center justify-center ${
              isWithinZone ? 'border-[#12A66A]' : 'border-[#DC2626]'
            }`}
          >
            <img
              src={workerAvatarUrl}
              alt="My Location"
              className="w-full h-full rounded-full object-cover"
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                isWithinZone ? 'bg-[#12A66A]' : 'bg-[#DC2626]'
              }`}
            />
          </div>

          <div
            className={`mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap flex items-center gap-1 ${
              isWithinZone
                ? 'bg-[#12A66A] text-white'
                : 'bg-[#DC2626] text-white animate-pulse'
            }`}
          >
            <span>{isWithinZone ? `You (${distanceMeters}m)` : 'You (Outside)'}</span>
          </div>
        </div>

        {/* ── Bottom legend bar ── */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-semibold bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E8EEF4] shadow-xs">
          <div className="flex items-center gap-1.5 text-[#475569]">
            <Navigation className="w-3.5 h-3.5 text-[#12A66A]" />
            <span>
              GPS: <strong className="text-[#111827]">±{accuracyMeters ?? 6}m</strong>
              {userCoords && (
                <span className="ml-1 text-[10px] text-slate-500 font-mono hidden sm:inline">
                  ({userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {userCoords && (
              <a
                href={`https://www.google.com/maps?q=${userCoords.lat},${userCoords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                title="Verify your device coordinates on Google Maps"
              >
                Verify GPS
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            <span
              className={`w-2 h-2 rounded-full ${
                isWithinZone ? 'bg-[#12A66A]' : 'bg-[#DC2626]'
              }`}
            />
            <span className="text-[#111827] font-bold">
              {worksite.radiusMeters}m Geofence{' '}
              {isWithinZone ? 'Approved' : 'Required'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Outside geofence warning ── */}
      {!isWithinZone && (
        <div className="p-3.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[16px] text-[#991B1B] text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <div className="w-6 h-6 rounded-full bg-[#DC2626] text-white flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <div className="space-y-0.5">
            <h4 className="font-extrabold text-[#7F1D1D] text-xs uppercase tracking-wide">
              FAR FROM THE LOCATION
            </h4>
            <p className="text-[11px] text-[#991B1B] leading-relaxed">
              You are{' '}
              <strong>
                {distanceLabel ?? 'an unknown distance'}
              </strong>{' '}
              from the approved {worksite.radiusMeters}m worksite radius.
              Attendance punch is locked until you arrive at the designated worksite.
            </p>
          </div>
        </div>
      )}

      {/* ── 4. Simulate location toggle (dev / test mode) ── */}
      {onToggleSimulateLocation && (
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isSimulatingLocation ? 'bg-[#12A66A] animate-ping' : 'bg-slate-400'
              }`}
            />
            <span className="text-[11px] font-bold text-slate-700">
              {isSimulatingLocation
                ? 'Test Mode: Simulated Inside Worksite (0m)'
                : 'Device GPS Mode'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onToggleSimulateLocation(!isSimulatingLocation)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
              isSimulatingLocation
                ? 'bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/30 hover:bg-[#C3F2DD]'
                : 'bg-[#12A66A] text-white hover:bg-[#0E8F5B] shadow-xs'
            }`}
          >
            {isSimulatingLocation ? 'Reset Real GPS' : '📍 Simulate On-Site Position'}
          </button>
        </div>
      )}
    </div>
  );
};

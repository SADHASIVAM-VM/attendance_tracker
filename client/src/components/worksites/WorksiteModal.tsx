import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import {
  X,
  MapPin,
  Globe,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  Hash,
  FileText,
  Compass,
  RefreshCw,
  Pencil,
  Sparkles,
  Info,
  Check,
  Layers,
} from 'lucide-react';

export interface WorksiteData {
  id?: string;
  name: string;
  code: string;
  address: string;
  description?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  isActive: boolean;
}

interface WorksiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WorksiteData) => Promise<void>;
  editWorksite?: WorksiteData | null;
}

const RADIUS_PRESETS = [
  { value: 15, label: '15m (Strict)' },
  { value: 30, label: '30m (Standard)' },
  { value: 50, label: '50m (Medium Yard)' },
  { value: 100, label: '100m (Large Campus)' },
  { value: 200, label: '200m (Extended)' },
];

export const WorksiteModal: React.FC<WorksiteModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editWorksite = null,
}) => {
  const isEditMode = Boolean(editWorksite && editWorksite.id);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('37.774929');
  const [longitude, setLongitude] = useState<string>('-122.419416');
  const [radiusMeters, setRadiusMeters] = useState<number>(30);
  const [maxAccuracyMeters, setMaxAccuracyMeters] = useState<number>(50);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Google Maps Extractor
  const [mapsUrl, setMapsUrl] = useState<string>('');
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractStatus, setExtractStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    source?: 'place_pin' | 'query_param' | 'camera_viewport' | 'meta_tag';
    isPinExact?: boolean;
    resolvedUrl?: string;
  } | null>(null);

  // Pin Verification
  const [pinConfirmed, setPinConfirmed] = useState<boolean>(false);

  // Submission & Validation States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset or populate fields on open / edit
  useEffect(() => {
    if (!isOpen) return;

    if (editWorksite) {
      setName(editWorksite.name || '');
      setCode(editWorksite.code || '');
      setAddress(editWorksite.address || '');
      setDescription(editWorksite.description || '');
      setLatitude(
        editWorksite.latitude !== undefined && editWorksite.latitude !== null
          ? String(editWorksite.latitude)
          : '37.774929'
      );
      setLongitude(
        editWorksite.longitude !== undefined && editWorksite.longitude !== null
          ? String(editWorksite.longitude)
          : '-122.419416'
      );
      setRadiusMeters(editWorksite.radiusMeters || 30);
      setMaxAccuracyMeters(editWorksite.maxAccuracyMeters || 50);
      setIsActive(editWorksite.isActive !== undefined ? editWorksite.isActive : true);
      setMapsUrl('');
      setExtractStatus(null);
      // In edit mode with existing coordinates, pre-confirm pin
      setPinConfirmed(true);
      setError(null);
    } else {
      // Create mode defaults
      setName('');
      setCode(`WKS-${Math.floor(1000 + Math.random() * 9000)}`);
      setAddress('');
      setDescription('');
      setLatitude('37.774929');
      setLongitude('-122.419416');
      setRadiusMeters(30);
      setMaxAccuracyMeters(50);
      setIsActive(true);
      setMapsUrl('');
      setExtractStatus(null);
      setPinConfirmed(false);
      setError(null);
    }
  }, [isOpen, editWorksite]);

  if (!isOpen) return null;

  // Auto-generate unique worksite code
  const handleGenerateCode = () => {
    const prefix = name
      ? name
          .split(' ')
          .map((w) => w[0]?.toUpperCase() || '')
          .slice(0, 3)
          .join('')
      : 'WKS';
    const cleanPrefix = prefix.length >= 2 ? prefix : 'WKS';
    const rand = Math.floor(100 + Math.random() * 900);
    setCode(`${cleanPrefix}-${rand}`);
  };

  // Google Maps coordinate extraction
  const handleExtractCoordinates = async () => {
    if (!mapsUrl.trim()) {
      setExtractStatus({
        type: 'error',
        message: 'Please paste a valid Google Maps link (e.g., https://maps.app.goo.gl/...).',
      });
      return;
    }

    try {
      setExtracting(true);
      setExtractStatus(null);
      setPinConfirmed(false);

      const res = await apiRequest<{
        latitude: number;
        longitude: number;
        resolvedUrl: string;
        source: 'place_pin' | 'query_param' | 'camera_viewport' | 'meta_tag';
        isPinExact: boolean;
      }>('/worksites/extract-coordinates', {
        method: 'POST',
        body: JSON.stringify({ mapsUrl: mapsUrl.trim() }),
      });

      if (
        isNaN(res.latitude) ||
        res.latitude < -90 ||
        res.latitude > 90 ||
        isNaN(res.longitude) ||
        res.longitude < -180 ||
        res.longitude > 180
      ) {
        throw new Error('Coordinates extracted from Google Maps are outside valid geographic limits.');
      }

      setLatitude(res.latitude.toFixed(6));
      setLongitude(res.longitude.toFixed(6));

      setExtractStatus({
        type: 'success',
        message: res.isPinExact
          ? `Exact location pin resolved: [${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}]`
          : `Extracted approximate map-center coordinates: [${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}]. Please verify the pin location below.`,
        source: res.source,
        isPinExact: res.isPinExact,
        resolvedUrl: res.resolvedUrl,
      });

      toast.success(
        res.isPinExact
          ? 'Exact location coordinates resolved!'
          : 'Approximate coordinates resolved. Please verify pin on map.',
        'Coordinates Extracted'
      );
    } catch (err: any) {
      const msg =
        err.message ||
        'Failed to extract coordinates from Google Maps link. You can enter coordinates manually.';
      setExtractStatus({
        type: 'error',
        message: msg,
      });
      toast.error(msg, 'Extraction Failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!name.trim()) {
      setError('Worksite Name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Worksite Code is required.');
      return;
    }
    if (!address.trim()) {
      setError('Physical Street Address is required.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    if (!pinConfirmed) {
      setError('Please check the confirmation box to verify the physical pin location before saving.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        id: editWorksite?.id,
        name: name.trim(),
        code: code.trim(),
        address: address.trim(),
        description: description.trim() || undefined,
        latitude: latNum,
        longitude: lngNum,
        radiusMeters,
        maxAccuracyMeters,
        isActive,
      });

      toast.success(
        isEditMode
          ? `Worksite "${name.trim()}" updated successfully.`
          : `Worksite "${name.trim()}" created and geofencing activated!`,
        isEditMode ? 'Location Updated' : 'Location Created'
      );
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to save worksite location. Please check inputs.';
      setError(msg);
      toast.error(msg, isEditMode ? 'Update Failed' : 'Creation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);
  const hasValidCoords = !isNaN(parsedLat) && !isNaN(parsedLng);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        {/* Same width (max-w-2xl) and fixed height (h-[90vh] max-h-[92vh]) as CreateUserModal */}
        <div
          className="relative w-full max-w-2xl rounded-[24px] bg-white border border-[#E8EEF4] shadow-[0_20px_50px_rgba(15,23,42,0.18)] transition-all overflow-hidden flex flex-col h-[90vh] max-h-[92vh]"
          role="dialog"
          aria-modal="true"
        >
          {/* Header - Fixed (shrink-0) */}
          <div className="p-5 sm:p-6 border-b border-[#F1F5F9] flex items-center justify-between bg-gradient-to-r from-white via-[#F8FAFC] to-[#F1F6FC] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-xs">
                {isEditMode ? (
                  <Pencil className="w-5 h-5 stroke-[2.2]" />
                ) : (
                  <MapPin className="w-5 h-5 stroke-[2.2]" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#111827] tracking-tight">
                  {isEditMode ? `Edit Physical Worksite: ${editWorksite?.name}` : 'Add Physical Worksite'}
                </h2>
                <p className="text-xs text-[#6B7280] font-medium">
                  {isEditMode
                    ? 'Modify worksite identity, geofence radius boundary, and authoritative GPS coordinates.'
                    : 'Configure authoritative coordinates, Google Maps resolution, and geofence enforcement boundaries.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white border border-[#E8EEF4] text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content - Scrollable with min-h-0 */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0 text-slate-700">
            {/* Intimation Banner */}
            <div className="p-3.5 rounded-2xl bg-[#E6F7EF] border border-[#A7F3D0] text-[#0E8F5B] text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#12A66A]" />
              <div className="leading-relaxed">
                <span className="font-extrabold block text-[#065F46] mb-0.5">
                  Authoritative Geofence Enforcement Note:
                </span>
                Workers clocking into this worksite will have their live GPS verified against these authoritative coordinates within the configured radius buffer.
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start justify-between gap-3 animate-in fade-in shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-extrabold block text-rose-900 text-[13px] mb-0.5">
                      Failed to Save Worksite:
                    </span>
                    <span className="leading-relaxed font-semibold">{error}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-600 hover:text-rose-800 text-xs font-bold shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* 1. Identity & Physical Address */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#12A66A]" />
                  1. Worksite Identity & Address
                </span>
                <span className="text-[11px] font-semibold text-[#64748B]">
                  * Required fields marked
                </span>
              </div>

              {/* Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
                      Worksite Name *
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#12A66A] border border-[#A7F3D0]">
                      Required
                    </span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. North Harbor Dock"
                    className="w-full text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-800 transition-all"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#374151] flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-[#64748B]" />
                      Site Identifier / Code *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="text-[11px] font-bold text-[#12A66A] hover:text-[#0E8F5B] flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto-Gen
                    </button>
                  </div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. NHD-03"
                    className="w-full text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] font-mono uppercase tracking-wider text-slate-800 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Physical Address */}
              <div>
                <label className="text-xs font-bold text-[#374151] flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#64748B]" />
                    Physical Street Address *
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#12A66A] border border-[#A7F3D0]">
                    Required
                  </span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Full street address, building number, city, postal code..."
                  className="w-full text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-800 transition-all"
                  required
                />
              </div>

              {/* Description (Optional) & Status Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#374151] flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#64748B]" />
                      Site Description / Operational Notes
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Optional
                    </span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Main entrance checkpoint, Gate 4"
                    className="w-full text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-800 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#374151] block mb-1.5">
                    Operational Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#E6F7EF] border-[#A7F3D0] text-[#0E8F5B]'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isActive ? 'bg-[#12A66A] animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    {isActive ? 'Active Worksite' : 'Inactive / Paused'}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Google Maps Coordinate Extraction */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  2. Google Maps Auto-Extraction
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Fast Auto-Fill
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/40 via-[#F8FAFC] to-indigo-50/30 border border-blue-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    Paste Google Maps Share Link or Web URL
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Supports maps.app.goo.gl, goo.gl/maps, or full browser URLs
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/XYZ or https://www.google.com/maps/place/..."
                    className="flex-1 text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleExtractCoordinates}
                    disabled={extracting || !mapsUrl.trim()}
                    className="px-4 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {extracting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Extract Coordinates
                      </>
                    )}
                  </button>
                </div>

                {/* Extraction Feedback */}
                {extractStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs border flex flex-col gap-1.5 animate-in fade-in ${
                      extractStatus.type === 'success'
                        ? extractStatus.isPinExact
                          ? 'bg-[#E6F7EF] text-[#065F46] border-[#A7F3D0]'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {extractStatus.type === 'success' ? (
                        extractStatus.isPinExact ? (
                          <CheckCircle2 className="w-4 h-4 text-[#12A66A] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold m-0">{extractStatus.message}</p>
                        {extractStatus.type === 'success' && (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/80 border border-current">
                              {extractStatus.isPinExact ? 'Exact Place Pin' : 'Approximate Center'}
                            </span>
                            {extractStatus.source && (
                              <span className="text-[10px] opacity-75">
                                Source: {extractStatus.source}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Coordinates & Geofencing Parameters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2 flex-wrap gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[#12A66A]" />
                  3. GPS Coordinates & Geofence Boundary
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error('Geolocation is not supported by your browser');
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setLatitude(pos.coords.latitude.toFixed(6));
                        setLongitude(pos.coords.longitude.toFixed(6));
                        setPinConfirmed(true);
                        toast.success('Coordinates set to your current device location!');
                      },
                      (err) => {
                        toast.error(`Unable to fetch location: ${err.message}`);
                      },
                      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                    );
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-[#12A66A] bg-[#E6F7EF] hover:bg-[#12A66A] hover:text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Detect and fill current device GPS coordinates"
                >
                  <Navigation className="w-3 h-3" />
                  Use Current Location
                </button>
              </div>

              {/* Latitude & Longitude */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] flex items-center justify-between mb-1.5">
                    <span>Latitude (-90° to 90°) *</span>
                    <span className="text-[10px] text-slate-500 font-mono">Decimal Degrees</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setPinConfirmed(false);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. 37.774929"
                    className="w-full text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] font-mono font-medium text-slate-800 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#374151] flex items-center justify-between mb-1.5">
                    <span>Longitude (-180° to 180°) *</span>
                    <span className="text-[10px] text-slate-500 font-mono">Decimal Degrees</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setPinConfirmed(false);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. -122.419416"
                    className="w-full text-xs p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] font-mono font-medium text-slate-800 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Radius Presets & Custom Input */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E8EEF4] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#374151] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#12A66A]" />
                    Geofence Radius Buffer (meters) *
                  </label>
                  <span className="text-xs font-extrabold text-[#12A66A]">
                    {radiusMeters} meters
                  </span>
                </div>

                {/* Preset Pills */}
                <div className="flex flex-wrap gap-2">
                  {RADIUS_PRESETS.map((p) => {
                    const isSelected = radiusMeters === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setRadiusMeters(p.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#12A66A] text-white shadow-xs'
                            : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-slate-50 hover:text-[#111827]'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                      Custom Radius (5m - 5,000m)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={5000}
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(parseInt(e.target.value) || 20)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-800"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                      Max Allowed GPS Accuracy (m)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={1000}
                      value={maxAccuracyMeters}
                      onChange={(e) => setMaxAccuracyMeters(parseInt(e.target.value) || 50)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] text-slate-800"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Visual Pin Verification & OpenStreetMap */}
            {hasValidCoords && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#12A66A]" />
                    4. Visual Pin Location Verification
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${parsedLat},${parsedLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    Open in Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Map Iframe */}
                <div className="w-full h-44 rounded-2xl overflow-hidden border border-[#E8EEF4] bg-slate-100 relative shadow-inner">
                  <iframe
                    title="Worksite Pin Preview"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      parsedLng - 0.004
                    }%2C${parsedLat - 0.002}%2C${parsedLng + 0.004}%2C${
                      parsedLat + 0.002
                    }&layer=mapnik&marker=${parsedLat}%2C${parsedLng}`}
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-xs text-[10px] font-mono font-bold text-slate-700 border border-slate-200/80 shadow-xs">
                    Pin: {parsedLat.toFixed(5)}, {parsedLng.toFixed(5)}
                  </div>
                </div>

                {/* Pin Confirmation Checkbox */}
                <div
                  onClick={() => setPinConfirmed(!pinConfirmed)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    pinConfirmed
                      ? 'bg-[#E6F7EF] border-[#A7F3D0]'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      pinConfirmed
                        ? 'bg-[#12A66A] border-[#12A66A] text-white'
                        : 'border-[#CBD5E1] bg-white'
                    }`}
                  >
                    {pinConfirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-[#111827] block mb-0.5">
                      Verify & Confirm Geofence Anchor
                    </span>
                    <span className="text-[#64748B] leading-relaxed">
                      I have verified the pin on the map preview and confirm that coordinates (
                      <span className="font-mono font-semibold text-[#111827]">
                        {parsedLat.toFixed(5)}, {parsedLng.toFixed(5)}
                      </span>
                      ) with radius buffer of <strong>{radiusMeters}m</strong> will be used for attendance geofencing enforcement.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Modal Footer - Fixed at bottom (shrink-0) matching CreateUserModal */}
          <div className="p-4 sm:p-5 border-t border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#111827] hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                !name.trim() ||
                !code.trim() ||
                !address.trim() ||
                !latitude ||
                !longitude ||
                !pinConfirmed
              }
              className="px-6 py-2.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl text-xs font-extrabold shadow-[0_4px_12px_rgba(18,166,106,0.35)] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-98"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isEditMode ? 'Saving Changes...' : 'Creating Worksite...'}</span>
                </>
              ) : (
                <>
                  {isEditMode ? (
                    <Pencil className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>{isEditMode ? 'Save & Update Worksite' : 'Activate & Create Worksite'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  MapPin,
  Plus,
  Navigation,
  Globe,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Pencil,
} from 'lucide-react';

export const WorksitesView: React.FC = () => {
  const [worksites, setWorksites] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('37.774929');
  const [longitude, setLongitude] = useState<string>('-122.419416');
  const [radiusMeters, setRadiusMeters] = useState<number>(30);
  const [maxAccuracyMeters, setMaxAccuracyMeters] = useState<number>(50);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Google Maps Extraction State
  const [mapsUrl, setMapsUrl] = useState<string>('');
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractStatus, setExtractStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    source?: 'place_pin' | 'query_param' | 'camera_viewport' | 'meta_tag';
    isPinExact?: boolean;
    resolvedUrl?: string;
  } | null>(null);
  const [pinConfirmed, setPinConfirmed] = useState<boolean>(false);

  useEffect(() => {
    loadWorksites();
  }, []);

  const resetForm = () => {
    setName('');
    setCode('');
    setAddress('');
    setLatitude('37.774929');
    setLongitude('-122.419416');
    setRadiusMeters(30);
    setMaxAccuracyMeters(50);
    setMapsUrl('');
    setExtractStatus(null);
    setPinConfirmed(false);
  };

  const loadWorksites = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/worksites');
      setWorksites(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load worksites', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExtractCoordinates = async () => {
    if (!mapsUrl.trim()) {
      setExtractStatus({
        type: 'error',
        message: 'Please enter a valid Google Maps URL or short link.',
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

      // Validate coordinate range
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
    } catch (err: any) {
      setExtractStatus({
        type: 'error',
        message: err.message || 'Failed to extract coordinates from Google Maps link. You can still enter coordinates manually.',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setMessage({ text: 'Latitude must be a valid number between -90 and 90.', type: 'error' });
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setMessage({ text: 'Longitude must be a valid number between -180 and 180.', type: 'error' });
      return;
    }
    if (!pinConfirmed) {
      setMessage({ text: 'Please confirm and verify the worksite pin location before saving.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/worksites', {
        method: 'POST',
        body: JSON.stringify({
          name,
          code,
          address,
          latitude: latNum,
          longitude: lngNum,
          radiusMeters,
          maxAccuracyMeters,
        }),
      });

      setMessage({ text: 'Worksite created and geofencing activated successfully.', type: 'success' });
      setModalOpen(false);
      resetForm();
      loadWorksites();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create worksite', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [selectedWorksite, setSelectedWorksite] = useState<any | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');
  const [editLatitude, setEditLatitude] = useState<string>('');
  const [editLongitude, setEditLongitude] = useState<string>('');
  const [editRadiusMeters, setEditRadiusMeters] = useState<number>(200);
  const [editMaxAccuracyMeters, setEditMaxAccuracyMeters] = useState<number>(50);

  const openEditModal = (site: any) => {
    setSelectedWorksite(site);
    setEditName(site.name);
    setEditAddress(site.address);
    setEditLatitude(site.latitude.toString());
    setEditLongitude(site.longitude.toString());
    setEditRadiusMeters(site.radiusMeters);
    setEditMaxAccuracyMeters(site.maxAccuracyMeters);
    setEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorksite) return;

    const latNum = parseFloat(editLatitude);
    const lngNum = parseFloat(editLongitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setMessage({ text: 'Latitude must be between -90 and 90.', type: 'error' });
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setMessage({ text: 'Longitude must be between -180 and 180.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest(`/worksites/${selectedWorksite.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          address: editAddress,
          latitude: latNum,
          longitude: lngNum,
          radiusMeters: editRadiusMeters,
          maxAccuracyMeters: editMaxAccuracyMeters,
        }),
      });

      setMessage({ text: 'Worksite updated successfully.', type: 'success' });
      setEditModalOpen(false);
      loadWorksites();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update worksite', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Physical Worksites</h1>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative physical coordinates and geofence enforcement boundaries.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Worksite
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Loading worksites...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worksites.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base m-0">{s.name}</h3>
                    <span className="text-xs font-mono text-slate-500">{s.code}</span>
                  </div>
                  <StatusBadge status={s.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>

                <p className="text-xs text-slate-600 flex items-start gap-1.5 min-h-[32px]">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{s.address}</span>
                </p>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Lat, Lng:</span>
                    <span className="font-semibold text-slate-800">
                      {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Geofence Radius:</span>
                    <span className="font-semibold text-emerald-700">{s.radiusMeters} meters (around center)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max GPS Accuracy:</span>
                    <span className="font-semibold text-slate-700">+/- {s.maxAccuracyMeters}m</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => openEditModal(s)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Geofence & Coordinates
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT WORKSITE MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Worksite Geofence & Coordinates"
        description="Update the physical coordinates and radius perimeter for this worksite."
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submitting ? 'Saving...' : 'Save Geofence Settings'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Worksite Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Physical Address</label>
            <input
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Latitude (-90 to 90) *
              </label>
              <input
                type="number"
                step="any"
                value={editLatitude}
                onChange={(e) => setEditLatitude(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Longitude (-180 to 180) *
              </label>
              <input
                type="number"
                step="any"
                value={editLongitude}
                onChange={(e) => setEditLongitude(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Geofence Radius (meters around location) *
              </label>
              <input
                type="number"
                value={editRadiusMeters}
                onChange={(e) => setEditRadiusMeters(parseInt(e.target.value) || 200)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                min={5}
                max={5000}
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Radius in meters around the central point
              </span>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Allowed GPS Accuracy (m) *
              </label>
              <input
                type="number"
                value={editMaxAccuracyMeters}
                onChange={(e) => setEditMaxAccuracyMeters(parseInt(e.target.value) || 50)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                min={5}
                max={1000}
                required
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* CREATE WORKSITE MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Add Physical Worksite"
        description="Configure geofence coordinates, Google Maps extraction, and geofence enforcement boundaries."
        footer={
          <>
            <button
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={
                submitting ||
                !name.trim() ||
                !code.trim() ||
                !address.trim() ||
                !latitude ||
                !longitude ||
                !pinConfirmed
              }
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              {submitting ? 'Creating...' : 'Create Worksite'}
            </button>
          </>
        }
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Worksite Name & Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Worksite Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Harbor Dock"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Worksite Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. NHD-03"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>
          </div>

          {/* Physical Address */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Physical Address *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full street address..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              required
            />
          </div>

          {/* GOOGLE MAPS EXTRACTION BOX */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600" />
                Google Maps Location Link
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                maps.app.goo.gl, goo.gl/maps, or full URLs
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="e.g. https://maps.app.goo.gl/XYZ or https://www.google.com/maps/place/..."
                className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleExtractCoordinates}
                disabled={extracting || !mapsUrl.trim()}
                className="px-3.5 py-2.5 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    Extract Coordinates
                  </>
                )}
              </button>
            </div>

            {/* Extraction Status Feedback */}
            {extractStatus && (
              <div
                className={`p-3 rounded-xl text-xs border flex flex-col gap-1.5 ${
                  extractStatus.type === 'success'
                    ? extractStatus.isPinExact
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {extractStatus.type === 'success' ? (
                    extractStatus.isPinExact ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/70 border border-current">
                          {extractStatus.isPinExact ? 'Exact Place Pin' : 'Approximate Center'}
                        </span>
                        {extractStatus.source && (
                          <span className="text-[10px] text-slate-600">
                            Source: {extractStatus.source}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {extractStatus.type === 'error' && (
                  <p className="text-[11px] text-rose-700 m-0 ml-6">
                    Extraction failed. You can still enter or fine-tune coordinates manually below.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Coordinates (Latitude & Longitude) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Latitude (-90 to 90) *
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => {
                  setLatitude(e.target.value);
                  setPinConfirmed(false);
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Longitude (-180 to 180) *
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => {
                  setLongitude(e.target.value);
                  setPinConfirmed(false);
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>
          </div>

          {/* Geofence Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Geofence Radius (meters) *
              </label>
              <input
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(parseInt(e.target.value) || 20)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                min={5}
                max={5000}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max Allowed GPS Accuracy (m) *
              </label>
              <input
                type="number"
                value={maxAccuracyMeters}
                onChange={(e) => setMaxAccuracyMeters(parseInt(e.target.value) || 50)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                min={5}
                max={1000}
                required
              />
            </div>
          </div>

          {/* MAP PREVIEW & VERIFICATION CHECKLIST */}
          {!isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude)) && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  Worksite Pin Preview ({parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)})
                </span>
                <a
                  href={`https://www.google.com/maps?q=${parseFloat(latitude)},${parseFloat(longitude)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  Open in Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Embedded Map Visualizer */}
              <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                <iframe
                  title="Worksite Pin Preview"
                  width="100%"
                  height="100%"
                  loading="lazy"
                  style={{ border: 0 }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    parseFloat(longitude) - 0.004
                  }%2C${parseFloat(latitude) - 0.002}%2C${
                    parseFloat(longitude) + 0.004
                  }%2C${parseFloat(latitude) + 0.002}&layer=mapnik&marker=${parseFloat(
                    latitude
                  )}%2C${parseFloat(longitude)}`}
                />
              </div>

              {/* Approximate Center Warning */}
              {extractStatus && !extractStatus.isPinExact && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Approximate Center Warning:</strong> Coordinates were extracted from a
                    camera viewport rather than a pinned point. Ensure the coordinates above accurately
                    reflect the worksite center before confirming.
                  </div>
                </div>
              )}

              {/* Admin Confirmation Checkbox */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="confirm-pin"
                  checked={pinConfirmed}
                  onChange={(e) => setPinConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label
                  htmlFor="confirm-pin"
                  className="text-xs text-slate-800 font-medium leading-relaxed cursor-pointer select-none"
                >
                  I have verified the pin on the map preview and confirm these coordinates (
                  <span className="font-mono font-semibold">
                    {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
                  </span>
                  ) will be used for attendance geofencing enforcement.
                </label>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

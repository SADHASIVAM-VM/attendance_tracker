import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { Building2, Save, CheckCircle2, ShieldCheck, MapPin, UserCheck, AlertTriangle } from 'lucide-react';

export const OrgSettingsView: React.FC = () => {
  const { organization, refreshUser } = useAuth();
  const [radius, setRadius] = useState<number>(organization?.defaultGeofenceRadius || 20);
  const [maxAccuracy, setMaxAccuracy] = useState<number>(organization?.maxLocationAccuracy || 50);
  const [clockOutEnabled, setClockOutEnabled] = useState<boolean>(
    organization?.clockOutEnabled !== undefined ? organization.clockOutEnabled : true
  );
  const [supervisorAutoApprove, setSupervisorAutoApprove] = useState<boolean>(true);
  const [supervisorBypassLocation, setSupervisorBypassLocation] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await apiRequest<any>('/organizations/settings').catch(() => null);
      if (res) {
        if (res.defaultGeofenceRadius !== undefined) setRadius(res.defaultGeofenceRadius);
        if (res.maxLocationAccuracy !== undefined) setMaxAccuracy(res.maxLocationAccuracy);
        if (res.clockOutEnabled !== undefined) setClockOutEnabled(res.clockOutEnabled);
        if (res.supervisorAutoApprove !== undefined) setSupervisorAutoApprove(res.supervisorAutoApprove);
        if (res.supervisorBypassLocation !== undefined) setSupervisorBypassLocation(res.supervisorBypassLocation);
      } else if (organization) {
        setRadius(organization.defaultGeofenceRadius || 20);
        setMaxAccuracy(organization.maxLocationAccuracy || 50);
        setClockOutEnabled(organization.clockOutEnabled !== undefined ? organization.clockOutEnabled : true);
      }
    } catch {
      // fallback
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await apiRequest('/organizations/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          defaultGeofenceRadius: radius,
          maxLocationAccuracy: maxAccuracy,
          clockOutEnabled,
          supervisorAutoApprove,
          supervisorBypassLocation,
        }),
      });
      setMessage('Organization policy settings updated successfully.');
      if (refreshUser) refreshUser();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update organization settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Organization Policy & Geofencing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform-level attendance policies, supervisor permissions, radius rules, and precision boundaries.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-sm flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Organization Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Organization Name</label>
            <input
              type="text"
              value={organization?.name || 'Global Logistics Corp'}
              disabled
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-medium"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Organization Code</label>
            <input
              type="text"
              value={organization?.code || 'GLC-01'}
              disabled
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono"
            />
          </div>
        </div>

        {/* Geofence & GPS Accuracy */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Geofence & Precision Boundaries</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Geofence Radius (meters)
              </label>
              <input
                type="number"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value) || 20)}
                min={10}
                max={1000}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Standard worker perimeter. Minimum 10m.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Max GPS Accuracy Threshold (meters)
              </label>
              <input
                type="number"
                value={maxAccuracy}
                onChange={(e) => setMaxAccuracy(parseInt(e.target.value) || 50)}
                min={10}
                max={500}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Submissions exceeding this are rejected.</span>
            </div>
          </div>
        </div>

        {/* Supervisor Attendance & Policy Configurations (Requested feature) */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#12A66A]" />
            <span>Supervisor Attendance & Geofence Policy</span>
          </h3>

          {/* Supervisor Auto Approve */}
          <div className="flex items-start justify-between p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-900 block flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Auto-Approve Supervisor Attendance</span>
              </label>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                When enabled, clock-in and clock-out sessions submitted by site supervisors are automatically verified and marked as <strong>APPROVED</strong> without requiring second-level supervisor authorization.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={supervisorAutoApprove}
                onChange={(e) => setSupervisorAutoApprove(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#12A66A]"></div>
            </label>
          </div>

          {/* Supervisor Location Bypass Option */}
          <div className="flex items-start justify-between p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-900 block flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Allow Supervisor Location Geofence Bypass</span>
              </label>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Gives supervisors the option to toggle location bypass when roaming between sites or inspecting equipment. Real device GPS coordinates, distance, and bypass state are still captured and logged for admin auditing.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={supervisorBypassLocation}
                onChange={(e) => setSupervisorBypassLocation(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Worker End of Day Clock Out */}
          <div className="flex items-start justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-800 block">
                Enable End-of-Day Clock-Out for Workers
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Allows field workers to submit their evening departure punch and calculate daily shift hours.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={clockOutEnabled}
                onChange={(e) => setClockOutEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-98"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{loading ? 'Saving Changes...' : 'Save Policy Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

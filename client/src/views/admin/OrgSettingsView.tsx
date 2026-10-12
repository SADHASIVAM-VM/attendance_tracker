import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { Building2, Save, CheckCircle2 } from 'lucide-react';

export const OrgSettingsView: React.FC = () => {
  const { organization, refreshUser } = useAuth();
  const [radius, setRadius] = useState<number>(organization?.defaultGeofenceRadius || 20);
  const [maxAccuracy, setMaxAccuracy] = useState<number>(organization?.maxLocationAccuracy || 50);
  const [clockOutEnabled, setClockOutEnabled] = useState<boolean>(
    organization?.clockOutEnabled !== undefined ? organization.clockOutEnabled : true
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setRadius(organization.defaultGeofenceRadius);
      setMaxAccuracy(organization.maxLocationAccuracy);
      setClockOutEnabled(organization.clockOutEnabled);
    }
  }, [organization]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Organization policy settings updated successfully.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Organization Policy & Geofencing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform-level attendance policies, radius rules, and precision boundaries.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
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

        <div className="grid grid-cols-2 gap-4">
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
            <span className="text-[11px] text-slate-500 mt-1 block">Default minimum is 20 meters.</span>
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

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={clockOutEnabled}
              onChange={(e) => setClockOutEnabled(e.target.checked)}
              className="rounded text-slate-900"
            />
            Enable End-of-Day Clock-Out for Workers
          </label>

          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};

import React from 'react';
import { Sliders, X, WifiOff, MapPinOff, CameraOff, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export interface EdgeStateControls {
  mockGpsDenied: boolean;
  mockCameraDenied: boolean;
  mockOffline: boolean;
  mockOutsideLocation: boolean;
  mockEmptyHistory?: boolean;
  mockStatusOverride: 'DEFAULT' | 'NOT_CLOCKED_IN' | 'WORKING' | 'SHIFT_DONE';
}

interface EdgeStateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  controls: EdgeStateControls;
  onChange: (updated: EdgeStateControls) => void;
}

export const EdgeStateDrawer: React.FC<EdgeStateDrawerProps> = ({
  isOpen,
  onClose,
  controls,
  onChange,
}) => {
  if (!isOpen) return null;

  const toggle = (key: keyof Omit<EdgeStateControls, 'mockStatusOverride'>) => {
    onChange({
      ...controls,
      [key]: !controls[key],
    });
  };

  const setStatus = (status: EdgeStateControls['mockStatusOverride']) => {
    onChange({
      ...controls,
      mockStatusOverride: status,
    });
  };

  return (
    <div
      role="dialog"
      aria-label="Simulation and Edge States Drawer"
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl border-2 border-[#181A20] p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-900 border border-amber-400 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#111317] font-['Space_Grotesk'] leading-tight">
                Simulate Field Conditions
              </h3>
              <p className="text-xs text-slate-500">Test edge states & network glitches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toggles List */}
        <div className="space-y-2.5">
          {/* No Internet */}
          <button
            type="button"
            onClick={() => toggle('mockOffline')}
            className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${
              controls.mockOffline
                ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <WifiOff className="w-5 h-5 text-amber-600" />
              <div>
                <span className="text-sm block">No Internet / Offline Queue</span>
                <span className="text-[11px] text-slate-500 font-normal">Saves punch locally & syncs later</span>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${controls.mockOffline ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
              {controls.mockOffline ? 'ACTIVE' : 'OFF'}
            </span>
          </button>

          {/* Outside Worksite */}
          <button
            type="button"
            onClick={() => toggle('mockOutsideLocation')}
            className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${
              controls.mockOutsideLocation
                ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <div>
                <span className="text-sm block">Outside Geofence (&gt;320m away)</span>
                <span className="text-[11px] text-slate-500 font-normal">Tests "You're too far" warning</span>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${controls.mockOutsideLocation ? 'bg-rose-600 text-white border-rose-700' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
              {controls.mockOutsideLocation ? 'TOO FAR' : 'ON-SITE'}
            </span>
          </button>

          {/* GPS Blocked */}
          <button
            type="button"
            onClick={() => toggle('mockGpsDenied')}
            className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${
              controls.mockGpsDenied
                ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <MapPinOff className="w-5 h-5 text-rose-600" />
              <div>
                <span className="text-sm block">No GPS / Permission Denied</span>
                <span className="text-[11px] text-slate-500 font-normal">Tests missing location error state</span>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${controls.mockGpsDenied ? 'bg-rose-600 text-white border-rose-700' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
              {controls.mockGpsDenied ? 'NO GPS' : 'GPS OK'}
            </span>
          </button>

          {/* Camera Blocked */}
          <button
            type="button"
            onClick={() => toggle('mockCameraDenied')}
            className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${
              controls.mockCameraDenied
                ? 'bg-rose-50 border-rose-500 text-rose-950 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <CameraOff className="w-5 h-5 text-rose-600" />
              <div>
                <span className="text-sm block">Camera Permission Denied</span>
                <span className="text-[11px] text-slate-500 font-normal">Tests photo retry & snapshot fallback</span>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${controls.mockCameraDenied ? 'bg-rose-600 text-white border-rose-700' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>
              {controls.mockCameraDenied ? 'BLOCKED' : 'CAMERA OK'}
            </span>
          </button>
        </div>

        {/* Status Force Preset */}
        <div className="pt-2 border-t border-slate-100">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Force Shift State:
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setStatus('NOT_CLOCKED_IN')}
              className={`p-2.5 rounded-xl border-2 font-bold cursor-pointer text-center ${
                controls.mockStatusOverride === 'NOT_CLOCKED_IN'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Not In
            </button>
            <button
              type="button"
              onClick={() => setStatus('WORKING')}
              className={`p-2.5 rounded-xl border-2 font-bold cursor-pointer text-center ${
                controls.mockStatusOverride === 'WORKING'
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Working
            </button>
            <button
              type="button"
              onClick={() => setStatus('SHIFT_DONE')}
              className={`p-2.5 rounded-xl border-2 font-bold cursor-pointer text-center ${
                controls.mockStatusOverride === 'SHIFT_DONE'
                  ? 'bg-slate-800 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Shift Done
            </button>
          </div>
        </div>

        {/* Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 bg-[#181A20] hover:bg-slate-800 text-white rounded-xl font-bold text-sm cursor-pointer"
        >
          Close & Return to App
        </button>
      </div>
    </div>
  );
};

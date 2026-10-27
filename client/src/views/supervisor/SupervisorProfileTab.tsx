import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SupervisorWorksite } from '../../types/supervisor';
import {
  Profile2Icon,
  Building1Icon,
  EmailIcon,
  CallIcon,
  SecuritySafeIcon,
  GroupIcon,
  ClockIcon,
  SunIcon,
  LogOut1Icon,
  LocationIcon,
  CheckCircleIcon,
  ErrorProfileIcon,
} from '@astraicons/react/linear';

interface SupervisorProfileTabProps {
  currentWorksite: SupervisorWorksite | null;
  assignedWorkersCount: number;
  pendingReviewsCount: number;
}

export const SupervisorProfileTab: React.FC<SupervisorProfileTabProps> = ({
  currentWorksite,
  assignedWorkersCount,
  pendingReviewsCount,
}) => {
  const { user, logout } = useAuth();
  const [isOutdoorMode, setIsOutdoorMode] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'ta' | 'hi'>('en');

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SP';

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* 1. PROFILE HEADER CARD */}
      <div className="bg-white border border-[#E8EEF4] rounded-[24px] p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-emerald-100/60 to-emerald-200/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#12A66A] to-[#0E8F5B] text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg border-4 border-white">
              {initials}
            </div>
            <span
              className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-xs"
              title="Active Supervisor"
            />
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
                  {user?.fullName || 'Site Supervisor'}
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {user?.employeeCode || user?.id?.slice(0, 8).toUpperCase() || 'SUP-001'}
                </p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F7EF] text-[#0E8F5B] border border-[#01B075]/20 flex items-center gap-1.5 shadow-xs">
                  <SecuritySafeIcon className="w-3.5 h-3.5" />
                  Site Supervisor
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
              Authorized to verify worker geolocation attendance, review selfie punches, manage worksite spends, and approve leave requests.
            </p>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Assigned Crew
            </span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">
              {assignedWorkersCount} Workers
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/60 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Pending Reviews
            </span>
            <span className="text-lg font-black text-amber-900 mt-0.5 block">
              {pendingReviewsCount} Actions
            </span>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Worksite
            </span>
            <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
              {currentWorksite ? currentWorksite.name.split(' - ')[0] : 'None Assigned'}
            </span>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Organization
            </span>
            <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
              {(user as any)?.orgName || 'Enterprise'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. OFFICIAL ACCOUNT & WORKSITE DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Contact Info Card */}
        <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Profile2Icon className="w-3.5 h-3.5 text-[#01B075]" />
            Supervisor Account Details
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 flex items-center gap-2">
                <EmailIcon className="w-3.5 h-3.5 text-slate-400" />
                Work Email
              </span>
              <strong className="text-slate-900 font-semibold">{user?.email || 'supervisor@enterprise.com'}</strong>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 flex items-center gap-2">
                <CallIcon className="w-3.5 h-3.5 text-slate-400" />
                Phone Number
              </span>
              <strong className="text-slate-900 font-semibold">{user?.phone || '+91 98765 43210'}</strong>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
              <span className="text-slate-500 flex items-center gap-2">
                <Building1Icon className="w-3.5 h-3.5 text-slate-400" />
                Organization
              </span>
              <strong className="text-slate-900 font-semibold">{(user as any)?.orgName || 'Enterprise Corp'}</strong>
            </div>
          </div>
        </div>

        {/* Assigned Site Information */}
        <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Building1Icon className="w-3.5 h-3.5 text-[#01B075]" />
            Active Worksite Deployment
          </h3>

          {currentWorksite ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Target Worksite
                </span>
                <h4 className="font-bold text-emerald-950 text-sm leading-tight">
                  {currentWorksite.name}
                </h4>
                <p className="text-[11px] text-emerald-800 flex items-start gap-1 mt-1">
                  <LocationIcon className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{currentWorksite.address || 'Designated site location'}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Geofence</span>
                  <span className="font-bold text-slate-800">{currentWorksite.radiusMeters}m Radius</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Code</span>
                  <span className="font-bold text-slate-800">{currentWorksite.code || 'SITE-01'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 text-center bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <ErrorProfileIcon className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No worksite currently assigned</p>
              <p className="text-[11px] text-slate-500">Contact admin to assign your profile to a worksite.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. PREFERENCES & SESSION ACTIONS */}
      <div className="bg-white border border-[#E8EEF4] p-5 rounded-[22px] shadow-xs space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Preferences & Session
        </h4>

        <div className="space-y-3">
          {/* Outdoor Mode */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <SunIcon className="w-4 h-4 text-amber-500" />
              <span>High-Contrast Sunlight Mode</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOutdoorMode(!isOutdoorMode)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                isOutdoorMode ? 'bg-[#01B075]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  isOutdoorMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Sign Out */}
          <button
            type="button"
            onClick={logout}
            className="w-full py-3.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
          >
            <LogOut1Icon className="w-4 h-4" />
            <span>Sign Out of Supervisor Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

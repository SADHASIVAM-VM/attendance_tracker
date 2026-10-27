import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { NeedHelpCard } from '../common/NeedHelpCard';
import { NotificationDrawer } from './NotificationDrawer';
import {
  HomeIcon,
  ClockIcon,
  Profile2Icon,
  Building1Icon,
  SettingsIcon,
  SearchIcon,
  NotificationIcon,
  MessageIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Chart2Icon,
  SecuritySafeIcon,
  CalenderIcon,
  Login2Icon,
  DollarCircleIcon,
  EditIcon,
  CloseCircleIcon,
  GroupIcon,
  ArchiveIcon,
  CheckCircleIcon,
  MenuIcon,
  CloseIcon,
  RotateCwIcon,
  ArrowLeftIcon,
  TransactionHistoryIcon,
  Profile1Icon
} from '@astraicons/react/linear';
import {
  SupervisorWorksite,
  SupervisorWorkerAttendance,
  WorkerLeaveItem,
} from '../../types/supervisor';
import { AlertTriangle, WifiOff } from 'lucide-react';

interface SupervisorAppShellProps {
  worksitesList: SupervisorWorksite[];
  selectedWorksite: SupervisorWorksite;
  onSelectWorksite: (site: SupervisorWorksite) => void;
  onRefreshRoster: () => void;
  isLoadingRoster: boolean;
  workers: SupervisorWorkerAttendance[];
  leaves: WorkerLeaveItem[];
  isOffline?: boolean;
  offlineQueueLength?: number;
  onSyncNow?: () => void;
  children: React.ReactNode;
}

export const SupervisorAppShell: React.FC<SupervisorAppShellProps> = ({
  worksitesList,
  selectedWorksite,
  onSelectWorksite,
  onRefreshRoster,
  isLoadingRoster,
  workers,
  leaves,
  isOffline = false,
  offlineQueueLength = 0,
  onSyncNow,
  children,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [messagesOpen, setMessagesOpen] = useState<boolean>(false);

  useEffect(() => {
    setUserMenuOpen(false);
    setShowNotifications(false);
    setMessagesOpen(false);
  }, [location.pathname]);

  // Auto-expand attendance submenu if on any attendance sub-route
  const isAttendancePath =
    location.pathname.startsWith('/supervisor/attendance') ||
    location.pathname.startsWith('/supervisor/attendance-exceptions') ||
    location.pathname.startsWith('/supervisor/exceptions');
  const [attendanceExpanded, setAttendanceExpanded] = useState<boolean>(isAttendancePath);

  useEffect(() => {
    if (isAttendancePath) {
      setAttendanceExpanded(true);
    }
  }, [isAttendancePath]);

  // Attendance Exceptions Section state & summary badge counts
  const [exceptionsSummary, setExceptionsSummary] = useState({
    missingAttendanceCount: 0,
    pendingRegularisationCount: 0,
    rejectedRegularisationCount: 0,
    totalExceptionsCount: 0,
  });

  useEffect(() => {
    apiRequest('/attendance/exceptions/summary')
      .then((data: any) => {
        if (data) setExceptionsSummary(data);
      })
      .catch(() => { });
  }, [location.pathname]);

  // Nested Attendance Sub-items
  const attendanceSubItems = [
    {
      id: 'daily-attendance',
      path: '/supervisor/attendance/daily',
      label: 'Daily Attendance',
      sublabel: 'Today & Missing',
      icon: Profile1Icon,
    },
    {
      id: 'attendance-exception',
      path: '/supervisor/attendance-exceptions',
      label: 'Attendance Exception',
      sublabel: 'Exceptions & Flags',
      icon: AlertTriangle,
      badge: exceptionsSummary.totalExceptionsCount,
    },
    {
      id: 'missing-attendance',
      path: '/supervisor/attendance/missing',
      label: 'Missing Attendance',
      sublabel: 'Unclocked Shifts',
      icon: ClockIcon,
      badge: exceptionsSummary.missingAttendanceCount,
    },
    {
      id: 'attendance-overrides',
      path: '/supervisor/attendance/overrides',
      label: 'Attendance Override',
      sublabel: 'Current Month',
      icon: SettingsIcon,
    },
    {
      id: 'attendance-history',
      path: '/supervisor/attendance/history',
      label: 'Attendance History',
      sublabel: 'Date Range Log',
      icon: TransactionHistoryIcon,
    },
  ];

  // Main navigation items
  const mainNavItems = [
    { id: 'dashboard', path: '/supervisor/home', label: 'Dashboard', icon: HomeIcon },
    { id: 'regularization', path: '/supervisor/regularization', label: 'Regularisation', icon: EditIcon },
    { id: 'leave-requests', path: '/supervisor/leaves', label: 'Leave Requests', icon: CalenderIcon },
    { id: 'spend', path: '/supervisor/spend', label: 'Spend Ledger', icon: DollarCircleIcon },
  ];

  // Personal navigation items
  const personalNavItems = [
    { id: 'my-attendance', path: '/supervisor/my-attendance', label: 'My Attendance', icon: CheckCircleIcon },
    { id: 'my-leave', path: '/supervisor/my-leave', label: 'My Leave', icon: ArchiveIcon },
    { id: 'profile', path: '/supervisor/profile', label: 'Profile', icon: Profile2Icon },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const isPathActive = (path: string) => {
    if (path === '/supervisor/home' && (location.pathname === '/supervisor' || location.pathname === '/supervisor/home' || location.pathname === '/supervisor/dashboard')) {
      return true;
    }
    if (path === '/supervisor/attendance/daily') {
      return (
        location.pathname === '/supervisor/attendance' ||
        location.pathname === '/supervisor/attendance/' ||
        location.pathname === '/supervisor/attendance/daily'
      );
    }
    if (path === '/supervisor/attendance/missing') {
      return location.pathname === '/supervisor/attendance/missing';
    }
    if (path === '/supervisor/attendance-exceptions' || path.startsWith('/supervisor/attendance-exceptions')) {
      return (
        location.pathname.startsWith('/supervisor/attendance-exceptions') ||
        location.pathname.startsWith('/supervisor/exceptions')
      );
    }
    return location.pathname === path;
  };

  const pendingAttendanceCount = workers.filter((w) => w.status === 'PENDING').length;
  const pendingLeaveCount = leaves.filter((l) => l.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-[#F1F6FC] flex flex-col font-sans text-[#111827]">
      <div className="flex flex-1 overflow-hidden">
        {/* ========================================================= */}
        {/* 1. DESKTOP SIDEBAR (IDENTICAL TO ADMIN APPSHELL)         */}
        {/* ========================================================= */}
        <aside className="w-64 bg-white border-r border-[#E8EEF4] hidden lg:flex flex-col justify-between p-5 shrink-0 select-none">
          <div className="space-y-6">
            {/* Logo Brand matching Reference Image 3 */}
            <div className="flex items-center justify-between px-2">
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => navigate('/supervisor/home')}
              >
                <div className="w-10 h-10 rounded-2xl bg-[#01B075] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(1,176,117,0.35)]">
                  <ClockIcon className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="font-extrabold text-base tracking-tight text-[#1E1F24] block leading-tight">
                    Attendance Tracker
                  </span>
                  <span className="text-[10px] text-[#71737D] font-semibold block leading-tight">
                    Supervisor Portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-[#01B075]/10 text-[#01B075] hover:bg-[#01B075] hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Collapse sidebar"
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Main Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Home
              </span>

              {/* Dashboard */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/home')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/home')
                  ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                  : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <HomeIcon className={`w-4 h-4 ${isPathActive('/supervisor/home') ? 'text-white' : 'text-[#464853]'}`} />
                  <span>Dashboard</span>
                </div>
                <ChevronRightIcon className={`w-3.5 h-3.5 ${isPathActive('/supervisor/home') ? 'text-white/80' : 'text-[#94A3B8]'}`} />
              </button>

              {/* Attendance - NESTED COLLAPSIBLE ACCORDION (Reference Image 5) */}
              <div className="space-y-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isAttendancePath
                    ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                    : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <ClockIcon className={`w-4 h-4 ${isAttendancePath ? 'text-white' : 'text-[#464853]'}`} />
                    <span>Attendance</span>
                  </div>
                  <ChevronDownIcon
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isAttendancePath ? 'text-white' : 'text-[#94A3B8]'
                      } ${attendanceExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Sub-items matching Reference Image 5 */}
                {attendanceExpanded && (
                  <div className="relative ml-6 pl-3.5 border-l border-slate-200 space-y-1 py-1.5 animate-in fade-in duration-150">
                    {attendanceSubItems.map((sub) => {
                      const Icon = sub.icon;
                      const active = isPathActive(sub.path);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleNavClick(sub.path)}
                          className={`relative w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs transition-all cursor-pointer text-left ${active
                            ? 'text-[#1E1F24] font-bold bg-[#F4F6F8]/70'
                            : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]/40 font-medium'
                            }`}
                        >
                          {/* Active Accent Vertical Bar on Guideline */}
                          {active && (
                            <span className="absolute -left-[15px] top-1.5 bottom-1.5 w-[2.5px] bg-[#01B075] rounded-full" />
                          )}
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Circular Bullet matching Reference Image 5 */}
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${active ? 'bg-[#01B075]' : 'bg-slate-300'
                                }`}
                            />
                            <span className="truncate">{sub.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Regularisation */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/regularization')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/regularization')
                  ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                  : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <EditIcon className={`w-4 h-4 ${isPathActive('/supervisor/regularization') ? 'text-white' : 'text-[#464853]'}`} />
                  <span>Regularisation</span>
                </div>
                <ChevronRightIcon className={`w-3.5 h-3.5 ${isPathActive('/supervisor/regularization') ? 'text-white/80' : 'text-[#94A3B8]'}`} />
              </button>

              {/* Leave Requests (Team Leaves) */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/leaves')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/leaves')
                  ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                  : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <CalenderIcon className={`w-4 h-4 ${isPathActive('/supervisor/leaves') ? 'text-white' : 'text-[#464853]'}`} />
                  <span>Leave Requests</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {pendingLeaveCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#B45309]">
                      {pendingLeaveCount}
                    </span>
                  )}
                  <ChevronRightIcon className={`w-3.5 h-3.5 ${isPathActive('/supervisor/leaves') ? 'text-white/80' : 'text-[#94A3B8]'}`} />
                </div>
              </button>

              {/* Spend Ledger */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/spend')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/spend')
                  ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                  : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <DollarCircleIcon className={`w-4 h-4 ${isPathActive('/supervisor/spend') ? 'text-white' : 'text-[#464853]'}`} />
                  <span>Spend Ledger</span>
                </div>
                <ChevronRightIcon className={`w-3.5 h-3.5 ${isPathActive('/supervisor/spend') ? 'text-white/80' : 'text-[#94A3B8]'}`} />
              </button>
            </div>

            {/* Personal / Self-Service Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Personal
              </span>

              {personalNavItems.map((item) => {
                const Icon = item.icon;
                const active = isPathActive(item.path);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.path)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${active
                      ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                      : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#464853]'}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRightIcon className={`w-3.5 h-3.5 ${active ? 'text-white/80' : 'text-[#94A3B8]'}`} />
                  </button>
                );
              })}

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-[#464853] hover:text-[#EF4444] hover:bg-rose-50 transition-all cursor-pointer"
              >
                <Login2Icon className="w-4 h-4 text-[#464853] rotate-180" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Daily Standup Widget Card matching Reference Image 3 */}
          <div className="pt-3">
            <div className="p-3.5 bg-gradient-to-br from-white to-[#F4F6F8] border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#1E1F24] m-0">Daily Standup</h4>
                  <span className="text-[10px] text-[#71737D] font-medium block mt-0.5">09:30 - 10:00 AM on Zoom</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-[#E6F7F1] text-[#01B075] flex items-center justify-center">
                  <ClockIcon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop" alt="Staff" />
                  <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&auto=format&fit=crop" alt="Staff" />
                  <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&auto=format&fit=crop" alt="Staff" />
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 ring-2 ring-white text-[10px] font-bold text-slate-600">+3</span>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#01B075] hover:bg-[#018F5F] text-white shadow-2xs transition-all cursor-pointer"
                >
                  Join now
                </button>
              </div>
            </div>
          </div>
        </aside >

        {/* ========================================================= */}
        {/* 2. MOBILE DRAWER (IDENTICAL TO ADMIN APPSHELL)           */}
        {/* ========================================================= */}
        {
          mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              <aside className="fixed inset-y-0 left-0 w-72 bg-white p-5 flex flex-col justify-between shadow-2xl z-50 overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shadow-xs">
                        <ClockIcon className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="font-extrabold text-base tracking-tight text-[#111827] block leading-tight">
                          Attendance Tracker
                        </span>
                        <span className="text-[10px] text-[#6B7280] font-semibold block leading-tight">
                          Supervisor Portal
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                      <CloseIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                      Main
                    </span>

                    <button
                      type="button"
                      onClick={() => handleNavClick('/supervisor/home')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/home')
                        ? 'bg-[#E6F7EF] text-[#01B075] font-bold'
                        : 'text-[#64748B] hover:text-[#111827]'
                        }`}
                    >
                      <HomeIcon className="w-4 h-4" />
                      <span>Dashboard</span>
                    </button>

                    {/* Attendance in mobile */}
                    <div className="space-y-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isAttendancePath ? 'bg-[#E6F7F1] text-[#01B075] font-bold' : 'text-[#64748B]'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <ClockIcon className="w-4 h-4" />
                          <span>Attendance</span>
                        </div>
                        <ChevronDownIcon className={`w-3.5 h-3.5 ${attendanceExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {attendanceExpanded && (
                        <div className="ml-4 pl-3 border-l-2 border-[#E8EEF4] space-y-1 py-1">
                          {attendanceSubItems.map((sub) => {
                            const Icon = sub.icon;
                            const active = isPathActive(sub.path);
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleNavClick(sub.path)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-xs font-medium transition-all ${active ? 'bg-[#01B075] text-white font-bold' : 'text-[#64748B]'
                                  }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Icon className="w-3.5 h-3.5" />
                                  <span className="truncate">{sub.label}</span>
                                </div>
                                {sub.badge && sub.badge > 0 ? (
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${active ? 'bg-white text-[#01B075]' : 'bg-amber-100 text-amber-800'
                                      }`}
                                  >
                                    {sub.badge}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNavClick('/supervisor/regularization')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/regularization') ? 'bg-[#E6F7F1] text-[#01B075] font-bold' : 'text-[#64748B]'
                        }`}
                    >
                      <EditIcon className="w-4 h-4" />
                      <span>Regularisation</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavClick('/supervisor/leaves')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/leaves') ? 'bg-[#E6F7F1] text-[#01B075] font-bold' : 'text-[#64748B]'
                        }`}
                    >
                      <CalenderIcon className="w-4 h-4" />
                      <span>Leave Requests</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavClick('/supervisor/spend')}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isPathActive('/supervisor/spend') ? 'bg-[#E6F7F1] text-[#01B075] font-bold' : 'text-[#64748B]'
                        }`}
                    >
                      <DollarCircleIcon className="w-4 h-4" />
                      <span>Spend Ledger</span>
                    </button>
                  </div>

                  <div className="space-y-1 border-t border-slate-100 pt-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                      Personal
                    </span>
                    {personalNavItems.map((item) => {
                      const Icon = item.icon;
                      const active = isPathActive(item.path);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.path)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active ? 'bg-[#E6F7F1] text-[#01B075] font-bold' : 'text-[#64748B]'
                            }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold text-[#E5484D] hover:bg-rose-50 transition-all cursor-pointer mt-2"
                    >
                      <Login2Icon className="w-4 h-4 rotate-180" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          )
        }

        {/* ========================================================= */}
        {/* 3. MAIN BODY AREA & TOP BAR (MATCHES ADMIN APPSHELL)     */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TOP BAR matching Reference Image 3 */}
          <header className="h-20 bg-[#F4F6F8] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
            {/* Left Controls (Mobile menu toggle + Search Bar) */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 text-slate-500 hover:text-[#1E1F24] lg:hidden rounded-xl bg-white border border-[#E8EEF4] shadow-2xs cursor-pointer"
              >
                {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>

              {/* Search Bar matching Reference Image 3 */}
              <div className="relative hidden sm:block w-72 lg:w-96">
                <SearchIcon className="w-4.5 h-4.5 text-[#94A3B8] absolute left-4.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search anything Here..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-12 pr-4 py-3 bg-white border border-[#E8EEF4] rounded-full focus:outline-none focus:ring-2 focus:ring-[#01B075]/20 focus:border-[#01B075] placeholder-[#94A3B8] text-[#1E1F24] shadow-2xs transition-all font-medium"
                />
              </div>
            </div>

            {/* Right Controls matching Reference Image 3 */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              {/* Worksite Selector Pill Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(!showLocationPicker)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-[#1E1F24] text-xs font-bold transition-all cursor-pointer border border-[#E8EEF4] shadow-2xs"
                >
                  <Building1Icon className="w-3.5 h-3.5 shrink-0 text-[#01B075]" />
                  <span className="max-w-[100px] sm:max-w-[140px] truncate">
                    {selectedWorksite.name ? selectedWorksite.name.split(' - ')[0] : 'Worksite'}
                  </span>
                  <ChevronDownIcon className="w-3 h-3 text-[#71737D]" />
                </button>

                {showLocationPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowLocationPicker(false)}
                    />
                    <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-2xl shadow-xl border border-[#E8EEF4] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 block">
                        Assigned Worksites
                      </span>
                      {worksitesList.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">No worksites available</p>
                      ) : (
                        worksitesList.map((site) => {
                          const isSelected = site.id === selectedWorksite.id;
                          return (
                            <button
                              key={site.id}
                              type="button"
                              onClick={() => {
                                onSelectWorksite(site);
                                setShowLocationPicker(false);
                              }}
                              className={`w-full p-2.5 rounded-xl text-left text-xs transition-colors flex items-start gap-2.5 ${isSelected
                                ? 'bg-[#E6F7EF] text-[#0E8F5B] font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                              <Building1Icon
                                className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-[#01B075]' : 'text-slate-400'
                                  }`}
                              />
                              <div className="min-w-0">
                                <span className="block truncate font-bold">{site.name}</span>
                                <span className="block text-[10px] text-slate-400 truncate">
                                  {site.address}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Refresh Roster Button */}
              <button
                type="button"
                onClick={onRefreshRoster}
                title="Refresh Team Attendance Roster"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-white hover:bg-[#F8FAFC] text-slate-700 hover:text-[#01B075] border border-[#E8EEF4] text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <RotateCwIcon
                  className={`w-3.5 h-3.5 ${isLoadingRoster ? 'animate-spin text-[#01B075]' : 'text-slate-500'}`}
                />
                <span className="hidden md:inline">Refresh</span>
              </button>

              {/* Notification Bell matching Reference Image 3 (Opens shadcn Drawer from right) */}
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(true);
                  setUserMenuOpen(false);
                  setMessagesOpen(false);
                }}
                className="w-11 h-11 rounded-full bg-white border border-[#E8EEF4] flex items-center justify-center text-[#464853] hover:text-[#01B075] hover:border-[#01B075]/40 shadow-2xs transition-all cursor-pointer relative group"
                title="Notifications"
              >
                <NotificationIcon className="w-5 h-5 group-hover:scale-105 transition-transform" />
                {(pendingAttendanceCount > 0 || pendingLeaveCount > 0) && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#01B075] absolute top-2.5 right-2.5 ring-2 ring-white" />
                )}
              </button>

              {/* Message / Chat Bubble matching Reference Image 3 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMessagesOpen(!messagesOpen);
                    setUserMenuOpen(false);
                    setShowNotifications(false);
                  }}
                  className="w-11 h-11 rounded-full bg-white border border-[#E8EEF4] flex items-center justify-center text-[#464853] hover:text-[#01B075] hover:border-[#01B075]/40 shadow-2xs transition-all cursor-pointer relative group"
                  title="Messages"
                >
                  <MessageIcon className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] absolute top-2.5 right-2.5 ring-2 ring-white" />
                </button>

                {/* Messages Dropdown */}
                {messagesOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E8EEF4] p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-[#1E1F24] m-0">Field Messages</h4>
                      <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">1 New</span>
                    </div>
                    <div className="py-2 space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors cursor-pointer flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#01B075]/10 text-[#01B075] font-bold text-xs flex items-center justify-center shrink-0">
                          HQ
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1E1F24] text-[11px] m-0 truncate">Main Office Admin</p>
                          <p className="text-[10px] text-[#71737D] m-0 truncate">Roster synchronization updated for shift B.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Section matching Reference Image 3 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setShowNotifications(false);
                    setMessagesOpen(false);
                  }}
                  className="flex items-center gap-3 p-1 rounded-2xl hover:bg-white/60 transition-all cursor-pointer select-none group"
                >
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop"
                      alt="Profile Avatar"
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-2xs"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className="w-11 h-11 rounded-full bg-[#01B075]/10 text-[#01B075] ring-2 ring-white shadow-2xs flex items-center justify-center font-bold text-sm"
                    >
                      {user?.fullName
                        ? user.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                        : 'SP'}
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#01B075] absolute bottom-0 right-0 ring-2 ring-white" />
                  </div>

                  <div className="hidden sm:block text-left leading-tight">
                    <span className="font-bold text-sm text-[#1E1F24] block group-hover:text-[#01B075] transition-colors">
                      {user?.fullName || 'Supervisor'}
                    </span>
                    <span className="text-xs text-[#71737D] font-normal block mt-0.5">
                      Field Supervisor
                    </span>
                  </div>

                  <ChevronDownIcon className="w-4 h-4 text-[#71737D] group-hover:text-[#1E1F24] transition-colors ml-0.5 hidden sm:block" />
                </button>

                {/* Profile Popover / Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E8EEF4] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#01B075]/10 text-[#01B075] ring-2 ring-white shadow-2xs flex items-center justify-center font-bold text-sm shrink-0">
                        {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'SP'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-[#1E1F24] truncate m-0">{user?.fullName || 'Supervisor'}</p>
                        <p className="text-[10px] text-[#71737D] truncate m-0">{user?.email || 'supervisor@hrm.com'}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E6F7F1] text-[#01B075]">
                          Field Supervisor
                        </span>
                      </div>
                    </div>

                    <div className="py-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/supervisor/profile');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#464853] hover:text-[#01B075] hover:bg-[#F4F6F8] transition-all cursor-pointer"
                      >
                        <Profile2Icon className="w-4 h-4 text-[#71737D]" />
                        <span>My Profile</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        <Login2Icon className="w-4 h-4 text-rose-500 rotate-180" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Offline Banner if offline */}
          {(isOffline || offlineQueueLength > 0) && (
            <div className="px-4 sm:px-8 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Offline mode</strong> • {offlineQueueLength} changes pending sync.
                </span>
              </div>
              {onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  className="text-[11px] font-bold text-amber-800 underline hover:text-amber-900 cursor-pointer"
                >
                  Sync now
                </button>
              )}
            </div>
          )}

          {/* PAGE CONTENT CONTAINER */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div >

      {/* SHADCN NOTIFICATION DRAWER (SLIDES FROM RIGHT) */}
      <NotificationDrawer
        open={showNotifications}
        onOpenChange={setShowNotifications}
        pendingLeavesCount={pendingLeaveCount}
        pendingRegularizationsCount={pendingAttendanceCount}
      />
    </div >
  );
};

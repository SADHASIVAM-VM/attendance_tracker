import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { NeedHelpCard } from '../common/NeedHelpCard';
import {
  SupervisorWorksite,
  SupervisorWorkerAttendance,
  WorkerLeaveItem,
} from '../../types/supervisor';
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  FileEdit,
  Receipt,
  User,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  Building2,
  RefreshCw,
  Users,
  Sliders,
  History,
  Palmtree,
  UserCheck,
  AlertTriangle,
  XCircle,
  WifiOff,
} from 'lucide-react';

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
      .catch(() => {});
  }, [location.pathname]);

  // Nested Attendance Sub-items
  const attendanceSubItems = [
    {
      id: 'daily-attendance',
      path: '/supervisor/attendance/daily',
      label: 'Daily Attendance',
      sublabel: 'Today & Missing',
      icon: Users,
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
      icon: Clock,
      badge: exceptionsSummary.missingAttendanceCount,
    },
    {
      id: 'attendance-overrides',
      path: '/supervisor/attendance/overrides',
      label: 'Attendance Override',
      sublabel: 'Current Month',
      icon: Sliders,
    },
    {
      id: 'attendance-history',
      path: '/supervisor/attendance/history',
      label: 'Attendance History',
      sublabel: 'Date Range Log',
      icon: History,
    },
  ];

  // Main navigation items
  const mainNavItems = [
    { id: 'dashboard', path: '/supervisor/home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'regularization', path: '/supervisor/regularization', label: 'Regularisation', icon: FileEdit },
    { id: 'leave-requests', path: '/supervisor/leaves', label: 'Leave Requests', icon: CalendarDays },
    { id: 'spend', path: '/supervisor/spend', label: 'Spend Ledger', icon: Receipt },
  ];

  // Personal navigation items
  const personalNavItems = [
    { id: 'my-attendance', path: '/supervisor/my-attendance', label: 'My Attendance', icon: UserCheck },
    { id: 'my-leave', path: '/supervisor/my-leave', label: 'My Leave', icon: Palmtree },
    { id: 'profile', path: '/supervisor/profile', label: 'Profile', icon: User },
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
            {/* Logo Brand */}
            <div
              className="flex items-center gap-2.5 px-2 cursor-pointer"
              onClick={() => navigate('/supervisor/home')}
            >
              <div className="w-10 h-10 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(18,166,106,0.35)]">
                <Clock className="w-5 h-5 stroke-[2.5]" />
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

            {/* Main Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Main
              </span>

              {/* Dashboard */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/home')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                  isPathActive('/supervisor/home')
                    ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${isPathActive('/supervisor/home') ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                <span>Dashboard</span>
              </button>

              {/* Attendance - NESTED COLLAPSIBLE ACCORDION */}
              <div className="space-y-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                    isAttendancePath
                      ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`w-4 h-4 ${isAttendancePath ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                    <span>Attendance</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      attendanceExpanded ? 'rotate-180 text-[#12A66A]' : 'text-[#94A3B8]'
                    }`}
                  />
                </button>

                {/* Sub-items */}
                {attendanceExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-[#E8EEF4] space-y-1 py-1 animate-in fade-in duration-150">
                    {attendanceSubItems.map((sub) => {
                      const Icon = sub.icon;
                      const active = isPathActive(sub.path);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleNavClick(sub.path)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-xs font-medium transition-all cursor-pointer text-left ${
                            active
                              ? 'bg-[#12A66A] text-white shadow-xs font-bold'
                              : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-[#64748B]'}`} />
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                  isPathActive('/supervisor/regularization')
                    ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                }`}
              >
                <FileEdit className={`w-4 h-4 ${isPathActive('/supervisor/regularization') ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                <span>Regularisation</span>
              </button>

              {/* Leave Requests (Team Leaves) */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/leaves')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                  isPathActive('/supervisor/leaves')
                    ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className={`w-4 h-4 ${isPathActive('/supervisor/leaves') ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                  <span>Leave Requests</span>
                </div>
                {pendingLeaveCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#B45309]">
                    {pendingLeaveCount}
                  </span>
                )}
              </button>

              {/* Spend Ledger */}
              <button
                type="button"
                onClick={() => handleNavClick('/supervisor/spend')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                  isPathActive('/supervisor/spend')
                    ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs font-bold'
                    : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                }`}
              >
                <Receipt className={`w-4 h-4 ${isPathActive('/supervisor/spend') ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                <span>Spend Ledger</span>
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
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                        : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold text-[#64748B] hover:text-[#E5484D] hover:bg-rose-50 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#64748B]" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Support Card at Bottom */}
          <div className="pt-4">
            <NeedHelpCard />
          </div>
        </aside>

        {/* ========================================================= */}
        {/* 2. MOBILE DRAWER (IDENTICAL TO ADMIN APPSHELL)           */}
        {/* ========================================================= */}
        {mobileMenuOpen && (
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
                      <Clock className="w-5 h-5 stroke-[2.5]" />
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
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                    Main
                  </span>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/supervisor/home')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                      isPathActive('/supervisor/home')
                        ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                        : 'text-[#64748B] hover:text-[#111827]'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </button>

                  {/* Attendance in mobile */}
                  <div className="space-y-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                        isAttendancePath ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4" />
                        <span>Attendance</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 ${attendanceExpanded ? 'rotate-180' : ''}`} />
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
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-xs font-medium transition-all ${
                                active ? 'bg-[#12A66A] text-white font-bold' : 'text-[#64748B]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon className="w-3.5 h-3.5" />
                                <span className="truncate">{sub.label}</span>
                              </div>
                              {sub.badge && sub.badge > 0 ? (
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                                    active ? 'bg-white text-[#12A66A]' : 'bg-amber-100 text-amber-800'
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
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                      isPathActive('/supervisor/regularization') ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
                    }`}
                  >
                    <FileEdit className="w-4 h-4" />
                    <span>Regularisation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/supervisor/leaves')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                      isPathActive('/supervisor/leaves') ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>Leave Requests</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/supervisor/spend')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                      isPathActive('/supervisor/spend') ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
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
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                          active ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
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
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. MAIN BODY AREA & TOP BAR (MATCHES ADMIN APPSHELL)     */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TOP BAR */}
          <header className="h-16 bg-white/80 backdrop-blur border-b border-[#E8EEF4] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
            {/* Left Controls (Mobile menu toggle + Search Bar) */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-500 hover:text-slate-800 lg:hidden rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Search Bar on Left */}
              <div className="relative hidden sm:block w-64 lg:w-80">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search workers, sites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] placeholder-[#94A3B8] text-[#111827] transition-all"
                />
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">

              {/* Worksite Selector Pill Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(!showLocationPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E6F7EF] hover:bg-[#C3F2DD] text-[#0E8F5B] text-xs font-bold transition-all cursor-pointer border border-[#12A66A]/20"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[100px] sm:max-w-[140px] truncate">
                    {selectedWorksite.name ? selectedWorksite.name.split(' - ')[0] : 'Worksite'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[#12A66A]" />
                </button>

                {showLocationPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowLocationPicker(false)}
                    />
                    <div className="absolute right-0 top-10 z-50 w-72 bg-white rounded-[16px] shadow-2xl border border-[#E8EEF4] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 block">
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
                              className={`w-full p-2.5 rounded-[12px] text-left text-xs transition-colors flex items-start gap-2.5 ${
                                isSelected
                                  ? 'bg-[#E6F7EF] text-[#0E8F5B] font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <Building2
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  isSelected ? 'text-[#12A66A]' : 'text-slate-400'
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
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white hover:bg-[#F8FAFC] text-slate-700 hover:text-[#12A66A] border border-[#E8EEF4] text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingRoster ? 'animate-spin text-[#12A66A]' : 'text-slate-500'}`}
                />
                <span className="hidden md:inline">Refresh</span>
              </button>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-10 h-10 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:bg-white transition-all cursor-pointer relative"
                >
                  <Bell className="w-4 h-4" />
                  {(pendingAttendanceCount > 0 || pendingLeaveCount > 0) && (
                    <span className="w-2 h-2 rounded-full bg-[#12A66A] absolute top-2.5 right-2.5 ring-2 ring-white" />
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotifications(false)}
                    />
                    <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-[18px] shadow-2xl border border-[#E8EEF4] p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-900">Notifications</span>
                        <span className="text-[10px] text-[#12A66A] font-bold">Live</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-[#E6F7EF] rounded-[10px] text-slate-700 space-y-0.5">
                          <strong className="block text-[#0E8F5B] font-bold">
                            Pending Punches
                          </strong>
                          <span>{pendingAttendanceCount} worker punches awaiting review.</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-[10px] text-slate-700 space-y-0.5">
                          <strong className="block text-slate-900 font-bold">
                            Pending Leave Requests
                          </strong>
                          <span>{pendingLeaveCount} leave requests awaiting decision.</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
                <div
                  onClick={() => handleNavClick('/supervisor/profile')}
                  className="w-10 h-10 rounded-full bg-[#12A66A]/10 text-[#12A66A] flex items-center justify-center font-bold text-sm cursor-pointer"
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
                <div
                  onClick={() => handleNavClick('/supervisor/profile')}
                  className="hidden xl:block text-left leading-tight cursor-pointer"
                >
                  <span className="font-bold text-xs text-[#111827] block">
                    {user?.fullName || 'Supervisor'}
                  </span>
                  <span className="text-[10px] text-[#6B7280] block">
                    {user?.email || 'supervisor@company.com'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign Out"
                  className="w-9 h-9 rounded-full bg-[#F8FAFC] hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-[#E2E8F0] flex items-center justify-center transition-all cursor-pointer ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
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
      </div>
    </div>
  );
};

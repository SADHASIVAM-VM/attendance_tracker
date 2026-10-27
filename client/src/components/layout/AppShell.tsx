import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NeedHelpCard } from '../common/NeedHelpCard';
import { apiRequest } from '../../lib/api';
import {
  LayoutDashboard,
  Clock,
  Users,
  MapPin,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  CalendarDays,
  ShieldCheck,
  History,
  Receipt,
  ChevronDown,
  Sliders,
  FileEdit,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface AppShellProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pending counts for badges
  const [pendingLeavesCount, setPendingLeavesCount] = useState<number>(0);
  const [pendingExpensesCount, setPendingExpensesCount] = useState<number>(0);
  const [pendingRegularizationsCount, setPendingRegularizationsCount] = useState<number>(0);

  // Auto-expand attendance submenu if on any attendance-related route
  const isAttendanceActive =
    location.pathname.startsWith('/admin/attendance') ||
    location.pathname.startsWith('/admin/exceptions') ||
    location.pathname.startsWith('/admin/regularization') ||
    location.pathname.startsWith('/admin/regularisation') ||
    location.pathname === '/admin/reports';

  const [attendanceExpanded, setAttendanceExpanded] = useState<boolean>(isAttendanceActive);

  useEffect(() => {
    if (isAttendanceActive) {
      setAttendanceExpanded(true);
    }
  }, [isAttendanceActive]);

  // Attendance Exceptions Section state & summary badge counts
  const [exceptionsSummary, setExceptionsSummary] = useState({
    missingAttendanceCount: 0,
    pendingRegularisationCount: 0,
    rejectedRegularisationCount: 0,
    totalExceptionsCount: 0,
  });

  const isExceptionsActive =
    location.pathname.startsWith('/admin/attendance-exceptions') ||
    location.pathname.startsWith('/admin/exceptions');
  const [exceptionsExpanded, setExceptionsExpanded] = useState<boolean>(isExceptionsActive);

  useEffect(() => {
    if (isExceptionsActive) {
      setExceptionsExpanded(true);
    }
  }, [isExceptionsActive]);

  // Fetch pending review counts for badges
  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const [leavesRes, expensesRes, regRes, exRes] = await Promise.allSettled([
          apiRequest('/leave/requests/pending'),
          apiRequest('/expenses?status=PENDING'),
          apiRequest('/regularization/pending'),
          apiRequest('/attendance/exceptions/summary'),
        ]);

        if (isMounted) {
          if (leavesRes.status === 'fulfilled' && Array.isArray(leavesRes.value)) {
            setPendingLeavesCount(leavesRes.value.length);
          }
          if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value)) {
            setPendingExpensesCount(expensesRes.value.length);
          }
          if (regRes.status === 'fulfilled') {
            const list = Array.isArray(regRes.value) ? regRes.value : regRes.value?.requests || [];
            setPendingRegularizationsCount(list.length);
          }
          if (exRes.status === 'fulfilled' && exRes.value) {
            setExceptionsSummary(exRes.value);
          }
        }
      } catch (err) {
        // Silently fail badge fetch in background
      }
    };

    fetchCounts();
  }, [location.pathname]);

  const exceptionSubItems = [
    {
      id: 'missing-attendance',
      path: '/admin/attendance-exceptions?category=missing',
      label: 'Missing Attendance',
      badge: exceptionsSummary.missingAttendanceCount,
      icon: Clock,
    },
    {
      id: 'pending-regularisation',
      path: '/admin/attendance-exceptions?category=pending-regularisation',
      label: 'Pending Regularisation',
      badge: exceptionsSummary.pendingRegularisationCount,
      icon: FileEdit,
    },
    {
      id: 'rejected-regularisation',
      path: '/admin/attendance-exceptions?category=rejected-regularisation',
      label: 'Rejected Regularisation',
      badge: exceptionsSummary.rejectedRegularisationCount,
      icon: XCircle,
    },
  ];

  // Nested Attendance Sub-items
  const attendanceSubItems = [
    {
      id: 'daily-attendance',
      path: '/admin/attendance',
      label: 'Daily Attendance',
      sublabel: 'Today & Missing Logs',
      icon: Clock,
    },
    {
      id: 'attendance-control',
      path: '/admin/attendance-control',
      label: 'Attendance Control Center',
      sublabel: 'Realtime Flags & Review',
      icon: ShieldCheck,
    },
    {
      id: 'attendance-override',
      path: '/admin/attendance-override',
      label: 'Attendance Override',
      sublabel: 'Record Missing Attendance',
      icon: FileEdit,
    },
    {
      id: 'attendance-reports',
      path: '/admin/reports',
      label: 'Reports & Analytics',
      sublabel: 'OT & Reconciliation',
      icon: BarChart3,
    },
  ];

  // Main Navigation Items with Routes
  const mainNavItems = [
    { id: 'dashboard', path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'leave-approvals',
      path: '/admin/leave-approvals',
      label: 'Leave Requests',
      icon: CalendarDays,
      badge: pendingLeavesCount,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'spend-approvals',
      path: '/admin/spend',
      label: 'Spend Approvals',
      icon: Receipt,
      badge: pendingExpensesCount,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'regularization',
      path: '/admin/regularization',
      label: 'Regularisation',
      icon: FileEdit,
      badge: pendingRegularizationsCount,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    { id: 'roster', path: '/admin/roster', label: 'Site Assignments', icon: CalendarDays },
    { id: 'users', path: '/admin/users', label: 'User Management', icon: Users },
    { id: 'worksites', path: '/admin/worksites', label: 'Locations', icon: MapPin },
  ];

  const otherNavItems = [
    { id: 'audit-logs', path: '/admin/audit-logs', label: 'Audit Logs', icon: History },
    { id: 'org-settings', path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (item: { id: string; path: string }) => {
    if (onTabChange) onTabChange(item.id);
    navigate(item.path);
    setMobileMenuOpen(false);
  };

  const isItemActive = (item: { id: string; path: string }) => {
    if (location.pathname === item.path) return true;
    if (item.id === 'dashboard' && (location.pathname === '/admin' || location.pathname === '/admin/')) return true;
    if (item.id === 'leave-approvals' && (location.pathname.startsWith('/admin/leave') || location.pathname.startsWith('/admin/leaves'))) return true;
    if (item.id === 'spend-approvals' && (location.pathname.startsWith('/admin/spend') || location.pathname.startsWith('/admin/expenses'))) return true;
    if (item.id === 'regularization' && (location.pathname.startsWith('/admin/regularization') || location.pathname.startsWith('/admin/regularisation'))) return true;
    if (item.id === 'attendance-exceptions' || item.id === 'exceptions') {
      return location.pathname.startsWith('/admin/attendance-exceptions') || location.pathname.startsWith('/admin/exceptions');
    }
    if (currentTab && currentTab === item.id) return true;
    return false;
  };

  const isSubItemActive = (sub: { id: string; path: string }) => {
    if (sub.id === 'daily-attendance') {
      return (
        location.pathname === '/admin/attendance' ||
        location.pathname === '/admin/attendance/' ||
        location.pathname === '/admin/attendance/daily'
      );
    }
    if (sub.id === 'attendance-regularization') {
      return (
        location.pathname.startsWith('/admin/regularization') ||
        location.pathname.startsWith('/admin/regularisation')
      );
    }
    if (sub.id === 'attendance-control') {
      return location.pathname === '/admin/attendance-control';
    }
    if (sub.id === 'attendance-reports') {
      return (
        location.pathname === '/admin/reports' ||
        location.pathname.startsWith('/admin/attendance/reports')
      );
    }
    return location.pathname === sub.path;
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] flex flex-col font-sans text-[#111827]">
      <div className="flex flex-1 overflow-hidden">
        {/* DESKTOP SIDEBAR */}
        <aside className="w-64 bg-white border-r border-[#E8EEF4] hidden lg:flex flex-col justify-between p-5 shrink-0 select-none">
          <div className="space-y-6 overflow-y-auto pr-1">
            {/* Logo Brand */}
            <div
              className="flex items-center gap-2.5 px-2 cursor-pointer"
              onClick={() => navigate('/admin/dashboard')}
            >
              <div className="w-10 h-10 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(18,166,106,0.35)]">
                <Clock className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-[#111827] block leading-tight">
                  Attendance Tracker
                </span>
                <span className="text-[10px] text-[#6B7280] font-semibold block leading-tight">
                  Workforce Geofence
                </span>
              </div>
            </div>

            {/* Main Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Main
              </span>

              {/* Dashboard */}
              {mainNavItems.slice(0, 1).map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active
                      ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Expandable Nested Attendance Navigation */}
              <div className="space-y-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isAttendanceActive
                    ? 'bg-[#E6F7EF]/60 text-[#12A66A] font-bold'
                    : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`w-4 h-4 ${isAttendanceActive ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                    <span>Attendance</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#94A3B8] transition-transform duration-200 ${attendanceExpanded ? 'rotate-180' : ''
                      }`}
                  />
                </button>

                {attendanceExpanded && (
                  <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-[#E6F7EF] ml-4 animate-in fade-in slide-in-from-top-1 duration-150">
                    {attendanceSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const subActive = isSubItemActive(sub);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            navigate(sub.path);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[11px] font-medium transition-all text-left cursor-pointer ${subActive
                            ? 'bg-[#E6F7EF] text-[#12A66A] font-bold shadow-2xs'
                            : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                            }`}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-[#12A66A]' : 'text-[#94A3B8]'}`} />
                          <div className="flex-1 min-w-0">
                            <span className="block truncate">{sub.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Other Main Nav Items (Leave Requests, Spend Approvals, Workers, Locations, etc.) */}
              {mainNavItems.slice(1).map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active
                      ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs font-bold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && item.badge > 0 ? (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Attendance Exceptions Section */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Attendance Exceptions
              </span>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/admin/attendance-exceptions');
                    setExceptionsExpanded(true);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                    isExceptionsActive && !location.search.includes('category=')
                      ? 'bg-[#E6F7EF] text-[#12A66A] font-bold shadow-xs'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Exceptions Dashboard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {exceptionsSummary.totalExceptionsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {exceptionsSummary.totalExceptionsCount}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        exceptionsExpanded ? 'rotate-180 text-[#12A66A]' : 'text-[#94A3B8]'
                      }`}
                    />
                  </div>
                </button>

                {exceptionsExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-[#E8EEF4] space-y-1 py-1 animate-in fade-in duration-150">
                    {exceptionSubItems.map((sub) => {
                      const Icon = sub.icon;
                      const active =
                        isExceptionsActive &&
                        location.search.includes(sub.path.split('?category=')[1] || '');
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            navigate(sub.path);
                            setMobileMenuOpen(false);
                          }}
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
                          {sub.badge > 0 && (
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                                active ? 'bg-white text-[#12A66A]' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Other Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Other
              </span>
              {otherNavItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active
                      ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                      }`}
                  >
                    <Icon className="w-4 h-4 text-[#64748B]" />
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

        {/* MOBILE DRAWER */}
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
                        Workforce Geofence
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

                  {/* Mobile Dashboard */}
                  {mainNavItems.slice(0, 1).map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active
                          ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                          : 'text-[#64748B] hover:text-[#111827]'
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}

                  {/* Mobile Nested Attendance */}
                  <div className="space-y-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isAttendanceActive
                        ? 'bg-[#E6F7EF]/60 text-[#12A66A] font-bold'
                        : 'text-[#64748B] hover:text-[#111827]'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4" />
                        <span>Attendance</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-[#94A3B8] transition-transform duration-200 ${attendanceExpanded ? 'rotate-180' : ''
                          }`}
                      />
                    </button>

                    {attendanceExpanded && (
                      <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-[#E6F7EF] ml-4">
                        {attendanceSubItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const subActive = isSubItemActive(sub);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                navigate(sub.path);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium transition-all text-left cursor-pointer ${subActive
                                ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                                : 'text-[#64748B] hover:text-[#111827]'
                                }`}
                            >
                              <SubIcon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-[#12A66A]' : 'text-[#94A3B8]'}`} />
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Other Mobile Nav items */}
                  {mainNavItems.slice(1).map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active
                          ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                          : 'text-[#64748B] hover:text-[#111827]'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && item.badge > 0 ? (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Attendance Exceptions Mobile */}
                <div className="space-y-1 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                    Attendance Exceptions
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      navigate('/admin/attendance-exceptions');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${
                      isExceptionsActive ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>Exceptions Dashboard</span>
                    </div>
                    {exceptionsSummary.totalExceptionsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {exceptionsSummary.totalExceptionsCount}
                      </span>
                    )}
                  </button>

                  <div className="ml-4 pl-3 border-l-2 border-[#E8EEF4] space-y-1 py-1">
                    {exceptionSubItems.map((sub) => {
                      const Icon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            navigate(sub.path);
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-xs text-[#64748B] hover:text-[#111827]"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{sub.label}</span>
                          </div>
                          {sub.badge > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-100 pt-4">
                  {otherNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${active
                          ? 'bg-[#E6F7EF] text-[#12A66A] font-bold'
                          : 'text-[#64748B] hover:text-[#111827]'
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
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold text-[#E5484D] hover:bg-rose-50 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* MAIN BODY AREA & TOP BAR */}
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

              <div className="relative hidden sm:block w-64 lg:w-80">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search workers, sites, dates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] placeholder-[#94A3B8] text-[#111827] transition-all"
                />
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Notification Bell */}
              <button
                type="button"
                className="w-10 h-10 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:bg-white transition-all cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-[#12A66A] absolute top-2.5 right-2.5 ring-2 ring-white" />
              </button>

              {/* User Profile */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-full bg-[#12A66A]/10 text-[#12A66A] flex items-center justify-center font-bold text-sm">
                  {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'AD'}
                </div>
                <div className="hidden xl:block text-left leading-tight">
                  <span className="font-bold text-xs text-[#111827] block">
                    {user?.fullName || 'Admin User'}
                  </span>
                  <span className="text-[10px] text-[#6B7280] block">
                    {user?.email || 'admin@company.com'}
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

          {/* PAGE CONTENT CONTAINER */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

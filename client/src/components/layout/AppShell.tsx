import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NeedHelpCard } from '../common/NeedHelpCard';
import { apiRequest } from '../../lib/api';
import { NotificationDrawer } from './NotificationDrawer';
import {
  HomeIcon,
  ClockIcon,
  Profile2Icon,
  Building1Icon,
  SearchIcon,
  NotificationIcon,
  MessageIcon,
  Chart2Icon,
  SecuritySafeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalenderIcon,
  Login2Icon,
  DollarCircleIcon,
  EditIcon,
  CloseCircleIcon,
  GroupIcon
} from '@astraicons/react/linear';
import {
  LayoutDashboard,
  Users,
  MapPin,

  HelpCircle,
  Search,
  Bell,
  Menu,
  X,
  CalendarDays,
  History,
  Receipt,
  ChevronDown,
  ChevronLeft,
  Sliders,

  AlertTriangle,
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
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [messagesOpen, setMessagesOpen] = useState<boolean>(false);

  // Close dropdowns on route change
  useEffect(() => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setMessagesOpen(false);
  }, [location.pathname]);

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
      icon: ClockIcon,
    },
    {
      id: 'pending-regularisation',
      path: '/admin/attendance-exceptions?category=pending-regularisation',
      label: 'Pending Regularisation',
      badge: exceptionsSummary.pendingRegularisationCount,
      icon: EditIcon,
    },
    {
      id: 'rejected-regularisation',
      path: '/admin/attendance-exceptions?category=rejected-regularisation',
      label: 'Rejected Regularisation',
      badge: exceptionsSummary.rejectedRegularisationCount,
      icon: CloseCircleIcon,
    },
  ];

  // Nested Attendance Sub-items
  const attendanceSubItems = [
    {
      id: 'daily-attendance',
      path: '/admin/attendance',
      label: 'Daily Attendance',
      sublabel: 'Today & Missing Logs',
      icon: ClockIcon,
    },
    {
      id: 'attendance-control',
      path: '/admin/attendance-control',
      label: 'Attendance Control Center',
      sublabel: 'Realtime Flags & Review',
      icon: SecuritySafeIcon,
    },
    {
      id: 'attendance-override',
      path: '/admin/attendance-override',
      label: 'Attendance Override',
      sublabel: 'Record Missing Attendance',
      icon: EditIcon,
    },
    {
      id: 'attendance-reports',
      path: '/admin/reports',
      label: 'Reports & Analytics',
      sublabel: 'OT & Reconciliation',
      icon: Chart2Icon,
    },
  ];

  // Main Navigation Items with Routes
  const mainNavItems = [
    { id: 'dashboard', path: '/admin/dashboard', label: 'Dashboard', icon: HomeIcon },
    {
      id: 'leave-approvals',
      path: '/admin/leave-approvals',
      label: 'Leave Requests',
      icon: CalenderIcon,
      badge: pendingLeavesCount,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'spend-approvals',
      path: '/admin/spend',
      label: 'Spend Approvals',
      icon: DollarCircleIcon,
      badge: pendingExpensesCount,
      badgeColor: 'bg-[#E6F7F1] text-[#01B075] border-[#76D4B4]',
    },
    {
      id: 'regularization',
      path: '/admin/regularization',
      label: 'Regularisation',
      icon: EditIcon,
      badge: pendingRegularizationsCount,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    { id: 'roster', path: '/admin/roster', label: 'Site Assignments', icon: CalenderIcon },
    { id: 'users', path: '/admin/users', label: 'User Management', icon: GroupIcon },
    { id: 'worksites', path: '/admin/worksites', label: 'Locations', icon: Building1Icon },
  ];

  const otherNavItems = [
    { id: 'audit-logs', path: '/admin/audit-logs', label: 'Audit Logs', icon: History },
    { id: 'org-settings', path: '/admin/settings', label: 'SearchIcon', icon: SearchIcon },
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
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col font-sans text-[#1E1F24]">
      <div className="flex flex-1 overflow-hidden">
        {/* DESKTOP SIDEBAR */}
        <aside className="w-64 bg-white border-r border-[#E8EEF4] hidden lg:flex flex-col justify-between p-5 shrink-0 select-none">
          <div className="space-y-6 overflow-y-auto pr-1">
            {/* Logo Brand matching Reference Image 3 */}
            <div className="flex items-center justify-between px-2">
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => navigate('/admin/dashboard')}
              >
                <div className="w-10 h-10 rounded-2xl bg-[#01B075] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(1,176,117,0.35)]">
                  <ClockIcon className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="font-extrabold text-base tracking-tight text-[#1E1F24] block leading-tight">
                    Attendance Tracker
                  </span>
                  <span className="text-[10px] text-[#71737D] font-semibold block leading-tight">
                    Workforce Geofence
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-[#01B075]/10 text-[#01B075] hover:bg-[#01B075] hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Main Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Home
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

              {/* Expandable Nested Attendance Navigation (Reference Image 5) */}
              <div className="space-y-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isAttendanceActive
                    ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                    : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <ClockIcon className={`w-4 h-4 ${isAttendanceActive ? 'text-white' : 'text-[#464853]'}`} />
                    <span>Attendance</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${isAttendanceActive ? 'text-white' : 'text-[#94A3B8]'
                      } ${attendanceExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {attendanceExpanded && (
                  <div className="relative ml-6 pl-3.5 border-l border-slate-200 space-y-1 py-1.5 animate-in fade-in duration-150">
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
                          className={`relative w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs transition-all text-left cursor-pointer ${subActive
                            ? 'text-[#1E1F24] font-bold bg-[#F4F6F8]/70'
                            : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]/40 font-medium'
                            }`}
                        >
                          {/* Active Accent Vertical Bar on Guideline */}
                          {subActive && (
                            <span className="absolute -left-[15px] top-1.5 bottom-1.5 w-[2.5px] bg-[#01B075] rounded-full" />
                          )}
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Circular Bullet matching Reference Image 5 */}
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${subActive ? 'bg-[#01B075]' : 'bg-slate-300'
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

              {/* Other Main Nav Items (Leave Requests, Spend Approvals, Workers, Locations, etc.) */}
              {mainNavItems.slice(1).map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${active
                      ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                      : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#464853]'}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.badge && item.badge > 0 ? (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      ) : null}
                      <ChevronRightIcon className={`w-3.5 h-3.5 ${active ? 'text-white/80' : 'text-[#94A3B8]'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Attendance Exceptions Section (Reference Image 5 Submenu Style) */}
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${isExceptionsActive && !location.search.includes('category=')
                    ? 'bg-[#01B075] text-white shadow-[0_4px_14px_-2px_rgba(1,176,117,0.35)] font-bold'
                    : 'text-[#464853] hover:text-[#1E1F24] hover:bg-[#F4F6F8]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-4 h-4 ${isExceptionsActive && !location.search.includes('category=') ? 'text-white' : 'text-amber-500'}`} />
                    <span>Exceptions Dashboard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {exceptionsSummary.totalExceptionsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {exceptionsSummary.totalExceptionsCount}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isExceptionsActive && !location.search.includes('category=') ? 'text-white' : 'text-[#94A3B8]'
                        } ${exceptionsExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {exceptionsExpanded && (
                  <div className="relative ml-6 pl-3.5 border-l border-slate-200 space-y-1 py-1.5 animate-in fade-in duration-150">
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
                          {sub.badge > 0 && (
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${active ? 'bg-[#E6F7F1] text-[#01B075]' : 'bg-amber-100 text-amber-800'
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
                SearchIcon & Audit
              </span>

              {otherNavItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item)}
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
                <Login2Icon className="w-4 h-4 text-[#464853]" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Daily Meeting Widget Card matching Reference Image 3 */}
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
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 ring-2 ring-white text-[10px] font-bold text-slate-600">+4</span>
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
                      <ClockIcon className="w-5 h-5 stroke-[2.5]" />
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
                        <ClockIcon className="w-4 h-4" />
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
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isExceptionsActive ? 'bg-[#E6F7EF] text-[#12A66A] font-bold' : 'text-[#64748B]'
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
                    <Login2Icon className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* MAIN BODY AREA & TOP BAR */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TOP BAR matching Reference Image 3 */}
          <header className="h-20 bg-[#F4F6F8] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
            {/* Left Controls (Mobile menu toggle + Reference Search Pill) */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 text-slate-500 hover:text-[#1E1F24] lg:hidden rounded-xl bg-white border border-[#E8EEF4] shadow-2xs cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

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
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Notification Bell matching Reference Image 3 (Opens shadcn Drawer from right) */}
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(true);
                  setUserMenuOpen(false);
                  setMessagesOpen(false);
                }}
                className="w-11 h-11 rounded-full bg-white border border-[#E8EEF4] flex items-center justify-center text-[#464853] hover:text-[#01B075] hover:border-[#01B075]/40 shadow-2xs transition-all cursor-pointer relative group"
                title="Notifications"
              >
                <NotificationIcon className="w-5 h-5 group-hover:scale-105 transition-transform" />
                {(pendingLeavesCount > 0 || pendingRegularizationsCount > 0 || pendingExpensesCount > 0) ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#01B075] absolute top-2.5 right-2.5 ring-2 ring-white" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#01B075] absolute top-2.5 right-2.5 ring-2 ring-white" />
                )}
              </button>

              {/* Message / Chat Bubble matching Reference Image 3 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMessagesOpen(!messagesOpen);
                    setUserMenuOpen(false);
                    setNotificationsOpen(false);
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
                      <h4 className="text-xs font-bold text-[#1E1F24] m-0">Recent Messages</h4>
                      <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">2 Unread</span>
                    </div>
                    <div className="py-2 space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors cursor-pointer flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#01B075]/10 text-[#01B075] font-bold text-xs flex items-center justify-center shrink-0">
                          SM
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1E1F24] text-[11px] m-0 truncate">Site Manager North</p>
                          <p className="text-[10px] text-[#71737D] m-0 truncate">Shift handover report completed.</p>
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
                    setNotificationsOpen(false);
                    setMessagesOpen(false);
                  }}
                  className="flex items-center gap-3 p-1 rounded-2xl hover:bg-white/60 transition-all cursor-pointer select-none group"
                >
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop"
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
                      {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'YA'}
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#01B075] absolute bottom-0 right-0 ring-2 ring-white" />
                  </div>

                  <div className="hidden sm:block text-left leading-tight">
                    <span className="font-bold text-sm text-[#1E1F24] block group-hover:text-[#01B075] transition-colors">
                      {user?.fullName || 'Yeasin Arafat'}
                    </span>
                    <span className="text-xs text-[#71737D] font-normal block mt-0.5">
                      {user?.role === 'admin' ? 'Super Admin' : user?.role || 'Super Admin'}
                    </span>
                  </div>

                  <ChevronDown className="w-4 h-4 text-[#71737D] group-hover:text-[#1E1F24] transition-colors ml-0.5 hidden sm:block" />
                </button>

                {/* Profile Popover / Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E8EEF4] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#01B075]/10 text-[#01B075] ring-2 ring-white shadow-2xs flex items-center justify-center font-bold text-sm shrink-0">
                        {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'YA'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-[#1E1F24] truncate m-0">{user?.fullName || 'Yeasin Arafat'}</p>
                        <p className="text-[10px] text-[#71737D] truncate m-0">{user?.email || 'admin@hrm.com'}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E6F7F1] text-[#01B075]">
                          {user?.role === 'admin' ? 'Super Admin' : user?.role || 'Super Admin'}
                        </span>
                      </div>
                    </div>

                    <div className="py-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/admin/settings');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#464853] hover:text-[#01B075] hover:bg-[#F4F6F8] transition-all cursor-pointer"
                      >
                        <SearchIcon className="w-4 h-4 text-[#71737D]" />
                        <span>Account SearchIcon</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/admin/help');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#464853] hover:text-[#01B075] hover:bg-[#F4F6F8] transition-all cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4 text-[#71737D]" />
                        <span>Help & Support</span>
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
                        <Login2Icon className="w-4 h-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

      {/* SHADCN NOTIFICATION DRAWER (SLIDES FROM RIGHT) */}
      <NotificationDrawer
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        pendingLeavesCount={pendingLeavesCount}
        pendingRegularizationsCount={pendingRegularizationsCount}
        pendingExpensesCount={pendingExpensesCount}
      />
    </div>
  );
};

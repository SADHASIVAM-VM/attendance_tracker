import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NeedHelpCard } from '../common/NeedHelpCard';
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
  Smartphone,
  ChevronDown,
  Building2,
  CalendarDays,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { user, organization, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const roles = user?.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isAdmin = roles.includes('ADMIN');
  const isSupervisor = roles.includes('SUPERVISOR');
  const isWorker = roles.includes('WORKER');

  // Navigation Items matching FreshCart reference
  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance-overview', label: 'Attendance', icon: Clock },
    { id: 'roster', label: 'Site Assignments', icon: CalendarDays },
    { id: 'users', label: 'Workers', icon: Users },
    { id: 'worksites', label: 'Locations', icon: MapPin },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  const otherNavItems = [
    { id: 'org-settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help/Support', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#F1F6FC] flex flex-col font-sans text-[#111827]">
      <div className="flex flex-1 overflow-hidden">
        {/* DESKTOP SIDEBAR MATCHING FRESHCART REFERENCE */}
        <aside className="w-64 bg-white border-r border-[#E8EEF4] hidden lg:flex flex-col justify-between p-5 shrink-0 select-none">
          <div className="space-y-6">
            {/* Logo Brand matching FreshCart with fresh green badge */}
            <div className="flex items-center gap-2.5 px-2">
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
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id || (item.id === 'dashboard' && currentTab === '');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isActive
                        ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs'
                        : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Other Navigation */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                Other
              </span>
              {otherNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isActive
                        ? 'bg-[#E6F7EF] text-[#12A66A]'
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

          {/* Mint-Green Support Card at Bottom */}
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
                  {mainNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id || (item.id === 'dashboard' && currentTab === '');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onTabChange(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isActive
                            ? 'bg-[#E6F7EF] text-[#12A66A] shadow-xs'
                            : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                          }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#12A66A]' : 'text-[#64748B]'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] px-3 block mb-2">
                    Other
                  </span>
                  {otherNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onTabChange(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-semibold transition-all cursor-pointer ${isActive
                            ? 'bg-[#E6F7EF] text-[#12A66A]'
                            : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                          }`}
                      >
                        <Icon className="w-4 h-4 text-[#64748B]" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
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
            </aside>
          </div>
        )}

        {/* MAIN BODY AREA & TOP BAR */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TOP BAR MATCHING REFERENCE */}
          <header className="h-20 bg-white/80 backdrop-blur border-b border-[#E8EEF4] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
            {/* Title & Subtitle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-500 hover:text-slate-800 lg:hidden rounded-lg hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827] leading-tight m-0">
                  {currentTab === 'roster'
                    ? 'Site Assignments'
                    : currentTab === 'worksites'
                      ? 'Worksite Locations'
                      : currentTab === 'users'
                        ? 'Workers & Staff'
                        : currentTab === 'attendance-overview'
                          ? 'Attendance Overview'
                          : currentTab === 'reports'
                            ? 'Reports & Analytics'
                            : currentTab === 'org-settings'
                              ? 'Settings'
                              : 'Dashboard Overview'}
                </h1>
                <p className="text-xs text-[#6B7280] leading-tight mt-0.5">
                  {currentTab === 'roster'
                    ? 'Schedule regional groups, assign locations, supervisors, and workforce'
                    : currentTab === 'worksites'
                      ? 'Manage geofenced work perimeters and physical work locations'
                      : currentTab === 'users'
                        ? 'Manage employee profiles, roles, and worksite assignments'
                        : currentTab === 'attendance-overview'
                          ? 'Live real-time monitoring and workforce clock-in records'
                          : currentTab === 'reports'
                            ? 'Comprehensive workforce presence and audit analytics'
                            : currentTab === 'org-settings'
                              ? 'Organization settings and geofence parameters'
                              : 'Welcome back! Your workforce attendance & site performance view'}
                </p>
              </div>
            </div>

            {/* Right Controls: Search, Notification Bell, Admin Profile, Worker Preview Toggle */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Search Pill */}
              <div className="relative hidden md:block w-64 lg:w-72">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search users, orders, products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] placeholder-[#94A3B8] text-[#111827] transition-all"
                />
              </div>

              {/* Notification Bell in soft circle */}
              <button
                type="button"
                className="w-10 h-10 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:bg-white transition-all cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-[#12A66A] absolute top-2.5 right-2.5 ring-2 ring-white" />
              </button>

              {/* Admin Avatar & Profile info with Logout */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#E2E8F0]">
                <img
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80"
                  alt="Admin User"
                  className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0]"
                />
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


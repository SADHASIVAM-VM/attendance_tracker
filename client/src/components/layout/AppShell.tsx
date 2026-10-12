import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  CalendarDays,
  Clock,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  CheckCircle2,
  Bell,
} from 'lucide-react';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
  highlight?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onTabChange, children }) => {
  const { user, organization, quickLogin, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roles = user?.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isAdmin = roles.includes('ADMIN');
  const isSupervisor = roles.includes('SUPERVISOR');
  const isWorker = roles.includes('WORKER');

  // Navigation items based on role
  const getNavItems = (): NavItem[] => {
    if (isSuperAdmin) {
      return [
        { id: 'dashboard', label: 'Global Overview', icon: LayoutDashboard },
        { id: 'roster', label: 'Assignment Planner', icon: CalendarDays },
        { id: 'org-settings', label: 'Organization Settings', icon: Building2 },
        { id: 'users', label: 'User Directory', icon: Users },
        { id: 'worksites', label: 'Physical Worksites', icon: MapPin },
        { id: 'attendance-overview', label: 'Organization Attendance', icon: Clock },
        { id: 'leave-approvals', label: 'Leave Review Queue', icon: FileText },
        { id: 'reports', label: 'Reports & CSV Exports', icon: FileText },
        { id: 'audit-logs', label: 'Security & Audit Logs', icon: History },
      ];
    }

    if (isAdmin) {
      return [
        { id: 'dashboard', label: 'Operations Dashboard', icon: LayoutDashboard },
        { id: 'roster', label: 'Assignment Planner', icon: CalendarDays },
        { id: 'worksites', label: 'Worksites & Geofences', icon: MapPin },
        { id: 'users', label: 'Workforce Users', icon: Users },
        { id: 'attendance-overview', label: 'Attendance Records', icon: Clock },
        { id: 'leave-approvals', label: 'Leave Approvals', icon: FileText },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'audit-logs', label: 'Audit Trail', icon: History },
      ];
    }

    if (isSupervisor) {
      return [
        { id: 'supervisor-dashboard', label: 'Supervisor Dashboard', icon: LayoutDashboard },
        { id: 'pending-approvals', label: 'Pending Approvals', icon: UserCheck, badge: 'Active' },
        { id: 'today-roster', label: 'My Assigned Schedule', icon: CalendarDays },
        { id: 'regularization', label: 'Regularization Requests', icon: ShieldCheck },
        { id: 'attendance-history', label: 'Attendance History', icon: History },
      ];
    }

    // Default to Worker
    return [
      { id: 'worker-home', label: 'Home & Shift', icon: LayoutDashboard },
      { id: 'clock-in', label: 'Clock In / Out', icon: Clock, highlight: true },
      { id: 'my-attendance', label: 'My Attendance', icon: History },
      { id: 'leave-apply', label: 'Apply for Leave', icon: CalendarDays },
      { id: 'my-leave', label: 'My Leave Requests', icon: FileText },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-500 hover:text-slate-800 lg:hidden rounded-lg hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-xs">
              P
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-950 block leading-tight">
                PULSE ATTENDANCE
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block leading-tight">
                {organization?.name || 'Enterprise'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Role Switcher Bar for instant Pair-Programming & Verification */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <span className="text-[11px] font-medium text-slate-500 px-2 uppercase tracking-wider">
            Switch Role:
          </span>
          <button
            onClick={() => quickLogin('SUPER_ADMIN')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isSuperAdmin ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Super Admin
          </button>
          <button
            onClick={() => quickLogin('ADMIN')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isAdmin && !isSuperAdmin ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => quickLogin('SUPERVISOR')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isSupervisor ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Supervisor
          </button>
          <button
            onClick={() => quickLogin('WORKER')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isWorker ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Worker
          </button>
        </div>

        {/* User profile & logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-slate-900 block leading-tight">
              {user?.fullName}
            </span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[10px] font-mono text-slate-500">{user?.employeeCode}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {roles[0]?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col justify-between p-4 shrink-0">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Workspace Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : item.highlight
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Geofence Enforced</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Default radius: {organization?.defaultGeofenceRadius || 20}m. Real-time GPS & selfie validation active.
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-white h-full p-4 flex flex-col justify-between shadow-2xl z-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-sm text-slate-900">Workspace Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onTabChange(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[11px] text-slate-500 font-semibold uppercase">Switch Account:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      quickLogin('SUPER_ADMIN');
                      setMobileMenuOpen(false);
                    }}
                    className="p-1.5 text-xs bg-slate-100 rounded-lg text-slate-700 font-medium"
                  >
                    Super Admin
                  </button>
                  <button
                    onClick={() => {
                      quickLogin('ADMIN');
                      setMobileMenuOpen(false);
                    }}
                    className="p-1.5 text-xs bg-slate-100 rounded-lg text-slate-700 font-medium"
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => {
                      quickLogin('SUPERVISOR');
                      setMobileMenuOpen(false);
                    }}
                    className="p-1.5 text-xs bg-slate-100 rounded-lg text-slate-700 font-medium"
                  >
                    Supervisor
                  </button>
                  <button
                    onClick={() => {
                      quickLogin('WORKER');
                      setMobileMenuOpen(false);
                    }}
                    className="p-1.5 text-xs bg-slate-100 rounded-lg text-slate-700 font-medium"
                  >
                    Worker
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

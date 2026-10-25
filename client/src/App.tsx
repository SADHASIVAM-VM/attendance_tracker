import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './views/auth/LoginView';
import { AppShell } from './components/layout/AppShell';
import { SupervisorTodayRosterView } from './views/supervisor/SupervisorTodayRosterView';
import { SupervisorApprovalsView } from './views/supervisor/SupervisorApprovalsView';
import { SupervisorRegularizationView } from './views/supervisor/SupervisorRegularizationView';
import { DashboardOverview } from './views/admin/DashboardOverview';
import { RosterPlannerView } from './views/admin/RosterPlannerView';
import { WorksitesView } from './views/admin/WorksitesView';
import { UsersView } from './views/admin/UsersView';
import { AdminLeaveApprovalsView } from './views/admin/AdminLeaveApprovalsView';
import { ReportsView } from './views/admin/ReportsView';
import { AuditLogsView } from './views/admin/AuditLogsView';
import { OrgSettingsView } from './views/admin/OrgSettingsView';
import { AdminExceptionDashboardView } from './views/admin/AdminExceptionDashboardView';
import { AdminAttendanceControlCenterView } from './views/admin/AdminAttendanceControlCenterView';
import { FieldWorkerApp } from './views/worker/FieldWorkerApp';
import { SupervisorApp } from './views/supervisor/SupervisorApp';
import { RefreshCw } from 'lucide-react';

const MainApplication: React.FC = () => {
  const { user, isInitializing } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('');

  const roles = user?.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isAdmin = roles.includes('ADMIN');
  const isSupervisor = roles.includes('SUPERVISOR');
  const isWorker = roles.includes('WORKER');

  // Set default tab based on role upon login or role switch
  useEffect(() => {
    if (!user) return;
    if (isWorker) {
      setCurrentTab('clock-in');
    } else if (isSupervisor) {
      setCurrentTab('pending-approvals');
    } else {
      setCurrentTab('dashboard');
    }
  }, [user?.id, user?.roles?.join(',')]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Authenticating session...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (currentTab) {
      // Supervisor views
      case 'supervisor-dashboard':
      case 'pending-approvals':
        return <SupervisorApprovalsView />;
      case 'today-roster':
        return <SupervisorTodayRosterView />;
      case 'regularization':
        return <SupervisorRegularizationView />;
      case 'attendance-history':
        return <ReportsView />;

      // Admin / Super Admin views
      case 'dashboard':
        return <DashboardOverview onNavigate={(t) => setCurrentTab(t)} />;
      case 'roster':
        return <RosterPlannerView />;
      case 'worksites':
        return <WorksitesView />;
      case 'users':
        return <UsersView />;
      case 'leave-approvals':
        return <AdminLeaveApprovalsView />;
      case 'attendance-control':
      case 'exceptions':
        return <AdminAttendanceControlCenterView />;
      case 'reports':
      case 'attendance-overview':
        return <ReportsView />;
      case 'audit-logs':
        return <AuditLogsView />;
      case 'org-settings':
        return <OrgSettingsView />;

      default:
        return <DashboardOverview onNavigate={(t) => setCurrentTab(t)} />;
    }
  };

  if (isSuperAdmin || isAdmin) {
    return (
      <AppShell currentTab={currentTab} onTabChange={setCurrentTab}>
        {renderActiveView()}
      </AppShell>
    );
  }

  if (isSupervisor) {
    return <SupervisorApp />;
  }

  // Field workers access worker portal alone
  return <FieldWorkerApp />;
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApplication />
      </AuthProvider>
    </ToastProvider>
  );
}

import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './views/auth/LoginView';
import { AppShell } from './components/layout/AppShell';
import { DashboardOverview } from './views/admin/DashboardOverview';
import { RosterPlannerView } from './views/admin/RosterPlannerView';
import { WorksitesView } from './views/admin/WorksitesView';
import { UsersView } from './views/admin/UsersView';
import { AdminLeaveApprovalsView } from './views/admin/AdminLeaveApprovalsView';
import { ReportsView } from './views/admin/ReportsView';
import { AdminDailyAttendanceView } from './views/admin/AdminDailyAttendanceView';
import { AdminRegularizationView } from './views/admin/AdminRegularizationView';
import { AuditLogsView } from './views/admin/AuditLogsView';
import { OrgSettingsView } from './views/admin/OrgSettingsView';
import { AdminAttendanceControlCenterView } from './views/admin/AdminAttendanceControlCenterView';
import { AdminAttendanceOverrideView } from './views/admin/AdminAttendanceOverrideView';
import { SiteExpensesTab } from './views/admin/SiteExpensesTab';
import { AttendanceExceptionsView } from './views/common/AttendanceExceptionsView';
import { FieldWorkerApp } from './views/worker/FieldWorkerApp';
import { SupervisorApp } from './views/supervisor/SupervisorApp';
import { RefreshCw } from 'lucide-react';

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#12A66A]" />
    Authenticating session...
  </div>
);

// Redirect to role-appropriate home view
const RoleRedirect: React.FC = () => {
  const { user, isInitializing } = useAuth();
  if (isInitializing) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const roles = user.roles || [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (roles.includes('SUPERVISOR')) {
    return <Navigate to="/supervisor/attendance" replace />;
  }
  return <Navigate to="/worker/clock-in" replace />;
};

// Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = user.roles || [];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return <RoleRedirect />;
    }
  }

  return <>{children}</>;
};

// Admin Application Sub-Routes
const AdminAppRoutes: React.FC = () => {
  const navigate = useNavigate();

  const handleAdminNavigate = (tab: string) => {
    switch (tab) {
      case 'exceptions':
      case 'attendance-control':
      case 'attendance/control':
        navigate('/admin/attendance-control');
        break;
      case 'users':
        navigate('/admin/users');
        break;
      case 'reports':
        navigate('/admin/reports');
        break;
      case 'attendance-overview':
      case 'attendance':
      case 'attendance/daily':
        navigate('/admin/attendance');
        break;
      case 'attendance-override':
      case 'attendance/override':
        navigate('/admin/attendance-override');
        break;
      case 'roster':
        navigate('/admin/roster');
        break;
      case 'worksites':
        navigate('/admin/worksites');
        break;
      case 'leave-approvals':
      case 'leaves':
      case 'leave-requests':
        navigate('/admin/leave-approvals');
        break;
      case 'spend':
      case 'spend-approvals':
      case 'expenses':
        navigate('/admin/spend');
        break;
      case 'regularization':
      case 'regularisation':
      case 'regularization-requests':
      case 'regularisation-requests':
        navigate('/admin/regularization');
        break;
      case 'attendance-exceptions':
      case 'exceptions':
        navigate('/admin/attendance-exceptions');
        break;
      case 'audit-logs':
        navigate('/admin/audit-logs');
        break;
      case 'org-settings':
      case 'settings':
        navigate('/admin/settings');
        break;
      default:
        navigate('/admin/dashboard');
        break;
    }
  };

  return (
    <AppShell>
      <Routes>
        <Route path="dashboard" element={<DashboardOverview onNavigate={handleAdminNavigate} />} />
        <Route path="attendance" element={<AdminDailyAttendanceView />} />
        <Route path="attendance/daily" element={<AdminDailyAttendanceView />} />
        <Route path="attendance-overview" element={<AdminDailyAttendanceView />} />
        <Route path="attendance-control" element={<AdminAttendanceControlCenterView />} />
        <Route path="attendance/control" element={<AdminAttendanceControlCenterView />} />
        <Route path="attendance-override" element={<AdminAttendanceOverrideView />} />
        <Route path="attendance/override" element={<AdminAttendanceOverrideView />} />
        <Route path="attendance-exceptions" element={<AttendanceExceptionsView isSupervisorView={false} />} />
        <Route path="exceptions" element={<AttendanceExceptionsView isSupervisorView={false} />} />
        <Route path="roster" element={<RosterPlannerView />} />
        <Route path="users" element={<UsersView />} />
        <Route path="worksites" element={<WorksitesView />} />
        <Route path="leave-approvals" element={<AdminLeaveApprovalsView />} />
        <Route path="leaves" element={<AdminLeaveApprovalsView />} />
        <Route path="leave-requests" element={<AdminLeaveApprovalsView />} />
        <Route path="spend" element={<SiteExpensesTab />} />
        <Route path="spend-approvals" element={<SiteExpensesTab />} />
        <Route path="expenses" element={<SiteExpensesTab />} />
        <Route path="regularization" element={<AdminRegularizationView />} />
        <Route path="regularisation" element={<AdminRegularizationView />} />
        <Route path="regularization-requests" element={<AdminRegularizationView />} />
        <Route path="regularisation-requests" element={<AdminRegularizationView />} />
        <Route path="reports" element={<ReportsView />} />
        <Route path="attendance/reports" element={<ReportsView />} />
        <Route path="audit-logs" element={<AuditLogsView />} />
        <Route path="settings" element={<OrgSettingsView />} />
        <Route path="org-settings" element={<OrgSettingsView />} />
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AppShell>
  );
};

// Top-level smart redirects for common URLs
const AttendanceRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const roles = user.roles || [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
    return <Navigate to="/admin/attendance" replace />;
  }
  if (roles.includes('SUPERVISOR')) {
    return <Navigate to="/supervisor/attendance" replace />;
  }
  return <Navigate to="/worker/attendance" replace />;
};

const RegularizationRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const roles = user.roles || [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
    return <Navigate to="/admin/regularization" replace />;
  }
  if (roles.includes('SUPERVISOR')) {
    return <Navigate to="/supervisor/regularization" replace />;
  }
  return <Navigate to="/worker/attendance" replace />;
};

const MainApplication: React.FC = () => {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route
        path="/login"
        element={user ? <RoleRedirect /> : <LoginView />}
      />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminAppRoutes />
          </ProtectedRoute>
        }
      />

      {/* Supervisor Routes */}
      <Route
        path="/supervisor/*"
        element={
          <ProtectedRoute allowedRoles={['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN']}>
            <SupervisorApp />
          </ProtectedRoute>
        }
      />

      {/* Field Worker & Staff Routes */}
      <Route
        path="/worker/*"
        element={
          <ProtectedRoute allowedRoles={['WORKER', 'ENGINEER', 'ACCOUNTANT', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN']}>
            <FieldWorkerApp />
          </ProtectedRoute>
        }
      />

      {/* Smart Root and Direct Alias Routes */}
      <Route path="/attendance/*" element={<AttendanceRedirect />} />
      <Route path="/regularization/*" element={<RegularizationRedirect />} />
      <Route path="/dashboard" element={<RoleRedirect />} />
      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
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

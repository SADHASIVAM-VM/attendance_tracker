import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import {
  Building2,
  Users,
  MapPin,
  CalendarDays,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export const DashboardOverview: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    usersCount: 0,
    worksitesCount: 0,
    assignmentsToday: 0,
    pendingApprovals: 0,
    pendingLeaves: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const [users, sites, assignments, leaves] = await Promise.all([
        apiRequest('/users'),
        apiRequest('/worksites'),
        apiRequest(`/assignments?date=${todayStr}`),
        apiRequest('/leave/requests/pending'),
      ]);

      setStats({
        usersCount: users.length,
        worksitesCount: sites.length,
        assignmentsToday: assignments.length,
        pendingApprovals: assignments.reduce((acc: number, a: any) => acc + (a.workers?.length || 0), 0),
        pendingLeaves: leaves.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Operations Control Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time workforce deployment, physical geofence verification and shift attendance status.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Worksites"
          value={stats.worksitesCount}
          subtitle="Enforced Geofences"
          icon={MapPin}
        />
        <StatCard
          title="Today's Shifts"
          value={stats.assignmentsToday}
          subtitle="Published Rosters"
          icon={CalendarDays}
        />
        <StatCard
          title="Total Workforce"
          value={stats.usersCount}
          subtitle="Registered Staff"
          icon={Users}
        />
        <StatCard
          title="Pending Leave Reviews"
          value={stats.pendingLeaves}
          subtitle="Direct Admin Queue"
          icon={FileText}
          badge={stats.pendingLeaves > 0 ? 'Requires Action' : undefined}
          badgeColor="text-amber-700 bg-amber-50"
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('roster')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm mb-1">Plan & Publish Rosters</h3>
          <p className="text-xs text-slate-500">
            Create daily worksite assignments, designate supervisors, and publish rosters for workers.
          </p>
        </div>

        <div
          onClick={() => onNavigate('worksites')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm mb-1">Manage Worksites</h3>
          <p className="text-xs text-slate-500">
            Configure reference coordinates, perimeter radius (default 20m), and GPS precision limits.
          </p>
        </div>

        <div
          onClick={() => onNavigate('reports')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm mb-1">Historical Reports</h3>
          <p className="text-xs text-slate-500">
            Filter historical attendance with date-specific supervisor routing and export sanitized CSV.
          </p>
        </div>
      </div>
    </div>
  );
};

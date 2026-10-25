import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { WeeklyAttendanceChart } from '../../components/dashboard/WeeklyAttendanceChart';
import { AttendanceDonutChart } from '../../components/dashboard/AttendanceDonutChart';
import { RecentClockInsTable, ClockInRecord } from '../../components/dashboard/RecentClockInsTable';
import { TopLocationsList } from '../../components/dashboard/TopLocationsList';
import { WorkerDetailModal } from '../../components/dashboard/WorkerDetailModal';
import {
  Users,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  Camera,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const [selectedWorker, setSelectedWorker] = useState<ClockInRecord | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<ClockInRecord | null>(null);
  const [controlSummary, setControlSummary] = useState({
    pendingCorrections: 0,
    overdueApprovals: 0,
    missingAttendanceExceptions: 0,
    approvedCorrections: 0,
    rejectedCorrections: 0,
    payrollLockedPeriods: 0,
  });

  useEffect(() => {
    apiRequest<any>('/admin/corrections/summary')
      .then((data) => {
        if (data) setControlSummary(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* ── SECTION A: ATTENDANCE CONTROL CENTER SUMMARY CARDS (REAL BACKEND COUNTS) ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider m-0">
              Attendance Control & Exception Summary
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('exceptions')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Open Control Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Pending Corrections */}
          <div
            onClick={() => onNavigate?.('exceptions')}
            className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/60 transition-colors"
          >
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Pending Corrections</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-amber-900 tabular-nums">{controlSummary.pendingCorrections}</div>
            <span className="text-[10px] text-amber-600 font-medium">Awaiting decision</span>
          </div>

          {/* 2. Overdue Supervisor Approvals */}
          <div
            onClick={() => onNavigate?.('exceptions')}
            className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl cursor-pointer hover:bg-rose-100/60 transition-colors"
          >
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Overdue Approvals</span>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-rose-900 tabular-nums">{controlSummary.overdueApprovals}</div>
            <span className="text-[10px] text-rose-600 font-medium">&gt; 24h past deadline</span>
          </div>

          {/* 3. Missing Attendance Exceptions */}
          <div
            onClick={() => onNavigate?.('exceptions')}
            className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl cursor-pointer hover:bg-orange-100/60 transition-colors"
          >
            <div className="flex items-center justify-between text-orange-700 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Missing Exceptions</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-orange-900 tabular-nums">{controlSummary.missingAttendanceExceptions}</div>
            <span className="text-[10px] text-orange-600 font-medium">Unresolved missing punches</span>
          </div>

          {/* 4. Approved & Rejected Corrections */}
          <div
            onClick={() => onNavigate?.('exceptions')}
            className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-100/60 transition-colors"
          >
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Approved / Rejected</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-emerald-900 tabular-nums">
              {controlSummary.approvedCorrections} <span className="text-xs text-slate-400 font-normal">/ {controlSummary.rejectedCorrections}</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">Historical decisions</span>
          </div>

          {/* 5. Payroll-Locked Periods */}
          <div
            onClick={() => onNavigate?.('exceptions')}
            className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl cursor-pointer hover:bg-indigo-100/60 transition-colors"
          >
            <div className="flex items-center justify-between text-indigo-700 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Locked Payroll</span>
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-indigo-900 tabular-nums">{controlSummary.payrollLockedPeriods}</div>
            <span className="text-[10px] text-indigo-600 font-medium">Periods under audit lock</span>
          </div>
        </div>
      </div>

      {/* 1. ROW OF 4 KPI STAT CARDS (FIRST CARD SOLID GREEN MATCHING REFERENCE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Solid Green Featured Card (Total Present Today) */}
        <StatCard
          variant="featured"
          title="Present Today"
          value="248"
          change="18.2%"
          isPositive={true}
          timeframe="this week"
          icon={Users}
          onOpenClick={() => onNavigate?.('users')}
        />

        {/* Card 2: White Card (Absent Staff) */}
        <StatCard
          variant="default"
          title="Absent"
          value="14"
          change="12.5%"
          isPositive={true}
          timeframe="this week"
          icon={UserX}
          iconBgColor="bg-[#E0F2FE]"
          iconColor="text-[#0284C7]"
          onOpenClick={() => onNavigate?.('reports')}
        />

        {/* Card 3: White Card (Late Arrivals) */}
        <StatCard
          variant="default"
          title="Late Arrivals"
          value="8"
          change="2.3%"
          isPositive={false}
          timeframe="this week"
          icon={Clock}
          iconBgColor="bg-[#F3E8FF]"
          iconColor="text-[#9333EA]"
          onOpenClick={() => onNavigate?.('attendance-overview')}
        />

        {/* Card 4: White Card (Total Hours Worked) */}
        <StatCard
          variant="default"
          title="Total Hours Logged"
          value="1,842"
          change="24.6%"
          isPositive={true}
          timeframe="this week"
          icon={CheckCircle2}
          iconBgColor="bg-[#FFEDD5]"
          iconColor="text-[#EA580C]"
          onOpenClick={() => onNavigate?.('reports')}
        />
      </div>

      {/* 2. ROW OF CHARTS (MATCHING REFERENCE ROW 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Weekly Attendance Area Chart with highlighted day */}
        <div className="lg:col-span-2">
          <WeeklyAttendanceChart />
        </div>

        {/* Right (1 col): Donut Chart with Center Total */}
        <div className="lg:col-span-1">
          <AttendanceDonutChart />
        </div>
      </div>

      {/* 3. ROW OF TABLES & LISTS (MATCHING REFERENCE ROW 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (1 col): Top Worksites / Workers */}
        <div className="lg:col-span-1">
          <TopLocationsList />
        </div>

        {/* Right (2 cols): Recent Clock-ins Table */}
        <div className="lg:col-span-2">
          <RecentClockInsTable
            onSelectWorker={(record) => setSelectedWorker(record)}
            onViewPhoto={(record) => setLightboxPhoto(record)}
          />
        </div>
      </div>

      {/* WORKER DETAIL MODAL */}
      {selectedWorker && (
        <WorkerDetailModal
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
        />
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-[24px] max-w-sm w-full p-5 space-y-4 shadow-2xl border border-[#E8EEF4]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#12A66A]" />
                <span className="font-bold text-sm text-[#111827]">
                  {lightboxPhoto.workerName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full h-72 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
              <img
                src={lightboxPhoto.photoUrl}
                alt="Selfie verification"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Clock In Time:</span>
                <strong className="text-[#111827]  ">{lightboxPhoto.clockInTime}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Worksite:</span>
                <strong className="text-[#111827]">{lightboxPhoto.worksite}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Facial Validation:</span>
                <span className="font-bold text-[#12A66A]">✓ 99.4% Match</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="w-full py-2.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

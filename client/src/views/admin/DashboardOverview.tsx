import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { WeeklyAttendanceChart } from '../../components/dashboard/WeeklyAttendanceChart';
import { AttendanceDonutChart } from '../../components/dashboard/AttendanceDonutChart';
import { RecentClockInsTable, ClockInRecord } from '../../components/dashboard/RecentClockInsTable';
import { TopLocationsList } from '../../components/dashboard/TopLocationsList';
import { WorkerDetailModal } from '../../components/dashboard/WorkerDetailModal';
import {
  GroupIcon,
  CheckCircleIcon,
  ErrorProfileIcon,
  ClockIcon,
  SecuritySafeIcon,
  ChevronRightIcon,
  CloseCircleIcon,
  InfoIcon,
  LockIcon,
  CameraIcon,
  CloseIcon,
} from '@astraicons/react/linear';

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
      .catch(() => { });
  }, []);

  return (
    <div className="space-y-6">


      {/*  ROW OF 4 KPI STAT CARDS MATCHING REFERENCE IMAGE 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Employee */}
        <StatCard
          variant="default"
          title="Total Employee"
          value="26"
          badge="100%"
          change="4"
          isPositive={true}
          visualType="sparkline"
          sparklineColor="#01B075"

          icon={GroupIcon}
          onOpenClick={() => onNavigate?.('users')}
        />

        {/* Card 2: Today Presents */}
        <StatCard
          variant="default"
          title="Today Presents"
          value="04"
          badge="15%"
          change="15%"
          isPositive={true}
          visualType="bars"
          barColor="#01B075"

          icon={CheckCircleIcon}
          iconBgColor="bg-[#E6F7F1]"
          iconColor="text-[#01B075]"
          onOpenClick={() => onNavigate?.('attendance-overview')}
        />

        {/* Card 3: Today Absents */}
        <StatCard
          variant="default"
          title="Today Absents"
          value="13"
          badge="50%"
          badgeColor="bg-[#FEF3C7] text-[#D97706]"
          change="50%"
          isPositive={false}
          visualType="bars"
          barColor="#F59E0B"
          icon={ErrorProfileIcon}
          iconBgColor="bg-[#FEF3C7]"
          iconColor="text-[#D97706]"
          onOpenClick={() => onNavigate?.('reports')}
        />

        {/* Card 4: Today Leave */}
        <StatCard
          variant="default"
          title="Today Leave"
          value="09"
          badge="35%"
          badgeColor="bg-[#FEE2E2] text-[#EF4444]"
          change="35%"
          isPositive={false}
          visualType="ring"
          progressPercent={35}
          sparklineColor="#EF4444"
          icon={ClockIcon}
          iconBgColor="bg-[#FEE2E2]"
          iconColor="text-[#EF4444]"
          onOpenClick={() => onNavigate?.('leave-approvals')}
        />
      </div>

      {/* 1. SECTION A: ATTENDANCE CONTROL CENTER SUMMARY CARDS (REAL BACKEND COUNTS) ── */}
      <div className="space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {/* 1. Pending Corrections */}
          <StatCard
            className="bg-[#F8FAFC]/80 border-[#E8EEF4] hover:bg-white"
            variant="default"
            title="Pending Corrections"
            value={controlSummary.pendingCorrections.toString().padStart(2, '0')}
            badge={controlSummary.pendingCorrections > 0 ? `${controlSummary.pendingCorrections} Req` : '0%'}
            badgeColor="bg-[#FEF3C7] text-[#D97706]"
            change={controlSummary.pendingCorrections.toString()}
            isPositive={controlSummary.pendingCorrections === 0}
            visualType="bars"
            barColor="#D97706"
            subtitle="Awaiting decision"
            icon={ClockIcon}
            iconBgColor="bg-[#FEF3C7]"
            iconColor="text-[#D97706]"
            onOpenClick={() => onNavigate?.('exceptions')}
          />

          {/* 2. Overdue Supervisor Approvals */}
          {/* <StatCard
            className="bg-[#F8FAFC]/80 border-[#E8EEF4] hover:bg-white"
            variant="default"
            title="Overdue Approvals"
            value={controlSummary.overdueApprovals.toString().padStart(2, '0')}
            badge={controlSummary.overdueApprovals > 0 ? '! Overdue' : '0%'}
            badgeColor="bg-[#FEE2E2] text-[#DC2626]"
            change={controlSummary.overdueApprovals.toString()}
            isPositive={controlSummary.overdueApprovals === 0}
            visualType="sparkline"
            sparklineColor="#DC2626"
            subtitle="> 24h past deadline"
            icon={InfoIcon}
            iconBgColor="bg-[#FEE2E2]"
            iconColor="text-[#DC2626]"
            onOpenClick={() => onNavigate?.('exceptions')}
          /> */}

          {/* 3. Missing Attendance Exceptions */}
          <StatCard
            className="bg-[#F8FAFC]/80 border-[#E8EEF4] hover:bg-white"
            variant="default"
            title="Missing Exceptions"
            value={controlSummary.missingAttendanceExceptions.toString().padStart(2, '0')}
            badge={controlSummary.missingAttendanceExceptions > 0 ? `${controlSummary.missingAttendanceExceptions} Logs` : '0%'}
            badgeColor="bg-[#FFEDD5] text-[#EA580C]"
            change={controlSummary.missingAttendanceExceptions.toString()}
            isPositive={controlSummary.missingAttendanceExceptions === 0}
            visualType="bars"
            barColor="#EA580C"
            subtitle="Unresolved missing punches"
            icon={CloseCircleIcon}
            iconBgColor="bg-[#FFEDD5]"
            iconColor="text-[#EA580C]"
            onOpenClick={() => onNavigate?.('exceptions')}
          />

          {/* 4. Approved & Rejected Corrections */}
          <StatCard
            className="bg-[#F8FAFC]/80 border-[#E8EEF4] hover:bg-white"
            variant="default"
            title="Approved / Rejected"
            value={`${controlSummary.approvedCorrections} / ${controlSummary.rejectedCorrections}`}
            badge={`${controlSummary.approvedCorrections + controlSummary.rejectedCorrections}`}
            badgeColor="bg-[#E6F7F1] text-[#01B075]"
            change={`${controlSummary.approvedCorrections}`}
            isPositive={true}
            visualType="sparkline"
            sparklineColor="#01B075"
            subtitle="Historical decisions"
            icon={CheckCircleIcon}
            iconBgColor="bg-[#E6F7F1]"
            iconColor="text-[#01B075]"
            onOpenClick={() => onNavigate?.('exceptions')}
          />

          {/* 5. Payroll-Locked Periods */}
          <StatCard
            className="bg-[#F8FAFC]/80 border-[#E8EEF4] hover:bg-white"
            variant="default"
            title="Locked Payroll"
            value={controlSummary.payrollLockedPeriods.toString().padStart(2, '0')}
            badge={controlSummary.payrollLockedPeriods > 0 ? 'Locked' : '0%'}
            badgeColor="bg-[#EDE9FE] text-[#7C3AED]"
            change={controlSummary.payrollLockedPeriods > 0 ? '100%' : '0%'}
            isPositive={true}
            visualType="ring"
            progressPercent={controlSummary.payrollLockedPeriods > 0 ? 100 : 0}
            barColor="#7C3AED"
            subtitle="Periods under audit lock"
            icon={LockIcon}
            iconBgColor="bg-[#EDE9FE]"
            iconColor="text-[#7C3AED]"
            onOpenClick={() => onNavigate?.('exceptions')}
          />
        </div>

      </div>

      {/* 2. ROW OF CHARTS & LEAVE APPLICATION (MATCHING REFERENCE IMAGE 3 ROW 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Daily Attendance Statistic Chart */}
        <div className="lg:col-span-2">
          <WeeklyAttendanceChart />
        </div>

        {/* Right (1 col): Leave Application Queue matching Reference Image 3 */}
        <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F4F8]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1E1F24] m-0">Leave Application</h3>
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[10px] flex items-center justify-center font-bold">i</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('leave-approvals')}
                className="text-xs font-semibold text-[#01B075] hover:underline cursor-pointer"
              >
                See Details
              </button>
            </div>

            <div className="divide-y divide-[#F8FAFC] mt-2">
              {[
                { name: 'Maisha Lucy zamora Fonzales', reason: 'Dental surgery', status: 'Approved', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop' },
                { name: 'Jonathan Ibrahim Sheikh', reason: 'Personal Leave', status: 'Pending', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop' },
                { name: 'Thomas Goodman', reason: 'Family Emergency', status: 'Approved', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop' },
                { name: 'Maisha Lucy zamora Fonzales', reason: 'Dental surgery', status: 'Approved', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop' },
              ].map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={item.photo} alt={item.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-100" />
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-[#1E1F24] block truncate">{item.name}</span>
                      <span className="text-[10px] text-[#71737D] block truncate">Reason: {item.reason}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${item.status === 'Approved' ? 'bg-[#E6F7F1] text-[#01B075]' : 'bg-[#FEF3C7] text-[#D97706]'
                    }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('leave-approvals')}
            className="w-full mt-3 py-2 rounded-xl border border-[#E8EEF4] text-xs font-semibold text-[#464853] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            Review All Requests
          </button>
        </div>
      </div>

      {/* 3. ROW OF TABLES & NOTICE BOARD (MATCHING REFERENCE IMAGE 3 ROW 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (1 col): Notice Board matching Reference Image 3 */}
        <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F4F8]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1E1F24] m-0">Notice</h3>
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[10px] flex items-center justify-center font-bold">i</span>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-[#01B075] hover:underline cursor-pointer"
              >
                See Details
              </button>
            </div>

            <div className="space-y-3 mt-3">
              {[
                { title: 'Get ready for meeting at 6 pm', tag: 'Meeting', date: '22-Aug-24', star: true },
                { title: 'Management Decision', tag: 'Immediate Management Meeting', date: '11-Jul-24', star: false },
                { title: 'Our Organization will Organize a Annual Report', tag: 'Meeting', date: '10-Jul-24', star: false },
              ].map((notice, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#EDF2F7] space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-[#1E1F24] leading-snug">{notice.title}</span>
                    <span className={notice.star ? 'text-[#01B075]' : 'text-slate-300'}>★</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#71737D] pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[#464853] font-medium">{notice.tag}</span>
                    <span>{notice.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right (2 cols): Employee Attendance List Table with Floating Card Rows (Reference Image 1) */}
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
                <CameraIcon className="w-4 h-4 text-[#01B075]" />
                <span className="font-bold text-sm text-[#111827]">
                  {lightboxPhoto.workerName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
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

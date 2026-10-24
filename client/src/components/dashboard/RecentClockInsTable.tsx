import React, { useState } from 'react';
import { SlidersHorizontal, Eye, CheckCircle2, Clock, AlertTriangle, MapPin } from 'lucide-react';

export interface ClockInRecord {
  id: string;
  workerName: string;
  workerCode: string;
  avatarUrl: string;
  worksite: string;
  clockInTime: string;
  clockOutTime: string | null;
  status: 'On Time' | 'Late' | 'Overtime' | 'Pending';
  photoUrl: string;
}

const MOCK_RECORDS: ClockInRecord[] = [
  {
    id: '1',
    workerName: 'Ramesh Kumar',
    workerCode: 'EMP-409',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    worksite: 'Metro Line 4 Worksite',
    clockInTime: '08:58 AM',
    clockOutTime: '05:32 PM',
    status: 'On Time',
    photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '2',
    workerName: 'Priya Sharma',
    workerCode: 'EMP-312',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    worksite: 'Airport Hub Depot',
    clockInTime: '09:02 AM',
    clockOutTime: null,
    status: 'On Time',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '3',
    workerName: 'Anil Verma',
    workerCode: 'EMP-205',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    worksite: 'Central Logistics Yard',
    clockInTime: '09:24 AM',
    clockOutTime: null,
    status: 'Late',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '4',
    workerName: 'Deepa Natarajan',
    workerCode: 'EMP-118',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    worksite: 'Tech Park Gate 2',
    clockInTime: '08:45 AM',
    clockOutTime: '06:15 PM',
    status: 'Overtime',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: '5',
    workerName: 'Suresh Patel',
    workerCode: 'EMP-520',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    worksite: 'Metro Line 4 Worksite',
    clockInTime: '09:00 AM',
    clockOutTime: null,
    status: 'On Time',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  },
];

interface RecentClockInsTableProps {
  onSelectWorker?: (record: ClockInRecord) => void;
  onViewPhoto?: (record: ClockInRecord) => void;
}

export const RecentClockInsTable: React.FC<RecentClockInsTableProps> = ({
  onSelectWorker,
  onViewPhoto,
}) => {
  const [filterType, setFilterType] = useState<string>('All');

  const renderStatusPill = (status: ClockInRecord['status']) => {
    switch (status) {
      case 'On Time':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F7EF] text-[#12A66A]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            On Time
          </span>
        );
      case 'Late':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309]">
            <Clock className="w-3.5 h-3.5" />
            Late (24m)
          </span>
        );
      case 'Overtime':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB]">
            <Clock className="w-3.5 h-3.5" />
            Overtime
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Table Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-base font-bold text-[#111827]">Recent Clock-ins</h3>
          <p className="text-xs text-[#6B7280]">Live GPS verified worker punches from field</p>
        </div>

        <button
          type="button"
          onClick={() => setFilterType(filterType === 'All' ? 'On Time' : 'All')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-full text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#64748B]" />
          <span>Filter: {filterType}</span>
        </button>
      </div>

      {/* Table Structure */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#F1F5F9] text-[#6B7280] font-semibold">
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Worker</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">Clock In</th>
              <th className="py-2.5 px-3">Photo Proof</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F8FAFC]">
            {MOCK_RECORDS.filter(r => filterType === 'All' || r.status === filterType).map((row, index) => (
              <tr
                key={row.id}
                onClick={() => onSelectWorker?.(row)}
                className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
              >
                <td className="py-3 px-3   text-[#94A3B8]">{index + 1}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={row.avatarUrl}
                      alt={row.workerName}
                      className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0]"
                    />
                    <div>
                      <span className="font-semibold text-[#111827] block group-hover:text-[#12A66A] transition-colors">
                        {row.workerName}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]   block">
                        {row.workerCode}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-[#475569]">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                    {row.worksite}
                  </span>
                </td>
                <td className="py-3 px-3   font-semibold text-[#111827]">
                  {row.clockInTime}
                </td>
                <td className="py-3 px-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPhoto?.(row);
                    }}
                    className="relative group/photo flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-[#12A66A] transition-all cursor-pointer"
                  >
                    <img
                      src={row.photoUrl}
                      alt="Selfie"
                      className="w-6 h-6 rounded-md object-cover"
                    />
                    <span className="text-[10px] font-semibold text-slate-600">View</span>
                  </button>
                </td>
                <td className="py-3 px-3">
                  {renderStatusPill(row.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

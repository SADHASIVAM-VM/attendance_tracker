import React, { useState } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';

export const AttendanceDonutChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<string>('Monthly');

  // Segments definition
  const segments = [
    { name: 'Metro Line 4 Worksite', color: '#12A66A', count: '34,000', percentage: 40 },
    { name: 'Airport Hub Depot', color: '#A8EBCB', count: '25,500', percentage: 28 },
    { name: 'Central Logistics Yard', color: '#E2E8F0', count: '25,600', percentage: 20 },
    { name: 'Tech Park Gate 2', color: '#FDBA74', count: '17,000', percentage: 12 },
  ];

  return (
    <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold text-[#111827]">
          Attendance by Worksite
        </span>

        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-full text-xs font-semibold text-[#475569] transition-colors cursor-pointer"
        >
          <span>{timeframe}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
        </button>
      </div>

      {/* Donut Chart Visual */}
      <div className="relative flex items-center justify-center my-4">
        <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 160 160">
          {/* Segment 1: Light Slate Background circle */}
          <circle
            cx="80"
            cy="80"
            r="60"
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth="20"
            strokeDasharray="377"
            strokeDashoffset="0"
          />

          {/* Segment 2: Peach / Orange (12%) */}
          <circle
            cx="80"
            cy="80"
            r="60"
            fill="transparent"
            stroke="#FDBA74"
            strokeWidth="20"
            strokeDasharray="377"
            strokeDashoffset="330"
          />

          {/* Segment 3: Mint Green (28%) */}
          <circle
            cx="80"
            cy="80"
            r="60"
            fill="transparent"
            stroke="#A8EBCB"
            strokeWidth="20"
            strokeDasharray="377"
            strokeDashoffset="220"
          />

          {/* Segment 4: Vibrant Primary Green (40%) */}
          <circle
            cx="80"
            cy="80"
            r="60"
            fill="transparent"
            stroke="#12A66A"
            strokeWidth="20"
            strokeDasharray="377"
            strokeDashoffset="120"
            strokeLinecap="round"
          />
        </svg>

        {/* Center Total Content (matching 16,100 and +45% in reference) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-[#111827] tabular-nums tracking-tight">
            16,100
          </span>
          <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-[#12A66A] bg-[#E6F7EF] px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3 h-3" />
            + 45%
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#12A66A]" />
          <span className="text-[#64748B] truncate">Metro Line 4</span>
          <strong className="text-[#111827] ml-auto  ">34,000</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A8EBCB]" />
          <span className="text-[#64748B] truncate">Airport Hub</span>
          <strong className="text-[#111827] ml-auto  ">25,500</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2E8F0]" />
          <span className="text-[#64748B] truncate">Central Yard</span>
          <strong className="text-[#111827] ml-auto  ">25,600</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FDBA74]" />
          <span className="text-[#64748B] truncate">Tech Park</span>
          <strong className="text-[#111827] ml-auto  ">17,000</strong>
        </div>
      </div>

      {/* Total Records Bottom Row */}
      <div className="text-center pt-2 border-t border-[#F1F5F9]">
        <span className="text-[11px] font-semibold text-[#64748B] block">
          Total Number of Shifts
        </span>
        <span className="text-xl font-black text-[#111827] tracking-tight tabular-nums block">
          3,40,031
        </span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

interface DayData {
  day: string;
  value: number;
  label: string;
  percentage: string;
  tooltipText: string;
}

const DEFAULT_DAYS: DayData[] = [
  { day: 'MON', value: 180, label: '180 punches', percentage: '96%', tooltipText: '180 Clock-ins' },
  { day: 'TUE', value: 210, label: '210 punches', percentage: '97%', tooltipText: '210 Clock-ins' },
  { day: 'WED', value: 235, label: '235 punches', percentage: '98%', tooltipText: '235 Clock-ins' },
  { day: 'THU', value: 220, label: '220 punches', percentage: '97%', tooltipText: '220 Clock-ins' },
  { day: 'FRI', value: 258, label: '258 punches', percentage: '99%', tooltipText: '258 Clock-ins (99%)' },
  { day: 'SAT', value: 165, label: '165 punches', percentage: '94%', tooltipText: '165 Clock-ins' },
  { day: 'SUN', value: 190, label: '190 punches', percentage: '95%', tooltipText: '190 Clock-ins' },
];

export const WeeklyAttendanceChart: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number>(4); // Default FRI (index 4)
  const [timeframe, setTimeframe] = useState<string>('Weekly');

  // Curve points calculation for SVG 0..600 width, 0..240 height
  const points = [
    { x: 30, y: 190 },
    { x: 110, y: 155 },
    { x: 195, y: 110 },
    { x: 280, y: 80 },
    { x: 365, y: 115 },
    { x: 450, y: 165 },
    { x: 535, y: 135 },
  ];

  // Create smooth bezier SVG path
  const pathD = `
    M ${points[0].x} ${points[0].y}
    C 70 190, 80 155, ${points[1].x} ${points[1].y}
    C 140 155, 160 110, ${points[2].x} ${points[2].y}
    C 230 110, 240 80, ${points[3].x} ${points[3].y}
    C 315 80, 330 115, ${points[4].x} ${points[4].y}
    C 395 115, 415 165, ${points[5].x} ${points[5].y}
    C 480 165, 505 135, ${points[6].x} ${points[6].y}
  `;

  const areaD = `
    ${pathD}
    L ${points[6].x} 230
    L ${points[0].x} 230
    Z
  `;

  const activePoint = points[selectedDay];
  const activeData = DEFAULT_DAYS[selectedDay];

  return (
    <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Top Header matching Reference Image 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F1F4F8]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#1E1F24] m-0">
            Daily Attendance Statistic
          </h3>
          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[10px] flex items-center justify-center font-bold">i</span>
        </div>

        {/* Legend matching Reference Image 3 */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-[#1E1F24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#01B075]" />
            <span>Present 04%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#1E1F24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>Absent 13%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#1E1F24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span>Leave 9%</span>
          </div>

          {/* Dropdown Filter Pill */}
          <div className="relative pl-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-full text-xs font-semibold text-[#464853] transition-colors cursor-pointer"
            >
              <span>Daily</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="relative mt-4 w-full h-[220px]">
        {/* Y Axis Guide Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-[#94A3B8]   select-none">
          <div className="flex items-center gap-2 border-b border-dashed border-[#F1F5F9] pb-1">
            <span className="w-8">280</span>
            <div className="flex-1" />
          </div>
          <div className="flex items-center gap-2 border-b border-dashed border-[#F1F5F9] pb-1">
            <span className="w-8">220</span>
            <div className="flex-1" />
          </div>
          <div className="flex items-center gap-2 border-b border-dashed border-[#F1F5F9] pb-1">
            <span className="w-8">160</span>
            <div className="flex-1" />
          </div>
          <div className="flex items-center gap-2 border-b border-dashed border-[#F1F5F9] pb-1">
            <span className="w-8">100</span>
            <div className="flex-1" />
          </div>
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-1">
            <span className="w-8">0</span>
            <div className="flex-1" />
          </div>
        </div>

        {/* SVG Graphic with Area Gradient & Active Pillar */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 570 240" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12A66A" stopOpacity="0.28" />
              <stop offset="70%" stopColor="#12A66A" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#12A66A" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="pillarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12A66A" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0E8F5B" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Area fill under curve */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Highlighted active day pillar (matching Friday column in reference) */}
          <rect
            x={activePoint.x - 22}
            y={activePoint.y}
            width="44"
            height={230 - activePoint.y}
            rx="8"
            fill="url(#pillarGradient)"
            opacity="0.95"
            className="transition-all duration-300"
          />

          {/* Smooth curved bezier stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#12A66A"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active point halo and dot */}
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="7"
            fill="#FFFFFF"
            stroke="#12A66A"
            strokeWidth="3.5"
            className="transition-all duration-300 drop-shadow-md"
          />
        </svg>

        {/* Active Tooltip Pill (matching $4,645.80 pill in reference) */}
        <div
          className="absolute z-10 transition-all duration-200 pointer-events-none transform -translate-x-1/2"
          style={{
            left: `${(activePoint.x / 570) * 100}%`,
            top: `${Math.max(10, activePoint.y - 38)}px`,
          }}
        >
          <div className="bg-[#12A66A] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md whitespace-nowrap border border-[#0E8F5B]/30 flex items-center gap-1">
            <span>{activeData.tooltipText}</span>
          </div>
        </div>
      </div>

      {/* X Axis Weekday Labels */}
      <div className="grid grid-cols-7 text-center pt-3 border-t border-[#F1F5F9] mt-2">
        {DEFAULT_DAYS.map((d, index) => {
          const isSelected = selectedDay === index;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelectedDay(index)}
              className={`text-[11px] font-bold tracking-wider py-1 rounded-lg transition-all cursor-pointer ${isSelected
                  ? 'text-[#12A66A] bg-[#E6F7EF]'
                  : 'text-[#64748B] hover:text-[#111827]'
                }`}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

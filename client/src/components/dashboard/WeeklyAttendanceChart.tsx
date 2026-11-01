import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DayData {
  day: string;
  date?: string;
  value: number;
  label: string;
  percentage: string;
  tooltipText: string;
}

interface WeeklyAttendanceChartProps {
  data?: DayData[];
  stats?: {
    presentPct?: number;
    absentPct?: number;
    leavePct?: number;
  };
  loading?: boolean;
}

const FALLBACK_DAYS: DayData[] = [
  { day: 'MON', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
  { day: 'TUE', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
  { day: 'WED', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
  { day: 'THU', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
  { day: 'FRI', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
  { day: 'SAT', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
  { day: 'SUN', value: 0, label: '0 punches', percentage: '0%', tooltipText: '0 Clock-ins' },
];

function generateSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const WeeklyAttendanceChart: React.FC<WeeklyAttendanceChartProps> = ({
  data,
  stats,
  loading = false,
}) => {
  const chartDays = data && data.length > 0 ? data : FALLBACK_DAYS;
  const [selectedDay, setSelectedDay] = useState<number>(() => Math.max(0, chartDays.length - 1));

  // Determine maximum punch value for dynamic Y scaling
  const rawMax = Math.max(...chartDays.map((d) => d.value), 0);
  const maxValue = rawMax === 0 ? 10 : Math.ceil(rawMax * 1.25);

  // Calculate points dynamically across 570x240 viewBox
  const points = chartDays.map((d, i) => {
    const x = chartDays.length > 1 ? 40 + i * ((570 - 80) / (chartDays.length - 1)) : 285;
    const norm = maxValue > 0 ? d.value / maxValue : 0;
    const y = 200 - norm * 145; // baseline y=200, top max y=55
    return { x, y };
  });

  const pathD = generateSmoothPath(points);
  const lastPointX = points[points.length - 1]?.x || 535;
  const firstPointX = points[0]?.x || 35;
  const areaD = points.length > 0
    ? `${pathD} L ${lastPointX} 230 L ${firstPointX} 230 Z`
    : '';

  const safeIndex = selectedDay < points.length ? selectedDay : points.length - 1;
  const activePoint = points[safeIndex] || { x: 285, y: 150 };
  const activeData = chartDays[safeIndex] || { tooltipText: '0 Clock-ins', label: '0 punches' };

  const yStep = Math.round(maxValue / 4);
  const yLabels = [maxValue, yStep * 3, yStep * 2, yStep, 0];

  return (
    <div className="bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F1F4F8]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#1E1F24] m-0">
            Daily Attendance Statistic
          </h3>
          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-[10px] flex items-center justify-center font-bold">i</span>
        </div>

        {/* Dynamic Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-[#1E1F24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#01B075]" />
            <span>Present {stats?.presentPct ?? 0}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#1E1F24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>Absent {stats?.absentPct ?? 0}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#1E1F24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span>Leave {stats?.leavePct ?? 0}%</span>
          </div>

          {/* Timeframe Pill */}
          <div className="relative pl-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full text-xs font-semibold text-[#464853]">
              <span>7 Days</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="relative mt-4 w-full h-[220px]">
        {/* Dynamic Y Axis Guide Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-[#94A3B8] select-none">
          {yLabels.map((lbl, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 pb-1 ${idx === yLabels.length - 1
                ? 'border-b border-[#E2E8F0]'
                : 'border-b border-dashed border-[#F1F5F9]'
                }`}
            >
              <span className="w-8">{lbl}</span>
              <div className="flex-1" />
            </div>
          ))}
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
          {areaD && <path d={areaD} fill="url(#chartGradient)" />}

          {/* Highlighted active day pillar */}
          <rect
            x={activePoint.x - 22}
            y={activePoint.y}
            width="44"
            height={Math.max(10, 230 - activePoint.y)}
            rx="8"
            fill="url(#pillarGradient)"
            opacity="0.95"
            className="transition-all duration-300"
          />

          {/* Smooth curved bezier stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#12A66A"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

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

        {/* Active Tooltip Pill */}
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
        {chartDays.map((d, index) => {
          const isSelected = safeIndex === index;
          return (
            <button
              key={`${d.day}-${index}`}
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

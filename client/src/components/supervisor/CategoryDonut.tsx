import React from 'react';
import { CategorySummary } from '../../types/supervisor';

interface CategoryDonutProps {
  categories: CategorySummary[];
  totalAmount: number;
  currencySymbol?: string;
}

export const CategoryDonut: React.FC<CategoryDonutProps> = ({
  categories,
  totalAmount,
  currencySymbol = '₹',
}) => {
  // SVG Donut Calculations
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;

  return (
    <div className="space-y-4">
      {/* Donut Chart with Centered Total */}
      <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {categories.map((cat, idx) => {
            const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativeAngle;
            cumulativeAngle += (cat.percentage / 100) * circumference;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={cat.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 hover:opacity-85"
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Total Spend
          </span>
          <span className="text-base font-black text-slate-900 tabular-nums">
            {currencySymbol}
            {totalAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Categories Breakdown List */}
      <div className="space-y-2 pt-2">
        {categories.map((cat) => (
          <div key={cat.category} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="font-semibold text-slate-800">{cat.category}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-medium tabular-nums">{cat.percentage}%</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {currencySymbol}
                {cat.amount.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

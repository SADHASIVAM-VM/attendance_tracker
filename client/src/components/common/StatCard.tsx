import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { THEME } from '../../styles/theme';

export interface StatCardProps {
  className?: string;
  title?: string;
  label?: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  timeframe?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  variant?: 'featured' | 'default' | 'warning' | 'info' | 'success';
  iconBgColor?: string;
  iconColor?: string;
  sparklineColor?: string;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  helpText?: string;
  chartType?: string;
  visualType?: 'sparkline' | 'bars' | 'ring' | 'progress';
  progressPercent?: number;
  barColor?: string;
  onOpenClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  className,
  title,
  label,
  value,
  change,
  isPositive = true,
  timeframe,
  icon: Icon,
  variant = 'default',
  iconBgColor = 'bg-[#E6F7F1]',
  iconColor = 'text-[#01B075]',
  sparklineColor = '#01B075',
  badge,
  badgeColor,
  subtitle,
  chartType,
  helpText,
  visualType = 'sparkline',
  progressPercent = 65,
  barColor,
  onOpenClick,
}) => {
  const isFeatured = variant === 'featured';
  const displayTitle = title || label || '';
  const displaySubtitle = subtitle || helpText;
  const strokeColor = isPositive ? sparklineColor : '#EF4444';
  const gradId = `spark-grad-${Math.random().toString(36).substring(2, 9)}`;

  // Render SVG Sparkline with gradient area fill matching Reference Image 2
  const renderSparkline = () => {
    return (
      <div className="relative w-24 h-12 flex items-center justify-end">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 48" fill="none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={isFeatured ? '0.45' : '0.22'} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {/* Gradient area under curve */}
          <path
            d={
              isPositive
                ? "M 0 38 Q 20 38, 35 22 T 70 24 T 100 10 L 100 48 L 0 48 Z"
                : "M 0 14 Q 25 14, 45 28 T 80 20 T 100 40 L 100 48 L 0 48 Z"
            }
            fill={`url(#${gradId})`}
          />
          {/* Main curve */}
          <path
            d={
              isPositive
                ? "M 0 38 Q 20 38, 35 22 T 70 24 T 100 10"
                : "M 0 14 Q 25 14, 45 28 T 80 20 T 100 40"
            }
            stroke={isFeatured ? '#FFFFFF' : strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Point indicator on current value */}
          <circle
            cx="100"
            cy={isPositive ? 10 : 40}
            r="3.5"
            fill={isFeatured ? '#FFFFFF' : strokeColor}
          />
        </svg>
      </div>
    );
  };

  // Render Mini Bar Visual matching Reference Image 3 (Today Presents / Absents)
  const renderMiniBars = () => {
    const activeColor = barColor || strokeColor;
    return (
      <div className="flex items-end gap-1 h-9 px-1">
        {[30, 45, 60, 40, 85, 95, 55, 75].map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}%`, backgroundColor: i >= 4 ? activeColor : '#EDF2F7' }}
            className="w-1.5 rounded-full transition-all"
          />
        ))}
      </div>
    );
  };

  // Render Ring Visual matching Reference Image 2
  const renderRing = () => {
    const size = 40;
    const strokeW = 4;
    const radius = (size - strokeW) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progressPercent / 100) * circumference;

    return (
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#EDF2F7"
            strokeWidth={strokeW}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeW}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[10px] font-bold text-[#1E1F24]">{progressPercent}%</span>
      </div>
    );
  };

  if (isFeatured) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-[#01B075] to-[#018F5F] text-white p-5 rounded-[20px] shadow-[0_10px_25px_-5px_rgba(1,176,117,0.35)] flex flex-col justify-between transition-all hover:translate-y-[-2px]">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
              {Icon ? <Icon className="w-4.5 h-4.5" /> : <TrendingUp className="w-4.5 h-4.5" />}
            </div>
            <span className="text-xs font-semibold tracking-wide text-white/95">
              {displayTitle}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                {badge}
              </span>
            )}
            {onOpenClick && (
              <button
                type="button"
                onClick={onOpenClick}
                aria-label="View details"
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stat Value & Visual */}
        <div className="flex items-center justify-between my-1">
          <div className="text-3xl font-extrabold tracking-tight tabular-nums text-white">
            {value}
          </div>
          <div>{renderSparkline()}</div>
        </div>

        {/* Trend Indicator */}
        {(change || displaySubtitle || timeframe) ? (
          <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-white/90">
            {change ? (
              <span className="flex items-center gap-0.5 font-bold">
                ↑ {change}
              </span>
            ) : null}
            {(displaySubtitle || timeframe) ? (
              <span className="text-white/80">{displaySubtitle || timeframe}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-[#E8EEF4] p-5 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all hover:shadow-[0_8px_24px_rgba(1,176,117,0.08)] hover:translate-y-[-2px] ${className || ''}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl ${iconBgColor} flex items-center justify-center ${iconColor}`}>
            {Icon ? <Icon className="w-4.5 h-4.5" /> : <TrendingUp className="w-4.5 h-4.5" />}
          </div>
          <span className="text-xs font-semibold text-[#464853]">
            {displayTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {badge && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                badgeColor || (isPositive ? 'bg-[#E6F7F1] text-[#01B075]' : 'bg-[#FEF3C7] text-[#D97706]')
              }`}
            >
              {badge}
            </span>
          )}
          {onOpenClick && (
            <button
              type="button"
              onClick={onOpenClick}
              aria-label="View details"
              className="w-7 h-7 rounded-full bg-[#F4F6F8] hover:bg-[#E8EEF4] flex items-center justify-center text-[#464853] transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stat Value & Visual */}
      <div className="flex items-center justify-between my-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#1E1F24]">
          {value}
        </div>
        <div>
          {visualType === 'bars'
            ? renderMiniBars()
            : visualType === 'ring'
              ? renderRing()
              : renderSparkline()}
        </div>
      </div>

      {/* Trend Indicator */}
      {(change || displaySubtitle || timeframe) ? (
        <div className="flex items-center gap-2 mt-2.5 text-xs">
          {change ? (
            <span
              className={`inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full text-[11px] ${isPositive
                ? 'bg-[#E6F7F1] text-[#01B075]'
                : 'bg-[#FEE2E2] text-[#EF4444]'
                }`}
            >
              {isPositive ? '↑' : '↓'} {change}
            </span>
          ) : null}
          {(displaySubtitle || timeframe) ? (
            <span className="text-[#71737D] truncate text-[11px] font-medium">
              {displaySubtitle || timeframe}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

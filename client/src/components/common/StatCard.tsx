import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  timeframe?: string;
  icon?: LucideIcon;
  variant?: 'featured' | 'default' | 'warning' | 'info' | 'success';
  iconBgColor?: string;
  iconColor?: string;
  sparklineColor?: string;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  helpText?: string;
  onOpenClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  label,
  value,
  change = '+12.5%',
  isPositive = true,
  timeframe = 'this week',
  icon: Icon,
  variant = 'default',
  iconBgColor = 'bg-[#E6F7EF]',
  iconColor = 'text-[#12A66A]',
  sparklineColor = '#12A66A',
  subtitle,
  helpText,
  onOpenClick,
}) => {
  const isFeatured = variant === 'featured';
  const displayTitle = title || label || '';
  const displaySubtitle = subtitle || helpText;

  // SVG sparklines
  const renderSparkline = () => {
    if (isFeatured) {
      return (
        <svg className="w-20 h-10 overflow-visible opacity-90" viewBox="0 0 100 40" fill="none">
          <path
            d="M0 28 C 15 28, 25 10, 40 22 C 55 34, 65 5, 80 18 C 90 26, 95 12, 100 8"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    const stroke = isPositive ? sparklineColor : '#E5484D';
    return (
      <svg className="w-20 h-10 overflow-visible" viewBox="0 0 100 40" fill="none">
        <path
          d={
            isPositive
              ? "M0 32 C 15 32, 25 18, 40 25 C 55 32, 65 10, 80 18 C 90 22, 95 12, 100 6"
              : "M0 10 C 15 10, 30 25, 45 16 C 60 8, 70 30, 85 24 C 92 20, 96 32, 100 36"
          }
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (isFeatured) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-[#12A66A] to-[#0E8F5B] text-white p-5 rounded-[20px] shadow-[0_10px_25px_-5px_rgba(18,166,106,0.35)] flex flex-col justify-between transition-all hover:translate-y-[-2px]">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
              {Icon ? <Icon className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
            <span className="text-xs font-semibold tracking-wide text-white/95">
              {displayTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenClick}
            aria-label="View details"
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stat Value & Sparkline */}
        <div className="flex items-center justify-between my-1">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-white">
            {value}
          </div>
          <div>{renderSparkline()}</div>
        </div>

        {/* Trend Indicator */}
        <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-white/90">
          <span className="flex items-center gap-0.5 font-bold">
            ↑ {change}
          </span>
          <span className="text-white/80">{displaySubtitle || timeframe}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E8EEF4] p-5 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all hover:shadow-[0_8px_24px_rgba(18,166,106,0.08)] hover:translate-y-[-2px]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${iconBgColor} flex items-center justify-center ${iconColor}`}>
            {Icon ? <Icon className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <span className="text-xs font-semibold text-[#6B7280]">
            {displayTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenClick}
          aria-label="View details"
          className="w-7 h-7 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] flex items-center justify-center text-[#6B7280] transition-colors cursor-pointer"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stat Value & Sparkline */}
      <div className="flex items-center justify-between my-1">
        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-[#111827]">
          {value}
        </div>
        <div>{renderSparkline()}</div>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center gap-1.5 mt-3 text-xs font-medium">
        <span
          className={`flex items-center gap-0.5 font-bold ${
            isPositive ? 'text-[#12A66A]' : 'text-[#E5484D]'
          }`}
        >
          {isPositive ? '↑' : '↓'} {change}
        </span>
        <span className="text-[#6B7280]">{timeframe}</span>
      </div>
    </div>
  );
};

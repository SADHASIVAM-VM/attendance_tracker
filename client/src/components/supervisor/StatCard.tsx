import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
  icon: React.ComponentType<{ className?: string }> | any;
  variant?: 'solid-green' | 'amber-tint' | 'default';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  note,
  icon: Icon,
  variant = 'default',
  onClick,
  className = '',
}) => {
  const isSolidGreen = variant === 'solid-green';
  const isAmberTint = variant === 'amber-tint';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative rounded-[16px] p-4 transition-all duration-150 ${
        onClick ? 'cursor-pointer active:scale-[0.98]' : ''
      } ${
        isSolidGreen
          ? 'bg-gradient-to-br from-[#12A66A] to-[#0E8F5B] text-white shadow-md shadow-[#12A66A]/20'
          : isAmberTint
          ? 'bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] shadow-xs'
          : 'bg-white border border-[#E8EEF4] text-[#111827] shadow-xs hover:border-[#12A66A]/30'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-[11px] font-bold tracking-wider uppercase block ${
            isSolidGreen ? 'text-white/80' : isAmberTint ? 'text-[#B45309]' : 'text-[#6B7280]'
          }`}
        >
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSolidGreen
              ? 'bg-white/20 text-white'
              : isAmberTint
              ? 'bg-[#FEF3C7] text-[#D97706]'
              : 'bg-[#E6F7EF] text-[#12A66A]'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={`text-2xl font-black tracking-tight tabular-nums ${
            isSolidGreen ? 'text-white' : isAmberTint ? 'text-[#78350F]' : 'text-[#111827]'
          }`}
        >
          {value}
        </span>
      </div>

      {note && (
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className={`text-[11px] font-medium leading-none ${
              isSolidGreen ? 'text-emerald-100' : isAmberTint ? 'text-[#B45309]' : 'text-[#64748B]'
            }`}
          >
            {note}
          </span>
        </div>
      )}
    </div>
  );
};

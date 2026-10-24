import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PrimaryActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: LucideIcon;
  variant?: 'safety-green' | 'safety-red' | 'outline';
  subLabel?: string;
  isLoading?: boolean;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  label,
  icon: Icon,
  variant = 'safety-green',
  subLabel,
  isLoading = false,
  className = '',
  onClick,
  disabled,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {
        // ignore
      }
    }
    if (onClick) onClick(e);
  };

  const getStyle = () => {
    if (variant === 'safety-red') {
      return 'bg-[#E5484D] hover:bg-[#C93B40] text-white shadow-[0_8px_24px_-4px_rgba(229,72,77,0.45)]';
    }
    if (variant === 'outline') {
      return 'bg-white hover:bg-[#F8FAFC] text-[#111827] border border-[#E8EEF4] shadow-xs';
    }
    // Default: FreshCart Primary Green
    return 'bg-[#12A66A] hover:bg-[#0E8F5B] text-white shadow-[0_8px_24px_-4px_rgba(18,166,106,0.45)]';
  };

  return (
    <button
      {...props}
      type={props.type || 'button'}
      disabled={disabled || isLoading}
      onClick={handleClick}
      aria-label={label}
      className={`w-full min-h-[68px] sm:min-h-[72px] rounded-[18px] px-6 py-4 flex items-center justify-center gap-3 transition-all duration-150 font-bold text-lg sm:text-xl tracking-tight active:scale-[0.98] active:translate-y-0.5 cursor-pointer select-none touch-manipulation disabled:opacity-50 disabled:pointer-events-none ${getStyle()} ${className}`}
    >
      {isLoading ? (
        <span className="flex items-center gap-2.5">
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Processing...</span>
        </span>
      ) : (
        <div className="flex items-center justify-center gap-3">
          {Icon && <Icon className="w-6 h-6 shrink-0 stroke-[2.5]" />}
          <div className="text-left leading-tight">
            <span className="block font-extrabold">{label}</span>
            {subLabel && (
              <span className="block text-xs font-normal opacity-90 tracking-normal mt-0.5 font-sans">
                {subLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
};

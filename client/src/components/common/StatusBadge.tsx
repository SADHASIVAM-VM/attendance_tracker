import React from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showIcon = true,
}) => {
  const norm = status?.toUpperCase() || '';

  let config = {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-[#E5EAF2]',
    icon: Sparkles,
    label: status,
  };

  if (['APPROVED', 'PUBLISHED', 'ACTIVE', 'HEALTHY', 'VERIFIED'].includes(norm)) {
    config = {
      bg: 'bg-emerald-50',
      text: 'text-[#16A36A]',
      border: 'border-emerald-200',
      icon: CheckCircle2,
      label: norm === 'ACTIVE' ? 'Active' : norm === 'PUBLISHED' ? 'Published' : norm === 'VERIFIED' ? 'Verified' : 'Approved',
    };
  } else if (['PENDING', 'DRAFT', 'UNDER_REVIEW'].includes(norm)) {
    config = {
      bg: 'bg-amber-50',
      text: 'text-[#E9A23B]',
      border: 'border-amber-200',
      icon: Clock,
      label: norm === 'DRAFT' ? 'Draft' : 'Pending',
    };
  } else if (['REJECTED', 'CANCELLED', 'INACTIVE', 'ERROR', 'OUTSIDE_GEOFENCE'].includes(norm)) {
    config = {
      bg: 'bg-rose-50',
      text: 'text-[#DC4545]',
      border: 'border-rose-200',
      icon: XCircle,
      label: norm === 'CANCELLED' ? 'Cancelled' : norm === 'INACTIVE' ? 'Inactive' : 'Rejected',
    };
  } else if (['COMPLETED', 'TRANSFERRED', 'CLOCKED_OUT'].includes(norm)) {
    config = {
      bg: 'bg-blue-50',
      text: 'text-[#356DF3]',
      border: 'border-blue-200',
      icon: CheckCircle2,
      label: norm === 'CLOCKED_OUT' ? 'Clocked Out' : norm === 'TRANSFERRED' ? 'Transferred' : 'Completed',
    };
  }

  const Icon = config.icon;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1 font-semibold'
      : size === 'md'
      ? 'px-2.5 py-1 text-xs gap-1.5 font-semibold'
      : 'px-3 py-1.5 text-sm gap-2 font-bold';

  const iconSizes = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center rounded-lg border ${sizeClasses} ${config.bg} ${config.text} ${config.border} shrink-0 tracking-tight`}
    >
      {showIcon && <Icon className={`${iconSizes} shrink-0`} />}
      <span>{config.label}</span>
    </span>
  );
};

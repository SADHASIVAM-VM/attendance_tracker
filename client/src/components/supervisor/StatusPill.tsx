import React from 'react';
import { SupervisorAttendanceStatus } from '../../types/supervisor';
import { CheckCircle2, Clock, XCircle, UserX, CalendarDays } from 'lucide-react';

interface StatusPillProps {
  status: SupervisorAttendanceStatus | 'PENDING' | 'APPROVED' | 'REJECTED';
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const getStyleAndIcon = () => {
    switch (status) {
      case 'APPROVED':
        return {
          bg: 'bg-[#E6F7EF] text-[#0E8F5B] border border-[#12A66A]/20',
          icon: CheckCircle2,
          label: 'Approved',
        };
      case 'PENDING':
        return {
          bg: 'bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/30',
          icon: Clock,
          label: 'Pending',
        };
      case 'REJECTED':
        return {
          bg: 'bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626]/20',
          icon: XCircle,
          label: 'Rejected',
        };
      case 'ABSENT':
      case 'ON_LEAVE':
        return {
          bg: 'bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626]/20',
          icon: UserX,
          label: 'Absent',
        };
      case 'NOT_YET_IN':
        return {
          bg: 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]',
          icon: Clock,
          label: 'Not yet in',
        };
      default:
        return {
          bg: 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]',
          icon: Clock,
          label: status === 'ABSENT' ? 'Absent' : 'Not yet in',
        };
    }
  };

  const config = getStyleAndIcon();
  const Icon = config.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full whitespace-nowrap transition-colors ${
        isSm ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5'
      } ${config.bg} ${className}`}
    >
      <Icon className={isSm ? 'w-3 h-3 flex-shrink-0' : 'w-3.5 h-3.5 flex-shrink-0'} />
      <span>{config.label}</span>
    </span>
  );
};

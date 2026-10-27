import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = status?.toUpperCase().trim() || '';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  // 6 Canonical Statuses & Variants
  if (['APPROVED', 'PUBLISHED', 'ACTIVE', 'HEALTHY', 'PRESENT'].includes(norm)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300';
  } else if (['REJECTED', 'CANCELLED', 'INACTIVE', 'ERROR'].includes(norm)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-300';
  } else if (['ABSENT', 'UNEXCUSED_ABSENCE'].includes(norm)) {
    colorClasses = 'bg-red-50 text-red-700 border-red-300';
  } else if (['MISSING', 'MISSING_CLOCK_IN'].includes(norm)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-300';
  } else if (['PENDING', 'DRAFT', 'PENDING_REVIEW', 'FLAGGED', 'REGULARIZATION_PENDING'].includes(norm)) {
    colorClasses = 'bg-yellow-50 text-yellow-800 border-yellow-300';
  } else if (['LEAVE', 'ON_LEAVE', 'APPROVED_LEAVE'].includes(norm)) {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-300';
  } else if (['COMPLETED', 'TRANSFERRED', 'EXCUSED_ABSENCE'].includes(norm)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-300';
  }

  const labelMap: Record<string, string> = {
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    ABSENT: 'Absent',
    MISSING: 'Missing',
    PENDING: 'Pending',
    LEAVE: 'Leave',
    MISSING_CLOCK_IN: 'Missing',
    UNEXCUSED_ABSENCE: 'Absent',
    EXCUSED_ABSENCE: 'Excused Absence',
    FLAGGED: 'Pending Review',
    REGULARIZATION_PENDING: 'Regularization Pending',
    PENDING_REVIEW: 'Pending Review',
    ON_LEAVE: 'Leave',
    APPROVED_LEAVE: 'Leave',
  };

  const displayLabel = labelMap[norm] || status?.replace(/_/g, ' ') || '';
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs font-semibold' : 'px-3 py-1 text-sm font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses} shadow-2xs`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80"></span>
      {displayLabel}
    </span>
  );
};

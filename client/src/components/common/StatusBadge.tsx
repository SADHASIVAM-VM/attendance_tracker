import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = status?.toUpperCase() || '';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['APPROVED', 'PUBLISHED', 'ACTIVE', 'HEALTHY'].includes(norm)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['PENDING', 'DRAFT'].includes(norm)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['REJECTED', 'CANCELLED', 'INACTIVE', 'ERROR'].includes(norm)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['COMPLETED', 'TRANSFERRED'].includes(norm)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs font-medium' : 'px-3 py-1 text-sm font-medium';

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};

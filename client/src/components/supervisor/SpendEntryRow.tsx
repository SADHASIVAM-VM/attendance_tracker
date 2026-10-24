import React, { useState } from 'react';
import { SpendEntry, SpendCategory } from '../../types/supervisor';
import {
  Package,
  Utensils,
  Truck,
  Banknote,
  Receipt,
  Lock,
  MoreVertical,
  Trash2,
  Edit2,
  Eye,
  X,
  WifiOff,
} from 'lucide-react';

interface SpendEntryRowProps {
  entry: SpendEntry;
  currencySymbol?: string;
  onEdit?: (entry: SpendEntry) => void;
  onDelete?: (entry: SpendEntry) => void;
}

export const getCategoryIcon = (category: SpendCategory) => {
  switch (category) {
    case 'Materials':
      return { icon: Package, bg: 'bg-[#EFF6FF] text-[#2563EB]' };
    case 'Food':
      return { icon: Utensils, bg: 'bg-[#FEF3C7] text-[#D97706]' };
    case 'Transport':
      return { icon: Truck, bg: 'bg-[#F3E8FF] text-[#9333EA]' };
    case 'Worker payment':
      return { icon: Banknote, bg: 'bg-[#E6F7EF] text-[#0E8F5B]' };
    case 'Other':
    default:
      return { icon: Receipt, bg: 'bg-[#F1F5F9] text-[#475569]' };
  }
};

export const SpendEntryRow: React.FC<SpendEntryRowProps> = ({
  entry,
  currencySymbol = '₹',
  onEdit,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  const { icon: CategoryIcon, bg: iconBg } = getCategoryIcon(entry.category);

  return (
    <>
      <div className="relative group bg-white border border-[#E8EEF4] rounded-[16px] p-3.5 shadow-xs transition-all duration-150 hover:border-[#12A66A]/30 flex items-center gap-3">
        {/* Category Icon in Tinted Circle */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <CategoryIcon className="w-5 h-5" />
        </div>

        {/* Details: Note, applies-to, time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-[#111827] truncate leading-tight">
              {entry.note}
            </h4>
            {entry.isLocked && (
              <span title="Locked by finance team" className="text-slate-400">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              </span>
            )}
            {entry.isOffline && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 font-bold flex items-center gap-0.5">
                <WifiOff className="w-2.5 h-2.5" /> Offline
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs text-[#64748B]">
            <span className="font-semibold text-[#12A66A]">{entry.category}</span>
            <span>•</span>
            <span className="truncate">
              {entry.appliesToType === 'LOCATION'
                ? 'Site General'
                : `Worker: ${entry.workerName || 'Assigned'}`}
            </span>
            <span>•</span>
            <span className="tabular-nums text-[#94A3B8]">{entry.time}</span>
          </div>
        </div>

        {/* Receipt thumbnail if available */}
        {entry.receiptUrl && (
          <div
            onClick={() => setShowReceiptModal(true)}
            title="View receipt photo"
            className="w-10 h-10 rounded-[10px] overflow-hidden border border-[#E8EEF4] flex-shrink-0 cursor-pointer relative group/img"
          >
            <img
              src={entry.receiptUrl}
              alt="Receipt"
              className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 text-white">
              <Eye className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-black text-[#111827] tabular-nums block">
            {currencySymbol}
            {entry.amount.toLocaleString()}
          </span>
          <span className="text-[10px] text-[#94A3B8]">Approved</span>
        </div>

        {/* Action Menu (Edit / Delete) if not locked */}
        {!entry.isLocked && (onEdit || onDelete) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-30 w-32 bg-white rounded-[12px] shadow-lg border border-[#E8EEF4] py-1 text-xs animate-in fade-in duration-100">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(entry);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      Edit entry
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(entry);
                      }}
                      className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && entry.receiptUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowReceiptModal(false)}
        >
          <div
            className="relative max-w-sm w-full bg-white rounded-[20px] overflow-hidden p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Receipt Voucher Proof</h4>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-3">
              <img
                src={entry.receiptUrl}
                alt="Receipt proof"
                className="w-full max-h-80 object-contain rounded-[12px] border border-slate-100"
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>{entry.note}</span>
              <strong className="text-slate-900 font-bold tabular-nums">
                {currencySymbol}
                {entry.amount.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

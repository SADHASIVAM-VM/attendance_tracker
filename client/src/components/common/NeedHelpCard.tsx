import React from 'react';
import { HelpCircle, Headphones, ArrowRight } from 'lucide-react';

interface NeedHelpCardProps {
  onContactSupport?: () => void;
  compact?: boolean;
}

export const NeedHelpCard: React.FC<NeedHelpCardProps> = ({
  onContactSupport,
  compact = false,
}) => {
  return (
    <div className="relative overflow-hidden rounded-[20px] p-4 bg-gradient-to-br from-[#E6F7EF] via-[#C8F3DF] to-[#A8EBCB] border border-[#A8EBCB]/40 shadow-xs">
      {/* Decorative glass orbs */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/30 rounded-full blur-sm pointer-events-none" />
      <div className="absolute right-10 -top-6 w-16 h-16 bg-[#12A66A]/10 rounded-full blur-xs pointer-events-none" />

      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#12A66A] text-white flex items-center justify-center shadow-xs">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#111827] leading-tight">
              Need Help?
            </h4>
            <p className="text-[11px] text-[#475569] leading-tight">
              Contact support team
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onContactSupport) onContactSupport();
            else alert("Connecting to 24/7 Field Workforce Support desk (support@attendancetracker.io)");
          }}
          className="w-full py-2 px-3 rounded-xl bg-[#12A66A] hover:bg-[#0E8F5B] text-white text-xs font-bold shadow-[0_2px_8px_rgba(18,166,106,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
        >
          <span>Get Support</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

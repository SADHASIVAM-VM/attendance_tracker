import React from 'react';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  onKeyPress: (digit: string) => void;
  onBackspace: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onKeyPress,
  onBackspace,
  onClear,
  disabled = false,
}) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const handlePress = (d: string) => {
    if (disabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch (e) {
        // ignore
      }
    }
    onKeyPress(d);
  };

  const handleBackspace = () => {
    if (disabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (e) {
        // ignore
      }
    }
    onBackspace();
  };

  return (
    <div
      aria-label="Numeric Keypad"
      className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-sm mx-auto"
    >
      {digits.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => handlePress(digit)}
          disabled={disabled}
          className="h-16 sm:h-18 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 border-2 border-[#181A20] text-2xl font-black text-[#111317] font-['Space_Grotesk'] shadow-[0_3px_0_0_#181A20] active:translate-y-0.5 active:shadow-[0_1px_0_0_#181A20] transition-all cursor-pointer select-none touch-manipulation flex items-center justify-center disabled:opacity-50"
        >
          {digit}
        </button>
      ))}

      {/* Clear Button */}
      <button
        type="button"
        onClick={onClear || handleBackspace}
        disabled={disabled}
        className="h-16 sm:h-18 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-[#181A20] text-xs font-bold uppercase tracking-wider text-slate-700 shadow-[0_3px_0_0_#181A20] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
      >
        Clear
      </button>

      {/* Zero */}
      <button
        type="button"
        onClick={() => handlePress('0')}
        disabled={disabled}
        className="h-16 sm:h-18 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 border-2 border-[#181A20] text-2xl font-black text-[#111317] font-['Space_Grotesk'] shadow-[0_3px_0_0_#181A20] active:translate-y-0.5 active:shadow-[0_1px_0_0_#181A20] transition-all cursor-pointer select-none touch-manipulation flex items-center justify-center disabled:opacity-50"
      >
        0
      </button>

      {/* Backspace Button */}
      <button
        type="button"
        onClick={handleBackspace}
        disabled={disabled}
        aria-label="Delete last digit"
        className="h-16 sm:h-18 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-[#181A20] text-[#111317] shadow-[0_3px_0_0_#181A20] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
      >
        <Delete className="w-7 h-7" />
      </button>
    </div>
  );
};

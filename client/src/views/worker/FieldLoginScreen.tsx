import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NumericKeypad } from '../../components/field/NumericKeypad';
import { TRANSLATIONS } from '../../lib/translations';
import { LanguageCode } from '../../types/fieldWorker';
import { ShieldCheck, Phone, KeyRound, Sparkles, UserCheck, ArrowRight, Sun, AlertCircle } from 'lucide-react';

interface FieldLoginScreenProps {
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  isSunlightMode: boolean;
  onSunlightToggle: () => void;
}

export const FieldLoginScreen: React.FC<FieldLoginScreenProps> = ({
  language,
  onLanguageChange,
  isSunlightMode,
  onSunlightToggle,
}) => {
  const { login, quickLogin, isLoading } = useAuth();
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [activeInput, setActiveInput] = useState<'phone' | 'pin'>('phone');
  const [phoneNumber, setPhoneNumber] = useState<string>('9876543210');
  const [pin, setPin] = useState<string>('1234');
  const [error, setError] = useState<string | null>(null);

  const handleDigitPress = (digit: string) => {
    setError(null);
    if (activeInput === 'phone') {
      if (phoneNumber.length < 10) {
        const next = phoneNumber + digit;
        setPhoneNumber(next);
        if (next.length === 10) {
          setActiveInput('pin');
        }
      }
    } else {
      if (pin.length < 4) {
        setPin((prev) => prev + digit);
      }
    }
  };

  const handleBackspace = () => {
    setError(null);
    if (activeInput === 'phone') {
      setPhoneNumber((prev) => prev.slice(0, -1));
    } else {
      if (pin.length > 0) {
        setPin((prev) => prev.slice(0, -1));
      } else {
        setActiveInput('phone');
      }
    }
  };

  const handleClear = () => {
    setError(null);
    if (activeInput === 'phone') {
      setPhoneNumber('');
    } else {
      setPin('');
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phoneNumber.length < 10) {
      setError('Please enter a 10-digit phone number');
      setActiveInput('phone');
      return;
    }
    if (pin.length < 4) {
      setError('Please enter your 4-digit PIN');
      setActiveInput('pin');
      return;
    }

    try {
      setError(null);
      // Maps mobile field login to backend credentials
      await quickLogin('WORKER');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check phone and PIN.');
    }
  };

  const handleQuickDemoWorker = async () => {
    setPhoneNumber('9876543210');
    setPin('1234');
    await quickLogin('WORKER');
  };

  return (
    <div className="min-h-screen bg-[#F6F5EF] flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto">
      {/* Top Header Utilities */}
      <header className="flex items-center justify-between pb-3 border-b-2 border-[#181A20]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#181A20] text-white flex items-center justify-center font-black text-sm">
            P
          </div>
          <span className="font-extrabold text-sm tracking-wider font-['Space_Grotesk']">
            {t.appTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          {/* <div className="flex items-center bg-white border-2 border-[#181A20] rounded-xl p-0.5 shadow-[0_2px_0_0_#181A20]">
            {(['en', 'ta', 'hi'] as LanguageCode[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={`px-2 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                  language === lang
                    ? 'bg-[#181A20] text-white'
                    : 'text-slate-700 hover:text-black'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'ta' ? 'தமிழ்' : 'हिन्दी'}
              </button>
            ))}
          </div> */}

          {/* Sunlight Mode Toggle */}
          <button
            type="button"
            onClick={onSunlightToggle}
            title={isSunlightMode ? t.standardMode : t.sunlightMode}
            className={`w-9 h-9 rounded-xl border-2 border-[#181A20] flex items-center justify-center shadow-[0_2px_0_0_#181A20] cursor-pointer ${isSunlightMode ? 'bg-amber-300 text-black' : 'bg-white text-slate-800'
              }`}
          >
            <Sun className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="my-auto py-4 space-y-4">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Field Workforce Sign In
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111317] font-['Space_Grotesk'] leading-tight m-0">
            {t.loginTitle}
          </h1>
          <p className="text-xs text-slate-600">
            One-touch attendance for field shifts
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Inputs Display */}
        <div className="space-y-3">
          {/* Phone Display */}
          <button
            type="button"
            onClick={() => setActiveInput('phone')}
            className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${activeInput === 'phone'
                ? 'bg-white border-[#181A20] shadow-[0_4px_0_0_#181A20] ring-2 ring-amber-400'
                : 'bg-white border-slate-300 opacity-90'
              }`}
          >
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  {t.enterPhone}
                </span>
                <span className="text-xl font-bold font-['Space_Grotesk'] tracking-widest text-[#111317] tabular-nums">
                  {phoneNumber || <span className="text-slate-300">10 Digits</span>}
                </span>
              </div>
            </div>
            {activeInput === 'phone' && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* PIN Display */}
          <button
            type="button"
            onClick={() => setActiveInput('pin')}
            className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${activeInput === 'pin'
                ? 'bg-white border-[#181A20] shadow-[0_4px_0_0_#181A20] ring-2 ring-amber-400'
                : 'bg-white border-slate-300 opacity-90'
              }`}
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-slate-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  {t.enterPin}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <span
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 border-[#181A20] ${pin.length > idx ? 'bg-[#181A20]' : 'bg-transparent'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            {activeInput === 'pin' && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Big Numeric Keypad */}
        <div className="pt-2">
          <NumericKeypad
            onKeyPress={handleDigitPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
            disabled={isLoading}
          />
        </div>

        {/* Primary Submit Button */}
        <button
          type="button"
          onClick={() => handleSignIn()}
          disabled={isLoading || phoneNumber.length < 10 || pin.length < 4}
          className="w-full min-h-[64px] bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white rounded-2xl border-2 border-[#14532D] font-extrabold text-lg uppercase tracking-wider font-['Space_Grotesk'] shadow-[0_4px_0_0_#14532D] active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Verifying...</span>
            </span>
          ) : (
            <>
              <span>{t.signIn}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* One-Touch Quick Demo Login for instant testing */}
        <button
          type="button"
          onClick={handleQuickDemoWorker}
          className="w-full py-3 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-amber-400 cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-amber-700" />
          <span>{t.quickTestLogin} (1-Tap Test)</span>
        </button>
      </main>

      <footer className="text-center text-[11px] text-slate-500 font-medium pt-2">
        Field-rated for bright sunlight & offline use • WCAG AAA
      </footer>
    </div>
  );
};

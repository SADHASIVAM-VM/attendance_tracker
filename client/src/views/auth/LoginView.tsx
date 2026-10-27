import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ArrowRight, Phone, Eye, EyeOff, AlertCircle, ShieldCheck, Clock } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);



  // Check if identifier looks like a phone number (digits, +, dashes, spaces)
  const isLikelyPhone = /^[+\d\s\-()]+$/.test(identifier.trim()) && identifier.trim().length > 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your work email or mobile phone number.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    try {
      setError(null);
      await login(identifier.trim(), password);
    } catch (err: any) {
      console.warn('Login failure:', err);
      if (err?.code === 'INVALID_CREDENTIALS' || err?.status === 401) {
        setError('Incorrect email/phone number or password. Please verify and try again.');
      } else if (err?.code === 'NETWORK_ERROR' || err?.message?.includes('connect') || err?.message?.includes('fetch')) {
        setError(err.message || 'Unable to connect to the server. Please check your network connection.');
      } else {
        setError(err?.message || 'Incorrect email/phone number or password. Please verify and try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F6FC] flex items-center justify-center p-4 sm:p-6 font-sans text-[#111827]">
      {/* Background Decorative Circles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-[#12A66A]/5 blur-3xl -translate-y-20 -translate-x-32" />
        <div className="w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl translate-y-32 translate-x-32" />
      </div>

      <div className="relative w-full max-w-md bg-white rounded-[28px] border border-[#E8EEF4] p-6 sm:p-8 shadow-[0_8px_32px_rgba(18,166,106,0.06)] space-y-6">

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3 pb-2 border-b border-[#F1F5F9]">
          <div className="w-14 h-14 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shadow-[0_6px_20px_rgba(18,166,106,0.35)] ring-4 ring-[#E6F7EF]">
            <Clock className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#111827] leading-tight">
              Attendance Tracker
            </h1>
            <p className="text-xs text-[#6B7280] font-medium mt-1">
              Workforce &amp; Field Attendance Management
            </p>
          </div>
        </div>

        {/* Real Unified Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Error Message displayed directly on top of the email input field */}
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-start gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="block font-bold text-rose-800 text-xs">Invalid Credentials</span>
                <span className="leading-relaxed text-[11px] font-medium text-rose-700 mt-0.5 block">
                  {error}
                </span>
              </div>
            </div>
          )}

          {/* Work Email or Phone Number Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] block">
                Work Email or Mobile Number
              </label>
              {error && (
                <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Incorrect
                </span>
              )}
            </div>
            <div className="relative">
              <div className="w-9 h-9 absolute left-1.5 top-1.5 rounded-xl bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
                {isLikelyPhone ? (
                  <Phone className="w-4 h-4 text-[#12A66A]" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
              </div>
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@enterprise.com or +1 555-0105"
                className={`w-full text-xs sm:text-sm pl-12 pr-4 py-3 rounded-2xl border ${error
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-[#E8EEF4] bg-[#F8FAFC] focus:bg-white focus:border-[#12A66A] focus:ring-[#12A66A]/20'
                  } focus:outline-none focus:ring-2 text-[#111827] placeholder-[#94A3B8] transition-all`}
                required
              />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1 pl-1">
              Enter your registered organization email or mobile phone
            </p>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Password
              </label>
              {error && (
                <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Incorrect
                </span>
              )}
            </div>
            <div className="relative">
              <div className="w-9 h-9 absolute left-1.5 top-1.5 rounded-xl bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className={`w-full text-xs sm:text-sm pl-12 pr-11 py-3 rounded-2xl border ${error
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-[#E8EEF4] bg-[#F8FAFC] focus:bg-white focus:border-[#12A66A] focus:ring-[#12A66A]/20'
                  } focus:outline-none focus:ring-2 text-[#111827] placeholder-[#94A3B8] transition-all`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#64748B] transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me row */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#12A66A] rounded border-slate-300 focus:ring-[#12A66A]/20 accent-[#12A66A]"
              />
              <span className="text-xs text-[#6B7280] font-medium">Keep me signed in</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[52px] bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 disabled:pointer-events-none text-white font-extrabold text-sm rounded-2xl shadow-[0_8px_20px_rgba(18,166,106,0.35)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <>
                <span>Sign In to Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>



        {/* Security & Access Info */}
        <div className="p-3 bg-[#F8FAFC] border border-[#E8EEF4] rounded-2xl flex items-center gap-2.5 text-[11px] text-[#64748B]">
          <ShieldCheck className="w-4 h-4 text-[#12A66A] shrink-0" />
          <span>
            Authorized access only. You will be routed directly to your assigned role portal (Field Worker, Supervisor, or Admin).
          </span>
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, quickLogin, isLoading } = useAuth();
  const [email, setEmail] = useState<string>('admin@enterprise.com');
  const [password, setPassword] = useState<string>('Password123!');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-bold text-xl mx-auto shadow-xs">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 m-0">Pulse Workforce</h1>
          <p className="text-xs text-slate-500">
            Location-Validated Physical Worksites Attendance Management
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Quick 1-Click Role Login for instant evaluation */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
            Or Sign In With Test Role:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => quickLogin('SUPER_ADMIN')}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition-colors cursor-pointer text-left"
            >
              👑 Super Admin
              <span className="block text-[10px] text-slate-500 font-normal">Platform Config</span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin('ADMIN')}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition-colors cursor-pointer text-left"
            >
              🏢 Admin
              <span className="block text-[10px] text-slate-500 font-normal">Roster & Leaves</span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin('SUPERVISOR')}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition-colors cursor-pointer text-left"
            >
              📋 Supervisor
              <span className="block text-[10px] text-slate-500 font-normal">Approve Clock-Ins</span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin('WORKER')}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 transition-colors cursor-pointer text-left"
            >
              📍 Field Worker
              <span className="block text-[10px] text-emerald-700 font-normal">GPS & Selfie Clock</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

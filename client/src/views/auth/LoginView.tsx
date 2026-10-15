import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
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
                placeholder="name@enterprise.com"
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
                placeholder="••••••••••••"
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
      </div>
    </div>
  );
};

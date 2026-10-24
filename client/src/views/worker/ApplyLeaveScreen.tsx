import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  CalendarDays,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Heart,
  Baby,
  Plane,
  Star,
  FileText,
  Loader2,
} from 'lucide-react';

interface LeaveTypeItem {
  id: string;
  name: string;
  code: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
  remaining: number;
  total: number;
}

const TYPE_CONFIG: Record<string, { icon: React.FC<any>; color: string; bg: string; total: number; consumed: number }> = {
  CL: { icon: Star, color: '#8B5CF6', bg: '#EDE9FE', total: 12, consumed: 6 },
  SL: { icon: Heart, color: '#EF4444', bg: '#FEE2E2', total: 6, consumed: 2 },
  EL: { icon: Briefcase, color: '#12A66A', bg: '#E6F7EF', total: 18, consumed: 6 },
  UL: { icon: Plane, color: '#F59E0B', bg: '#FEF3C7', total: 999, consumed: 0 },
  LOP: { icon: Plane, color: '#F59E0B', bg: '#FEF3C7', total: 999, consumed: 0 },
  ML: { icon: Baby, color: '#EC4899', bg: '#FCE7F3', total: 84, consumed: 0 },
};

// Fallback dummy types with valid UUID format in case network fails
const FALLBACK_TYPES: LeaveTypeItem[] = [
  { id: '11111111-1111-4111-a111-111111111111', name: 'Casual Leave', code: 'CL', icon: Star, color: '#8B5CF6', bg: '#EDE9FE', remaining: 6, total: 12 },
  { id: '22222222-2222-4222-a222-222222222222', name: 'Sick Leave', code: 'SL', icon: Heart, color: '#EF4444', bg: '#FEE2E2', remaining: 4, total: 6 },
  { id: '33333333-3333-4333-a333-333333333333', name: 'Earned Leave', code: 'EL', icon: Briefcase, color: '#12A66A', bg: '#E6F7EF', remaining: 12, total: 18 },
  { id: '44444444-4444-4444-a444-444444444444', name: 'Unpaid Leave', code: 'UL', icon: Plane, color: '#F59E0B', bg: '#FEF3C7', remaining: 999, total: 999 },
];

interface ApplyLeaveModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const reviewerAuthority = isSupervisor ? 'Administrator' : 'Assigned Supervisor';

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>(FALLBACK_TYPES);
  const [selectedTypeId, setSelectedTypeId] = useState<string>(FALLBACK_TYPES[0].id);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [startDate, setStartDate] = useState(tomorrowStr);
  const [endDate, setEndDate] = useState(tomorrowStr);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch actual leave types from backend
  useEffect(() => {
    let active = true;
    const fetchTypes = async () => {
      try {
        setLoadingTypes(true);
        const data = await apiRequest('/leave/types');
        if (active && Array.isArray(data) && data.length > 0) {
          const mapped: LeaveTypeItem[] = data.map((t: any) => {
            const cfg = TYPE_CONFIG[t.code] || {
              icon: Briefcase,
              color: '#12A66A',
              bg: '#E6F7EF',
              total: 12,
              consumed: 0,
            };
            return {
              id: t.id,
              name: t.name,
              code: t.code,
              icon: cfg.icon,
              color: cfg.color,
              bg: cfg.bg,
              remaining: Math.max(0, cfg.total - cfg.consumed),
              total: cfg.total,
            };
          });
          setLeaveTypes(mapped);
          setSelectedTypeId(mapped[0].id);
        }
      } catch (err) {
        console.warn('Could not fetch leave types, keeping default types', err);
      } finally {
        if (active) setLoadingTypes(false);
      }
    };

    fetchTypes();
    return () => {
      active = false;
    };
  }, []);

  const selectedType = leaveTypes.find((t) => t.id === selectedTypeId) || leaveTypes[0];
  const effectiveEndDate = isHalfDay ? startDate : endDate;
  const numDays = isHalfDay
    ? 0.5
    : Math.max(1, Math.round((new Date(effectiveEndDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();

    if (!cleanReason) {
      setError('Please enter a reason for your leave.');
      return;
    }

    if (cleanReason.length < 5) {
      setError('Reason must be at least 5 characters long.');
      return;
    }

    if (!isHalfDay && endDate < startDate) {
      setError('End date cannot be before start date.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: selectedTypeId,
          startDate,
          endDate: effectiveEndDate,
          isHalfDay,
          halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
          reason: cleanReason,
        }),
      });

      setSubmitting(false);
      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setSubmitting(false);
      let errorMsg = err.message || 'Failed to submit leave request';
      if (err.details && Array.isArray(err.details) && err.details.length > 0) {
        errorMsg = err.details.map((d: any) => d.message || d.code).join(' • ');
      }
      setError(errorMsg);
    }
  };

  // Success screen
  if (success) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white rounded-[28px] border border-[#E8EEF4] p-7 shadow-2xl text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-[#E6F7EF] flex items-center justify-center mx-auto shadow-[0_6px_20px_rgba(18,166,106,0.2)]">
            <CheckCircle2 className="w-11 h-11 text-[#12A66A] stroke-[1.8]" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#12A66A] block">Submitted Successfully</span>
            <h2 className="text-xl font-extrabold text-[#111827] mt-1">Leave Request Sent!</h2>
            <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
              Your <strong className="text-[#111827]">{selectedType?.name || 'Leave'}</strong> for <strong className="text-[#111827]">{numDays} day{numDays !== 1 ? 's' : ''}</strong> is saved and submitted to your <strong className="text-[#12A66A]">{reviewerAuthority}</strong> for approval.
            </p>
          </div>
          <div className="bg-[#F8FAFC] rounded-xl border border-[#E8EEF4] p-3.5 text-xs space-y-1.5 text-left">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Dates:</span>
              <strong className="  text-[#111827]">
                {startDate}{!isHalfDay && endDate !== startDate ? ` → ${endDate}` : ''}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Duration:</span>
              <strong className="text-[#12A66A]">
                {numDays} day{numDays !== 1 ? 's' : ''}{isHalfDay ? ` (${halfDayPeriod === 'FIRST_HALF' ? '1st Half / AM' : '2nd Half / PM'})` : ''}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Reviewer:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#0E8F5B]">
                {reviewerAuthority}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Status:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#B45309]">Pending Approval</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSuccess || onClose}
              className="flex-1 py-3 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl font-bold text-sm cursor-pointer transition-all"
            >
              View Leave Log
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-[#F1F5F9] text-[#64748B] rounded-xl font-bold text-sm cursor-pointer hover:bg-[#E2E8F0]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] border border-[#E8EEF4] shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F1F5F9] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E6F7EF] flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-[#12A66A]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111827] m-0 leading-tight">Apply for Leave</h2>
              <p className="text-[11px] text-[#6B7280]">
                {isSupervisor
                  ? 'Request will be sent to Admin for review'
                  : 'Request will be sent to assigned supervisor for review'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Leave Type
              </label>
              {loadingTypes && (
                <span className="text-[10px] text-[#94A3B8] flex items-center gap-1 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin text-[#12A66A]" /> Loading categories…
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {leaveTypes.map((lt) => {
                const LtIcon = lt.icon;
                const isSel = selectedTypeId === lt.id;
                return (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() => setSelectedTypeId(lt.id)}
                    className={`flex items-center gap-3 p-3 rounded-[14px] border text-left cursor-pointer transition-all ${isSel ? 'border-[#12A66A] bg-[#E6F7EF]' : 'border-[#E8EEF4] bg-[#F8FAFC] hover:bg-white'
                      }`}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: lt.bg }}>
                      <LtIcon className="w-4 h-4" style={{ color: lt.color }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-[#111827] block">{lt.name}</span>
                      <span className="text-[10px] text-[#6B7280]">
                        {lt.code === 'UL' || lt.code === 'LOP' ? 'Unpaid • Authorized absence' : `${lt.remaining}/${lt.total} days left`}
                      </span>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'border-[#12A66A] bg-[#12A66A]' : 'border-[#CBD5E0]'
                        }`}
                    >
                      {isSel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Half Day Toggle */}
          <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#12A66A]" />
              <span className="text-xs font-semibold text-[#111827]">Half Day</span>
            </div>
            <button
              type="button"
              onClick={() => setIsHalfDay(!isHalfDay)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${isHalfDay ? 'bg-[#12A66A]' : 'bg-[#E2E8F0]'
                }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform absolute top-0.5 ${isHalfDay ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>

          {isHalfDay && (
            <div className="grid grid-cols-2 gap-2">
              {(['FIRST_HALF', 'SECOND_HALF'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setHalfDayPeriod(p)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${halfDayPeriod === p
                      ? 'bg-[#12A66A] text-white border-[#12A66A]'
                      : 'bg-white text-[#6B7280] border-[#E8EEF4]'
                    }`}
                >
                  {p === 'FIRST_HALF' ? '🌅 First Half (AM)' : '🌇 Second Half (PM)'}
                </button>
              ))}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1.5">
                {isHalfDay ? 'Date' : 'From'}
              </label>
              <input
                type="date"
                value={startDate}
                min={todayStr}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-xs font-semibold text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/30 focus:border-[#12A66A] cursor-pointer"
              />
            </div>
            {!isHalfDay && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] block mb-1.5">
                  To
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-xs font-semibold text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/30 focus:border-[#12A66A] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Duration pill */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#E6F7EF] rounded-xl border border-[#12A66A]/20">
            <CalendarDays className="w-3.5 h-3.5 text-[#12A66A]" />
            <span className="text-xs font-bold text-[#12A66A]">
              {numDays} day{numDays !== 1 ? 's' : ''} requested{isHalfDay ? ' (half day)' : ''}
            </span>
          </div>

          {/* Reason */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#12A66A]" />
                Reason <span className="text-rose-400">*</span>
              </label>
              <span className={`text-[10px]   ${reason.trim().length >= 5 ? 'text-[#12A66A]' : 'text-[#94A3B8]'}`}>
                {reason.trim().length}/5 min characters
              </span>
            </div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detailed reason for your absence (minimum 5 characters)..."
              className="w-full px-3.5 py-3 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-xs font-medium text-[#111827] placeholder:text-[#CBD5E0] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/30 focus:border-[#12A66A] resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 pb-6 pt-3 border-t border-[#F1F5F9] shrink-0">
          <form onSubmit={handleSubmit}>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5}
              className="w-full py-3.5 bg-[#12A66A] hover:bg-[#0E8F5B] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[16px] font-bold text-sm shadow-[0_4px_14px_rgba(18,166,106,0.35)] active:translate-y-0.5 cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Leave Request
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

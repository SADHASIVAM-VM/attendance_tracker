import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Star,
  Heart,
  Briefcase,
  Baby,
  Plane,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { ApplyLeaveModal } from './ApplyLeaveScreen';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeaveRequest {
  id: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod: string | null;
  reason: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  decisionNote: string | null;
  createdAt: string;
}

// ─── Demo data (fallback when offline) ────────────────────────────────────────
const DEMO_REQUESTS: LeaveRequest[] = [
  { id: 'lr_001', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', startDate: '2026-10-05', endDate: '2026-10-06', isHalfDay: false, halfDayPeriod: null, reason: 'Personal work – bank visits and documentation', status: 'APPROVED', decisionNote: 'Approved. Enjoy your day off.', createdAt: '2026-10-01' },
  { id: 'lr_002', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', startDate: '2026-10-15', endDate: '2026-10-15', isHalfDay: true, halfDayPeriod: 'FIRST_HALF', reason: 'Doctor appointment – general checkup', status: 'APPROVED', decisionNote: 'Approved.', createdAt: '2026-10-12' },
  { id: 'lr_003', leaveTypeName: 'Earned Leave', leaveTypeCode: 'EL', startDate: '2026-11-10', endDate: '2026-11-14', isHalfDay: false, halfDayPeriod: null, reason: 'Family trip planned for Diwali holidays', status: 'PENDING', decisionNote: null, createdAt: '2026-10-18' },
  { id: 'lr_004', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', startDate: '2026-09-20', endDate: '2026-09-20', isHalfDay: false, halfDayPeriod: null, reason: 'Attending sibling wedding function', status: 'REJECTED', decisionNote: 'Rejected – critical deadline.', createdAt: '2026-09-15' },
  { id: 'lr_005', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', startDate: '2026-09-10', endDate: '2026-09-10', isHalfDay: false, halfDayPeriod: null, reason: 'Fever and body pain – rest required', status: 'APPROVED', decisionNote: 'Approved.', createdAt: '2026-09-08' },
];

// ─── Leave balance definitions ────────────────────────────────────────────────
const LEAVE_BALANCE_CONFIG = [
  { code: 'CL', name: 'Casual', icon: Star, color: '#8B5CF6', bg: '#EDE9FE', total: 12 },
  { code: 'SL', name: 'Sick', icon: Heart, color: '#EF4444', bg: '#FEE2E2', total: 6 },
  { code: 'EL', name: 'Earned', icon: Briefcase, color: '#12A66A', bg: '#E6F7EF', total: 18 },
  { code: 'ML', name: 'Maternity', icon: Baby, color: '#EC4899', bg: '#FCE7F3', total: 84 },
  { code: 'UL', name: 'Unpaid', icon: Plane, color: '#F59E0B', bg: '#FEF3C7', total: 0 },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.FC<any>; cls: string }> = {
  APPROVED: { label: 'Approved', icon: CheckCircle2, cls: 'bg-[#E6F7EF] text-[#12A66A]' },
  PENDING: { label: 'Pending', icon: Clock, cls: 'bg-[#FEF3C7] text-[#B45309]' },
  REJECTED: { label: 'Rejected', icon: XCircle, cls: 'bg-[#FEE2E2] text-[#DC2626]' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, cls: 'bg-[#F1F5F9] text-[#94A3B8]' },
};

const TYPE_META: Record<string, { icon: React.FC<any>; color: string; bg: string }> = {
  CL: { icon: Star, color: '#8B5CF6', bg: '#EDE9FE' },
  SL: { icon: Heart, color: '#EF4444', bg: '#FEE2E2' },
  EL: { icon: Briefcase, color: '#12A66A', bg: '#E6F7EF' },
  ML: { icon: Baby, color: '#EC4899', bg: '#FCE7F3' },
  UL: { icon: Plane, color: '#F59E0B', bg: '#FEF3C7' },
  LOP: { icon: Plane, color: '#F59E0B', bg: '#FEF3C7' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDuration = (req: LeaveRequest) => {
  if (req.isHalfDay) return `½ Day (${req.halfDayPeriod === 'FIRST_HALF' ? 'AM' : 'PM'})`;
  const days = Math.round((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / 86400000) + 1;
  return `${days}d`;
};

// ─── Component ────────────────────────────────────────────────────────────────
export const WorkerLeaveView: React.FC = () => {
  const { user } = useAuth();
  const isSupervisor = user?.roles?.includes('SUPERVISOR') || (user as any)?.role === 'SUPERVISOR';
  const [requests, setRequests] = useState<LeaveRequest[]>(DEMO_REQUESTS);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedReason, setExpandedReason] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/leave/requests/me');
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch {
      /* keep demo data if offline */
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!confirm('Withdraw this leave request?')) return;
    setWithdrawing(id);
    try {
      await apiRequest(`/leave/requests/${id}/cancel`, { method: 'POST' });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r)));
      setToast({ text: 'Leave request withdrawn successfully.', type: 'success' });
    } catch (e: any) {
      setToast({ text: e.message || 'Failed to withdraw.', type: 'error' });
    } finally {
      setWithdrawing(null);
      setTimeout(() => setToast(null), 3500);
    }
  };

  // Calculate consumed days per leave code dynamically from approved requests
  const getConsumedDays = (code: string) => {
    return requests
      .filter((r) => r.leaveTypeCode === code && r.status === 'APPROVED')
      .reduce((acc, r) => {
        if (r.isHalfDay) return acc + 0.5;
        const days = Math.max(1, Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1);
        return acc + days;
      }, 0);
  };

  // Summary counts
  const approved = requests.filter((r) => r.status === 'APPROVED').length;
  const pending = requests.filter((r) => r.status === 'PENDING').length;
  const rejected = requests.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-3.5 text-xs font-medium border animate-in slide-in-from-top-2 ${toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{toast.text}</span>
        </div>
      )}

      {/* ── Approval Routing Policy Banner ─────────────────────────────────── */}
      {isSupervisor ? (
        <div className="flex items-start gap-3 p-3.5 bg-blue-50/80 border border-blue-200 rounded-[18px] text-xs text-blue-900 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold text-blue-900">
              Supervisor Leave Approval Hierarchy
            </strong>
            <span className="text-blue-700 leading-relaxed block mt-0.5">
              Your leave applications below are routed to the <strong>Administrator</strong> for approval. Worker leave requests from your assigned site team are reviewed and approved by you under <strong>Team Leave Roster</strong>.
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3.5 bg-[#E6F7EF] border border-[#A7F3D0] rounded-[18px] text-xs text-[#065F46] shadow-xs">
          <ShieldCheck className="w-4 h-4 text-[#12A66A] shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold text-[#065F46]">
              Worker Leave Approval Hierarchy
            </strong>
            <span className="text-[#047857] leading-relaxed block mt-0.5">
              Your leave applications below are routed directly to your <strong>Assigned Site Supervisor</strong> for approval.
            </span>
          </div>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#12A66A] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(18,166,106,0.28)] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#111827] m-0 leading-tight">Leave History</h1>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              {isSupervisor
                ? `Supervisor leave requests (reviewed by Admin) • ${new Date().getFullYear()}`
                : `Worker leave requests (reviewed by Supervisor) • ${new Date().getFullYear()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl text-xs font-bold shadow-[0_2px_8px_rgba(18,166,106,0.25)] transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Apply Leave
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh"
            className="w-8 h-8 rounded-xl border border-[#E8EEF4] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F1F6FC] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Leave Balance Cards ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">Leave Balances</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {LEAVE_BALANCE_CONFIG.map((lb) => {
            const LbIcon = lb.icon;
            const consumed = getConsumedDays(lb.code);
            const available = Math.max(0, lb.total - consumed);
            const pct = lb.total > 0 ? Math.min(100, Math.round((consumed / lb.total) * 100)) : 0;
            const isUnpaid = lb.code === 'UL' || lb.code === 'LOP';

            return (
              <div key={lb.code} className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 shadow-xs space-y-3">
                {/* Icon + Name */}
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: lb.bg }}>
                    <LbIcon className="w-4.5 h-4.5" style={{ color: lb.color }} />
                  </span>
                  <span className="text-xs font-bold text-[#111827] leading-tight">{lb.name}</span>
                </div>

                {/* Stats */}
                {isUnpaid ? (
                  <div className="text-center py-1">
                    <span className="text-[10px] text-[#94A3B8] font-semibold block">On Demand</span>
                    <span className="text-xs font-bold text-[#F59E0B]">Authorized Unpaid</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[10px] text-[#94A3B8] font-semibold block">Available</span>
                        <span className="text-xl font-black tabular-nums" style={{ color: lb.color }}>
                          {available}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#94A3B8] font-semibold block">Consumed</span>
                        <span className="text-xl font-black text-[#111827] tabular-nums">
                          {consumed}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: lb.color }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-[#94A3B8] font-medium">
                        <span>{pct}% used</span>
                        <span>{lb.total} total</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Approved */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-[#12A66A]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">Approved</span>
            <span className="text-2xl font-black text-[#12A66A] tabular-nums leading-tight block">{approved}</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-[#B45309]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">Pending</span>
            <span className="text-2xl font-black text-[#B45309] tabular-nums leading-tight block">{pending}</span>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FEE2E2] flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-[#DC2626]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">Rejected</span>
            <span className="text-2xl font-black text-[#DC2626] tabular-nums leading-tight block">{rejected}</span>
          </div>
        </div>
      </div>

      {/* ── Requests Table Card ───────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8EEF4] rounded-[24px] shadow-xs overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#111827] m-0">Leave Applications</h2>
            <p className="text-[11px] text-[#94A3B8]">Detailed log of all submitted leave requests</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#64748B]">
            {requests.length} Total
          </span>
        </div>

        {/* Table container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9] text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">From</th>
                <th className="py-3 px-4">To</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Applied On</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Admin Note</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#94A3B8]">
                    <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E8EEF4] flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-[#CBD5E0]" />
                    </div>
                    <p className="text-xs font-semibold text-[#64748B] mb-1">No Leave Requests Found</p>
                    <p className="text-[11px] text-[#94A3B8] mb-3">You haven't submitted any leave requests yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowApplyModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#12A66A] text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Apply for Leave
                    </button>
                  </td>
                </tr>
              ) : (
                requests.map((req, idx) => {
                  const typeMeta = TYPE_META[req.leaveTypeCode] || TYPE_META.CL;
                  const TypeIcon = typeMeta.icon;
                  const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = sc.icon;
                  const isExpanded = expandedReason === req.id;
                  const canWithdraw = req.status === 'PENDING';
                  const isWithdrawing = withdrawing === req.id;

                  return (
                    <tr key={req.id} className="hover:bg-[#FAFCFF] transition-colors">
                      {/* Row # */}
                      <td className="py-3.5 px-4 text-[11px] font-bold text-[#CBD5E0]">{idx + 1}</td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: typeMeta.bg }}
                          >
                            <TypeIcon className="w-3.5 h-3.5" style={{ color: typeMeta.color }} />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-[#111827] block whitespace-nowrap">
                              {req.leaveTypeName}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]  ">{req.leaveTypeCode}</span>
                          </div>
                        </div>
                      </td>

                      {/* From */}
                      <td className="py-3.5 px-4 text-xs   text-[#475569] whitespace-nowrap">
                        {req.startDate}
                      </td>

                      {/* To */}
                      <td className="py-3.5 px-4 text-xs   text-[#475569] whitespace-nowrap">
                        {req.isHalfDay ? req.startDate : req.endDate}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">
                          {formatDuration(req)}
                        </span>
                      </td>

                      {/* Applied On */}
                      <td className="py-3.5 px-4 text-xs   text-[#94A3B8] whitespace-nowrap">
                        {req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : '—'}
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${sc.cls}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {req.status === 'PENDING'
                            ? isSupervisor
                              ? 'Pending Admin'
                              : 'Pending Supervisor'
                            : req.status === 'APPROVED'
                            ? isSupervisor
                              ? 'Approved (Admin)'
                              : 'Approved (Supervisor)'
                            : req.status === 'REJECTED'
                            ? isSupervisor
                              ? 'Rejected (Admin)'
                              : 'Rejected (Supervisor)'
                            : sc.label}
                        </span>
                      </td>

                      {/* Admin Note / Reason */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        {req.decisionNote ? (
                          <button
                            type="button"
                            onClick={() => setExpandedReason(isExpanded ? null : req.id)}
                            className="flex items-start gap-1 text-left cursor-pointer group"
                          >
                            <span className={`text-[11px] text-[#475569] leading-relaxed ${isExpanded ? '' : 'line-clamp-1'}`}>
                              {req.decisionNote}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-[#94A3B8] shrink-0 mt-0.5 group-hover:text-[#475569]" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-[#94A3B8] shrink-0 mt-0.5 group-hover:text-[#475569]" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8] italic truncate block" title={req.reason}>
                            "{req.reason}"
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={!canWithdraw || isWithdrawing}
                          onClick={() => canWithdraw && handleWithdraw(req.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${canWithdraw
                              ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer active:scale-95'
                              : 'bg-[#F8FAFC] text-[#CBD5E0] border border-[#E8EEF4] cursor-not-allowed'
                            }`}
                        >
                          {isWithdrawing ? (
                            <span className="flex items-center gap-1">
                              <div className="w-3 h-3 border border-rose-300 border-t-rose-600 rounded-full animate-spin" />
                              Wait…
                            </span>
                          ) : (
                            'Withdraw'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Apply Leave Modal Popup ───────────────────────────────────────── */}
      {showApplyModal && (
        <ApplyLeaveModal
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => {
            setShowApplyModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

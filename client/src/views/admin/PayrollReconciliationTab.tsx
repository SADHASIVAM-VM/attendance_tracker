import React, { useState, useEffect } from 'react';
import { apiRequest, downloadFile } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { DataTablePagination } from '../../components/ui/data-table-pagination';
import {
  DollarSign,
  Lock,
  CheckCircle,
  AlertTriangle,
  Clock,
  Plus,
  Download,
  Calendar,
  Users,
  Building2,
  FileText,
  ShieldCheck,
  Receipt,
  HelpCircle,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const PayrollReconciliationTab: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [loadingPeriods, setLoadingPeriods] = useState<boolean>(true);
  const [loadingRec, setLoadingRec] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // New Period Modal
  const [showNewPeriodModal, setShowNewPeriodModal] = useState<boolean>(false);
  const [newPeriodName, setNewPeriodName] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newEndDate, setNewEndDate] = useState<string>('');

  // Adjustment Modal
  const [showAdjModal, setShowAdjModal] = useState<boolean>(false);
  const [adjWorkerId, setAdjWorkerId] = useState<string>('');
  const [adjType, setAdjType] = useState<string>('HOURS_ADDITION');
  const [adjAmountOrMinutes, setAdjAmountOrMinutes] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('');
  const [workerPage, setWorkerPage] = useState<number>(1);
  const [workerLimit, setWorkerLimit] = useState<number>(10);

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadReconciliation(selectedPeriodId);
    } else {
      setReconciliation(null);
    }
  }, [selectedPeriodId]);

  const loadPeriods = async () => {
    try {
      setLoadingPeriods(true);
      const res = await apiRequest('/payroll/periods');
      const list = Array.isArray(res) ? res : res.data || [];
      setPeriods(list);
      if (list.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load payroll periods:', err);
    } finally {
      setLoadingPeriods(false);
    }
  };

  const loadReconciliation = async (periodId: string) => {
    try {
      setLoadingRec(true);
      const res = await apiRequest(`/payroll/periods/${periodId}/reconciliation`);
      setReconciliation(res);
    } catch (err) {
      console.error('Failed to load reconciliation:', err);
    } finally {
      setLoadingRec(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodName || !newStartDate || !newEndDate) {
      alert('Please fill all required period fields');
      return;
    }
    try {
      setActionLoading(true);
      const created = await apiRequest('/payroll/periods', {
        method: 'POST',
        body: JSON.stringify({
          name: newPeriodName,
          startDate: newStartDate,
          endDate: newEndDate,
        }),
      });
      setShowNewPeriodModal(false);
      setNewPeriodName('');
      setNewStartDate('');
      setNewEndDate('');
      await loadPeriods();
      if (created?.id) {
        setSelectedPeriodId(created.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create payroll period');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockPeriod = async () => {
    if (!selectedPeriodId) return;
    if (!window.confirm('Lock this payroll period? Ordinary attendance and OT edits will be frozen.')) return;
    try {
      setActionLoading(true);
      await apiRequest(`/payroll/periods/${selectedPeriodId}/lock`, { method: 'POST' });
      await loadPeriods();
      await loadReconciliation(selectedPeriodId);
    } catch (err: any) {
      alert(err.message || 'Failed to lock period');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizePeriod = async () => {
    if (!selectedPeriodId) return;
    if (
      !window.confirm(
        'FINAL CONFIRMATION: Finalize and close this payroll period? This will permanently snapshot totals and lock all associated records.'
      )
    )
      return;
    try {
      setActionLoading(true);
      await apiRequest(`/payroll/periods/${selectedPeriodId}/finalize`, { method: 'POST' });
      await loadPeriods();
      await loadReconciliation(selectedPeriodId);
    } catch (err: any) {
      alert(err.message || 'Failed to finalize period');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId || !adjWorkerId || !adjAmountOrMinutes || !adjReason.trim()) {
      alert('Please complete all adjustment fields with a mandatory reason.');
      return;
    }
    try {
      setActionLoading(true);
      await apiRequest(`/payroll/periods/${selectedPeriodId}/adjustments`, {
        method: 'POST',
        body: JSON.stringify({
          workerId: adjWorkerId,
          adjustmentType: adjType,
          amountOrMinutes: parseFloat(adjAmountOrMinutes),
          reason: adjReason,
        }),
      });
      setShowAdjModal(false);
      setAdjWorkerId('');
      setAdjAmountOrMinutes('');
      setAdjReason('');
      await loadReconciliation(selectedPeriodId);
    } catch (err: any) {
      alert(err.message || 'Failed to record payroll adjustment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPayrollXlsx = async () => {
    if (!selectedPeriodId) return;
    try {
      setActionLoading(true);
      await downloadFile(
        `/exports/payroll/${selectedPeriodId}`,
        `payroll_reconciliation_${selectedPeriod?.name?.replace(/\s+/g, '_') || selectedPeriodId}.xlsx`
      );
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setActionLoading(false);
    }
  };

  const formatHoursMinutes = (totalMinutes: number) => {
    const mins = totalMinutes || 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0 && m === 0) return '0h';
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const metrics = reconciliation?.metrics;
  const workers = reconciliation?.workers || [];
  const adjustments = reconciliation?.adjustments || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 m-0">Payroll Reconciliation & Locking</h2>
          <p className="text-sm text-slate-500 mt-1">
            Reconcile eligible standard hours, worked hours, approved overtime, and site expenses with audit locking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector Dropdown */}
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 shadow-xs"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startDate} to {p.endDate}) — [{p.status}]
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowNewPeriodModal(true)}
            className="px-3.5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Period</span>
          </button>

          {selectedPeriodId && (
            <button
              onClick={handleExportPayrollXlsx}
              disabled={actionLoading}
              className="px-3.5 py-2.5 bg-[#12A66A] text-white rounded-xl text-xs font-semibold hover:bg-[#0f8a58] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export Reconciled (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {selectedPeriod && (
        <>
          {/* Period Status Banner & Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                  selectedPeriod.status === 'FINALIZED'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : selectedPeriod.status === 'LOCKED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {selectedPeriod.status}
              </span>
              <div>
                <span className="text-sm font-bold text-slate-900 block leading-tight">
                  {selectedPeriod.name}
                </span>
                <span className="text-xs text-slate-500">
                  {selectedPeriod.startDate} &rarr; {selectedPeriod.endDate}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAdjModal(true)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Add Adjustment</span>
              </button>

              {selectedPeriod.status === 'DRAFT' && (
                <button
                  onClick={handleLockPeriod}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Period</span>
                </button>
              )}

              {selectedPeriod.status === 'LOCKED' && (
                <button
                  onClick={handleFinalizePeriod}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-700 text-white hover:bg-purple-800 text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Finalize & Snapshot</span>
                </button>
              )}

              {selectedPeriod.status === 'FINALIZED' && (
                <div className="flex items-center gap-1.5 text-xs text-purple-700 font-semibold px-2 py-1 bg-purple-50 rounded-xl">
                  <Lock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Locked & Immutable Snapshot</span>
                </div>
              )}
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard
              title="Eligible Standard Hours"
              value={formatHoursMinutes(metrics?.totalStandardMinutes || selectedPeriod.totalStandardMinutes)}
              icon={Calendar}
            />
            <StatCard
              title="Net Worked Hours"
              value={formatHoursMinutes(metrics?.totalWorkedMinutes || selectedPeriod.totalWorkedMinutes)}
              icon={Clock}
              badge={`${metrics?.totalWorkers || selectedPeriod.totalWorkers || 0} workers`}
            />
            <StatCard
              title="Approved Overtime"
              value={formatHoursMinutes(metrics?.totalApprovedOtMinutes || selectedPeriod.totalApprovedOtMinutes)}
              icon={CheckCircle}
              badgeColor="text-emerald-700 bg-emerald-50"
            />
            <StatCard
              title="Approved Expenses"
              value={`$${Number(metrics?.totalApprovedExpenses || selectedPeriod.totalApprovedExpenses || 0).toFixed(2)}`}
              icon={Receipt}
              badgeColor="text-blue-700 bg-blue-50"
            />
            <StatCard
              title="Exceptions & Flags"
              value={`${metrics?.unresolvedExceptions || selectedPeriod.exceptionCount || 0}`}
              icon={AlertTriangle}
              badgeColor={
                (metrics?.unresolvedExceptions || selectedPeriod.exceptionCount || 0) > 0
                  ? 'text-rose-700 bg-rose-50'
                  : 'text-slate-600 bg-slate-50'
              }
            />
          </div>

          {/* Reconciliation Details Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900 m-0">Worker Payroll Reconciliation Ledger</h3>
              </div>
              <span className="text-xs text-slate-500">
                {workers.length} eligible workers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Primary Worksite</th>
                    <th className="py-3 px-4">Standard Hours</th>
                    <th className="py-3 px-4">Worked Hours</th>
                    <th className="py-3 px-4">Approved OT</th>
                    <th className="py-3 px-4">Approved Expenses</th>
                    <th className="py-3 px-4">Exceptions / Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingRec ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Reconciling payroll records and policy rules...
                      </td>
                    </tr>
                  ) : workers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No worker attendance found for this payroll period.
                      </td>
                    </tr>
                  ) : (
                    workers
                      .slice((workerPage - 1) * workerLimit, workerPage * workerLimit)
                      .map((w: any) => (
                      <tr key={w.workerId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {w.workerName}
                          <span className="block text-[11px] font-mono text-slate-400 font-normal">
                            {w.employeeCode || w.workerId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">{w.worksiteName || '—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">{formatHoursMinutes(w.standardMinutes)}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{formatHoursMinutes(w.workedMinutes)}</td>
                        <td className="py-3 px-4 font-bold text-emerald-700">
                          {formatHoursMinutes(w.approvedOtMinutes)}
                          {w.pendingOtMinutes > 0 && (
                            <span className="block text-[10px] text-amber-600 font-medium">
                              ({formatHoursMinutes(w.pendingOtMinutes)} pending)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                          ${Number(w.approvedExpenses || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {w.flags && w.flags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {w.flags.map((flag: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"
                                >
                                  {flag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                              <CheckCircle className="w-3 h-3" />
                              <span>Clean</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {workers.length > 0 && (
              <DataTablePagination
                metadata={{
                  total: workers.length,
                  page: workerPage,
                  limit: workerLimit,
                  offset: (workerPage - 1) * workerLimit,
                  totalPages: Math.ceil(workers.length / workerLimit),
                }}
                onPageChange={(p) => setWorkerPage(p)}
                onLimitChange={(l) => {
                  setWorkerLimit(l);
                  setWorkerPage(1);
                }}
                pageSizeOptions={[10, 25, 50]}
                isLoading={loadingRec}
              />
            )}
          </div>

          {/* Payroll Adjustments Audit Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900 m-0">Mandatory Adjustments & Audit Trail</h3>
              </div>
              <span className="text-xs text-slate-500">
                {adjustments.length} adjustment records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Worker</th>
                    <th className="py-3 px-4">Adjustment Type</th>
                    <th className="py-3 px-4">Amount / Minutes</th>
                    <th className="py-3 px-4">Mandatory Audit Reason</th>
                    <th className="py-3 px-4">Adjusted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No manual adjustments recorded for this payroll cycle.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{a.workerName || a.workerId}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                            {a.adjustmentType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {a.adjustmentType.includes('HOURS')
                            ? `${a.amountOrMinutes} mins`
                            : `$${Number(a.amountOrMinutes).toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4 text-xs italic text-slate-600">{a.reason}</td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-800">{a.adjustedByName || a.adjustedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* New Period Modal */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 m-0">Create Payroll Reconciliation Period</h3>
            <p className="text-xs text-slate-500">
              Define the calendar boundaries for this payroll cycle. Records within these dates will be aggregated.
            </p>

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Period Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="e.g. October 2026 Cycle A"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#12A66A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPeriodModal(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#12A66A] text-white hover:bg-[#0f8a58] transition-colors shadow-xs"
                >
                  {actionLoading ? 'Creating...' : 'Create Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 m-0">Record Payroll Adjustment</h3>
            <p className="text-xs text-slate-500">
              Post-finalization correction or discretionary reconciliation adjustment. Mandatory reason will be permanently audited.
            </p>

            <form onSubmit={handleCreateAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Worker <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={adjWorkerId}
                  onChange={(e) => setAdjWorkerId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="">Select a worker...</option>
                  {workers.map((w: any) => (
                    <option key={w.workerId} value={w.workerId}>
                      {w.workerName} ({w.employeeCode || w.workerId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <option value="HOURS_ADDITION">Hours Addition (Minutes)</option>
                  <option value="HOURS_DEDUCTION">Hours Deduction (Minutes)</option>
                  <option value="EXPENSE_REIMBURSEMENT">Expense Reimbursement ($)</option>
                  <option value="MISC_BONUS">Discretionary Bonus ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {adjType.includes('HOURS') ? 'Minutes' : 'Amount ($)'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjAmountOrMinutes}
                  onChange={(e) => setAdjAmountOrMinutes(e.target.value)}
                  placeholder={adjType.includes('HOURS') ? 'e.g. 60' : 'e.g. 150.00'}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Approved supervisor overtime missed due to network timeout, manual ticket #1042..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#12A66A] text-white hover:bg-[#0f8a58] transition-colors shadow-xs"
                >
                  {actionLoading ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

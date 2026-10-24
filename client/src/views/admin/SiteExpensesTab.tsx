import React, { useState, useEffect } from 'react';
import { apiRequest, downloadFile } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Filter,
  Check,
  X,
  ExternalLink,
  Receipt,
  Building2,
  FileText,
} from 'lucide-react';

export const SiteExpensesTab: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [worksites, setWorksites] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Rejection modal
  const [rejectModalExpense, setRejectModalExpense] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    loadWorksites();
  }, []);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, worksiteId, statusFilter]);

  const loadWorksites = async () => {
    try {
      const res = await apiRequest('/worksites');
      setWorksites(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to load worksites:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);
      if (statusFilter) params.append('status', statusFilter);

      const [expRes, sumRes] = await Promise.all([
        apiRequest(`/expenses?${params.toString()}`),
        apiRequest(`/reports/expenses-summary?${params.toString()}`),
      ]);

      setExpenses(Array.isArray(expRes) ? expRes : expRes.data || []);
      setSummary(sumRes);
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (expenseId: string) => {
    if (!window.confirm('Approve this site expense for payroll reimbursement?')) return;
    try {
      setActionLoading(true);
      await apiRequest(`/expenses/${expenseId}/approve`, { method: 'POST' });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalExpense) return;
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required');
      return;
    }

    try {
      setActionLoading(true);
      await apiRequest(`/expenses/${rejectModalExpense.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      setRejectModalExpense(null);
      setRejectionReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExpenses = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);

      await downloadFile(
        `/exports/expenses?${params.toString()}`,
        `site_expenses_${new Date().toISOString().split('T')[0]}.xlsx`
      );
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const totalAmount = summary?.totalAmount || 0;
  const approvedAmount = summary?.approvedAmount || 0;
  const pendingAmount = summary?.pendingAmount || 0;
  const totalCount = summary?.totalCount || expenses.length;

  return (
    <div className="space-y-6">
      {/* Header and Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 m-0">Site Expense Management & Vouchers</h2>
          <p className="text-sm text-slate-500 mt-1">
            Review, approve, or reject field site expenditures. Only approved expenses flow to finalized payroll.
          </p>
        </div>

        <button
          onClick={handleExportExpenses}
          disabled={isExporting}
          className="px-4 py-2.5 bg-[#12A66A] text-white rounded-xl text-xs font-semibold hover:bg-[#0f8a58] transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Generating Excel...' : 'Export Expenses (.xlsx)'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Expenses Logged"
          value={`$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Receipt}
          badge={`${totalCount} vouchers`}
        />
        <StatCard
          title="Approved (Payroll Eligible)"
          value={`$${approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={CheckCircle}
          badgeColor="text-emerald-700 bg-emerald-50"
        />
        <StatCard
          title="Pending Approval"
          value={`$${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Clock}
          badgeColor="text-amber-700 bg-amber-50"
        />
        <StatCard
          title="Rejected Vouchers"
          value={`${expenses.filter((e) => e.status === 'REJECTED').length}`}
          icon={AlertTriangle}
          badgeColor="text-rose-700 bg-rose-50"
        />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
          <Filter className="w-3.5 h-3.5" />
          Filters:
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Start Date"
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="End Date"
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        />

        <select
          value={worksiteId}
          onChange={(e) => setWorksiteId(e.target.value)}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        >
          <option value="">All Worksites</option>
          {worksites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {(startDate || endDate || worksiteId || statusFilter) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setWorksiteId('');
              setStatusFilter('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Worksite</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Receipt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reviewer / Audit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    Loading site expense vouchers...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No site expenses found matching filters.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{e.expenseDate}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800">{e.worksiteName || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs max-w-xs truncate" title={e.description}>
                      {e.description}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {e.currency || 'USD'} {Number(e.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {e.receiptUrl ? (
                        <a
                          href={e.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 hover:underline"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          e.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {e.status || 'PENDING'}
                      </span>
                      {e.payrollPeriodId && (
                        <span className="block text-[10px] text-indigo-600 font-semibold mt-0.5">
                          Linked to Payroll
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {e.reviewerName ? (
                        <div>
                          <span className="font-medium text-slate-800">{e.reviewerName}</span>
                          <span className="block text-[10px] text-slate-400">
                            {e.reviewedAt ? new Date(e.reviewedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {e.rejectionReason && (
                        <span className="block text-[10px] text-rose-600 italic mt-0.5" title={e.rejectionReason}>
                          Reason: {e.rejectionReason}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {e.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(e.id)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Approve Expense"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setRejectModalExpense(e);
                              setRejectionReason('');
                            }}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Reject Expense"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Closed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 m-0">Reject Site Expense Voucher</h3>
            <p className="text-xs text-slate-500">
              Please state why this expense voucher of {rejectModalExpense.currency || 'USD'}{' '}
              {Number(rejectModalExpense.amount).toFixed(2)} is being rejected. This will be preserved in the audit trail.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Unapproved personal expense, receipt illegible, exceeded authorized site quota..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalExpense(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

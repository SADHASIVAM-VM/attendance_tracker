import React, { useState, useEffect } from 'react';
import { apiRequest, downloadFile } from '../../lib/api';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  Users,
  Clock,
  DollarSign,
  ShieldCheck,
  X,
} from 'lucide-react';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({ isOpen, onClose }) => {
  const [exportType, setExportType] = useState<string>('detailed-attendance');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [worksites, setWorksites] = useState<any[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    try {
      const [ws, pp] = await Promise.all([
        apiRequest('/worksites').catch(() => []),
        apiRequest('/payroll/periods').catch(() => []),
      ]);
      setWorksites(Array.isArray(ws) ? ws : ws.data || []);
      const pList = Array.isArray(pp) ? pp : pp.data || [];
      setPayrollPeriods(pList);
      if (pList.length > 0) {
        setSelectedPeriodId(pList[0].id);
      }
    } catch (err) {
      console.error('Failed to load export options:', err);
    }
  };

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (worksiteId) params.append('worksiteId', worksiteId);

      const timestamp = new Date().toISOString().split('T')[0];

      switch (exportType) {
        case 'detailed-attendance':
          await downloadFile(
            `/exports/attendance?${params.toString()}`,
            `detailed_attendance_${timestamp}.xlsx`
          );
          break;
        case 'worker-summaries':
          await downloadFile(
            `/exports/worker-summaries?${params.toString()}`,
            `worker_summaries_${timestamp}.xlsx`
          );
          break;
        case 'overtime':
          await downloadFile(
            `/exports/overtime?${params.toString()}`,
            `overtime_report_${timestamp}.xlsx`
          );
          break;
        case 'site-attendance':
          await downloadFile(
            `/exports/site-attendance?${params.toString()}`,
            `site_attendance_ot_${timestamp}.xlsx`
          );
          break;
        case 'expenses':
          await downloadFile(
            `/exports/expenses?${params.toString()}`,
            `site_expenses_${timestamp}.xlsx`
          );
          break;
        case 'payroll':
          if (!selectedPeriodId) {
            alert('Please select a payroll cycle');
            return;
          }
          await downloadFile(
            `/exports/payroll/${selectedPeriodId}`,
            `payroll_reconciliation_${selectedPeriodId}_${timestamp}.xlsx`
          );
          break;
        default:
          break;
      }
      onClose();
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      id: 'detailed-attendance',
      title: '1. Detailed Attendance Records',
      description: 'Punches, GPS coordinates, geofence audit, break minutes, shift policies, and approval status.',
      icon: Clock,
    },
    {
      id: 'worker-summaries',
      title: '2. Weekly & Monthly Worker Summaries',
      description: 'Aggregated worked days, scheduled hours, net worked hours, OT minutes, and attendance rate.',
      icon: Users,
    },
    {
      id: 'overtime',
      title: '3. Calculated & Approved Overtime',
      description: 'Daily sessions with >9h worked duration, break deductions, approval status, reviewer, and reason.',
      icon: FileSpreadsheet,
    },
    {
      id: 'site-attendance',
      title: '4. Site-wise Attendance & OT',
      description: 'Worksite totals, location geofence parameters, total worker sessions, and cumulative overtime.',
      icon: Building2,
    },
    {
      id: 'expenses',
      title: '5. Site Expenses Ledger',
      description: 'Site expense vouchers, submitters, category distribution, receipts, and supervisor approval logs.',
      icon: DollarSign,
    },
    {
      id: 'payroll',
      title: '6. Payroll Period Reconciliation',
      description: 'Finalized or active payroll cycle: standard hours, net hours, approved OT, site expenses, and flags.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#12A66A] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 m-0">Excel (.xlsx) Report Exporter</h3>
              <p className="text-xs text-slate-500">
                Formula-injection protected binary spreadsheets formatted with real formulas, headers, and numeric durations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Type Selection Grid */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Select Report Type:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exportOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = exportType === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setExportType(opt.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#12A66A] bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected ? 'text-[#12A66A]' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          isSelected ? 'text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {opt.title}
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                        {opt.description}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Parameters */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <span className="text-xs font-bold text-slate-700 block">Scope & Parameters:</span>

          {exportType === 'payroll' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Payroll Cycle <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
              >
                {payrollPeriods.length === 0 ? (
                  <option value="">No payroll periods created yet</option>
                ) : (
                  payrollPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.startDate} to {p.endDate}) — [{p.status}]
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Worksite Scope</label>
                <select
                  value={worksiteId}
                  onChange={(e) => setWorksiteId(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">All Worksites</option>
                  {worksites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || (exportType === 'payroll' && !selectedPeriodId)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#12A66A] text-white hover:bg-[#0f8a58] transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generating Spreadsheet...' : 'Download .xlsx Spreadsheet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import {
  CloseIcon,
  CheckCircleIcon,
  ErrorProfileIcon,
  ShieldIcon,
  Profile1Icon,
  CalenderIcon,
  LocationIcon,
  RefreshCcwIcon,
} from '@astraicons/react/linear';

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  employeeCode?: string;
}

interface WorksiteOption {
  id: string;
  name: string;
  code: string;
  primarySupervisorId?: string | null;
  primarySupervisorName?: string | null;
  secondarySupervisorId?: string | null;
  secondarySupervisorName?: string | null;
}

interface ReassignSupervisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWorksite?: WorksiteOption | null;
}

export const ReassignSupervisorModal: React.FC<ReassignSupervisorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialWorksite,
}) => {
  const [worksitesList, setWorksitesList] = useState<WorksiteOption[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<UserOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedWorksiteId, setSelectedWorksiteId] = useState<string>('');
  const [isPermanent, setIsPermanent] = useState<boolean>(true);
  const [newPrimaryId, setNewPrimaryId] = useState<string>('');
  const [newSecondaryId, setNewSecondaryId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setReason('');
      setStartDate(todayStr);
      // default end date: 14 days later
      const defaultEnd = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      setEndDate(defaultEnd);

      if (initialWorksite) {
        setSelectedWorksiteId(initialWorksite.id);
        setNewPrimaryId(initialWorksite.primarySupervisorId || '');
        setNewSecondaryId(initialWorksite.secondarySupervisorId || '');
      }

      loadPrerequisites();
    }
  }, [isOpen, initialWorksite]);

  const loadPrerequisites = async () => {
    setLoadingInitial(true);
    try {
      // 1. Fetch supervisors and admins
      const usersRes = await apiRequest<any>('/users?limit=100');
      const allUsers = Array.isArray(usersRes) ? usersRes : usersRes?.users || usersRes?.data || [];
      const eligible = allUsers.filter((u: any) =>
        u.isActive && (u.roles?.includes('SUPERVISOR') || u.roles?.includes('ADMIN') || u.roles?.includes('SUPER_ADMIN'))
      );
      setSupervisorsList(eligible);

      // 2. Fetch worksites if not provided
      if (!initialWorksite) {
        const wsRes = await apiRequest<any>('/worksites');
        const wsData = Array.isArray(wsRes) ? wsRes : wsRes?.data || [];
        setWorksitesList(wsData);
        if (wsData.length > 0 && !selectedWorksiteId) {
          setSelectedWorksiteId(wsData[0].id);
          setNewPrimaryId(wsData[0].primarySupervisorId || '');
          setNewSecondaryId(wsData[0].secondarySupervisorId || '');
        }
      }
    } catch (err: any) {
      toast.error('Failed to load eligible supervisors', 'Error');
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleWorksiteChange = (wsId: string) => {
    setSelectedWorksiteId(wsId);
    const found = worksitesList.find((w) => w.id === wsId);
    if (found) {
      setNewPrimaryId(found.primarySupervisorId || '');
      setNewSecondaryId(found.secondarySupervisorId || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedWorksiteId) {
      setErrorMsg('Please select a worksite.');
      return;
    }
    if (!newPrimaryId) {
      setErrorMsg('Please select a primary supervisor.');
      return;
    }
    if (newSecondaryId && newSecondaryId === newPrimaryId) {
      setErrorMsg('Primary supervisor and backup supervisor cannot be the same person.');
      return;
    }
    if (!isPermanent) {
      if (!startDate || !endDate) {
        setErrorMsg('Start date and end date are required for temporary coverage reassignment.');
        return;
      }
      if (startDate > endDate) {
        setErrorMsg('Start date must be before or equal to end date.');
        return;
      }
    }
    if (!reason || reason.trim().length < 5) {
      setErrorMsg('A meaningful explanation/reason of at least 5 characters is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        worksiteId: selectedWorksiteId,
        newPrimaryId,
        newSecondaryId: newSecondaryId || null,
        isPermanent,
        reason: reason.trim(),
      };
      if (!isPermanent) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }

      const res = await apiRequest<any>('/admin/reassignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(res?.message || 'Supervisor reassignment completed successfully', 'Success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply supervisor reassignment');
      toast.error(err.message || 'Reassignment failed', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentWorksite = initialWorksite || worksitesList.find((w) => w.id === selectedWorksiteId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#E8EEF4] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8EEF4] bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-xs">
              <ShieldIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111827] m-0">Supervisor Site Reassignment</h2>
              <p className="text-xs text-[#64748B] m-0 mt-0.5">
                Assign primary & backup supervisors with permanent or temporary coverage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#111827] hover:bg-[#E8EEF4] transition-colors cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-start gap-2.5 text-xs text-[#991B1B]">
              <ErrorProfileIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Worksite Selector */}
          <div>
            <label className="block text-xs font-bold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <LocationIcon className="w-3.5 h-3.5 text-[#12A66A]" />
              Worksite Target
            </label>
            {initialWorksite ? (
              <div className="p-3 rounded-2xl border border-[#E8EEF4] bg-[#F8FAFC] flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-[#111827] m-0">{initialWorksite.name}</p>
                  <p className="text-[11px] font-mono text-[#64748B] m-0">{initialWorksite.code}</p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E6F7EF] text-[#0E8F5B]">
                  Preselected Site
                </span>
              </div>
            ) : (
              <select
                value={selectedWorksiteId}
                onChange={(e) => handleWorksiteChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E8EEF4] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                disabled={loadingInitial}
              >
                {worksitesList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            )}
            {currentWorksite && (
              <p className="text-[11px] text-[#64748B] mt-1">
                Current Primary: <span className="font-bold text-[#111827]">{currentWorksite.primarySupervisorName || 'Unassigned'}</span>
                {currentWorksite.secondarySupervisorName && (
                  <span> • Backup: <span className="font-bold text-[#111827]">{currentWorksite.secondarySupervisorName}</span></span>
                )}
              </p>
            )}
          </div>

          {/* Reassignment Mode (Permanent vs Temporary) */}
          <div>
            <label className="block text-xs font-bold text-[#111827] mb-1.5">
              Reassignment Scope & Duration
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPermanent(true)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${isPermanent
                    ? 'border-[#12A66A] bg-[#E6F7EF] text-[#0E8F5B] ring-2 ring-[#12A66A]/20'
                    : 'border-[#E8EEF4] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold">Permanent Reassignment</span>
                  {isPermanent && <CheckCircleIcon className="w-4 h-4 text-[#12A66A]" />}
                </div>
                <p className="text-[11px] text-[#64748B] m-0 leading-tight">
                  Closes & supersedes previous supervisor assignments. Preserves audit history.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsPermanent(false)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${!isPermanent
                    ? 'border-[#12A66A] bg-[#E6F7EF] text-[#0E8F5B] ring-2 ring-[#12A66A]/20'
                    : 'border-[#E8EEF4] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold">Temporary Coverage</span>
                  {!isPermanent && <CheckCircleIcon className="w-4 h-4 text-[#12A66A]" />}
                </div>
                <p className="text-[11px] text-[#64748B] m-0 leading-tight">
                  Delegates supervisor powers for a defined date period. Returns automatically on expiry.
                </p>
              </button>
            </div>
          </div>

          {/* Date Range if Temporary */}
          {!isPermanent && (
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E8EEF4] space-y-3 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#111827]">
                <CalenderIcon className="w-4 h-4 text-[#12A66A]" />
                Coverage Date Window
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">Effective Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8EEF4] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">Effective End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8EEF4] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Primary Supervisor Selection */}
          <div>
            <label className="block text-xs font-bold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <Profile1Icon className="w-3.5 h-3.5 text-[#12A66A]" />
              {isPermanent ? 'New Primary Supervisor' : 'Delegated Coverage Supervisor'}
            </label>
            <select
              value={newPrimaryId}
              onChange={(e) => setNewPrimaryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E8EEF4] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
            >
              <option value="">Select a qualified supervisor...</option>
              {supervisorsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email}) {s.employeeCode ? `• ${s.employeeCode}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Secondary Supervisor Selection (Permanent mode) */}
          {isPermanent && (
            <div>
              <label className="block text-xs font-bold text-[#111827] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldIcon className="w-3.5 h-3.5 text-[#64748B]" />
                  Configured Secondary / Backup Supervisor (Optional)
                </span>
                <span className="text-[10px] text-[#94A3B8]">Auto-fallback during supervisor leave</span>
              </label>
              <select
                value={newSecondaryId}
                onChange={(e) => setNewSecondaryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E8EEF4] bg-white text-xs font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
              >
                <option value="">None (Admin fallback will be used if leave is taken)</option>
                {supervisorsList
                  .filter((s) => s.id !== newPrimaryId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email}) {s.employeeCode ? `• ${s.employeeCode}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Mandatory Reason */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#111827]">
                Reassignment Reason <span className="text-red-500">*</span>
              </label>
              <span className={`text-[10px] font-mono ${reason.trim().length >= 5 ? 'text-[#12A66A]' : 'text-[#94A3B8]'}`}>
                {reason.trim().length}/5 min characters
              </span>
            </div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a mandatory reason for this manual reassignment (e.g. Leave coverage for Marcus, Site management restructuring)..."
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E8EEF4] bg-white text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] resize-none"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-[#E8EEF4] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-[#E8EEF4] text-xs font-bold text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5 || !newPrimaryId}
              className="px-5 py-2.5 rounded-xl bg-[#12A66A] text-white text-xs font-bold hover:bg-[#0E8F5B] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              {submitting && <RefreshCcwIcon className="w-3.5 h-3.5 animate-spin" />}
              {isPermanent ? 'Apply Permanent Reassignment' : 'Schedule Temporary Delegation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

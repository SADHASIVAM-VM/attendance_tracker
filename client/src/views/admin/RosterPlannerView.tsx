import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../lib/api';
import { toast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  CalendarDays,
  Plus,
  Users,
  MapPin,
  Clock,
  Send,
  XCircle,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar as CalendarIcon,
  Layers,
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Building2,
  UserCheck,
  Sparkles,
  Info,
  Repeat,
  Sun,
  Mail,
  Ban,
  User,
  ArrowRightLeft,
} from 'lucide-react';
import { ScheduleTransferModal } from '../../components/transfers/ScheduleTransferModal';
import { TransferManagementTab } from '../../components/transfers/TransferManagementTab';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RosterPlannerView: React.FC = () => {
  // Current real-world date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayDate = useMemo(() => new Date(), []);

  // View mode: 'calendar' or 'date-groups'
  const [viewMode, setViewMode] = useState<'calendar' | 'date-groups'>('calendar');

  // Currently selected date (defaults to current date!)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Calendar navigation state (year & month)
  const [currentYear, setCurrentYear] = useState<number>(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(todayDate.getMonth()); // 0-indexed (0 to 11)

  // Assignments data for current month & selected date
  const [monthAssignments, setMonthAssignments] = useState<any[]>([]);
  const [dateAssignments, setDateAssignments] = useState<any[]>([]);
  const [workerAllocations, setWorkerAllocations] = useState<any[]>([]);

  // Metadata dropdowns
  const [worksites, setWorksites] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);

  // Loading & message states
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pop-up Modal State for Add Group
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('Delhi');
  const [worksiteId, setWorksiteId] = useState<string>('');
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [shiftStartTime, setShiftStartTime] = useState<string>('08:00');
  const [shiftEndTime, setShiftEndTime] = useState<string>('17:00');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');
  const [carryForward, setCarryForward] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Manage Workers Modal (for ongoing / carried-forward group)
  const [editWorkersModalOpen, setEditWorkersModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [editSelectedWorkerIds, setEditSelectedWorkerIds] = useState<string[]>([]);
  const [editWorkerSearchTerm, setEditWorkerSearchTerm] = useState<string>('');
  const [savingWorkers, setSavingWorkers] = useState<boolean>(false);

  // Cancellation Modal
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelAssignmentId, setCancelAssignmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Primary Section Tab: 'rosters' (Site Rosters) | 'transfers' (Worker Transfers & History)
  const [activeSection, setActiveSection] = useState<'rosters' | 'transfers'>('rosters');

  // Quick Schedule Transfer Modal State
  const [scheduleTransferModalOpen, setScheduleTransferModalOpen] = useState<boolean>(false);
  const [transferTargetWorker, setTransferTargetWorker] = useState<any | null>(null);

  // Formatted worker list with current worksite and scheduled transfer details
  const formattedWorkersForModal = useMemo(() => {
    return allWorkers.map((w) => {
      const alloc = workerAllocations.find((a) => a.workerId === w.id);
      return {
        id: w.id,
        fullName: w.fullName,
        email: w.email,
        employeeCode: w.employeeCode,
        currentWorksiteId: alloc?.worksiteId,
        currentWorksiteName: alloc?.worksiteName,
        currentWorksiteCode: alloc?.worksiteCode,
        hasScheduledTransfer: alloc?.hasScheduledTransfer || false,
        scheduledTransfer: alloc?.scheduledTransfer || null,
      };
    });
  }, [allWorkers, workerAllocations]);

  // Initial load of master metadata (sites, supervisors, workers, allocations)
  useEffect(() => {
    loadMasterData();
  }, []);

  // Load assignments when year/month changes (for the calendar markers)
  useEffect(() => {
    loadMonthAssignments(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Load assignments whenever selectedDate changes
  useEffect(() => {
    loadDateAssignments(selectedDate);
  }, [selectedDate]);

  const loadWorkerAllocations = async () => {
    try {
      const data = await apiRequest('/assignments/worker-allocations');
      setWorkerAllocations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load worker allocations:', err);
    }
  };

  const loadMasterData = async () => {
    try {
      const [sitesRes, usersRes, allocationsRes] = await Promise.all([
        apiRequest('/worksites'),
        apiRequest('/users'),
        apiRequest('/assignments/worker-allocations').catch(() => []),
      ]);

      const sitesList = Array.isArray(sitesRes) ? sitesRes : (sitesRes?.data || []);
      const activeSites = sitesList.filter((s: any) => s.isActive !== false);
      setWorksites(activeSites);

      const usersList = Array.isArray(usersRes) ? usersRes : (usersRes?.data || []);
      const sups = usersList.filter((u: any) => u.roles && u.roles.includes('SUPERVISOR') && u.isActive !== false);
      const wrks = usersList.filter((u: any) => u.roles && u.roles.includes('WORKER') && u.isActive !== false);

      setSupervisors(sups);
      setAllWorkers(wrks);
      setWorkerAllocations(Array.isArray(allocationsRes) ? allocationsRes : []);

      if (activeSites.length > 0) setWorksiteId(activeSites[0].id);
      if (sups.length > 0) setSupervisorId(sups[0].id);
    } catch (err: any) {
      console.error('Failed to load master metadata:', err);
    }
  };

  const loadMonthAssignments = async (year: number, month: number) => {
    try {
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const data = await apiRequest(`/assignments?month=${monthPrefix}`);
      setMonthAssignments(data);
    } catch (err: any) {
      console.error('Failed to load month assignments:', err);
    }
  };

  const loadDateAssignments = async (date: string) => {
    try {
      setLoading(true);
      const data = await apiRequest(`/assignments?date=${date}`);
      setDateAssignments(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load assignments for date', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Generate Year Range (supports N years: e.g., +/- 10 years around current year)
  const availableYears = useMemo(() => {
    const startYear = todayDate.getFullYear() - 5;
    const endYear = todayDate.getFullYear() + 10;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [todayDate]);

  // Calendar Days calculation for the active month and year
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const getAssignmentsForDate = (dateStr: string) => {
      return monthAssignments.filter((a) => {
        const aDate = String(a.workDate).split('T')[0];
        if (aDate === dateStr) return true;
        // Don't carry forward locations to future dates; only the current date is enough
        if (dateStr > todayStr) return false;
        const isCarry = a.carryForward !== false;
        if (isCarry && aDate < dateStr) {
          if (a.status === 'CANCELLED') {
            const cancelDate = a.cancelledAt ? String(a.cancelledAt).split('T')[0] : aDate;
            return dateStr <= cancelDate;
          }
          return true;
        }
        return false;
      });
    };

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      assignments: any[];
    }> = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        assignments: getAssignmentsForDate(dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        assignments: getAssignmentsForDate(dateStr),
      });
    }

    // Next month padding days to complete 35 or 42 cells (multiple of 7)
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
        days.push({
          dateStr,
          dayNumber: nextDay,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
          isSelected: dateStr === selectedDate,
          assignments: getAssignmentsForDate(dateStr),
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, monthAssignments, todayStr, selectedDate]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayStr);
  };

  // Click on a calendar date opens the Date Detail / Groups view
  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setViewMode('date-groups');
  };

  // Open modal prefilling group defaults
  const handleOpenAddGroupModal = (suggestedName?: string) => {
    setGroupName(suggestedName || `Group-${dateAssignments.length + 1}`);
    setSelectedWorkerIds([]);
    setWorkerSearchTerm('');
    setCarryForward(true);
    setCreateModalOpen(true);
  };

  // Toggle worker in multi-select checklist
  const toggleWorker = (id: string) => {
    if (selectedWorkerIds.includes(id)) {
      setSelectedWorkerIds(selectedWorkerIds.filter((wId) => wId !== id));
    } else {
      setSelectedWorkerIds([...selectedWorkerIds, id]);
    }
  };

  const handleSelectAllWorkers = () => {
    const availableWrkIds = allWorkers
      .filter((w) => {
        const alloc = workerAllocations.find((a) => a.workerId === w.id);
        return !alloc || alloc.worksiteId === worksiteId;
      })
      .map((w) => w.id);
    setSelectedWorkerIds(availableWrkIds);
  };

  const handleDeselectAllWorkers = () => {
    setSelectedWorkerIds([]);
  };

  // Filtered workers in modal
  const filteredWorkersForModal = useMemo(() => {
    if (!workerSearchTerm.trim()) return allWorkers;
    const term = workerSearchTerm.toLowerCase();
    return allWorkers.filter(
      (w) =>
        w.fullName?.toLowerCase().includes(term) ||
        w.employeeCode?.toLowerCase().includes(term) ||
        w.email?.toLowerCase().includes(term)
    );
  }, [allWorkers, workerSearchTerm]);

  // Manage / Edit Workers Handlers (Ongoing carry-forward group)
  const handleOpenEditWorkers = (assignment: any) => {
    setEditingAssignment(assignment);
    const currentWorkerIds = (assignment.workers || []).map((w: any) => w.workerId || w.id);
    setEditSelectedWorkerIds(currentWorkerIds);
    setEditWorkerSearchTerm('');
    setEditWorkersModalOpen(true);
  };

  const toggleEditWorker = (id: string) => {
    if (editSelectedWorkerIds.includes(id)) {
      setEditSelectedWorkerIds(editSelectedWorkerIds.filter((wId) => wId !== id));
    } else {
      setEditSelectedWorkerIds([...editSelectedWorkerIds, id]);
    }
  };

  const handleSaveEditWorkers = async () => {
    if (!editingAssignment) return;
    try {
      setSavingWorkers(true);
      await apiRequest(`/assignments/${editingAssignment.id}/workers`, {
        method: 'PUT',
        body: JSON.stringify({ workerIds: editSelectedWorkerIds }),
      });
      const msg = `Updated workforce for "${editingAssignment.groupName || editingAssignment.shiftName}" (${editSelectedWorkerIds.length} workers). Carry-forward updated seamlessly!`;
      toast.success(msg);
      setMessage({ text: msg, type: 'success' });
      setEditWorkersModalOpen(false);
      await Promise.all([
        loadDateAssignments(selectedDate),
        loadMonthAssignments(currentYear, currentMonth),
        loadWorkerAllocations(),
      ]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workers');
      setMessage({ text: err.message || 'Failed to update workers', type: 'error' });
    } finally {
      setSavingWorkers(false);
    }
  };

  const filteredWorkersForEditModal = useMemo(() => {
    if (!editWorkerSearchTerm.trim()) return allWorkers;
    const term = editWorkerSearchTerm.toLowerCase();
    return allWorkers.filter(
      (w) =>
        w.fullName?.toLowerCase().includes(term) ||
        w.employeeCode?.toLowerCase().includes(term) ||
        w.email?.toLowerCase().includes(term)
    );
  }, [allWorkers, editWorkerSearchTerm]);

  // Create Assignment Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !worksiteId || !supervisorId) {
      setMessage({ text: 'Please fill in group name, worksite, and supervisor.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          groupName: groupName.trim(),
          shiftName: groupName.trim(),
          worksiteId,
          supervisorId,
          workDate: selectedDate,
          shiftStartTime,
          shiftEndTime,
          workerIds: selectedWorkerIds,
          publishImmediately: true,
          carryForward,
        }),
      });

      const successMsg = carryForward
        ? `Group "${groupName.trim()}" created! Location, supervisor, and workers will carry forward daily until cancelled.`
        : `Group "${groupName.trim()}" created & assigned successfully for ${selectedDate}!`;
      setMessage({
        text: successMsg,
        type: 'success',
      });
      toast.success(successMsg);
      setCreateModalOpen(false);
      setSelectedWorkerIds([]);

      // Reload assignments and allocations
      await Promise.all([
        loadDateAssignments(selectedDate),
        loadMonthAssignments(currentYear, currentMonth),
        loadWorkerAllocations(),
      ]);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to create group assignment';
      setMessage({ text: errorMsg, type: 'error' });
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Complete Assignment / Worksite Duration
  const handleCompleteAssignment = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Mark worksite duration completed for "${name}"?\n\nThis will finish the worksite duration and immediately release all assigned workers so they can be assigned to other worksites.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/assignments/${id}/complete`, { method: 'POST' });
      const successMsg = `Worksite duration for "${name}" completed! All assigned workers have been released.`;
      setMessage({ text: successMsg, type: 'success' });
      toast.success(successMsg);
      await Promise.all([
        loadDateAssignments(selectedDate),
        loadMonthAssignments(currentYear, currentMonth),
        loadWorkerAllocations(),
      ]);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to complete worksite duration';
      setMessage({ text: errorMsg, type: 'error' });
      toast.error(errorMsg);
    }
  };

  // Publish assignment
  const handlePublish = async (id: string, name: string) => {
    try {
      await apiRequest(`/assignments/${id}/publish`, { method: 'POST' });
      const successMsg = `Group "${name}" published! Staff can now clock in.`;
      setMessage({ text: successMsg, type: 'success' });
      toast.success(successMsg);
      await Promise.all([
        loadDateAssignments(selectedDate),
        loadMonthAssignments(currentYear, currentMonth),
      ]);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to publish group assignment';
      setMessage({ text: errorMsg, type: 'error' });
      toast.error(errorMsg);
    }
  };

  // Publish All Drafts on current date
  const handlePublishAll = async () => {
    const draftGroups = dateAssignments.filter((a) => a.status === 'DRAFT');
    if (draftGroups.length === 0) return;

    try {
      for (const grp of draftGroups) {
        await apiRequest(`/assignments/${grp.id}/publish`, { method: 'POST' });
      }
      const successMsg = `Successfully published all ${draftGroups.length} draft groups for ${selectedDate}!`;
      setMessage({
        text: successMsg,
        type: 'success',
      });
      toast.success(successMsg);
      await Promise.all([
        loadDateAssignments(selectedDate),
        loadMonthAssignments(currentYear, currentMonth),
      ]);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to publish all draft groups';
      setMessage({ text: errorMsg, type: 'error' });
      toast.error(errorMsg);
    }
  };

  // Cancel Assignment
  const handleCancelSubmit = async () => {
    if (!cancelAssignmentId || !cancelReason.trim()) return;

    try {
      await apiRequest(`/assignments/${cancelAssignmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setMessage({ text: 'Group assignment cancelled. Assigned workers have been released.', type: 'success' });
      toast.success('Group assignment cancelled. Assigned workers released.');
      setCancelModalOpen(false);
      setCancelReason('');
      await Promise.all([
        loadDateAssignments(selectedDate),
        loadMonthAssignments(currentYear, currentMonth),
        loadWorkerAllocations(),
      ]);
    } catch (err: any) {
      setMessage({ text: err.message || 'Cancellation failed', type: 'error' });
      toast.error(err.message || 'Cancellation failed');
    }
  };

  // Switch to next or previous day in Date View
  const handleStepDay = (delta: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + delta);
    const newDateStr = current.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
    setCurrentYear(current.getFullYear());
    setCurrentMonth(current.getMonth());
  };

  // Formatted date string for header
  const formattedSelectedDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Top Banner Alert Message */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between shadow-2xs transition-all ${message.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-[11px] font-bold uppercase tracking-wider underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Section Switcher: Site Rosters vs Worker Transfers & History */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSection('rosters')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'rosters'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <span>Site Rosters & Groups</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('transfers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'transfers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <span>Worker Transfers & History</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setTransferTargetWorker(null);
            setScheduleTransferModalOpen(true);
          }}
          className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Schedule Worker Transfer
        </button>
      </div>

      {activeSection === 'transfers' && (
        <TransferManagementTab
          workersList={formattedWorkersForModal}
          worksitesList={worksites}
          onRefreshParent={loadMasterData}
        />
      )}

      {activeSection === 'rosters' && (
        <>
          {/* VIEW MODE 1: FULL CALENDAR FOR N YEARS & MONTHS */}
          {viewMode === 'calendar' && (
            <div className="space-y-6">
          {/* Calendar Header with Year & Month Selection */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 m-0">
                    Master Assignment Calendar
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Multi-year workforce assignment management. Click any date to view and create regional groups.
                  </p>
                </div>
              </div>
            </div>

            {/* Year & Month Controllers */}
            <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
              {/* Year Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                <button
                  onClick={() => setCurrentYear((y) => y - 1)}
                  title="Previous Year"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(Number(e.target.value))}
                  className="bg-transparent px-2 py-0.5 font-bold text-slate-900 cursor-pointer focus:outline-none"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setCurrentYear((y) => y + 1)}
                  title="Next Year"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              {/* Month Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                <button
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                  className="bg-transparent px-2 py-0.5 font-bold text-slate-900 cursor-pointer focus:outline-none"
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={idx}>
                      {mName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Today jump */}
              <button
                onClick={handleJumpToToday}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Today
              </button>
            </div>
          </div>

          {/* Quick Month Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Selected Period
              </span>
              <span className="text-base font-bold text-slate-900 mt-0.5 block">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Month Groups
              </span>
              <span className="text-base font-bold text-indigo-600 mt-0.5 block">
                {monthAssignments.length} Groups Scheduled
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Published Rosters
              </span>
              <span className="text-base font-bold text-emerald-600 mt-0.5 block">
                {monthAssignments.filter((a) => a.status === 'PUBLISHED').length} Active
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Draft Groups
              </span>
              <span className="text-base font-bold text-amber-600 mt-0.5 block">
                {monthAssignments.filter((a) => a.status === 'DRAFT').length} In Draft
              </span>
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-3">
              {DAY_NAMES.map((day) => (
                <div key={day} className="tracking-wider uppercase text-[11px]">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Day Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarDays.map((day) => {
                const hasGroups = day.assignments.length > 0;
                const isToday = day.isToday;
                const isSelected = day.isSelected;

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => handleDateClick(day.dateStr)}
                    className={`min-h-[110px] sm:min-h-[125px] p-2 sm:p-2.5 transition-all cursor-pointer relative group flex flex-col justify-between ${day.isCurrentMonth
                      ? 'bg-white hover:bg-slate-50/90'
                      : 'bg-slate-50/40 text-slate-300 hover:bg-slate-50'
                      } ${isSelected ? 'ring-2 ring-inset ring-slate-900 bg-slate-50/60' : ''}`}
                  >
                    {/* Top Row: Date Number and Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isToday
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : day.isCurrentMonth
                            ? 'text-slate-800 group-hover:text-slate-900'
                            : 'text-slate-400'
                          }`}
                      >
                        {day.dayNumber}
                      </span>

                      {isToday && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                          Today
                        </span>
                      )}

                      {!isToday && hasGroups && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                          {day.assignments.length} {day.assignments.length === 1 ? 'grp' : 'grps'}
                        </span>
                      )}
                    </div>

                    {/* Middle: Scheduled Groups List Previews */}
                    <div className="my-1.5 space-y-1 overflow-hidden">
                      {hasGroups ? (
                        day.assignments.slice(0, 2).map((a) => {
                          const isCarried = a.workDate !== day.dateStr;
                          return (
                            <div
                              key={a.id}
                              className={`text-[10px] truncate px-1.5 py-0.5 rounded-md font-medium border flex items-center justify-between gap-1 ${a.status === 'PUBLISHED'
                                ? isCarried
                                  ? 'bg-blue-50/90 border-blue-200 text-blue-900'
                                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : 'bg-amber-50/80 border-amber-200 text-amber-900'
                                }`}
                            >
                              <span className="truncate font-semibold flex items-center gap-1">
                                {isCarried && <Repeat className="w-2.5 h-2.5 shrink-0 text-blue-600" />}
                                {a.groupName || a.shiftName || 'Group'}
                              </span>
                              <span className="text-[9px] opacity-75 shrink-0">
                                {a.workers?.length || 0}u
                              </span>
                            </div>
                          );
                        })
                      ) : day.isCurrentMonth ? (
                        <span className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity block text-center py-2">
                          + Add Group
                        </span>
                      ) : null}

                      {day.assignments.length > 2 && (
                        <span className="text-[9px] text-slate-500 font-bold block text-center">
                          +{day.assignments.length - 2} more groups
                        </span>
                      )}
                    </div>

                    {/* Bottom: Date hint */}
                    <div className="text-[9px] text-slate-400 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to open date
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DATE GROUPS PAGE (Multiple groups like Delhi, Chennai, Salem) */}
      {viewMode === 'date-groups' && (
        <div className="space-y-6">
          {/* Breadcrumb & Navigation Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="space-y-1">
              <button
                onClick={() => setViewMode('calendar')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Master Calendar
              </button>
              <div className="flex items-center gap-2.5 pt-1">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 m-0">
                  Daily Groups for {formattedSelectedDate}
                </h1>
                {selectedDate === todayStr && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Today
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Manage multi-site workforce groupings (e.g., Delhi, Chennai, Salem), supervisor assignments, and scheduled personnel.
              </p>
            </div>

            {/* Quick Actions & Date Stepper */}
            <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
              {/* Stepper buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => handleStepDay(-1)}
                  title="Previous Day"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent px-2 text-xs font-semibold text-slate-800 cursor-pointer focus:outline-none"
                />
                <button
                  onClick={() => handleStepDay(1)}
                  title="Next Day"
                  className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Publish All Drafts (if any) */}
              {dateAssignments.some((a) => a.status === 'DRAFT') && (
                <button
                  onClick={handlePublishAll}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish All Drafts
                </button>
              )}

              {/* Add Group Button (Matches Prompt Requirement) */}
              <button
                onClick={() => handleOpenAddGroupModal()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
            </div>
          </div>

          {/* Summary Metric Cards for this Date */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Groups
              </span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {dateAssignments.length}
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Assigned Workforce
              </span>
              <span className="text-2xl font-bold text-indigo-600 mt-1 block">
                {dateAssignments.reduce((acc, curr) => acc + (curr.workers?.length || 0), 0)} Users
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Supervisors Assigned
              </span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {new Set(dateAssignments.map((a) => a.supervisorId)).size}
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Roster Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {dateAssignments.filter((a) => a.status === 'PUBLISHED').length} Published
                </span>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  {dateAssignments.filter((a) => a.status === 'DRAFT').length} Draft
                </span>
              </div>
            </div>
          </div>

          {/* Groups List */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading groups for {selectedDate}...</div>
          ) : dateAssignments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-2xs">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 text-lg">No Groups Configured for {selectedDate}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No regional groups (e.g. Delhi, Chennai, Salem) have been created for this date yet. Click the button below to schedule groups and assign workforce.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={() => handleOpenAddGroupModal('Delhi')}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add First Group (e.g. Delhi)
                </button>
              </div>
            </div>
          ) : (

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {dateAssignments.map((a) => {
                const workerCount = a.workers?.length || 0;
                const isCarried =
                  a.isCarriedForward ||
                  (a.carryForward !== false && a.workDate !== selectedDate);

                const statusStyles =
                  a.status === "PUBLISHED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : a.status === "DRAFT"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : a.status === "COMPLETED"
                        ? "bg-blue-50 text-blue-700 border-blue-100"
                        : "bg-rose-50 text-rose-700 border-rose-100";

                const statusDot =
                  a.status === "PUBLISHED"
                    ? "bg-emerald-500"
                    : a.status === "DRAFT"
                      ? "bg-amber-500"
                      : a.status === "COMPLETED"
                        ? "bg-blue-500"
                        : "bg-rose-500";

                return (
                  <div
                    key={a.id}
                    className="min-w-0 rounded-2xl border border-slate-200
                   bg-white p-4 shadow-sm transition-shadow
                   hover:shadow-md space-y-3.5"
                  >
                    {/* Header */}
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center
                          justify-center rounded-xl
                          bg-indigo-50 text-indigo-600">
                        <Building2 className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-semibold
                           tracking-tight text-slate-900">
                          {a.worksiteName}
                        </h2>

                        <p className="mt-1 flex min-w-0 items-center gap-1
                          text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{a.worksiteAddress}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full
                           border border-sky-100 bg-sky-50 px-2.5 py-1
                           text-[11px] font-medium text-sky-700">
                        <Sun className="h-3.5 w-3.5" />
                        {a.groupName || a.shiftName || "Morning Shift"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full
                        border px-2.5 py-1 text-[11px] font-medium
                        ${statusStyles}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                        {a.status === "PUBLISHED"
                          ? "Published"
                          : a.status === "DRAFT"
                            ? "Draft"
                            : a.status === "COMPLETED"
                              ? "Completed"
                              : "Cancelled"}
                      </span>

                      {a.carryForward !== false && (
                        <span className="inline-flex items-center gap-1 rounded-full
                             border border-indigo-100 bg-indigo-50
                             px-2.5 py-1 text-[11px] font-medium
                             text-indigo-700">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {isCarried
                            ? `Carried · ${String(a.workDate).split("T")[0]}`
                            : "Carry-forward"}
                        </span>
                      )}
                    </div>

                    {/* Carry-forward notice */}
                    {isCarried &&
                      a.status !== "CANCELLED" &&
                      a.status !== "COMPLETED" && (
                        <div className="flex items-start gap-2.5 rounded-xl
                            border border-sky-100 bg-sky-50/70 p-3">
                          <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0
                                       text-sky-600" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-sky-900">
                              Carried forward from{" "}
                              {String(a.workDate).split("T")[0]}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed
                              text-slate-600">
                              Location, supervisor and {workerCount} assigned{" "}
                              {workerCount === 1 ? "worker" : "workers"} continue
                              daily until cancelled.
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Cancelled notice */}
                    {a.status === "CANCELLED" && (
                      <div className="flex items-start gap-2.5 rounded-xl
                          border border-rose-100 bg-rose-50/70 p-3">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-rose-800">
                            Assignment Group Cancelled
                          </p>
                          <p className="mt-1 text-[11px] text-rose-700">
                            {a.cancellationReason ||
                              "Daily carry-forward has been stopped."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Completed notice */}
                    {a.status === "COMPLETED" && (
                      <div className="flex items-start gap-2.5 rounded-xl
                          border border-emerald-100 bg-emerald-50/70 p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0
                                     text-emerald-600" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-800">
                            Duration Completed
                          </p>
                          <p className="mt-1 text-[11px] text-emerald-700">
                            Workforce released for new assignments.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Compact details */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* Supervisor */}
                      <div className="flex min-w-0 items-start gap-2.5 rounded-xl
                          border border-slate-100 bg-slate-50/70 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center
                            justify-center rounded-lg bg-indigo-50
                            text-indigo-600">
                          <User className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium uppercase
                            tracking-wide text-slate-400">
                            Supervisor
                          </p>
                          <p className="mt-0.5 truncate text-sm font-semibold
                            text-slate-800">
                            {a.supervisorName || "Unassigned"}
                          </p>

                          {a.supervisorEmail && (
                            <p className="mt-1 flex min-w-0 items-center gap-1
                              text-[11px] text-slate-500">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{a.supervisorEmail}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Shift timing */}
                      <div className="flex min-w-0 items-start gap-2.5 rounded-xl
                          border border-emerald-100/80 bg-emerald-50/40 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center
                            justify-center rounded-lg bg-emerald-100
                            text-emerald-700">
                          <Clock className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase
                            tracking-wide text-slate-400">
                            Shift timing
                          </p>
                          <p className="mt-0.5 text-sm font-semibold
                            text-slate-800">
                            {a.shiftStartTime || "08:00"} – {a.shiftEndTime || "17:00"}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[11px]
                            text-slate-500">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {a.worksiteRadius || 20}m geofence
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Assigned workforce */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditWorkers(a)}
                      className="flex w-full min-w-0 items-center gap-3 rounded-xl
                     border border-slate-200 px-3 py-2.5 text-left
                     transition-colors hover:border-indigo-200
                     hover:bg-indigo-50/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center
                          justify-center rounded-lg bg-indigo-50
                          text-indigo-600">
                        <Users className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-500">
                          Assigned workforce
                        </p>
                        <p className="text-lg font-bold leading-tight text-slate-900">
                          {workerCount}
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            {workerCount === 1 ? "worker" : "workers"}
                          </span>
                        </p>
                      </div>

                      {/* Show up to 3 avatars, not all workers */}
                      <div className="flex shrink-0 items-center">
                        {a.workers?.slice(0, 3).map((w: any, idx: number) => (
                          <div
                            key={w.workerId || idx}
                            title={`${w.fullName} (${w.employeeCode || ""})`}
                            className="-ml-2 flex h-7 w-7 items-center
                           justify-center rounded-full border-2
                           border-white bg-indigo-100 text-indigo-700
                           first:ml-0"
                          >
                            <User className="h-3.5 w-3.5" />
                          </div>
                        ))}

                        {workerCount > 3 && (
                          <span className="-ml-2 flex h-7 items-center rounded-full
                               border-2 border-white bg-slate-100 px-2
                               text-[10px] font-semibold text-slate-600">
                            +{workerCount - 3}
                          </span>
                        )}
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>

                    {/* Footer: publication info and actions */}
                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-1.5 text-[11px]
                          text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {a.status === "COMPLETED"
                            ? "Completed"
                            : a.status === "CANCELLED"
                              ? "Cancelled"
                              : a.publishedAt
                                ? `Published · ${new Date(a.publishedAt).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}`
                                : "Published · 4:00 PM"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {/* Publish */}
                        {a.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={() =>
                              handlePublish(a.id, a.groupName || a.shiftName)
                            }
                            className="inline-flex min-h-9 items-center justify-center
                           gap-2 rounded-lg bg-indigo-600 px-3 py-2
                           text-xs font-semibold text-white
                           transition-colors hover:bg-indigo-700"
                          >
                            <Send className="h-4 w-4" />
                            Publish Group
                          </button>
                        )}

                        {/* Manage staff */}
                        {a.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditWorkers(a)}
                            className="inline-flex min-h-9 items-center justify-center
                           gap-2 rounded-lg border border-indigo-200
                           bg-white px-3 py-2 text-xs font-semibold
                           text-indigo-700 transition-colors
                           hover:bg-indigo-50"
                          >
                            <Users className="h-4 w-4" />
                            Manage Staff ({workerCount})
                          </button>
                        )}

                        {/* Complete */}
                        {a.status !== "CANCELLED" &&
                          a.status !== "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCompleteAssignment(
                                  a.id,
                                  a.groupName || a.shiftName
                                )
                              }
                              className="inline-flex min-h-9 items-center justify-center
                             gap-2 rounded-lg border border-emerald-200
                             bg-emerald-50 px-3 py-2 text-xs font-semibold
                             text-emerald-700 transition-colors
                             hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Complete Duration
                            </button>
                          )}

                        {/* Cancel */}
                        {a.status !== "CANCELLED" &&
                          a.status !== "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelAssignmentId(a.id);
                                setCancelModalOpen(true);
                              }}
                              className="inline-flex min-h-9 items-center justify-center
                             gap-2 rounded-lg border border-rose-200
                             bg-white px-3 py-2 text-xs font-semibold
                             text-rose-600 transition-colors
                             hover:bg-rose-50"
                            >
                              <Ban className="h-4 w-4" />
                              Cancel Group
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          )}
        </div>
      )}
        </>
      )}

      {/* POP-UP MODAL: ADD GROUP (Requested fields: group name, location, assign supervisor, multiple select users) */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Assignment Group"
        description={`Schedule a regional workforce group for ${selectedDate}.`}
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={submitting || !groupName.trim() || !worksiteId || !supervisorId}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submitting ? 'Creating Group...' : 'Save Group Roster'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          {/* FIELD 1: Group Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Group Name <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">e.g. Delhi, Chennai, Salem</span>
            </div>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Delhi, Chennai, Salem..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:outline-none"
              required
            />
          </div>

          {/* FIELD 2: Location (Worksite) & FIELD 3: Assign Supervisor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Location (Worksite) <span className="text-rose-500">*</span>
              </label>
              <select
                value={worksiteId}
                onChange={(e) => setWorksiteId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none"
                required
              >
                {worksites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.radiusMeters}m radius
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Assign Supervisor <span className="text-rose-500">*</span>
              </label>
              <select
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none"
                required
              >
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.employeeCode || s.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shift Timings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Shift Start Time</label>
              <input
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Shift End Time</label>
              <input
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          {/* FIELD 4: Multiple Select Users */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Multiple Select Users ({selectedWorkerIds.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllWorkers}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllWorkers}
                  className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Search filter for users */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={workerSearchTerm}
                onChange={(e) => setWorkerSearchTerm(e.target.value)}
                placeholder="Search staff by name, code, or email..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none"
              />
            </div>

            {/* Checklist of Users */}
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-1.5 space-y-1 bg-slate-50/50">
              {filteredWorkersForModal.length > 0 ? (
                filteredWorkersForModal.map((w) => {
                  const isChecked = selectedWorkerIds.includes(w.id);
                  const allocation = workerAllocations.find((a) => a.workerId === w.id);
                  const isAssignedToOtherSite = Boolean(allocation && allocation.worksiteId !== worksiteId);

                  return (
                    <label
                      key={w.id}
                      title={
                        isAssignedToOtherSite
                          ? `Assigned to worksite: ${allocation.worksiteName} (${allocation.worksiteCode}). Remove from that worksite or mark completed/cancelled first.`
                          : undefined
                      }
                      className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${isAssignedToOtherSite
                        ? 'bg-slate-100/80 opacity-60 cursor-not-allowed border border-slate-200'
                        : isChecked
                          ? 'bg-white font-semibold text-slate-900 shadow-2xs border border-slate-200 cursor-pointer'
                          : 'text-slate-600 hover:bg-slate-100 border border-transparent cursor-pointer'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isAssignedToOtherSite}
                          onChange={() => {
                            if (!isAssignedToOtherSite) toggleWorker(w.id);
                          }}
                          className="rounded text-slate-900 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span>{w.fullName}</span>
                        <span className="text-[10px] text-slate-400">
                          ({w.employeeCode})
                        </span>
                        {isAssignedToOtherSite && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            Assigned: {allocation.worksiteName} ({allocation.worksiteCode})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{w.email}</span>
                    </label>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">
                  No active workers found matching search.
                </div>
              )}
            </div>

            {/* FIELD 5: Carry Forward Daily Until Cancelled */}
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 flex items-start gap-3 mt-3">
              <input
                type="checkbox"
                id="carryForwardCheckbox"
                checked={carryForward}
                onChange={(e) => setCarryForward(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4 shrink-0"
              />
              <label htmlFor="carryForwardCheckbox" className="cursor-pointer">
                <span className="text-xs font-semibold text-indigo-950 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  Carry Forward Daily Until Cancelled (Recommended)
                </span>
                <span className="text-[11px] text-indigo-800/80 block mt-0.5">
                  Automatically carries forward this location, supervisor, and all assigned workers up to the current date until cancelled. Future dates will not be populated until that day arrives.
                </span>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* CANCELLATION MODAL */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Group Assignment & Stop Carry-Forward"
        description="Cancelling this group will immediately stop this location, supervisor, and worker assignment from carrying forward to future dates. All past attendance records remain safely preserved."
        footer={
          <>
            <button
              onClick={() => setCancelModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Keep Active
            </button>
            <button
              onClick={handleCancelSubmit}
              disabled={!cancelReason.trim()}
              className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              Confirm Cancellation & Stop Carry-Forward
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 block">
            Cancellation Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Inclement weather, site closure, shift rescheduled..."
            rows={3}
            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none"
          />
        </div>
      </Modal>

      {/* MANAGE STAFF MODAL (FOR ONGOING / CARRIED-FORWARD GROUPS) */}
      <Modal
        isOpen={editWorkersModalOpen}
        onClose={() => setEditWorkersModalOpen(false)}
        title={`Manage Staff: ${editingAssignment?.groupName || editingAssignment?.shiftName || 'Group'}`}
        description="Update assigned personnel for this location. Changes will immediately take effect and carry forward daily."
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setEditWorkersModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditWorkers}
              disabled={savingWorkers}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {savingWorkers ? 'Saving...' : `Save Workforce (${editSelectedWorkerIds.length} Staff)`}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-700">
              Selected Staff ({editSelectedWorkerIds.length} of {allWorkers.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const currentWorksiteId = editingAssignment?.worksiteId;
                  const availableIds = allWorkers
                    .filter((w) => {
                      const alloc = workerAllocations.find((a) => a.workerId === w.id);
                      return !alloc || alloc.assignmentId === editingAssignment?.id || alloc.worksiteId === currentWorksiteId;
                    })
                    .map((w) => w.id);
                  setEditSelectedWorkerIds(availableIds);
                }}
                className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                Select All Available
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setEditSelectedWorkerIds([])}
                className="text-[11px] text-slate-500 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={editWorkerSearchTerm}
              onChange={(e) => setEditWorkerSearchTerm(e.target.value)}
              placeholder="Search staff by name, employee code, or email..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-1.5 space-y-1 bg-slate-50/50">
            {filteredWorkersForEditModal.length > 0 ? (
              filteredWorkersForEditModal.map((w) => {
                const isChecked = editSelectedWorkerIds.includes(w.id);
                const allocation = workerAllocations.find((a) => a.workerId === w.id);
                const isAssignedToOtherSite = Boolean(
                  allocation &&
                  allocation.assignmentId !== editingAssignment?.id &&
                  allocation.worksiteId !== editingAssignment?.worksiteId
                );

                return (
                  <label
                    key={w.id}
                    title={
                      isAssignedToOtherSite
                        ? `Assigned to worksite: ${allocation.worksiteName} (${allocation.worksiteCode}). Remove from that worksite or mark completed/cancelled first.`
                        : undefined
                    }
                    className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${isAssignedToOtherSite
                      ? 'bg-slate-100/80 opacity-60 cursor-not-allowed border border-slate-200'
                      : isChecked
                        ? 'bg-white font-semibold text-slate-900 shadow-2xs border border-slate-200 cursor-pointer'
                        : 'text-slate-600 hover:bg-slate-100 border border-transparent cursor-pointer'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isAssignedToOtherSite}
                        onChange={() => {
                          if (!isAssignedToOtherSite) toggleEditWorker(w.id);
                        }}
                        className="rounded text-slate-900 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span>{w.fullName}</span>
                      <span className="text-[10px] text-slate-400">({w.employeeCode})</span>
                      {isAssignedToOtherSite && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          Assigned: {allocation.worksiteName} ({allocation.worksiteCode})
                        </span>
                      )}
                      {allocation?.hasScheduledTransfer && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <ArrowRight className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                          Transfer: {allocation.scheduledTransfer?.destinationWorksiteName} ({allocation.scheduledTransfer?.effectiveDate})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">{w.email}</span>
                      {isChecked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const workerOption = formattedWorkersForModal.find((fw) => fw.id === w.id);
                            setTransferTargetWorker(workerOption || null);
                            setScheduleTransferModalOpen(true);
                          }}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Schedule future worksite transfer for this worker"
                        >
                          <ArrowRightLeft className="w-2.5 h-2.5 text-emerald-600" />
                          Transfer
                        </button>
                      )}
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400">
                No active workers found matching search.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Schedule Transfer Modal */}
      <ScheduleTransferModal
        isOpen={scheduleTransferModalOpen}
        onClose={() => {
          setScheduleTransferModalOpen(false);
          setTransferTargetWorker(null);
        }}
        onSuccess={() => {
          loadMasterData();
          loadDateAssignments(selectedDate);
          loadMonthAssignments(currentYear, currentMonth);
        }}
        initialWorker={transferTargetWorker}
        workersList={formattedWorkersForModal}
        worksitesList={worksites}
      />
    </div>
  );
};

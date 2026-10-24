import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  SupervisorWorksite,
  SupervisorWorkerAttendance,
  WorkerLeaveItem,
  SpendEntry,
  SpendDaySummary,
  CategorySummary,
} from '../../types/supervisor';
import { SupervisorHomeTab } from './SupervisorHomeTab';
import { SupervisorAttendanceTab } from './SupervisorAttendanceTab';
import { SupervisorLeavesTab } from './SupervisorLeavesTab';
import { SupervisorSpendTab } from './SupervisorSpendTab';
import { SupervisorHistoryTab } from './SupervisorHistoryTab';
import { SupervisorProfileTab } from './SupervisorProfileTab';
import {
  Home,
  UserCheck,
  CalendarDays,
  Receipt,
  History,
  Building2,
  Bell,
  WifiOff,
  RefreshCw,
  LogOut,
  Sliders,
  CheckCircle2,
  ChevronDown,
  Sun,
  ShieldAlert,
  ArrowRightLeft,
  X,
  User,
} from 'lucide-react';

export type SupervisorTabId = 'home' | 'attendance' | 'leaves' | 'spend' | 'history' | 'profile';

const DEFAULT_FALLBACK_WORKSITE: SupervisorWorksite = {
  id: '',
  name: 'Assigned Worksite',
  code: 'SITE',
  address: 'Deployment Location',
  radiusMeters: 50,
};

export const SupervisorApp: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SupervisorTabId>('home');
  const [worksitesList, setWorksitesList] = useState<SupervisorWorksite[]>([]);
  const [selectedWorksite, setSelectedWorksite] = useState<SupervisorWorksite>(DEFAULT_FALLBACK_WORKSITE);
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);

  // Core Data States - live from backend
  const [workers, setWorkers] = useState<SupervisorWorkerAttendance[]>([]);
  const [leaves, setLeaves] = useState<WorkerLeaveItem[]>([]);
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`supervisor_spends_${user?.id || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync spendEntries to localStorage
  useEffect(() => {
    if (user?.id) {
      try {
        localStorage.setItem(`supervisor_spends_${user.id}`, JSON.stringify(spendEntries));
      } catch (err) {
        console.error('Failed to persist spend entries:', err);
      }
    }
  }, [spendEntries, user?.id]);

  // Derived dynamic spend summaries
  const categoryBreakdown: CategorySummary[] = useMemo(() => {
    const catColors: Record<string, string> = {
      Materials: '#2563EB',
      'Worker payment': '#12A66A',
      Food: '#F59E0B',
      Transport: '#9333EA',
      Other: '#64748B',
    };
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    spendEntries.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
      grandTotal += e.amount;
    });
    return Object.entries(totals).map(([category, amount]) => ({
      category: category as any,
      amount,
      percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
      color: catColors[category] || '#64748B',
    }));
  }, [spendEntries]);

  const monthlySpend: SpendDaySummary[] = useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    // Monday as start of week (1), Sunday as end of week (0 -> offset -6)
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Map existing spend entries by date (scoped to selected worksite if selected)
    const siteExpenses = selectedWorksite?.id
      ? spendEntries.filter((e) => !e.worksiteId || e.worksiteId === selectedWorksite.id)
      : spendEntries;

    const dayMap: Record<string, { amount: number; count: number }> = {};
    siteExpenses.forEach((e) => {
      if (!dayMap[e.date]) dayMap[e.date] = { amount: 0, count: 0 };
      dayMap[e.date].amount += e.amount;
      dayMap[e.date].count += 1;
    });

    const weekDays: SpendDaySummary[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dt}`;

      const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
      const dayFull = d.toLocaleDateString('en-US', { weekday: 'long' });   // "Monday"
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' }); // "Oct"
      const dayNum = d.getDate(); // 19

      const summary = dayMap[dateStr] || { amount: 0, count: 0 };
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;

      weekDays.push({
        date: dateStr,
        dayLabel: dayShort,
        dateLabel: `${dayNum} ${monthShort}`,
        dayName: dayFull,
        dayOfWeek: dayShort,
        dayNumber: dayNum,
        monthShort,
        amount: summary.amount,
        entriesCount: summary.count,
        isToday,
        isFuture,
      });
    }

    return weekDays;
  }, [spendEntries, selectedWorksite?.id]);

  // Fetch live team roster & attendance for supervisor
  const loadRosterAndAttendance = useCallback(
    async (siteId?: string, date?: string, isBackground = false) => {
      if (!isBackground) setIsLoadingRoster(true);
      try {
        const targetDate = date || attendanceDate;
        const targetWs = siteId !== undefined ? siteId : (selectedWorksite?.id || '');
        const wsParam = targetWs ? `&worksiteId=${encodeURIComponent(targetWs)}` : '';
        const data = await apiRequest<any>(
          `/attendance/supervisor-roster?date=${targetDate}${wsParam}`
        );
        const list = Array.isArray(data) ? data : data?.workers || [];
        setWorkers(list);
      } catch (err) {
        console.error('Error loading supervisor team roster:', err);
      } finally {
        if (!isBackground) setIsLoadingRoster(false);
      }
    },
    [attendanceDate, selectedWorksite?.id]
  );

  const memoizedWorkersList = useMemo(() => {
    return workers.map((w) => ({ id: w.workerId, name: w.name }));
  }, [workers]);

  // Fetch pending leaves
  const loadPendingLeaves = useCallback(async () => {
    try {
      const res = await apiRequest<any[]>('/leave/requests/pending').catch(() => []);
      if (Array.isArray(res)) {
        const mappedLeaves: WorkerLeaveItem[] = res.map((l: any) => ({
          id: l.id,
          workerId: l.userId,
          workerName: l.userName || 'Assigned Worker',
          workerRole: l.userRole || 'Field Worker',
          workerAvatar: l.userAvatar,
          leaveType: l.leaveType || 'Casual Leave',
          startDate: String(l.startDate).split('T')[0],
          endDate: String(l.endDate).split('T')[0],
          daysCount: Number(l.totalDays || 1),
          reason: l.reason || '',
          status: l.status || 'PENDING',
          isApprovedByAdmin: l.isApprovedByAdmin || false,
          appliedOn: l.createdAt
            ? new Date(l.createdAt).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Today',
          worksiteId: l.worksiteId || selectedWorksite?.id,
        }));
        setLeaves(mappedLeaves);
      }
    } catch (err) {
      console.error('Error loading pending leaves:', err);
    }
  }, [selectedWorksite?.id]);

  // Load assigned worksite, master worksites, roster, and leaves
  useEffect(() => {
    const loadSupervisorData = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        // 1. Fetch site assignments for today
        const assignmentsData = await apiRequest<any[]>(`/assignments?date=${todayStr}`).catch(() => []);
        let assignedWs: SupervisorWorksite | null = null;
        if (Array.isArray(assignmentsData) && assignmentsData.length > 0) {
          const nonCancelled = assignmentsData.filter((a) => a.status !== 'CANCELLED');
          const myAssignments = nonCancelled.filter((a) => a.supervisorId === user?.id);
          const target = myAssignments.length > 0 ? myAssignments[0] : (nonCancelled[0] || assignmentsData[0]);
          if (target) {
            assignedWs = {
              id: target.worksiteId,
              name: target.worksiteName,
              code: target.worksiteCode || '',
              address: target.worksiteAddress,
              radiusMeters: Number(target.worksiteRadius || 30),
            };
          }
        }

        // 2. Fetch master worksites
        const masterRes = await apiRequest<any>('/worksites').catch(() => null);
        const sitesRaw = Array.isArray(masterRes) ? masterRes : masterRes?.data || [];
        let finalSite: SupervisorWorksite | null = null;
        if (sitesRaw.length > 0) {
          const mapped: SupervisorWorksite[] = sitesRaw
            .filter((s: any) => s.isActive !== false)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              address: s.address,
              radiusMeters: Number(s.radiusMeters || 30),
            }));

          if (assignedWs) {
            const others = mapped.filter((s) => s.id !== assignedWs!.id);
            const combined = [assignedWs, ...others];
            setWorksitesList(combined);
            setSelectedWorksite(assignedWs);
            finalSite = assignedWs;
          } else if (mapped.length > 0) {
            setWorksitesList(mapped);
            setSelectedWorksite(mapped[0]);
            finalSite = mapped[0];
          }
        } else if (assignedWs) {
          setWorksitesList([assignedWs]);
          setSelectedWorksite(assignedWs);
          finalSite = assignedWs;
        }

        // 3. Load roster for this worksite
        await loadRosterAndAttendance(finalSite?.id);
        await loadPendingLeaves();
        await loadExpenses(finalSite?.id);
      } catch (err) {
        console.error('Error loading supervisor worksites:', err);
      }
    };

    loadSupervisorData();
  }, [user?.id]);

  // Fetch live site expenses (spend ledger) from backend
  const loadExpenses = useCallback(async (siteId?: string) => {
    try {
      const targetWs = siteId !== undefined ? siteId : (selectedWorksite?.id || '');
      const wsParam = targetWs ? `?worksiteId=${encodeURIComponent(targetWs)}` : '';
      const data = await apiRequest<SpendEntry[]>(`/expenses${wsParam}`);
      if (Array.isArray(data)) {
        setSpendEntries(data);
      }
    } catch (err) {
      console.error('Failed to load expenses from API:', err);
    }
  }, [selectedWorksite?.id]);

  // Reload roster & expenses when attendance date or selected worksite changes + live auto-poll every 6 seconds
  useEffect(() => {
    if (selectedWorksite?.id) {
      loadRosterAndAttendance(selectedWorksite.id, attendanceDate);
      loadExpenses(selectedWorksite.id);
      const pollTimer = setInterval(() => {
        loadRosterAndAttendance(selectedWorksite.id, attendanceDate, true);
      }, 6000);
      return () => clearInterval(pollTimer);
    }
  }, [attendanceDate, selectedWorksite?.id, loadRosterAndAttendance, loadExpenses]);

  // Offline & Sync
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [offlineSyncQueue, setOfflineSyncQueue] = useState<any[]>([]);

  // Undo history stack
  const [undoStack, setUndoStack] = useState<{
    previousState: SupervisorWorkerAttendance[];
    message: string;
  } | null>(null);

  // Notifications Modal
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Location dropdown toggle
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);

  // Greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Sync online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Action: Single Approve
  const handleApproveWorker = async (worker: SupervisorWorkerAttendance) => {
    setUndoStack({
      previousState: [...workers],
      message: `Approved ${worker.name}`,
    });

    setWorkers((prev) =>
      prev.map((w) =>
        w.id === worker.id
          ? { ...w, status: 'APPROVED', decisionNote: 'Verified on-site selfie and geofence' }
          : w
      )
    );

    try {
      await apiRequest(`/attendance/${worker.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: 'Verified on-site selfie and geofence' }),
      });
    } catch (err) {
      console.warn('API approve failed, state updated locally:', err);
    }

    if (isOffline) {
      setOfflineSyncQueue((q) => [
        ...q,
        { type: 'APPROVE', workerId: worker.id, timestamp: new Date().toISOString() },
      ]);
    }
  };

  // Action: Single Reject
  const handleRejectWorker = async (worker: SupervisorWorkerAttendance, reason: string) => {
    setUndoStack({
      previousState: [...workers],
      message: `Rejected ${worker.name}`,
    });

    setWorkers((prev) =>
      prev.map((w) =>
        w.id === worker.id ? { ...w, status: 'REJECTED', decisionNote: reason } : w
      )
    );

    try {
      const finalReason = reason && reason.trim().length >= 3 ? reason.trim() : 'Photo unclear or verification mismatch';
      await apiRequest(`/attendance/${worker.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: finalReason, decisionNote: finalReason }),
      });
    } catch (err) {
      console.warn('API reject failed, state updated locally:', err);
    }

    if (isOffline) {
      setOfflineSyncQueue((q) => [
        ...q,
        { type: 'REJECT', workerId: worker.id, reason, timestamp: new Date().toISOString() },
      ]);
    }
  };

  // Action: Bulk Approve
  const handleBulkApprove = (workerIds: string[]) => {
    setUndoStack({
      previousState: [...workers],
      message: `Bulk approved ${workerIds.length} workers`,
    });

    setWorkers((prev) =>
      prev.map((w) =>
        workerIds.includes(w.id)
          ? { ...w, status: 'APPROVED', decisionNote: 'Verified via bulk supervisor review' }
          : w
      )
    );

    // Call API for each approved session so changes persist in backend
    workerIds.forEach(async (id) => {
      try {
        await apiRequest(`/attendance/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ decisionNote: 'Verified via bulk supervisor review' }),
        });
      } catch (err) {
        console.warn('API bulk approve failed for ID', id, err);
      }
    });

    if (isOffline) {
      setOfflineSyncQueue((q) => [
        ...q,
        { type: 'BULK_APPROVE', workerIds, timestamp: new Date().toISOString() },
      ]);
    }
  };

  // Action: Undo Last Decision
  const handleUndoLastAction = () => {
    if (undoStack) {
      setWorkers(undoStack.previousState);
      setUndoStack(null);
    }
  };

  // Action: Supervisor approves worker leave request
  const handleApproveLeave = async (leaveId: string) => {
    try {
      await apiRequest(`/leave/requests/${leaveId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: 'Approved by supervisor' }),
      });
    } catch {
      // offline fallback or demo mode
    }
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? { ...l, status: 'APPROVED', isApprovedByAdmin: false }
          : l
      )
    );
  };

  // Action: Supervisor rejects worker leave request
  const handleRejectLeave = async (leaveId: string) => {
    const reason = window.prompt(
      'Optional reason for rejecting this leave request:',
      'Site operational demands and scheduling constraints'
    );
    if (reason === null) return; // user cancelled

    try {
      await apiRequest(`/leave/requests/${leaveId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: reason || 'Rejected by supervisor' }),
      });
    } catch {
      // offline fallback or demo mode
    }
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? { ...l, status: 'REJECTED', isApprovedByAdmin: false }
          : l
      )
    );
  };

  // Action: Add Spend Entry
  const handleAddSpendEntry = async (
    newSpend: Omit<SpendEntry, 'id' | 'isLocked' | 'time'>
  ) => {
    try {
      const res = await apiRequest<{ success: boolean; expense: SpendEntry }>('/expenses', {
        method: 'POST',
        body: JSON.stringify(newSpend),
      });
      if (res?.expense) {
        setSpendEntries((prev) => [res.expense, ...prev.filter((e) => e.id !== res.expense.id)]);
        return;
      }
    } catch (err) {
      console.error('API create expense failed, saving locally:', err);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const entry: SpendEntry = {
      ...newSpend,
      id: `spd_${Date.now()}`,
      time: timeStr,
      isLocked: false,
      isOffline: isOffline,
    };
    setSpendEntries((prev) => [entry, ...prev]);

    if (isOffline) {
      setOfflineSyncQueue((q) => [
        ...q,
        { type: 'ADD_SPEND', entry, timestamp: now.toISOString() },
      ]);
    }
  };

  // Action: Edit Spend Entry
  const handleEditSpendEntry = async (updated: SpendEntry) => {
    try {
      const res = await apiRequest<{ success: boolean; expense: SpendEntry }>(`/expenses/${updated.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: updated.amount,
          category: updated.category,
          appliesToType: updated.appliesToType,
          workerId: updated.workerId,
          workerName: updated.workerName,
          note: updated.note,
          receiptUrl: updated.receiptUrl,
          date: updated.date,
          time: updated.time,
          worksiteId: updated.worksiteId,
        }),
      });
      if (res?.expense) {
        setSpendEntries((prev) => prev.map((e) => (e.id === updated.id ? res.expense : e)));
        return;
      }
    } catch (err: any) {
      console.error('Failed to update expense:', err);
      alert(err?.message || 'Failed to update expense entry');
    }
    setSpendEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  // Action: Delete Spend Entry
  const handleDeleteSpendEntry = async (entry: SpendEntry) => {
    if (!window.confirm(`Delete expense "${entry.note}" (${entry.category} - ₹${entry.amount})?`)) {
      return;
    }
    try {
      await apiRequest(`/expenses/${entry.id}`, {
        method: 'DELETE',
      });
      setSpendEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err: any) {
      console.error('Failed to delete expense:', err);
      alert(err?.message || 'Failed to delete expense entry');
    }
  };

  const handleSyncNow = () => {
    setOfflineSyncQueue([]);
    setIsOffline(false);
  };

  // Today formatted for header
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="min-h-screen bg-[#F1F6FC] text-[#111827] flex flex-col font-sans select-none antialiased">
      {/* 1. TOP HEADER (Responsive across mobile, tablet, and desktop) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8EEF4] px-4 sm:px-8 py-3">
        <div className=" w-full mx-auto flex items-center justify-between gap-4">
          {/* Brand & Greeting */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#12A66A] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              <UserCheck className="w-5 h-5 stroke-[2.5]" />
            </div>

          </div>

          {/* Desktop / Tablet Nav Tabs (hidden on mobile, visible on md+) */}
          <div className="hidden md:flex items-center gap-1 bg-[#F1F6FC] p-1 rounded-full border border-[#E8EEF4]">
            {(
              [
                { id: 'home', label: 'Home', icon: Home },
                { id: 'attendance', label: 'Attendance', icon: UserCheck },
                { id: 'leaves', label: 'Leaves', icon: CalendarDays },
                { id: 'spend', label: 'Spend', icon: Receipt },
                { id: 'history', label: 'History', icon: History },
                { id: 'profile', label: 'Profile', icon: User },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeTab === id
                  ? 'bg-[#12A66A] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#111827]'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Location Switcher & Utilities */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Location Switcher Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#E6F7EF] hover:bg-[#C3F2DD] text-[#0E8F5B] text-xs font-bold transition-all cursor-pointer border border-[#12A66A]/20"
              >
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="max-w-[110px] sm:max-w-[160px] truncate">
                  {selectedWorksite.name ? selectedWorksite.name.split(' - ')[0] : 'Worksite'}
                </span>
                <ChevronDown className="w-3 h-3 text-[#12A66A]" />
              </button>

              {/* Location Switcher Dropdown Popover */}
              {showLocationPicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLocationPicker(false)}
                  />
                  <div className="absolute right-0 top-10 z-50 w-72 bg-white rounded-[16px] shadow-2xl border border-[#E8EEF4] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 block">
                      Assigned Worksites
                    </span>
                    {worksitesList.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No worksites available</p>
                    ) : (
                      worksitesList.map((site) => {
                        const isSelected = site.id === selectedWorksite.id;
                        return (
                          <button
                            key={site.id}
                            type="button"
                            onClick={() => {
                              setSelectedWorksite(site);
                              setShowLocationPicker(false);
                            }}
                            className={`w-full p-2.5 rounded-[12px] text-left text-xs transition-colors flex items-start gap-2.5 ${isSelected
                              ? 'bg-[#E6F7EF] text-[#0E8F5B] font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                              }`}
                          >
                            <Building2
                              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-[#12A66A]' : 'text-slate-400'
                                }`}
                            />
                            <div className="min-w-0">
                              <span className="block truncate font-bold">{site.name}</span>
                              <span className="block text-[10px] text-slate-400 truncate">
                                {site.address}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Live Sync / Refresh Roster Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedWorksite?.id) {
                  loadRosterAndAttendance(selectedWorksite.id, attendanceDate);
                }
              }}
              title="Refresh Team Attendance Roster"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white hover:bg-[#F8FAFC] text-slate-700 hover:text-[#12A66A] border border-[#E8EEF4] text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoster ? 'animate-spin text-[#12A66A]' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Profile Avatar Quick Button */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              title="Supervisor Profile"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#E6F7EF] border-[#12A66A] text-[#0E8F5B]'
                  : 'bg-white hover:bg-slate-50 border-[#E8EEF4] text-slate-700'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-[#12A66A]/10 text-[#12A66A] flex items-center justify-center font-bold text-[11px]">
                {user?.fullName
                  ? user.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : 'SP'}
              </div>
              <span className="hidden lg:inline text-xs font-bold max-w-[90px] truncate">
                {user?.fullName || 'Profile'}
              </span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 border border-[#E8EEF4] flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#12A66A] ring-2 ring-white" />
              </button>

              {/* Notifications Popover */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-72 bg-white rounded-[18px] shadow-2xl border border-[#E8EEF4] p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">Notifications</span>
                      <span className="text-[10px] text-[#12A66A] font-bold">Live</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2 bg-[#E6F7EF] rounded-[10px] text-slate-700 space-y-0.5">
                        <strong className="block text-[#0E8F5B] font-bold">
                          Team Punch Approvals
                        </strong>
                        <span>{workers.filter((w) => w.status === 'PENDING').length} punches pending review.</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-[10px] text-slate-700 space-y-0.5">
                        <strong className="block text-slate-900 font-bold">Pending Leave Requests</strong>
                        <span>{leaves.filter((l) => l.status === 'PENDING').length} leave requests awaiting decision.</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Log Out */}
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="flex w-9 h-9 rounded-full bg-[#F8FAFC] hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-[#E8EEF4] items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline Banner (if offline or items pending sync) */}
        {(isOffline || offlineSyncQueue.length > 0) && (
          <div className="max-w-6xl w-full mx-auto mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[12px] flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Offline mode</strong> • {offlineSyncQueue.length} items will sync when online.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSyncNow}
              className="text-[11px] font-bold text-amber-800 underline hover:text-amber-900 cursor-pointer"
            >
              Sync now
            </button>
          </div>
        )}
      </header>

      {/* 2. MAIN RESPONSIVE CONTAINER (Matching Worker Design) */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-28 md:pb-12">
        {activeTab === 'home' && (
          <SupervisorHomeTab
            workers={workers}
            worksites={worksitesList}
            selectedWorksite={selectedWorksite}
            onSelectWorksite={setSelectedWorksite}
            monthlySpendData={monthlySpend}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onApproveWorker={handleApproveWorker}
            onRejectWorker={handleRejectWorker}
          />
        )}

        {activeTab === 'attendance' && (
          <SupervisorAttendanceTab
            workers={
              workers.filter(
                (w) => !w.worksiteId || !selectedWorksite?.id || w.worksiteId === selectedWorksite.id
              ).length > 0
                ? workers.filter(
                    (w) => !w.worksiteId || !selectedWorksite?.id || w.worksiteId === selectedWorksite.id
                  )
                : workers
            }
            selectedDate={attendanceDate}
            onSelectDate={setAttendanceDate}
            onApproveWorker={handleApproveWorker}
            onRejectWorker={handleRejectWorker}
            onBulkApprove={handleBulkApprove}
            onUndoLastAction={handleUndoLastAction}
            undoAvailable={undoStack}
            isLoading={isLoadingRoster}
            currentWorksite={selectedWorksite}
          />
        )}

        {activeTab === 'leaves' && (
          <SupervisorLeavesTab
            leaves={leaves.filter(
              (l) => !l.worksiteId || !selectedWorksite?.id || l.worksiteId === selectedWorksite.id
            )}
            onApproveLeave={handleApproveLeave}
            onRejectLeave={handleRejectLeave}
          />
        )}

        {activeTab === 'spend' && (
          <SupervisorSpendTab
            entries={spendEntries.filter(
              (e) => !e.worksiteId || !selectedWorksite?.id || e.worksiteId === selectedWorksite.id
            )}
            yesterdayTotal={0}
            monthlySpendData={monthlySpend}
            categoryBreakdown={categoryBreakdown}
            workersList={memoizedWorkersList}
            currentWorksite={selectedWorksite}
            onAddSpend={handleAddSpendEntry}
            onEditSpend={handleEditSpendEntry}
            onDeleteSpend={handleDeleteSpendEntry}
          />
        )}

        {activeTab === 'history' && (
          <SupervisorHistoryTab
            workers={workers}
            spendEntries={spendEntries}
            worksites={worksitesList}
            selectedWorksite={selectedWorksite}
            onSelectWorksite={setSelectedWorksite}
          />
        )}

        {activeTab === 'profile' && (
          <SupervisorProfileTab
            currentWorksite={selectedWorksite}
            assignedWorkersCount={workers.length}
            pendingReviewsCount={workers.filter((w) => w.status === 'PENDING').length}
          />
        )}
      </main>

      {/* 3. MOBILE BOTTOM NAVBAR — WITH PROFILE (Visible on mobile, hidden on md+) */}
      <nav
        aria-label="Supervisor Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E8EEF4] z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md mx-auto flex items-stretch justify-around px-1 pt-1.5 pb-2">
          {(
            [
              { id: 'home', label: 'Home', icon: Home },
              { id: 'attendance', label: 'Attendance', icon: UserCheck },
              { id: 'leaves', label: 'Leaves', icon: CalendarDays },
              { id: 'spend', label: 'Spend', icon: Receipt },
              { id: 'history', label: 'History', icon: History },
              { id: 'profile', label: 'Profile', icon: User },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center gap-0.5 min-w-0 flex-1 py-1 rounded-2xl transition-all cursor-pointer ${isActive ? 'text-[#12A66A]' : 'text-[#94A3B8] hover:text-slate-600'
                  }`}
              >
                {/* Active item in primary green with soft green pill background */}
                <span
                  className={`flex items-center justify-center w-10 h-8 rounded-full transition-all duration-150 ${isActive ? 'bg-[#E6F7EF] text-[#12A66A]' : ''
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                </span>
                <span
                  className={`text-[10px] leading-tight ${isActive ? 'font-bold text-[#12A66A]' : 'font-medium'
                    }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
};

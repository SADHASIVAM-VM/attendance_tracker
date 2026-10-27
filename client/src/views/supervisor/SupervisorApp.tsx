import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  SupervisorWorksite,
  SupervisorWorkerAttendance,
  SupervisorAttendanceStatistics,
  WorkerLeaveItem,
  SpendEntry,
  SpendDaySummary,
  CategorySummary,
} from '../../types/supervisor';
import { SupervisorHomeTab } from './SupervisorHomeTab';
import { SupervisorAttendanceTab } from './SupervisorAttendanceTab';
import { SupervisorLeavesTab } from './SupervisorLeavesTab';
import { SupervisorMyLeaveTab } from './SupervisorMyLeaveTab';
import { SupervisorSpendTab } from './SupervisorSpendTab';
import { SupervisorHistoryTab } from './SupervisorHistoryTab';
import { SupervisorProfileTab } from './SupervisorProfileTab';
import { SupervisorRegularizationView } from './SupervisorRegularizationView';
import { AttendanceExceptionsView } from '../common/AttendanceExceptionsView';
import { SupervisorAppShell } from '../../components/layout/SupervisorAppShell';


export type SupervisorTabId = 'home' | 'attendance' | 'regularization' | 'leaves' | 'spend' | 'history' | 'profile';

const DEFAULT_FALLBACK_WORKSITE: SupervisorWorksite = {
  id: '',
  name: 'Assigned Worksite',
  code: 'SITE',
  address: 'Deployment Location',
  radiusMeters: 50,
};

const getLocalTodayDateString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
};

export const SupervisorApp: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from current route path
  const activeTab: SupervisorTabId = useMemo(() => {
    const p = location.pathname.toLowerCase();
    if (p.includes('/attendance-exceptions') || p.includes('/exceptions')) return 'attendance-exceptions';
    if (p.includes('/regularization')) return 'regularization';
    if (p.includes('/attendance')) return 'attendance';
    if (p.includes('/leaves')) return 'leaves';
    if (p.includes('/spend')) return 'spend';
    if (p.includes('/history')) return 'history';
    if (p.includes('/profile')) return 'profile';
    if (p.includes('/home')) return 'home';
    return 'attendance';
  }, [location.pathname]);

  const handleTabClick = (tabId: SupervisorTabId) => {
    navigate(`/supervisor/${tabId}`);
  };

  const [worksitesList, setWorksitesList] = useState<SupervisorWorksite[]>([]);
  const [selectedWorksite, setSelectedWorksite] = useState<SupervisorWorksite>(DEFAULT_FALLBACK_WORKSITE);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qDate = urlParams.get('date');
      if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
        return qDate;
      }
    } catch {}
    return getLocalTodayDateString();
  });
  const [rosterStats, setRosterStats] = useState<SupervisorAttendanceStatistics | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [isRosterError, setIsRosterError] = useState<boolean>(false);

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

  // Date selector handler with URL sync to preserve selected date across refreshes
  const handleSelectAttendanceDate = useCallback((newDate: string) => {
    setAttendanceDate(newDate);
    try {
      const url = new URL(window.location.href);
      if (newDate === getLocalTodayDateString()) {
        url.searchParams.delete('date');
      } else {
        url.searchParams.set('date', newDate);
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  // Fetch live team roster & attendance for supervisor
  const loadRosterAndAttendance = useCallback(
    async (siteId?: string, date?: string, isBackground = false) => {
      if (!isBackground) setIsLoadingRoster(true);
      setIsRosterError(false);
      try {
        const targetDate = date || attendanceDate;
        const targetWs = siteId !== undefined ? siteId : (selectedWorksite?.id || '');
        const wsParam = targetWs ? `&worksiteId=${encodeURIComponent(targetWs)}` : '';
        const data = await apiRequest<any>(
          `/attendance/supervisor-roster?date=${targetDate}${wsParam}`
        );
        const list = Array.isArray(data) ? data : data?.workers || [];
        setWorkers(list);
        if (data) {
          setRosterStats({
            totalWorkers: data.totalWorkers ?? data.statistics?.totalWorkers ?? list.length,
            approved: data.approved ?? data.statistics?.approved ?? 0,
            rejected: data.rejected ?? data.statistics?.rejected ?? 0,
            pending: data.pending ?? data.statistics?.pending ?? 0,
            missingClockIns: data.missingClockIns ?? data.statistics?.missingClockIns ?? 0,
            pendingRegularization: data.pendingRegularization ?? data.statistics?.pendingRegularization ?? 0,
            flaggedDatesCount: data.flaggedDatesCount ?? data.statistics?.flaggedDatesCount ?? 0,
          });
        }
      } catch (err) {
        console.error('Error loading supervisor team roster:', err);
        if (!isBackground) setIsRosterError(true);
      } finally {
        if (!isBackground) setIsLoadingRoster(false);
      }
    },
    [attendanceDate, selectedWorksite?.id]
  );

  const memoizedWorkersList = useMemo(() => {
    return workers.map((w) => ({ id: w.workerId, name: w.name }));
  }, [workers]);

  // Fetch team leaves (pending, approved, rejected, revoked)
  const loadPendingLeaves = useCallback(async () => {
    try {
      const res = await apiRequest<any[]>('/leave/requests/team').catch(() =>
        apiRequest<any[]>('/leave/requests/pending').catch(() => [])
      );
      if (Array.isArray(res)) {
        const mappedLeaves: WorkerLeaveItem[] = res.map((l: any) => ({
          id: l.id,
          workerId: l.userId || l.workerId,
          workerName: l.workerName || l.userName || 'Assigned Worker',
          workerRole: l.requesterRole || l.userRole || 'Field Worker',
          workerAvatar: l.workerPhoto || l.userAvatar,
          leaveType: l.leaveTypeName || l.leaveType || 'Casual Leave',
          startDate: String(l.startDate).split('T')[0],
          endDate: String(l.endDate).split('T')[0],
          daysCount: Number(l.totalDays || 1),
          reason: l.reason || '',
          status: l.status || 'PENDING',
          isApprovedByAdmin: l.reviewerRole === 'ADMIN' || l.reviewerRole === 'SUPER_ADMIN' || (l.decisionNote && l.decisionNote.includes('Administrator')),
          appliedOn: l.createdAt
            ? new Date(l.createdAt).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Today',
          worksiteId: l.worksiteId || selectedWorksite?.id,
          decisionNote: l.decisionNote,
          decidedAt: l.decidedAt,
          revokedAt: l.revokedAt,
          revokedBy: l.revokedBy,
          revokedByName: l.revokedByName,
          revocationReason: l.revocationReason,
          reviewerName: l.reviewerName,
        }));
        setLeaves(mappedLeaves);
      }
    } catch (err) {
      console.error('Error loading team leaves:', err);
    }
  }, [selectedWorksite?.id]);

  // Load assigned worksite, master worksites, roster, and leaves
  useEffect(() => {
    const loadSupervisorData = async () => {
      try {
        const todayStr = getLocalTodayDateString();
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

  // Reload roster & expenses when attendance date or selected worksite changes + live auto-poll every 6 seconds (today only)
  useEffect(() => {
    if (selectedWorksite?.id) {
      loadRosterAndAttendance(selectedWorksite.id, attendanceDate);
      loadExpenses(selectedWorksite.id);

      const todayStr = getLocalTodayDateString();
      if (attendanceDate === todayStr) {
        const pollTimer = setInterval(() => {
          loadRosterAndAttendance(selectedWorksite.id, attendanceDate, true);
        }, 6000);
        return () => clearInterval(pollTimer);
      }
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

  // Action: Supervisor-Assisted Clock-Out
  const handleClockOutWorker = async (worker: SupervisorWorkerAttendance, reason: string) => {
    const effectiveReason = reason && reason.trim().length >= 3 ? reason.trim() : 'Clocked out by supervisor';
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setWorkers((prev) =>
      prev.map((w) =>
        w.id === worker.id
          ? {
              ...w,
              clockOutTime: nowTimeStr,
              decisionNote: `Supervisor Clock-Out: ${effectiveReason}`,
            }
          : w
      )
    );

    try {
      await apiRequest(`/attendance/${worker.id}/supervisor-clock-out`, {
        method: 'POST',
        body: JSON.stringify({ reason: effectiveReason }),
      });
      if (selectedWorksite?.id) {
        await loadRosterAndAttendance(selectedWorksite.id, attendanceDate, true);
      }
    } catch (err: any) {
      console.warn('API supervisor clock out failed, refreshed roster:', err);
      if (selectedWorksite?.id) {
        await loadRosterAndAttendance(selectedWorksite.id, attendanceDate, true);
      }
      throw err;
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
  const handleApproveLeave = async (leaveId: string, note?: string) => {
    try {
      await apiRequest(`/leave/requests/${leaveId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: note || 'Approved by supervisor' }),
      });
    } catch {
      // offline fallback or demo mode
    }
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === leaveId
          ? { ...l, status: 'APPROVED', isApprovedByAdmin: false, decisionNote: note || 'Approved by supervisor' }
          : l
      )
    );
  };

  // Action: Supervisor rejects worker leave request
  const handleRejectLeave = async (leaveId: string, reason?: string) => {
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
          ? { ...l, status: 'REJECTED', isApprovedByAdmin: false, decisionNote: reason || 'Rejected by supervisor' }
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
    <SupervisorAppShell
      worksitesList={worksitesList}
      selectedWorksite={selectedWorksite}
      onSelectWorksite={setSelectedWorksite}
      onRefreshRoster={() => {
        if (selectedWorksite?.id) {
          loadRosterAndAttendance(selectedWorksite.id, attendanceDate);
        }
      }}
      isLoadingRoster={isLoadingRoster}
      workers={workers}
      leaves={leaves}
      isOffline={isOffline}
      offlineQueueLength={offlineSyncQueue.length}
      onSyncNow={handleSyncNow}
    >
      <Routes>
        {/* Dashboard */}
        <Route
          path="home"
          element={
            <SupervisorHomeTab
              workers={workers}
              worksites={worksitesList}
              selectedWorksite={selectedWorksite}
              onSelectWorksite={setSelectedWorksite}
              monthlySpendData={monthlySpend}
              onNavigateTab={(tab) => handleTabClick(tab as any)}
              onApproveWorker={handleApproveWorker}
              onRejectWorker={handleRejectWorker}
              onRefreshRoster={() => {
                if (selectedWorksite?.id) {
                  loadRosterAndAttendance(selectedWorksite.id, attendanceDate);
                }
              }}
            />
          }
        />
        <Route path="dashboard" element={<Navigate to="/supervisor/home" replace />} />

        {/* ── Attendance Nested Routes ── */}
        {/* 1. Daily Attendance (combines Today's Attendance & Missing Attendance) */}
        <Route
          path="attendance/daily"
          element={
            <SupervisorAttendanceTab
              workers={
                selectedWorksite?.id
                  ? workers.filter((w) => !w.worksiteId || w.worksiteId === selectedWorksite.id)
                  : workers
              }
              selectedDate={attendanceDate}
              onSelectDate={handleSelectAttendanceDate}
              statistics={rosterStats || undefined}
              isLoading={isLoadingRoster}
              isError={isRosterError}
              onRetry={() => loadRosterAndAttendance(selectedWorksite?.id, attendanceDate)}
              onApproveWorker={handleApproveWorker}
              onRejectWorker={handleRejectWorker}
              onClockOutWorker={handleClockOutWorker}
              onBulkApprove={handleBulkApprove}
              onUndoLastAction={handleUndoLastAction}
              undoAvailable={undoStack}
              currentWorksite={selectedWorksite}
              initialSection="today-attendance"
            />
          }
        />
        <Route
          path="attendance/missing"
          element={
            <SupervisorAttendanceTab
              workers={
                selectedWorksite?.id
                  ? workers.filter((w) => !w.worksiteId || w.worksiteId === selectedWorksite.id)
                  : workers
              }
              selectedDate={attendanceDate}
              onSelectDate={handleSelectAttendanceDate}
              statistics={rosterStats || undefined}
              isLoading={isLoadingRoster}
              isError={isRosterError}
              onRetry={() => loadRosterAndAttendance(selectedWorksite?.id, attendanceDate)}
              onApproveWorker={handleApproveWorker}
              onRejectWorker={handleRejectWorker}
              onClockOutWorker={handleClockOutWorker}
              onBulkApprove={handleBulkApprove}
              onUndoLastAction={handleUndoLastAction}
              undoAvailable={undoStack}
              currentWorksite={selectedWorksite}
              initialSection="missing-attendance"
            />
          }
        />
        <Route path="attendance" element={<Navigate to="/supervisor/attendance/daily" replace />} />

        {/* 2. Attendance Overrides */}
        <Route
          path="attendance/overrides"
          element={
            <SupervisorAttendanceTab
              workers={
                selectedWorksite?.id
                  ? workers.filter((w) => !w.worksiteId || w.worksiteId === selectedWorksite.id)
                  : workers
              }
              selectedDate={attendanceDate}
              onSelectDate={handleSelectAttendanceDate}
              statistics={rosterStats || undefined}
              isLoading={isLoadingRoster}
              isError={isRosterError}
              onRetry={() => loadRosterAndAttendance(selectedWorksite?.id, attendanceDate)}
              onApproveWorker={handleApproveWorker}
              onRejectWorker={handleRejectWorker}
              onClockOutWorker={handleClockOutWorker}
              onBulkApprove={handleBulkApprove}
              onUndoLastAction={handleUndoLastAction}
              undoAvailable={undoStack}
              currentWorksite={selectedWorksite}
              initialSection="attendance-overrides"
            />
          }
        />

        {/* 3. Attendance History */}
        <Route
          path="attendance/history"
          element={
            <SupervisorAttendanceTab
              workers={
                selectedWorksite?.id
                  ? workers.filter((w) => !w.worksiteId || w.worksiteId === selectedWorksite.id)
                  : workers
              }
              selectedDate={attendanceDate}
              onSelectDate={handleSelectAttendanceDate}
              statistics={rosterStats || undefined}
              isLoading={isLoadingRoster}
              isError={isRosterError}
              onRetry={() => loadRosterAndAttendance(selectedWorksite?.id, attendanceDate)}
              onApproveWorker={handleApproveWorker}
              onRejectWorker={handleRejectWorker}
              onClockOutWorker={handleClockOutWorker}
              onBulkApprove={handleBulkApprove}
              onUndoLastAction={handleUndoLastAction}
              undoAvailable={undoStack}
              currentWorksite={selectedWorksite}
              initialSection="attendance-history"
            />
          }
        />

        {/* Attendance Exceptions */}
        <Route
          path="attendance-exceptions"
          element={
            <AttendanceExceptionsView
              isSupervisorView={true}
              currentWorksite={selectedWorksite}
            />
          }
        />
        <Route
          path="exceptions"
          element={
            <AttendanceExceptionsView
              isSupervisorView={true}
              currentWorksite={selectedWorksite}
            />
          }
        />
        <Route path="attendance/exceptions" element={<Navigate to="/supervisor/attendance-exceptions" replace />} />

        {/* Regularisation */}
        <Route
          path="regularization"
          element={<SupervisorRegularizationView currentWorksite={selectedWorksite} />}
        />

        {/* Leave Requests (Team Leaves) */}
        <Route
          path="leaves"
          element={
            <SupervisorLeavesTab
              leaves={leaves.filter(
                (l) => !l.worksiteId || !selectedWorksite?.id || l.worksiteId === selectedWorksite.id
              )}
              onApproveLeave={handleApproveLeave}
              onRejectLeave={handleRejectLeave}
              onRefresh={loadPendingLeaves}
            />
          }
        />
        <Route path="leave-requests" element={<Navigate to="/supervisor/leaves" replace />} />

        {/* My Leave (Personal Leaves & Balances) */}
        <Route
          path="my-leave"
          element={<SupervisorMyLeaveTab />}
        />

        {/* My Attendance (Personal Clock-in & Attendance Calendar) */}
        <Route
          path="my-attendance"
          element={
            <SupervisorAttendanceTab
              workers={[]}
              selectedDate={attendanceDate}
              onSelectDate={handleSelectAttendanceDate}
              onApproveWorker={() => {}}
              onRejectWorker={() => {}}
              onBulkApprove={() => {}}
              currentWorksite={selectedWorksite}
              initialSection="my-attendance"
            />
          }
        />

        {/* Spend Ledger */}
        <Route
          path="spend"
          element={
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
          }
        />

        {/* History */}
        <Route
          path="history"
          element={
            <SupervisorHistoryTab
              workers={workers}
              spendEntries={spendEntries}
              worksites={worksitesList}
              selectedWorksite={selectedWorksite}
              onSelectWorksite={setSelectedWorksite}
            />
          }
        />

        {/* Profile */}
        <Route
          path="profile"
          element={
            <SupervisorProfileTab
              currentWorksite={selectedWorksite}
              assignedWorkersCount={workers.length}
              pendingReviewsCount={workers.filter((w) => w.status === 'PENDING').length}
            />
          }
        />

        <Route path="" element={<Navigate to="attendance/daily" replace />} />
        <Route path="*" element={<Navigate to="attendance/daily" replace />} />
      </Routes>
    </SupervisorAppShell>
  );
};

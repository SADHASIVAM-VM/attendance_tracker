import React, { useState, useEffect, useMemo } from 'react';
import {
    SupervisorWorkerAttendance,
    SupervisorWorksite,
    SpendDaySummary,
    SupervisorTabId,
} from '../../types/supervisor';
import { apiRequest } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { WorkerRow } from '../../components/supervisor/WorkerRow';
import { ReviewSheet } from '../../components/supervisor/ReviewSheet';
import { SpendBarChart } from '../../components/supervisor/SpendBarChart';
import { StatusPill } from '../../components/supervisor/StatusPill';
import { SupervisorClockInCard } from '../../components/supervisor/SupervisorClockInCard';
import { AttendanceExceptionsSection } from '../../components/supervisor/AttendanceExceptionsSection';
import {
    ClockIcon,
    CheckCircleIcon,
    GroupIcon,
    CalenderIcon,
    ChevronRightIcon,
    Building1Icon,
    ArrowDownIcon,
    SecuritySafeIcon,
    Profile2Icon,
    NoteTextIcon,
    Building2Icon,
} from '@astraicons/react/linear';

interface SupervisorHomeTabProps {
    workers: SupervisorWorkerAttendance[];
    worksites: SupervisorWorksite[];
    selectedWorksite: SupervisorWorksite;
    onSelectWorksite: (worksite: SupervisorWorksite) => void;
    monthlySpendData: SpendDaySummary[];
    onNavigateTab: (tab: SupervisorTabId) => void;
    onApproveWorker: (worker: SupervisorWorkerAttendance) => void;
    onRejectWorker: (worker: SupervisorWorkerAttendance, reason: string) => void;
    onRefreshRoster?: () => void;
}

export const SupervisorHomeTab: React.FC<SupervisorHomeTabProps> = ({
    workers,
    worksites,
    selectedWorksite,
    onSelectWorksite,
    monthlySpendData,
    onNavigateTab,
    onApproveWorker,
    onRejectWorker,
    onRefreshRoster,
}) => {
    const [selectedWorkerForReview, setSelectedWorkerForReview] =
        useState<SupervisorWorkerAttendance | null>(null);
    const [showWorksiteDropdown, setShowWorksiteDropdown] = useState<boolean>(false);
    const [extraWorksites, setExtraWorksites] = useState<SupervisorWorksite[]>([]);

    // Fetch master worksites list to ensure all worksite options are visible
    useEffect(() => {
        apiRequest<any>('/worksites')
            .then((res) => {
                const raw = Array.isArray(res) ? res : res?.data || [];
                if (raw.length > 0) {
                    const mapped: SupervisorWorksite[] = raw
                        .filter((s: any) => s.isActive !== false)
                        .map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            code: s.code || 'SITE',
                            address: s.address || '',
                            radiusMeters: Number(s.radiusMeters || 30),
                        }));
                    setExtraWorksites(mapped);
                }
            })
            .catch(() => { });
    }, []);

    // Combine worksites to guarantee options are fully visible
    const allDisplayWorksites = useMemo(() => {
        const list = [...worksites];
        extraWorksites.forEach((ew) => {
            if (!list.some((w) => w.id === ew.id)) {
                list.push(ew);
            }
        });
        if (selectedWorksite?.id && !list.some((w) => w.id === selectedWorksite.id)) {
            list.unshift(selectedWorksite);
        }
        return list;
    }, [worksites, extraWorksites, selectedWorksite]);

    // Time-based greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Today's formatted date
    const todayFormatted = useMemo(() => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    }, []);

    // Filter workers belonging to selected worksite if worksite is specified
    const siteWorkers = useMemo(() => {
        if (!selectedWorksite?.id) return workers;
        const filtered = workers.filter((w) => w.worksiteId === selectedWorksite.id);
        return filtered.length > 0 ? filtered : workers;
    }, [workers, selectedWorksite?.id]);

    // Key counts
    const pendingWorkers = useMemo(
        () => siteWorkers.filter((w) => w.status === 'PENDING'),
        [siteWorkers]
    );
    const approvedWorkers = useMemo(
        () => siteWorkers.filter((w) => w.status === 'APPROVED'),
        [siteWorkers]
    );
    const notYetInWorkers = useMemo(
        () => siteWorkers.filter((w) => w.status === 'NOT_YET_IN'),
        [siteWorkers]
    );
    const onLeaveOrAbsentWorkers = useMemo(
        () =>
            siteWorkers.filter(
                (w) => w.status === 'ABSENT' || w.status === 'ON_LEAVE' || w.hasAppliedLeave
            ),
        [siteWorkers]
    );

    // Spend calculations for site
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const todaySpend = useMemo(() => {
        const match = monthlySpendData.find((d) => d.date === todayStr);
        return match ? match.amount : 0;
    }, [monthlySpendData, todayStr]);

    const weeklySpendTotal = useMemo(() => {
        return monthlySpendData.reduce((acc, curr) => acc + curr.amount, 0);
    }, [monthlySpendData]);

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* ─── 1. WELCOME & LOCATION HEADER BANNER ────────────────────── */}
            <div className="bg-gradient-to-br from-white via-white to-[#E6F7EF]/40 border border-[#E8EEF4] rounded-[22px] p-5 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#12A66A] uppercase tracking-wider bg-[#E6F7EF] px-2.5 py-0.5 rounded-full">
                                {todayFormatted}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">• Live Site Operations</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 leading-tight tracking-tight">
                            {greeting}, Supervisor
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            {pendingWorkers.length > 0
                                ? `You have ${pendingWorkers.length} punch verification(s) awaiting your sign-off today.`
                                : 'All assigned site operations and attendance punches are up-to-date.'}
                        </p>
                    </div>

                    {/* Worksite Selector Dropdown */}
                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowWorksiteDropdown(!showWorksiteDropdown)}
                            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-[#E8EEF4] hover:border-[#12A66A] rounded-2xl flex items-center justify-between gap-3 text-left shadow-xs transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shrink-0">
                                    <Building2Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Current Worksite
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-800 truncate block">
                                        {selectedWorksite?.name || 'Assigned Worksite'}
                                    </span>
                                </div>
                            </div>
                            <ArrowDownIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>

                        {/* Dropdown Menu */}
                        {showWorksiteDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowWorksiteDropdown(false)}
                                />
                                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E8EEF4] rounded-2xl p-2 shadow-2xl z-50 space-y-1 animate-in fade-in duration-150 max-h-60 overflow-y-auto">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1.5 block">
                                        Switch Site
                                    </span>
                                    {allDisplayWorksites.length === 0 ? (
                                        <div className="p-3 text-xs text-slate-400 text-center">No other worksites</div>
                                    ) : (
                                        allDisplayWorksites.map((ws) => (
                                            <button
                                                key={ws.id}
                                                type="button"
                                                onClick={() => {
                                                    onSelectWorksite(ws);
                                                    setShowWorksiteDropdown(false);
                                                }}
                                                className={`w-full p-2.5 rounded-xl text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${ws.id === selectedWorksite?.id
                                                    ? 'bg-[#E6F7EF] text-[#0E8F5B] font-bold'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                            >
                                                <div className="min-w-0">
                                                    <span className="truncate block font-semibold">{ws.name}</span>
                                                    {ws.address && (
                                                        <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                                                            {ws.address}
                                                        </span>
                                                    )}
                                                </div>
                                                {ws.id === selectedWorksite?.id && (
                                                    <CheckCircleIcon className="w-4 h-4 text-[#01B075] shrink-0 ml-2" />
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── 2. SUPERVISOR CLOCK-IN & LOCATION CARD (WORKER HOME SECTION STYLE) ─── */}
            <SupervisorClockInCard
                worksites={allDisplayWorksites}
                selectedWorksite={selectedWorksite}
                onSelectWorksite={onSelectWorksite}
                onClockInSuccess={onRefreshRoster}
            />

            {/* ─── 3. KEY METRICS STAT STRIP ───────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                    title="Pending Review"
                    value={pendingWorkers.length}
                    change={pendingWorkers.length > 0 ? 'Requires Action' : 'All Caught Up'}
                    isPositive={pendingWorkers.length === 0}
                    helpText="Punches awaiting sign-off"
                    icon={ClockIcon}
                    visualType="sparkline"
                    sparklineColor={pendingWorkers.length > 0 ? '#F59E0B' : '#01B075'}
                    iconBgColor={pendingWorkers.length > 0 ? 'bg-amber-50' : 'bg-[#E6F7EF]'}
                    iconColor={pendingWorkers.length > 0 ? 'text-amber-600' : 'text-[#01B075]'}
                    onOpenClick={() => onNavigateTab('attendance')}
                    className="cursor-pointer"
                />

                <StatCard
                    title="Active on Site"
                    value={approvedWorkers.length}
                    change={`${siteWorkers.length > 0 ? Math.round((approvedWorkers.length / siteWorkers.length) * 100) : 0}%`}
                    isPositive={true}
                    helpText={`of ${siteWorkers.length} scheduled staff`}
                    icon={CheckCircleIcon}
                    visualType="ring"
                    progressPercent={siteWorkers.length > 0 ? Math.round((approvedWorkers.length / siteWorkers.length) * 100) : 0}
                    barColor="#01B075"
                    iconBgColor="bg-[#E6F7EF]"
                    iconColor="text-[#01B075]"
                    onOpenClick={() => onNavigateTab('attendance')}
                    className="cursor-pointer"
                />

                <StatCard
                    title="Not Yet In"
                    value={notYetInWorkers.length}
                    change={notYetInWorkers.length > 0 ? 'Shift Pending' : 'All In'}
                    isPositive={notYetInWorkers.length === 0}
                    helpText="Workers awaiting clock-in"
                    icon={GroupIcon}
                    visualType="sparkline"
                    sparklineColor="#3B82F6"
                    iconBgColor="bg-blue-50"
                    iconColor="text-blue-600"
                    onOpenClick={() => onNavigateTab('attendance')}
                    className="cursor-pointer"
                />

                <StatCard
                    title="On Leave / Absent"
                    value={onLeaveOrAbsentWorkers.length}
                    change={onLeaveOrAbsentWorkers.length > 0 ? 'Off Duty' : 'Full Team'}
                    isPositive={onLeaveOrAbsentWorkers.length === 0}
                    helpText="Scheduled off or absent today"
                    icon={CalenderIcon}
                    visualType="bars"
                    sparklineColor="#8B5CF6"
                    iconBgColor="bg-purple-50"
                    iconColor="text-purple-600"
                    onOpenClick={() => onNavigateTab('leaves')}
                    className="cursor-pointer"
                />
            </div>

            {/* ─── ATTENDANCE EXCEPTIONS SECTION ─────────────────────────────── */}
            <AttendanceExceptionsSection
                worksiteId={selectedWorksite?.id}
                onNavigateToExceptions={(cat) =>
                    onNavigateTab(cat ? (`attendance-exceptions?category=${cat}` as any) : 'attendance-exceptions')
                }
                onRefreshParent={onRefreshRoster}
            />

            {/* ─── 3. PENDING VERIFICATIONS ACTION QUEUE ───────────────────── */}
            <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                            Awaiting Verification
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Review clock-in selfies and verify physical presence on site
                        </p>
                    </div>

                    {pendingWorkers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onNavigateTab('attendance')}
                            className="text-xs font-bold text-[#01B075] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                        >
                            <span>View All ({pendingWorkers.length})</span>
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {pendingWorkers.length === 0 ? (
                    <div className="p-8 text-center bg-[#F8FAFC] border border-[#E8EEF4] rounded-2xl space-y-2">
                        <div className="w-12 h-12 rounded-full bg-[#E6F7EF] text-[#01B075] flex items-center justify-center mx-auto">
                            <SecuritySafeIcon className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">All Punches Verified</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            There are no pending clock-in requests waiting for your verification right now.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {pendingWorkers.slice(0, 5).map((worker) => (
                            <WorkerRow
                                key={worker.id}
                                worker={worker}
                                onSelect={(w) => setSelectedWorkerForReview(w)}
                                onQuickApprove={(w, e) => {
                                    e.stopPropagation();
                                    onApproveWorker(w);
                                }}
                                onQuickReject={(w, e) => {
                                    e.stopPropagation();
                                    setSelectedWorkerForReview(w);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ─── 4. FIELD SPEND & QUICK HUB (2-Column Grid) ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Weekly Site Expenses */}
                <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                                Site Expenses
                            </h3>

                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigateTab('spend')}
                            className="text-xs font-bold text-[#01B075] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                        >
                            <span>Manage Spend</span>
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="pt-2">
                        <SpendBarChart data={monthlySpendData} currencySymbol="₹" />
                    </div>
                </div>

                {/* Quick Management Shortcuts */}
                <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                            Management Hub
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Fast navigation to supervisor roster and field control tools
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => onNavigateTab('attendance')}
                            className="p-4 rounded-2xl border border-[#E8EEF4] hover:border-[#01B075]/40 hover:bg-[#F8FAFC] text-left transition-all cursor-pointer group space-y-2 shadow-xs"
                        >
                            <div className="w-9 h-9 rounded-xl bg-[#E6F7EF] text-[#01B075] flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Profile2Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-900 block">Team Roster</span>
                                <span className="text-[11px] text-slate-400">Bulk verify & roster</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => onNavigateTab('leaves')}
                            className="p-4 rounded-2xl border border-[#E8EEF4] hover:border-[#01B075]/40 hover:bg-[#F8FAFC] text-left transition-all cursor-pointer group space-y-2 shadow-xs"
                        >
                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <CalenderIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-900 block">Worker Leaves</span>
                                <span className="text-[11px] text-slate-400">Review time-off requests</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => onNavigateTab('spend')}
                            className="p-4 rounded-2xl border border-[#E8EEF4] hover:border-[#01B075]/40 hover:bg-[#F8FAFC] text-left transition-all cursor-pointer group space-y-2 shadow-xs"
                        >
                            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <NoteTextIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-900 block">Spend Ledger</span>
                                <span className="text-[11px] text-slate-400">Add petty cash & fuel</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => onNavigateTab('history')}
                            className="p-4 rounded-2xl border border-[#E8EEF4] hover:border-[#01B075]/40 hover:bg-[#F8FAFC] text-left transition-all cursor-pointer group space-y-2 shadow-xs"
                        >
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <SecuritySafeIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-900 block">Site History</span>
                                <span className="text-[11px] text-slate-400">Past punch records</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── 5. REVIEW SHEET MODAL ─────────────────────────────────────── */}
            <ReviewSheet
                worker={selectedWorkerForReview}
                isOpen={Boolean(selectedWorkerForReview)}
                onClose={() => setSelectedWorkerForReview(null)}
                onApprove={(w) => {
                    onApproveWorker(w);
                    setSelectedWorkerForReview(null);
                }}
                onReject={(w, reason) => {
                    onRejectWorker(w, reason);
                    setSelectedWorkerForReview(null);
                }}
            />
        </div>
    );
};

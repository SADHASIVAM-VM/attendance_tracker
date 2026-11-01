import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '../ui/drawer';
import {
  NotificationIcon,
  ClockIcon,
  CloseCircleIcon,
  CheckCircleIcon,
  SecuritySafeIcon,
  CalenderIcon,
  DollarCircleIcon,
  ChevronRightIcon,
} from '@astraicons/react/linear';

export interface NotificationItem {
  id: string;
  type: 'leave' | 'exception' | 'regularization' | 'spend' | 'system';
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
  actionPath: string;
  actionLabel: string;
}

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingLeavesCount?: number;
  pendingRegularizationsCount?: number;
  pendingExpensesCount?: number;
  onCountChange?: (unreadCount: number) => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function getNotificationRoute(
  item: any,
  role: string
): {
  actionPath: string;
  actionLabel: string;
  category: 'leave' | 'exception' | 'regularization' | 'spend' | 'system';
} {
  const typeUpper = (item.type || '').toUpperCase();
  const entityUpper = (item.entityType || '').toUpperCase();
  const isSupervisor = role === 'SUPERVISOR';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  // 1. Regularization
  if (
    typeUpper.includes('REGULARIZ') ||
    entityUpper.includes('REGULARIZ') ||
    entityUpper === 'ATTENDANCE_ADJUSTMENT'
  ) {
    if (isAdmin) {
      return { actionPath: '/admin/regularization', actionLabel: 'Review Regularisation', category: 'regularization' };
    }
    if (isSupervisor) {
      return { actionPath: '/supervisor/regularization', actionLabel: 'Review Request', category: 'regularization' };
    }
    return { actionPath: '/worker/attendance', actionLabel: 'View Attendance', category: 'regularization' };
  }

  // 2. Leave Request
  if (typeUpper.includes('LEAVE') || entityUpper.includes('LEAVE')) {
    if (isAdmin) {
      return { actionPath: '/admin/leave-approvals', actionLabel: 'Review Leave', category: 'leave' };
    }
    if (isSupervisor) {
      return { actionPath: '/supervisor/leaves', actionLabel: 'Review Leave', category: 'leave' };
    }
    return { actionPath: '/worker/leaves', actionLabel: 'View Leave Status', category: 'leave' };
  }

  // 3. Exception / Missing clock-in / Geofence breach
  if (
    typeUpper.includes('EXCEPTION') ||
    entityUpper.includes('EXCEPTION') ||
    typeUpper.includes('MISSING') ||
    typeUpper.includes('FLAG')
  ) {
    if (isAdmin) {
      return { actionPath: '/admin/exceptions', actionLabel: 'View Exceptions', category: 'exception' };
    }
    if (isSupervisor) {
      return { actionPath: '/supervisor/exceptions', actionLabel: 'Resolve Exception', category: 'exception' };
    }
    return { actionPath: '/worker/attendance', actionLabel: 'View Attendance', category: 'exception' };
  }

  // 4. Site Expense / Spend
  if (typeUpper.includes('EXPENSE') || entityUpper.includes('EXPENSE') || typeUpper.includes('SPEND')) {
    if (isAdmin) {
      return { actionPath: '/admin/spend', actionLabel: 'Review Expenses', category: 'spend' };
    }
    if (isSupervisor) {
      return { actionPath: '/supervisor/spend', actionLabel: 'Site Spend', category: 'spend' };
    }
    return { actionPath: '/worker/attendance', actionLabel: 'View Spend', category: 'spend' };
  }

  // 5. Default / System
  if (isAdmin) {
    return { actionPath: '/admin/dashboard', actionLabel: 'Open Dashboard', category: 'system' };
  }
  if (isSupervisor) {
    return { actionPath: '/supervisor/home', actionLabel: 'Supervisor Hub', category: 'system' };
  }
  return { actionPath: '/worker/clock-in', actionLabel: 'Open Attendance', category: 'system' };
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  open,
  onOpenChange,
  pendingLeavesCount = 0,
  pendingRegularizationsCount = 0,
  pendingExpensesCount = 0,
  onCountChange,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = (user?.roles?.[0] || 'WORKER').toUpperCase();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'attendance' | 'approvals'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any[]>('/notifications');
      if (Array.isArray(res)) {
        const mapped: NotificationItem[] = res.map((item) => {
          const { actionPath, actionLabel, category } = getNotificationRoute(item, userRole);
          return {
            id: item.id,
            type: category,
            title: item.title,
            description: item.message,
            timestamp: formatRelativeTime(item.createdAt),
            unread: !item.isRead,
            actionPath,
            actionLabel,
          };
        });

        // Add live pending alerts if user is Admin or Supervisor and counts exist
        if ((userRole === 'ADMIN' || userRole === 'SUPERVISOR') && mapped.length === 0) {
          if (pendingRegularizationsCount > 0) {
            mapped.push({
              id: 'live-reg-alert',
              type: 'regularization',
              title: `${pendingRegularizationsCount} Regularisation Requests Pending`,
              description: 'Workers have submitted attendance adjustments awaiting your review.',
              timestamp: 'Action required',
              unread: true,
              actionPath: userRole === 'ADMIN' ? '/admin/regularization' : '/supervisor/regularization',
              actionLabel: 'Review Requests',
            });
          }
          if (pendingLeavesCount > 0) {
            mapped.push({
              id: 'live-leave-alert',
              type: 'leave',
              title: `${pendingLeavesCount} Leave Applications Awaiting Decision`,
              description: 'Staff leave applications require your approval.',
              timestamp: 'Action required',
              unread: true,
              actionPath: userRole === 'ADMIN' ? '/admin/leave-approvals' : '/supervisor/leaves',
              actionLabel: 'Review Leaves',
            });
          }
          if (pendingExpensesCount > 0) {
            mapped.push({
              id: 'live-expense-alert',
              type: 'spend',
              title: `${pendingExpensesCount} Site Expenses Submitted`,
              description: 'Pending field reimbursement and expense receipts.',
              timestamp: 'Action required',
              unread: true,
              actionPath: '/admin/spend',
              actionLabel: 'Review Expenses',
            });
          }
        }

        setNotifications(mapped);
        const unread = mapped.filter((n) => n.unread).length;
        onCountChange?.(unread);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications from backend:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole, pendingLeavesCount, pendingRegularizationsCount, pendingExpensesCount, onCountChange]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    try {
      // Mark as read in backend if not already read
      if (item.unread && !item.id.startsWith('live-')) {
        await apiRequest(`/notifications/${item.id}/read`, { method: 'POST' });
      }
    } catch {
      // Silent catch
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
    );

    onOpenChange(false);
    if (item.actionPath) {
      navigate(item.actionPath);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
    } catch {
      // Fallback local update
    }
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
    onCountChange?.(0);
  };

  const getFilteredNotifications = () => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter((n) => n.unread);
      case 'attendance':
        return notifications.filter((n) => n.type === 'exception' || n.type === 'regularization');
      case 'approvals':
        return notifications.filter((n) => n.type === 'leave' || n.type === 'spend');
      default:
        return notifications;
    }
  };

  const filteredItems = getFilteredNotifications();
  const unreadCount = notifications.filter((n) => n.unread).length;

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'leave':
        return <CalenderIcon className="w-4 h-4 text-[#01B075]" />;
      case 'regularization':
        return <ClockIcon className="w-4 h-4 text-[#D97706]" />;
      case 'spend':
        return <DollarCircleIcon className="w-4 h-4 text-[#3B82F6]" />;
      case 'exception':
        return <CloseCircleIcon className="w-4 h-4 text-[#EF4444]" />;
      case 'system':
      default:
        return <SecuritySafeIcon className="w-4 h-4 text-[#7C3AED]" />;
    }
  };

  const getIconBg = (type: NotificationItem['type']) => {
    switch (type) {
      case 'leave':
        return 'bg-[#E6F7F1]';
      case 'regularization':
        return 'bg-[#FEF3C7]';
      case 'spend':
        return 'bg-blue-50';
      case 'exception':
        return 'bg-rose-50';
      case 'system':
      default:
        return 'bg-purple-50';
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-full sm:max-w-md md:max-w-lg h-full flex flex-col p-0 shadow-2xl">
        {/* Drawer Header */}
        <DrawerHeader className="p-5 sm:p-6 bg-white border-b border-[#E8EEF4] flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#01B075] flex items-center justify-center shadow-xs">
              <NotificationIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DrawerTitle className="text-base font-bold text-[#1E1F24] m-0">
                  Notification Centre
                </DrawerTitle>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#01B075]">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <DrawerDescription className="text-xs text-[#71737D] mt-0.5">
                Role-based alerts, ticket resolutions, and approvals
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        {/* Filter Tabs */}
        <div className="px-5 pt-3 pb-2 bg-[#FAFCFE] border-b border-[#E8EEF4] flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'attendance', label: 'Attendance' },
              { id: 'approvals', label: 'Approvals' },
            ].map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#01B075] text-white shadow-2xs'
                      : 'bg-white text-[#464853] hover:text-[#1E1F24] border border-[#E8EEF4]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-[#01B075] hover:underline whitespace-nowrap cursor-pointer shrink-0"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Scrollable Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F4F6F8]">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-[#01B075] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#71737D]">Checking for notifications...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white border border-[#E8EEF4] mx-auto flex items-center justify-center text-slate-400 shadow-2xs">
                <CheckCircleIcon className="w-6 h-6 text-[#01B075]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1E1F24]">You're all caught up!</p>
                <p className="text-xs text-[#71737D] mt-0.5">No notifications matching this filter.</p>
              </div>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-4 rounded-2xl border transition-all bg-white cursor-pointer hover:shadow-xs ${
                  item.unread
                    ? 'border-[#01B075]/40 shadow-xs ring-1 ring-[#01B075]/10'
                    : 'border-[#E8EEF4] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl ${getIconBg(item.type)} flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-[#1E1F24] leading-snug m-0">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-[#94A3B8] font-medium shrink-0">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-[#71737D] mt-1 leading-relaxed m-0">
                      {item.description}
                    </p>

                    <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#01B075]">
                        <span>{item.actionLabel}</span>
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                      </span>

                      {item.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#01B075]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <DrawerFooter className="p-4 bg-white border-t border-[#E8EEF4] flex items-center justify-between">
          <span className="text-xs text-[#71737D]">
            Showing <strong>{filteredItems.length}</strong> updates
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F4F6F8] hover:bg-slate-200 text-[#1E1F24] transition-all cursor-pointer"
          >
            Close
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  GroupIcon,
  DollarCircleIcon,
  CloseIcon,
  ChevronRightIcon,
} from '@astraicons/react/linear';

export interface NotificationItem {
  id: string;
  type: 'leave' | 'exception' | 'regularization' | 'spend' | 'system';
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
  actionPath?: string;
  actionLabel?: string;
}

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingLeavesCount?: number;
  pendingRegularizationsCount?: number;
  pendingExpensesCount?: number;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  open,
  onOpenChange,
  pendingLeavesCount = 0,
  pendingRegularizationsCount = 0,
  pendingExpensesCount = 0,
}) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'attendance' | 'approvals'>('all');

  // Dynamic live notifications combined with alerts
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      type: 'leave',
      title: pendingLeavesCount > 0 ? `${pendingLeavesCount} Leave Requests Pending` : 'Leave Application Submitted',
      description: 'Jane Doe requested 3 days of Annual Leave awaiting supervisor approval.',
      timestamp: '10m ago',
      unread: true,
      actionPath: '/admin/leaves',
      actionLabel: 'Review Requests',
    },
    {
      id: 'notif-2',
      type: 'regularization',
      title: pendingRegularizationsCount > 0 ? `${pendingRegularizationsCount} Regularizations Flagged` : 'Missing Clock-In Flagged',
      description: 'Workers at North Site have unreviewed missing clock-in exceptions.',
      timestamp: '25m ago',
      unread: true,
      actionPath: '/admin/regularization',
      actionLabel: 'Resolve Exceptions',
    },
    {
      id: 'notif-3',
      type: 'spend',
      title: pendingExpensesCount > 0 ? `${pendingExpensesCount} Spend Approvals` : 'Travel Allowance Claim',
      description: 'Site supervisor submitted fuel and material reimbursement invoice.',
      timestamp: '1h ago',
      unread: true,
      actionPath: '/admin/spend',
      actionLabel: 'Open Spend Review',
    },
    {
      id: 'notif-4',
      type: 'exception',
      title: 'Geofence Boundary Alert',
      description: '2 punch attempts were recorded outside designated perimeter at East Depot.',
      timestamp: '2h ago',
      unread: false,
      actionPath: '/admin/attendance-exceptions',
      actionLabel: 'View Audit Log',
    },
    {
      id: 'notif-5',
      type: 'system',
      title: 'Payroll Audit Period Locked',
      description: 'Bi-weekly cycle (Oct 1 - Oct 15) is locked for supervisor edits.',
      timestamp: '5h ago',
      unread: false,
      actionPath: '/admin/attendance/control',
      actionLabel: 'View Payroll Lock',
    },
  ]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
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
        {/* Drawer Header with Title, Count Badge, and Close Button */}
        <DrawerHeader className="p-5 sm:p-6 bg-white border-b border-[#E8EEF4] flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F7F1] text-[#01B075] flex items-center justify-center shadow-xs">
              <NotificationIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DrawerTitle className="text-base font-bold text-[#1E1F24] m-0">
                  Notifications
                </DrawerTitle>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7F1] text-[#01B075]">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <DrawerDescription className="text-xs text-[#71737D] mt-0.5">
                Workforce alerts, punch exceptions, and approvals
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        {/* Filter Pills */}
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
              Mark all as read
            </button>
          )}
        </div>

        {/* Scrollable Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F4F6F8]">
          {filteredItems.length === 0 ? (
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
                className={`p-4 rounded-2xl border transition-all bg-white ${
                  item.unread
                    ? 'border-[#01B075]/30 shadow-xs ring-1 ring-[#01B075]/10'
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

                    {item.actionPath && (
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false);
                            if (item.actionPath) navigate(item.actionPath);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#01B075] hover:text-[#018F5F] cursor-pointer transition-colors"
                        >
                          <span>{item.actionLabel || 'Take Action'}</span>
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                        </button>

                        {item.unread && (
                          <span className="w-2 h-2 rounded-full bg-[#01B075]" />
                        )}
                      </div>
                    )}
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

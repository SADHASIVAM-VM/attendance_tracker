export type SupervisorAttendanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ABSENT' | 'ON_LEAVE' | 'NOT_YET_IN';

export interface SupervisorWorksite {
  id: string;
  name: string;
  code: string;
  address: string;
  radiusMeters: number;
  latitude?: number;
  longitude?: number;
}

export interface SupervisorWorkerAttendance {
  id: string;
  workerId: string;
  name: string;
  role: string;
  avatar: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  totalHours: number;
  inPhotoUrl: string;
  outPhotoUrl?: string;
  distanceMeters: number;
  isWithinRadius: boolean;
  status: SupervisorAttendanceStatus;
  hasAppliedLeave?: boolean;
  note?: string;
  decisionNote?: string;
  worksiteId: string;
  worksiteName: string;
  date: string;
}

export type LeaveFilter = 'Today' | 'Pending' | 'Approved' | 'Rejected';

export interface WorkerLeaveItem {
  id: string;
  workerId: string;
  workerName: string;
  workerAvatar: string;
  workerRole: string;
  leaveType: 'Casual Leave' | 'Sick Leave' | 'Privilege Leave' | 'Emergency';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  isApprovedByAdmin: boolean;
  appliedOn: string;
  worksiteId: string;
}

export type SpendCategory = 'Materials' | 'Food' | 'Transport' | 'Worker payment' | 'Other';

export interface SpendEntry {
  id: string;
  amount: number;
  category: SpendCategory;
  appliesToType: 'LOCATION' | 'WORKER';
  workerId?: string;
  workerName?: string;
  note: string;
  receiptUrl?: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. 11:30 AM
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  currency?: string;
  isLocked?: boolean;
  isOffline?: boolean;
  worksiteId: string;
}

export interface SpendDaySummary {
  date: string;          // YYYY-MM-DD
  dayLabel: string;      // e.g. "Mon"
  dateLabel?: string;    // e.g. "19 Oct"
  dayName?: string;      // e.g. "Monday"
  dayOfWeek?: string;    // e.g. "Mon"
  dayNumber?: number | string; // e.g. 19
  monthShort?: string;   // e.g. "Oct"
  amount: number;
  entriesCount: number;
  isToday?: boolean;
  isFuture?: boolean;
}

export interface CategorySummary {
  category: SpendCategory;
  amount: number;
  percentage: number;
  color: string;
}

export type AttendanceFlagStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface MissingClockInCase {
  id: string;
  assignmentId: string;
  workerId: string;
  workerName: string;
  employeeCode?: string;
  workerCode?: string;
  workerRole?: string;
  avatar?: string;
  workerAvatar?: string;
  workerPhone?: string;
  worksiteId: string;
  worksiteName: string;
  worksiteCode?: string;
  workDate?: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime?: string;
  gracePeriodMinutes: number;
  gracePeriodExpiresAt: string;
  timeElapsedMinutes?: number;
  timeElapsedFormatted?: string;
  elapsedLabel?: string;
  leaveStatus: 'NONE' | 'PENDING_LEAVE';
  flagStatus: AttendanceFlagStatus;
  reason?: string | null;
  note?: string | null;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  employmentType?: string;
  resolvedByClockIn: boolean;
  resolvedAt?: string | null;
}

export type SupervisorTabId = 'home' | 'attendance' | 'leaves' | 'spend' | 'history' | 'profile';


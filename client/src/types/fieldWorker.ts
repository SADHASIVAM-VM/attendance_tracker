export type WorkerStatus = 'NOT_CLOCKED_IN' | 'WORKING' | 'SHIFT_DONE';

export type LanguageCode = 'en' | 'ta' | 'hi';

export interface Worksite {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
}

export interface AttendanceRecordItem {
  id: string;
  workDate: string;
  clockInTime: string;
  clockOutTime?: string | null;
  totalHoursWorked?: number;
  worksiteName: string;
  worksiteAddress: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
  inPhotoUrl?: string;
  outPhotoUrl?: string;
  inLatitude?: number;
  inLongitude?: number;
  isOfflineSynced?: boolean;
}

export interface OfflineAction {
  id: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  timestamp: string;
  worksiteId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photoDataUrl: string;
  synced: boolean;
}

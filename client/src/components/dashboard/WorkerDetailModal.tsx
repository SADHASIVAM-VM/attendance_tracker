import React from 'react';
import { X, CheckCircle2, MapPin, Calendar, Clock, ShieldCheck, Camera, Phone, Mail, Award } from 'lucide-react';
import { ClockInRecord } from './RecentClockInsTable';

interface WorkerDetailModalProps {
  worker: ClockInRecord | null;
  onClose: () => void;
}

export const WorkerDetailModal: React.FC<WorkerDetailModalProps> = ({ worker, onClose }) => {
  if (!worker) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-[24px] border border-[#E8EEF4] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#F1F5F9] flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <img
              src={worker.avatarUrl}
              alt={worker.workerName}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#12A66A]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#111827]">
                  {worker.workerName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F7EF] text-[#12A66A]">
                  Verified Field Tech
                </span>
              </div>
              <span className="text-xs text-[#6B7280]  ">
                {worker.workerCode} • Assigned to {worker.worksite}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] flex items-center justify-center text-[#6B7280] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-center">
              <span className="text-[11px] text-[#6B7280] block font-medium">Monthly Hours</span>
              <span className="text-xl font-extrabold text-[#111827]   mt-0.5 block">178.5 hrs</span>
              <span className="text-[10px] text-[#12A66A] font-bold">↑ 4.2% vs target</span>
            </div>
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-center">
              <span className="text-[11px] text-[#6B7280] block font-medium">Punctuality</span>
              <span className="text-xl font-extrabold text-[#12A66A]   mt-0.5 block">98.2%</span>
              <span className="text-[10px] text-[#12A66A] font-bold">23/24 on-time</span>
            </div>
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-center">
              <span className="text-[11px] text-[#6B7280] block font-medium">Geofence Compliance</span>
              <span className="text-xl font-extrabold text-[#111827]   mt-0.5 block">100%</span>
              <span className="text-[10px] text-[#12A66A] font-bold">Avg 8m from gate</span>
            </div>
          </div>

          {/* Today's Punch Verification Proof */}
          <div className="bg-white border border-[#E8EEF4] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#12A66A]" />
                Today's Clock-in Facial &amp; GPS Verification
              </span>
              <span className="text-xs   font-bold text-[#12A66A] bg-[#E6F7EF] px-2.5 py-0.5 rounded-full">
                {worker.clockInTime}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-48 rounded-xl overflow-hidden bg-slate-900 border border-[#E8EEF4] relative group">
                <img
                  src={worker.photoUrl}
                  alt="Verified clock-in selfie"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-xs text-white p-2 rounded-lg text-[10px] flex items-center justify-between">
                  <span>Facial Match: 99.4%</span>
                  <span className="text-[#A8EBCB]">Live Camera</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#6B7280] block text-[10px]">Verified Worksite:</span>
                  <strong className="text-[#111827] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#12A66A]" />
                    {worker.worksite}
                  </strong>
                </div>
                <div className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <span className="text-[#6B7280] block text-[10px]">GPS Coordinates:</span>
                  <strong className="text-[#111827] mt-0.5 block">
                    {worker.latitude && worker.longitude
                      ? `${Math.abs(worker.latitude).toFixed(4)}° ${worker.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(worker.longitude).toFixed(4)}° ${worker.longitude >= 0 ? 'E' : 'W'} (±${Math.round(worker.accuracyMeters || 8)}m)`
                      : 'GPS Verified at Worksite Perimeter'}
                  </strong>
                </div>
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  worker.isWithinGeofence !== false
                    ? 'bg-[#E6F7EF] border-[#12A66A]/20 text-[#12A66A]'
                    : 'bg-[#FEF3C7] border-[#D97706]/20 text-[#D97706]'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-[11px]">
                    {worker.isWithinGeofence !== false
                      ? `Inside geofence perimeter (${Math.round(worker.distanceMeters || 10)}m from center)`
                      : `Punch recorded outside perimeter (${Math.round(worker.distanceMeters || 120)}m)`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent 5 Days Punch Calendar Log */}
          <div>
            <h4 className="text-xs font-bold text-[#111827] mb-2">Recent Shift Attendance History</h4>
            <div className="space-y-1.5 text-xs">
              {[
                { date: 'Yesterday (Oct 17)', in: '08:55 AM', out: '05:30 PM', hrs: '8.5 hrs', status: 'On Time' },
                { date: 'Wed (Oct 16)', in: '08:48 AM', out: '05:25 PM', hrs: '8.6 hrs', status: 'On Time' },
                { date: 'Tue (Oct 15)', in: '09:02 AM', out: '05:35 PM', hrs: '8.5 hrs', status: 'On Time' },
                { date: 'Mon (Oct 14)', in: '08:50 AM', out: '05:20 PM', hrs: '8.5 hrs', status: 'On Time' },
              ].map((shift, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                    <span className="font-semibold text-[#111827]">{shift.date}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[#64748B]  ">{shift.in} – {shift.out}</span>
                    <span className="font-bold text-[#111827]  ">{shift.hrs}</span>
                    <span className="px-2 py-0.5 bg-[#E6F7EF] text-[#12A66A] rounded-full text-[10px] font-bold">
                      {shift.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#F1F5F9] rounded-b-[24px] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

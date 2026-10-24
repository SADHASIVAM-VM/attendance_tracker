import React, { useState, useEffect } from 'react';
import { toast } from '../../context/ToastContext';
import {
  X,
  Upload,
  Camera,
  User,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  ShieldCheck,
  Mail,
  Lock,
  Sparkles,
  Check,
  AlertCircle,
  FileCheck2,
  HeartPulse,
  Info,
  ShieldAlert,
  RefreshCw,
  Pencil,
} from 'lucide-react';

export type EmploymentType = 'full-time' | 'part-time' | 'contract';
export type UserRole = 'WORKER' | 'SUPERVISOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface CreateUserData {
  id?: string;
  fullName: string;
  phone: string;
  photoUrl?: string;
  dob?: string;
  age?: number | '';
  personalEmail?: string;
  gender?: string;
  currentAddress?: string;
  permanentAddress?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  employmentType: EmploymentType;
  role: UserRole;
  employeeCode: string;
  email: string;
  password?: string;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: CreateUserData) => Promise<void>;
  initialRole?: UserRole;
  editUser?: CreateUserData | null;
}

const PRESET_AVATARS = [
  {
    label: 'Technician (Male)',
    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Engineer (Female)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Supervisor (Male)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Specialist (Female)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Field Lead (Male)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Operations (Female)',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
  },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Non-Binary', 'Other', 'Prefer not to say'];

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialRole = 'WORKER',
  editUser = null,
}) => {
  const isEditMode = Boolean(editUser && editUser.id);

  // Required Fields
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // Optional / Business Need Fields
  const [photoUrl, setPhotoUrl] = useState<string>(PRESET_AVATARS[0].url);
  const [dob, setDob] = useState<string>('');
  const [age, setAge] = useState<number | ''>(28);
  const [personalEmail, setPersonalEmail] = useState<string>('');
  const [gender, setGender] = useState<string>('Male');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [permanentAddress, setPermanentAddress] = useState<string>('');
  const [sameAddressAsCurrent, setSameAddressAsCurrent] = useState<boolean>(true);

  // Recommended Fields
  const [emergencyContactName, setEmergencyContactName] = useState<string>('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');

  // Employment & Credentials
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full-time');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('Password123!');

  // Status & Validation State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customPhotoSelected, setCustomPhotoSelected] = useState<boolean>(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Populate form if in edit mode or when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editUser) {
      setFullName(editUser.fullName || '');
      setPhone(editUser.phone || '');
      setPhotoUrl(editUser.photoUrl || PRESET_AVATARS[0].url);
      setDob(editUser.dob || '');
      setAge(editUser.age ?? 28);
      setPersonalEmail(editUser.personalEmail || '');
      setGender(editUser.gender || 'Male');
      setBloodGroup(editUser.bloodGroup || 'O+');
      const curAddr = editUser.currentAddress || editUser.address || '';
      setCurrentAddress(curAddr);
      setPermanentAddress(editUser.permanentAddress || '');
      setSameAddressAsCurrent(
        !editUser.permanentAddress || editUser.permanentAddress === curAddr
      );
      setEmergencyContactName(editUser.emergencyContactName || '');
      setEmergencyContactPhone(editUser.emergencyContactPhone || '');
      setEmploymentType(editUser.employmentType || 'full-time');
      setRole(editUser.role || initialRole);
      setEmployeeCode(editUser.employeeCode || '');
      setEmail(editUser.email || '');
      setPassword(''); // keep blank when editing
      setCustomPhotoSelected(Boolean(editUser.photoUrl && !editUser.photoUrl.includes('unsplash')));
      setError(null);
      setTouched({});
    } else {
      // Create mode defaults
      setFullName('');
      setPhone('');
      setPhotoUrl(PRESET_AVATARS[0].url);
      setDob('');
      setAge(28);
      setPersonalEmail('');
      setGender('Male');
      setBloodGroup('O+');
      setCurrentAddress('');
      setPermanentAddress('');
      setSameAddressAsCurrent(true);
      setEmergencyContactName('');
      setEmergencyContactPhone('');
      setEmploymentType('full-time');
      setRole(initialRole);
      const prefix = initialRole === 'WORKER' ? 'EMP' : initialRole === 'SUPERVISOR' ? 'SUP' : 'ADM';
      setEmployeeCode(`${prefix}-${Math.floor(100 + Math.random() * 900)}`);
      setEmail('');
      setPassword('Password123!');
      setCustomPhotoSelected(false);
      setError(null);
      setTouched({});
    }
  }, [isOpen, editUser, initialRole]);

  if (!isOpen) return null;

  // Handle local image file upload, downscale via canvas to prevent PayloadTooLargeError
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError('Selected image exceeds 15MB limit. Please select a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const img = new Image();
        img.onload = () => {
          try {
            // Compress and resize to max 400x400 to keep JSON payload tiny (~30-50kb)
            const maxDim = 400;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
              setPhotoUrl(compressedDataUrl);
              setCustomPhotoSelected(true);
              setError(null);
            } else {
              setPhotoUrl(result);
              setCustomPhotoSelected(true);
              setError(null);
            }
          } catch (err) {
            setPhotoUrl(result);
            setCustomPhotoSelected(true);
            setError(null);
          }
        };
        img.onerror = () => {
          setError('Failed to process image file.');
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-calculate age when DOB changes
  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDob(val);
    if (val) {
      const birthDate = new Date(val);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge > 0 && calculatedAge < 120) {
        setAge(calculatedAge);
      }
    }
  };

  const handleGenerateCode = () => {
    const prefix = role === 'WORKER' ? 'EMP' : role === 'SUPERVISOR' ? 'SUP' : 'ADM';
    setEmployeeCode(`${prefix}-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Form validations
    if (!fullName.trim()) {
      const msg = 'Full Name is required.';
      setError(msg);
      toast.error(msg, 'Validation Error');
      setTouched((prev) => ({ ...prev, fullName: true }));
      return;
    }
    if (!phone.trim()) {
      const msg = 'Mobile Number is required for worker login and site communication.';
      setError(msg);
      toast.error(msg, 'Validation Error');
      setTouched((prev) => ({ ...prev, phone: true }));
      return;
    }

    // Auto-generate email if left blank
    let finalEmail = email.trim();
    if (!finalEmail) {
      const sanitizedName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '.');
      finalEmail = `${sanitizedName}@enterprise.com`;
    }

    const finalPermanentAddress = sameAddressAsCurrent
      ? currentAddress.trim()
      : permanentAddress.trim();

    try {
      setSubmitting(true);
      await onSubmit({
        id: editUser?.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        photoUrl,
        dob: dob || undefined,
        age: age !== '' ? Number(age) : undefined,
        personalEmail: personalEmail.trim() || undefined,
        gender: gender || undefined,
        currentAddress: currentAddress.trim() || undefined,
        permanentAddress: finalPermanentAddress || undefined,
        address: currentAddress.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        bloodGroup: bloodGroup || undefined,
        employmentType,
        role,
        employeeCode: employeeCode.trim(),
        email: finalEmail,
        password: password ? password : isEditMode ? undefined : 'Password123!',
      });
      // Show success toast
      toast.success(
        isEditMode
          ? `Profile details for "${fullName.trim()}" updated successfully!`
          : `User account for "${fullName.trim()}" created successfully!`,
        isEditMode ? 'User Updated' : 'User Created'
      );
      // Only close on verified success!
      onClose();
    } catch (err: any) {
      console.error('CreateUserModal submit error:', err);
      // Clean visible error message
      let message = err.message || 'Failed to save user account. Please check inputs.';
      if (err.message && err.message.includes('request entity too large')) {
        message = 'The uploaded photo was too large for the server. It has been downscaled; please retry submission.';
      }
      setError(message);
      toast.error(message, isEditMode ? 'Update Failed' : 'Creation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative w-full max-w-2xl rounded-[24px] bg-white border border-[#E8EEF4] shadow-[0_20px_50px_rgba(15,23,42,0.18)] transition-all overflow-hidden flex flex-col max-h-[92vh]"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-[#F1F5F9] flex items-center justify-between bg-gradient-to-r from-white via-[#F8FAFC] to-[#F1F6FC]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center shadow-xs">
                {isEditMode ? (
                  <Pencil className="w-5 h-5 stroke-[2.2]" />
                ) : (
                  <User className="w-5 h-5 stroke-[2.2]" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#111827] tracking-tight">
                  {isEditMode ? `Edit Profile: ${editUser?.fullName}` : 'Register Workforce User'}
                </h2>
                <p className="text-xs text-[#6B7280] font-medium">
                  {isEditMode
                    ? 'Modify employee details, contact info, emergency numbers, and employment terms.'
                    : 'Enter personal, contact, emergency details, and login credentials.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white border border-[#E8EEF4] text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content - Scrollable */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
            {/* INTIMATION BANNER */}
            <div className="p-3.5 rounded-2xl bg-[#E6F7EF] border border-[#A7F3D0] text-[#0E8F5B] text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#12A66A]" />
              <div className="leading-relaxed">
                <span className="font-extrabold block text-[#065F46] mb-0.5">
                  Single Sign-On & Verification Note:
                </span>
                Mobile Number and Work Email are <strong>unique identifiers</strong>. Field workers can log in to the mobile attendance app using either their <strong>Mobile Number</strong> or <strong>Work Email</strong>.
              </div>
            </div>

            {/* ERROR BANNER */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start justify-between gap-3 animate-in fade-in shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-extrabold block text-rose-900 text-[13px] mb-0.5">
                      Failed to Save User:
                    </span>
                    <span className="leading-relaxed font-semibold">{error}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-600 hover:text-rose-800 text-xs font-bold shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* 1. PERSONAL INFORMATION & PHOTO */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#12A66A]" />
                  1. Personal Information
                </span>
                <span className="text-[11px] font-semibold text-[#64748B]">
                  * Required fields marked
                </span>
              </div>

              {/* Profile Photo (Optional) */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E8EEF4] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#374151] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#64748B]" />
                    Profile Photo
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      Optional
                    </span>
                  </label>
                  <span className="text-[11px] text-[#6B7280]">
                    {customPhotoSelected ? 'Custom image loaded (Optimized)' : 'Sample preset selected'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group shrink-0">
                    <img
                      src={photoUrl}
                      alt="Preview"
                      className="w-18 h-18 rounded-2xl object-cover border-2 border-[#12A66A] shadow-xs"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#12A66A] text-white p-1 rounded-full shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#334155] rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-2">
                        <Upload className="w-3.5 h-3.5 text-[#12A66A]" />
                        <span>Upload Custom Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={submitting}
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {PRESET_AVATARS.map((av, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setPhotoUrl(av.url);
                            setCustomPhotoSelected(false);
                          }}
                          className={`relative shrink-0 rounded-xl overflow-hidden transition-all cursor-pointer ${
                            photoUrl === av.url && !customPhotoSelected
                              ? 'ring-2 ring-[#12A66A] scale-105 shadow-xs'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={av.label}
                        >
                          <img
                            src={av.url}
                            alt={av.label}
                            className="w-9 h-9 object-cover rounded-xl"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Name & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">
                      Full Name <span className="text-rose-500 font-black">*</span>
                    </label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                      Required
                    </span>
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                    placeholder="e.g. Ramesh Kumar / Rachel Adams"
                    required
                    disabled={submitting}
                    className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 ${
                      touched.fullName && !fullName.trim()
                        ? 'border-rose-300 focus:border-rose-500'
                        : 'border-[#CBD5E1] focus:border-[#12A66A]'
                    }`}
                  />
                  {touched.fullName && !fullName.trim() && (
                    <span className="text-[10px] font-bold text-rose-600 block">
                      Full name is required.
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">Gender</label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                      Optional
                    </span>
                  </div>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={submitting}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] cursor-pointer"
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date of Birth, Age & Blood Group */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                      Date of Birth
                    </label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700">
                      Business Need
                    </span>
                  </div>
                  <input
                    type="date"
                    value={dob}
                    onChange={handleDobChange}
                    max={new Date().toISOString().split('T')[0]}
                    disabled={submitting}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#374151]">Age</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={16}
                      max={99}
                      value={age}
                      onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 28"
                      disabled={submitting}
                      className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                    />
                    <span className="absolute right-3 top-2.5 text-[11px] font-bold text-[#94A3B8]">
                      yrs
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151] flex items-center gap-1">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                      Blood Group
                    </label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                      Optional
                    </span>
                  </div>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    disabled={submitting}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] cursor-pointer"
                  >
                    <option value="">Not Specified</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. CONTACT INFORMATION & UNIQUE CREDENTIALS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#12A66A]" />
                  2. Contact & Login Credentials
                </span>
                <span className="text-[11px] font-bold text-[#12A66A]">
                  Worker Login Enabled
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Mobile Number (Required, Unique) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">
                      Mobile Number <span className="text-rose-500 font-black">*</span>
                    </label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#12A66A]">
                      Unique Login
                    </span>
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                      placeholder="+91 98765 43210"
                      required
                      disabled={submitting}
                      className={`w-full text-xs font-semibold pl-9 pr-3.5 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 ${
                        touched.phone && !phone.trim()
                          ? 'border-rose-300 focus:border-rose-500'
                          : 'border-[#CBD5E1] focus:border-[#12A66A]'
                      }`}
                    />
                  </div>
                  {touched.phone && !phone.trim() && (
                    <span className="text-[10px] font-bold text-rose-600 block">
                      Mobile number is mandatory for account login.
                    </span>
                  )}
                </div>

                {/* Personal Email (Optional) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">Personal Email</label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                      Optional
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      placeholder="personal.id@gmail.com"
                      disabled={submitting}
                      className="w-full text-xs font-medium pl-9 pr-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                    />
                  </div>
                </div>
              </div>

              {/* Work Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">
                      Work Email (Login Username)
                    </label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#12A66A]">
                      Unique Login
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@enterprise.com"
                      disabled={submitting}
                      className="w-full text-xs font-medium pl-9 pr-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">
                      {isEditMode ? 'New Password (Optional)' : 'Account Password'}
                    </label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {isEditMode ? 'Keep blank to preserve' : 'Default Available'}
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isEditMode ? '•••••••• (unchanged)' : 'Enter password'}
                      required={!isEditMode}
                      disabled={submitting}
                      className="w-full text-xs font-mono font-bold pl-9 pr-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. RESIDENTIAL & PERMANENT ADDRESS DETAILS */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#12A66A]" />
                  3. Address Details
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700">
                  Depends on business need
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#374151]">
                  Current Residential / Worksite Address
                </label>
                <textarea
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  placeholder="e.g. Flat 302, Green Glen Layout, Bellandur, Bengaluru - 560103"
                  rows={2}
                  disabled={submitting}
                  className="w-full text-xs font-medium p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                />
              </div>

              {/* Same address toggle */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="sameAddress"
                  checked={sameAddressAsCurrent}
                  onChange={(e) => setSameAddressAsCurrent(e.target.checked)}
                  disabled={submitting}
                  className="w-4 h-4 rounded text-[#12A66A] focus:ring-[#12A66A] border-slate-300 cursor-pointer"
                />
                <label
                  htmlFor="sameAddress"
                  className="text-xs font-semibold text-[#475569] cursor-pointer"
                >
                  Permanent address is same as current address
                </label>
              </div>

              {!sameAddressAsCurrent && (
                <div className="space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">Permanent Address</label>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                      Optional
                    </span>
                  </div>
                  <textarea
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="Enter native town or permanent residential address..."
                    rows={2}
                    disabled={submitting}
                    className="w-full text-xs font-medium p-3 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
                  />
                </div>
              )}
            </div>

            {/* 4. EMERGENCY CONTACT INFORMATION (RECOMMENDED) */}
            <div className="space-y-3.5 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  4. Emergency Contact
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  Recommended for Safety
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                Recommended by industrial safety regulations for prompt emergency site notification.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-950">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="e.g. Sunita Kumar (Spouse / Guardian)"
                    disabled={submitting}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-950">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="+91 98451 22334"
                    disabled={submitting}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. EMPLOYMENT TYPE & WORK ARRANGEMENT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#374151] flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-[#12A66A]" />
                  5. Employment Type & Terms
                </span>
                <span className="text-[11px] font-semibold text-[#64748B]">
                  Role & Work Terms
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {/* Full Time */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setEmploymentType('full-time')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    employmentType === 'full-time'
                      ? 'bg-[#E6F7EF] border-[#12A66A] text-[#12A66A] shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold block">Full-Time</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        employmentType === 'full-time'
                          ? 'border-[#12A66A] bg-[#12A66A] text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {employmentType === 'full-time' && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <span className="text-[10px] leading-tight opacity-80">
                    40h regular roster
                  </span>
                </button>

                {/* Part Time */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setEmploymentType('part-time')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    employmentType === 'part-time'
                      ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold block">Part-Time</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        employmentType === 'part-time'
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {employmentType === 'part-time' && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <span className="text-[10px] leading-tight opacity-80">
                    Flexible split shifts
                  </span>
                </button>

                {/* Contract */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setEmploymentType('contract')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    employmentType === 'contract'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold block">Contract</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        employmentType === 'contract'
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {employmentType === 'contract' && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <span className="text-[10px] leading-tight opacity-80">
                    Milestone or project
                  </span>
                </button>
              </div>

              {/* Role & Employee Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#374151]">System Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={submitting}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A] cursor-pointer"
                  >
                    <option value="WORKER">Field Worker</option>
                    <option value="SUPERVISOR">Site Supervisor</option>
                    <option value="ADMIN">Operations Admin</option>
                    <option value="SUPER_ADMIN">Super Administrator</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#374151]">Employee Code</label>
                    {!isEditMode && (
                      <button
                        type="button"
                        onClick={handleGenerateCode}
                        disabled={submitting}
                        className="text-[10px] font-bold text-[#12A66A] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Auto-gen
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white uppercase"
                  />
                </div>
              </div>
            </div>
          </form>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#111827] hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !fullName.trim() || !phone.trim()}
              className="px-6 py-2.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-xl text-xs font-extrabold shadow-[0_4px_12px_rgba(18,166,106,0.35)] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-98"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isEditMode ? 'Saving Changes...' : 'Registering User...'}</span>
                </>
              ) : (
                <>
                  {isEditMode ? (
                    <Pencil className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>{isEditMode ? 'Save & Update Profile' : 'Register & Save User'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

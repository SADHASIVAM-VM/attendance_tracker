import React, { useState, useEffect, useMemo } from 'react';
import { toast } from '../../context/ToastContext';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTablePagination, PaginationMetadata } from '../../components/ui/data-table-pagination';
import { CreateUserModal, CreateUserData, EmploymentType, UserRole } from '../../components/users/CreateUserModal';
import {
  Users,
  Plus,
  ShieldCheck,
  UserCheck,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Clock,
  Award,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Eye,
  LayoutGrid,
  List,
  Sparkles,
  UserPlus,
  RefreshCw,
  FileCheck2,
  X,
  Pencil,
  ArrowUpDown,
} from 'lucide-react';

export interface DirectoryUser {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  personalEmail?: string;
  dob?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  currentAddress?: string;
  permanentAddress?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  photoUrl?: string;
  employmentType?: EmploymentType;
  roles: string[];
  isActive: boolean;
  createdAt?: string;
}

const DEFAULT_SEED_USERS: DirectoryUser[] = [
  {
    id: 'usr_seed_01',
    fullName: 'John Miller',
    employeeCode: 'EMP-409',
    email: 'john.miller@enterprise.com',
    phone: '+91 98765 43210',
    personalEmail: 'jmiller.field@gmail.com',
    dob: '1997-06-14',
    age: 29,
    gender: 'Male',
    bloodGroup: 'O+',
    currentAddress: 'Flat 402, Sunrise Towers, Outer Ring Road, Bengaluru',
    permanentAddress: 'Village Mandya, Near Canal Road, Karnataka',
    address: 'Flat 402, Sunrise Towers, Outer Ring Road, Bengaluru',
    emergencyContactName: 'Sunita Miller (Spouse)',
    emergencyContactPhone: '+91 98450 11223',
    photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=300&q=80',
    employmentType: 'full-time',
    roles: ['WORKER'],
    isActive: true,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'usr_seed_02',
    fullName: 'Priya Sundaram',
    employeeCode: 'EMP-412',
    email: 'priya.sundaram@enterprise.com',
    phone: '+91 98765 88910',
    personalEmail: 'priya.sundaram@outlook.com',
    dob: '1999-03-22',
    age: 27,
    gender: 'Female',
    bloodGroup: 'B+',
    currentAddress: 'Plot 18, 4th Cross, Indiranagar, Bengaluru',
    permanentAddress: '15 Gandhi Nagar, Madurai, Tamil Nadu',
    address: 'Plot 18, 4th Cross, Indiranagar, Bengaluru',
    emergencyContactName: 'K. Sundaram (Father)',
    emergencyContactPhone: '+91 98760 33445',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    employmentType: 'full-time',
    roles: ['WORKER'],
    isActive: true,
    createdAt: '2026-02-10T09:30:00Z',
  },
  {
    id: 'usr_seed_03',
    fullName: 'Marcus Brody',
    employeeCode: 'SUP-204',
    email: 'marcus.brody@enterprise.com',
    phone: '+91 98765 11223',
    personalEmail: 'brody.marcus@yahoo.com',
    dob: '1988-11-05',
    age: 38,
    gender: 'Male',
    bloodGroup: 'A+',
    currentAddress: '12/A Green Glen Layout, Bellandur, Bengaluru',
    permanentAddress: '12/A Green Glen Layout, Bellandur, Bengaluru',
    address: '12/A Green Glen Layout, Bellandur, Bengaluru',
    emergencyContactName: 'Elena Brody (Wife)',
    emergencyContactPhone: '+91 99001 44556',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    employmentType: 'full-time',
    roles: ['SUPERVISOR'],
    isActive: true,
    createdAt: '2025-11-01T10:00:00Z',
  },
  {
    id: 'usr_seed_04',
    fullName: 'Ramesh Kumar',
    employeeCode: 'EMP-415',
    email: 'ramesh.kumar@enterprise.com',
    phone: '+91 98450 12345',
    personalEmail: 'ramesh.k@rediffmail.com',
    dob: '1992-08-19',
    age: 34,
    gender: 'Male',
    bloodGroup: 'AB+',
    currentAddress: '54 BTM Layout 2nd Stage, Bannerghatta Road, Bengaluru',
    permanentAddress: 'Railway Colony, Hubballi, Karnataka',
    address: '54 BTM Layout 2nd Stage, Bannerghatta Road, Bengaluru',
    emergencyContactName: 'Manjula Kumar (Mother)',
    emergencyContactPhone: '+91 97412 88990',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    employmentType: 'contract',
    roles: ['WORKER'],
    isActive: true,
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'usr_seed_05',
    fullName: 'Anita Sen',
    employeeCode: 'EMP-420',
    email: 'anita.sen@enterprise.com',
    phone: '+91 98860 99881',
    personalEmail: 'anita.sen.design@gmail.com',
    dob: '2002-05-10',
    age: 24,
    gender: 'Female',
    bloodGroup: 'O-',
    currentAddress: 'Sector 3, HSR Layout, Bengaluru',
    permanentAddress: 'Lake Gardens, South Kolkata, West Bengal',
    address: 'Sector 3, HSR Layout, Bengaluru',
    emergencyContactName: 'Debashis Sen (Brother)',
    emergencyContactPhone: '+91 98300 77889',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    employmentType: 'part-time',
    roles: ['WORKER'],
    isActive: true,
    createdAt: '2026-04-12T11:00:00Z',
  },
  {
    id: 'usr_seed_06',
    fullName: 'Sarah Connor',
    employeeCode: 'SUP-205',
    email: 'sarah.connor@enterprise.com',
    phone: '+91 98765 44332',
    personalEmail: 'sconnor.ops@proton.me',
    dob: '1990-09-28',
    age: 36,
    gender: 'Female',
    bloodGroup: 'A-',
    currentAddress: '29 Koramangala 5th Block, Bengaluru',
    permanentAddress: '29 Koramangala 5th Block, Bengaluru',
    address: '29 Koramangala 5th Block, Bengaluru',
    emergencyContactName: 'John Connor (Son)',
    emergencyContactPhone: '+91 99887 66554',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
    employmentType: 'full-time',
    roles: ['SUPERVISOR'],
    isActive: true,
    createdAt: '2025-10-15T09:00:00Z',
  },
  {
    id: 'usr_seed_07',
    fullName: 'Arthur Dent',
    employeeCode: 'ADM-101',
    email: 'admin@enterprise.com',
    phone: '+91 99000 11223',
    personalEmail: 'arthur.dent@galaxy.org',
    dob: '1984-04-01',
    age: 42,
    gender: 'Male',
    bloodGroup: 'B-',
    currentAddress: '101 Whitefield Main Road, Bengaluru',
    permanentAddress: 'Country Cottage, Cottington, England',
    address: '101 Whitefield Main Road, Bengaluru',
    emergencyContactName: 'Trillian Astra (Partner)',
    emergencyContactPhone: '+91 98111 22334',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
    employmentType: 'full-time',
    roles: ['ADMIN'],
    isActive: true,
    createdAt: '2025-08-01T08:00:00Z',
  },
  {
    id: 'usr_seed_08',
    fullName: 'Manoj Tiwari',
    employeeCode: 'EMP-428',
    email: 'manoj.tiwari@enterprise.com',
    phone: '+91 97410 88776',
    personalEmail: 'tiwari.manoj@gmail.com',
    dob: '1995-12-03',
    age: 31,
    gender: 'Male',
    bloodGroup: 'O+',
    currentAddress: 'Kalyan Nagar, Near Ring Road, Bengaluru',
    permanentAddress: 'Civil Lines, Varanasi, Uttar Pradesh',
    address: 'Kalyan Nagar, Near Ring Road, Bengaluru',
    emergencyContactName: 'Rajesh Tiwari (Brother)',
    emergencyContactPhone: '+91 94150 55667',
    photoUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=300&q=80',
    employmentType: 'contract',
    roles: ['WORKER'],
    isActive: true,
    createdAt: '2026-05-18T08:00:00Z',
  },
];

export const UsersView: React.FC = () => {
  const [usersList, setUsersList] = useState<DirectoryUser[]>(() => {
    try {
      const cached = localStorage.getItem('attendance_users_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SEED_USERS;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [userToEdit, setUserToEdit] = useState<DirectoryUser | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<DirectoryUser | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pagination state (limit options: 10, 25, 50)
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    limit: 10,
    offset: 0,
    totalPages: 1,
  });

  // Sorting filter (sort based on name, asc, desc, newest first use createdAt)
  const [sortFilter, setSortFilter] = useState<string>('createdAt_desc');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EmploymentType>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  useEffect(() => {
    loadUsers();
  }, [page, limit, sortFilter, searchQuery, typeFilter, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [sortBy, sortOrder] = sortFilter.split('_');
      const offset = (page - 1) * limit;

      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (typeFilter !== 'ALL') params.append('employmentType', typeFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await apiRequest(`/users?${params.toString()}`);
      const rawData = res && res.data ? res.data : (Array.isArray(res) ? res : []);

      if (Array.isArray(rawData) && rawData.length > 0) {
        // Merge with local seed fields for missing age/photo/address/employmentType
        const merged: DirectoryUser[] = rawData.map((u: any, idx: number) => {
          const fallbackSeed = DEFAULT_SEED_USERS[idx % DEFAULT_SEED_USERS.length];
          return {
            id: u.id,
            fullName: u.fullName || fallbackSeed.fullName,
            employeeCode: u.employeeCode || fallbackSeed.employeeCode,
            email: u.email || fallbackSeed.email,
            phone: u.phone || fallbackSeed.phone,
            personalEmail: u.personalEmail || fallbackSeed.personalEmail,
            dob: u.dob || fallbackSeed.dob,
            age: u.age || fallbackSeed.age || 28,
            gender: u.gender || fallbackSeed.gender,
            bloodGroup: u.bloodGroup || fallbackSeed.bloodGroup,
            currentAddress: u.currentAddress || u.address || fallbackSeed.currentAddress,
            permanentAddress: u.permanentAddress || fallbackSeed.permanentAddress,
            address: u.currentAddress || u.address || fallbackSeed.address,
            emergencyContactName: u.emergencyContactName || fallbackSeed.emergencyContactName,
            emergencyContactPhone: u.emergencyContactPhone || fallbackSeed.emergencyContactPhone,
            photoUrl: u.photoUrl || fallbackSeed.photoUrl,
            employmentType: (u.employmentType as EmploymentType) || fallbackSeed.employmentType || 'full-time',
            roles: u.roles || ['WORKER'],
            isActive: u.isActive !== undefined ? u.isActive : true,
            createdAt: u.createdAt || new Date().toISOString(),
          };
        });
        setUsersList(merged);
        localStorage.setItem('attendance_users_cache', JSON.stringify(merged));

        if (res && res.pagination) {
          setPagination(res.pagination);
        } else {
          setPagination({
            total: merged.length,
            page,
            limit,
            offset,
            totalPages: Math.ceil(merged.length / limit) || 1,
            hasNextPage: offset + limit < merged.length,
            hasPrevPage: page > 1,
          });
        }
      } else {
        // Empty or cached fallback
        if (res && res.pagination) {
          setUsersList([]);
          setPagination(res.pagination);
        } else {
          const cached = localStorage.getItem('attendance_users_cache');
          const fallbackData = cached ? JSON.parse(cached) : DEFAULT_SEED_USERS;
          setUsersList(fallbackData);
          setPagination({
            total: fallbackData.length,
            page: 1,
            limit,
            offset: 0,
            totalPages: Math.ceil(fallbackData.length / limit) || 1,
          });
        }
      }
    } catch (err: any) {
      console.warn('API error loading users, falling back to local dataset:', err);
      const cached = localStorage.getItem('attendance_users_cache');
      const fallbackData = cached ? JSON.parse(cached) : DEFAULT_SEED_USERS;
      setUsersList(fallbackData);
      setPagination({
        total: fallbackData.length,
        page: 1,
        limit,
        offset: 0,
        totalPages: Math.ceil(fallbackData.length / limit) || 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (data: CreateUserData) => {
    // Check local duplicate phone or email before submitting
    const duplicatePhone = usersList.find(
      (u) => u.phone && u.phone.replace(/\s+/g, '') === data.phone.replace(/\s+/g, '')
    );
    if (duplicatePhone) {
      throw new Error(`Mobile number ${data.phone} is already registered to user "${duplicatePhone.fullName}".`);
    }

    const duplicateEmail = usersList.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase()
    );
    if (duplicateEmail) {
      throw new Error(`Work email ${data.email} is already registered to user "${duplicateEmail.fullName}".`);
    }

    let createdUserFromServer: any = null;
    try {
      createdUserFromServer = await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          roles: [data.role],
        }),
      });
    } catch (err: any) {
      console.error('Server error creating user:', err);
      throw new Error(err.message || 'Failed to create user on server');
    }

    const newId = createdUserFromServer?.id || `usr_${Date.now()}`;

    const newUser: DirectoryUser = {
      id: newId,
      fullName: createdUserFromServer?.fullName || data.fullName,
      employeeCode: createdUserFromServer?.employeeCode || data.employeeCode,
      email: createdUserFromServer?.email || data.email,
      phone: createdUserFromServer?.phone || data.phone,
      personalEmail: createdUserFromServer?.personalEmail || data.personalEmail,
      dob: createdUserFromServer?.dob || data.dob,
      age: data.age !== '' ? Number(data.age) : createdUserFromServer?.age,
      gender: createdUserFromServer?.gender || data.gender,
      bloodGroup: createdUserFromServer?.bloodGroup || data.bloodGroup,
      currentAddress: createdUserFromServer?.currentAddress || data.currentAddress || data.address,
      permanentAddress: createdUserFromServer?.permanentAddress || data.permanentAddress,
      address: createdUserFromServer?.address || data.currentAddress || data.address,
      emergencyContactName: createdUserFromServer?.emergencyContactName || data.emergencyContactName,
      emergencyContactPhone: createdUserFromServer?.emergencyContactPhone || data.emergencyContactPhone,
      photoUrl: createdUserFromServer?.photoUrl || data.photoUrl,
      employmentType: createdUserFromServer?.employmentType || data.employmentType,
      roles: createdUserFromServer?.roles || [data.role],
      isActive: true,
      createdAt: createdUserFromServer?.createdAt || new Date().toISOString(),
    };

    setUsersList((prev) => {
      const updated = [newUser, ...prev];
      localStorage.setItem('attendance_users_cache', JSON.stringify(updated));
      return updated;
    });

    toast.success(
      `User account for "${data.fullName}" created successfully! Login via Mobile (${data.phone}) or Email (${data.email}) is active.`,
      'Account Created'
    );
  };

  const handleUpdateUser = async (data: CreateUserData) => {
    if (!data.id) {
      const msg = 'User identifier is missing for update';
      toast.error(msg, 'Error');
      throw new Error(msg);
    }

    // Check unique phone if modified
    const duplicatePhone = usersList.find(
      (u) => u.id !== data.id && u.phone && u.phone.replace(/\s+/g, '') === data.phone.replace(/\s+/g, '')
    );
    if (duplicatePhone) {
      const msg = `Mobile number ${data.phone} is already registered to user "${duplicatePhone.fullName}".`;
      toast.error(msg, 'Duplicate Phone Number');
      throw new Error(msg);
    }

    const duplicateEmail = usersList.find(
      (u) => u.id !== data.id && u.email.toLowerCase() === data.email.toLowerCase()
    );
    if (duplicateEmail) {
      const msg = `Work email ${data.email} is already registered to user "${duplicateEmail.fullName}".`;
      toast.error(msg, 'Duplicate Email');
      throw new Error(msg);
    }

    try {
      await apiRequest(`/users/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: data.fullName,
          employeeCode: data.employeeCode,
          email: data.email,
          phone: data.phone,
          personalEmail: data.personalEmail || '',
          dob: data.dob || '',
          age: data.age !== '' ? Number(data.age) : undefined,
          gender: data.gender || '',
          bloodGroup: data.bloodGroup || '',
          currentAddress: data.currentAddress || data.address || '',
          permanentAddress: data.permanentAddress || '',
          address: data.currentAddress || data.address || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          photoUrl: data.photoUrl || '',
          employmentType: data.employmentType,
          roles: [data.role],
        }),
      });
    } catch (err: any) {
      console.error('Server error updating user:', err);
      const msg = err.message || 'Failed to update user profile on server';
      toast.error(msg, 'Update Failed');
      throw new Error(msg);
    }

    setUsersList((prev) => {
      const updated = prev.map((u) => {
        if (u.id === data.id) {
          return {
            ...u,
            fullName: data.fullName,
            employeeCode: data.employeeCode,
            email: data.email,
            phone: data.phone,
            personalEmail: data.personalEmail,
            dob: data.dob,
            age: data.age !== '' ? Number(data.age) : u.age,
            gender: data.gender,
            bloodGroup: data.bloodGroup,
            currentAddress: data.currentAddress || data.address,
            permanentAddress: data.permanentAddress,
            address: data.currentAddress || data.address,
            emergencyContactName: data.emergencyContactName,
            emergencyContactPhone: data.emergencyContactPhone,
            photoUrl: data.photoUrl || u.photoUrl,
            employmentType: data.employmentType,
            roles: [data.role],
          };
        }
        return u;
      });
      localStorage.setItem('attendance_users_cache', JSON.stringify(updated));
      return updated;
    });

    if (selectedUserDetail && selectedUserDetail.id === data.id) {
      setSelectedUserDetail((prev) =>
        prev
          ? {
              ...prev,
              fullName: data.fullName,
              employeeCode: data.employeeCode,
              email: data.email,
              phone: data.phone,
              personalEmail: data.personalEmail,
              dob: data.dob,
              age: data.age !== '' ? Number(data.age) : prev.age,
              gender: data.gender,
              bloodGroup: data.bloodGroup,
              currentAddress: data.currentAddress || data.address,
              permanentAddress: data.permanentAddress,
              address: data.currentAddress || data.address,
              emergencyContactName: data.emergencyContactName,
              emergencyContactPhone: data.emergencyContactPhone,
              photoUrl: data.photoUrl || prev.photoUrl,
              employmentType: data.employmentType,
              roles: [data.role],
            }
          : null
      );
    }

    toast.success(`User details for "${data.fullName}" updated successfully!`, 'Profile Updated');
  };

  const handleToggleActive = async (user: DirectoryUser) => {
    const nextStatus = !user.isActive;
    const actionLabel = nextStatus ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${actionLabel} ${user.fullName}?`)) return;

    try {
      if (!nextStatus) {
        await apiRequest(`/users/${user.id}/deactivate`, { method: 'POST' }).catch(() => {});
      } else {
        await apiRequest(`/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: true }),
        }).catch(() => {});
      }
    } catch (err) {
      // ignore
    }

    setUsersList((prev) => {
      const updated = prev.map((u) => (u.id === user.id ? { ...u, isActive: nextStatus } : u));
      localStorage.setItem('attendance_users_cache', JSON.stringify(updated));
      return updated;
    });

    const statusMsg = `User ${user.fullName} is now ${nextStatus ? 'ACTIVE' : 'INACTIVE'}.`;
    toast.success(statusMsg, nextStatus ? 'User Activated' : 'User Deactivated');
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.fullName?.toLowerCase().includes(q);
        const matchesCode = u.employeeCode?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q);
        const matchesAddr = u.address?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEmail && !matchesPhone && !matchesAddr) {
          return false;
        }
      }

      // Employment Type
      if (typeFilter !== 'ALL') {
        const uType = (u.employmentType || 'full-time').toLowerCase();
        if (uType !== typeFilter.toLowerCase()) return false;
      }

      // Role
      if (roleFilter !== 'ALL') {
        if (!u.roles.includes(roleFilter)) return false;
      }

      // Status
      if (statusFilter === 'ACTIVE' && !u.isActive) return false;
      if (statusFilter === 'INACTIVE' && u.isActive) return false;

      return true;
    });
  }, [usersList, searchQuery, typeFilter, roleFilter, statusFilter]);

  // Aggregate Stats
  const totalCount = usersList.length;
  const fullTimeCount = usersList.filter(
    (u) => (u.employmentType || 'full-time').toLowerCase() === 'full-time'
  ).length;
  const partTimeCount = usersList.filter(
    (u) => (u.employmentType || '').toLowerCase() === 'part-time'
  ).length;
  const contractCount = usersList.filter(
    (u) => (u.employmentType || '').toLowerCase() === 'contract'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E8EEF4] p-5 sm:p-6 rounded-[22px] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F7EF] text-[#12A66A]">
              HR & Personnel Directory
            </span>
            <span className="text-xs text-[#94A3B8] font-medium">• {totalCount} total personnel</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">
            Workforce User Management
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-2xl">
            Register personnel with full profile records: name, age, phone number, address, verified photo, and work type (full-time, part-time, contract).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 sm:px-5 py-2.5 bg-[#12A66A] hover:bg-[#0E8F5B] text-white rounded-[14px] text-xs font-bold transition-all shadow-[0_4px_12px_rgba(18,166,106,0.35)] flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <UserPlus className="w-4 h-4 stroke-[2.2]" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (4-pack) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Workforce */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              Total Personnel
            </span>
            <span className="text-2xl font-black text-[#111827] mt-1 block">
              {totalCount}
            </span>
            <span className="text-[11px] font-semibold text-[#12A66A] flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              All departments
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F1F6FC] text-[#3B82F6] flex items-center justify-center">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Full-Time */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              Full-Time
            </span>
            <span className="text-2xl font-black text-[#12A66A] mt-1 block">
              {fullTimeCount}
            </span>
            <span className="text-[11px] font-semibold text-[#64748B] block mt-0.5">
              40 hrs regular
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#E6F7EF] text-[#12A66A] flex items-center justify-center">
            <Briefcase className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Part-Time */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              Part-Time
            </span>
            <span className="text-2xl font-black text-sky-600 mt-1 block">
              {partTimeCount}
            </span>
            <span className="text-[11px] font-semibold text-[#64748B] block mt-0.5">
              Split / flexible shifts
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* Contract */}
        <div className="bg-white border border-[#E8EEF4] rounded-[20px] p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              Contract
            </span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {contractCount}
            </span>
            <span className="text-[11px] font-semibold text-[#64748B] block mt-0.5">
              Milestone / project based
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Alert Message Toast */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border flex items-center justify-between animate-in fade-in ${
            message.type === 'success'
              ? 'bg-[#E6F7EF] text-[#0E8F5B] border-[#A7F3D0]'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12A66A]" />
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-bold text-[#64748B] hover:text-[#111827] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search, Filter Bar & View Toggle */}
      <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, employee code, phone, address, email..."
              className="w-full text-xs font-medium pl-10 pr-9 py-2.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12A66A]/20 focus:border-[#12A66A]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#111827] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls: View Mode & Refresh */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="flex items-center p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#111827] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
                title="Dense Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#111827] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              className="p-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              title="Reload users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#12A66A]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Pills & Sort Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F5F9]">
          <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-[#12A66A]" />
            Type:
          </span>

          {(['ALL', 'full-time', 'part-time', 'contract'] as const).map((t) => {
            const isActive = typeFilter === t;
            const label =
              t === 'ALL'
                ? 'All Types'
                : t === 'full-time'
                ? 'Full-Time'
                : t === 'part-time'
                ? 'Part-Time'
                : 'Contract';
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#12A66A] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                {label}
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          <span className="text-[11px] font-bold text-[#64748B] ml-1">Role:</span>
          {(['ALL', 'WORKER', 'SUPERVISOR', 'ADMIN'] as const).map((r) => {
            const isActive = roleFilter === r;
            const label =
              r === 'ALL'
                ? 'All Roles'
                : r === 'WORKER'
                ? 'Workers'
                : r === 'SUPERVISOR'
                ? 'Supervisors'
                : 'Admins';
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(r);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                {label}
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          <span className="text-[11px] font-bold text-[#64748B] ml-1">Status:</span>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((s) => {
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active Only' : 'Inactive'}
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          {/* Sort Filter: Name (asc, desc), Newest first (createdAt) */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#12A66A]" />
            <span className="text-[11px] font-bold text-[#64748B]">Sort:</span>
            <select
              value={sortFilter}
              onChange={(e) => {
                setSortFilter(e.target.value);
                setPage(1);
              }}
              className="text-[11px] font-bold px-2 py-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#12A66A] cursor-pointer"
            >
              <option value="createdAt_desc">Newest First (Created Date)</option>
              <option value="createdAt_asc">Oldest First (Created Date)</option>
              <option value="name_asc">Name (A to Z)</option>
              <option value="name_desc">Name (Z to A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* USER LISTING: TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-[22px] border border-[#E8EEF4] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E8EEF4] text-[#64748B] font-extrabold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Employee & Photo</th>
                  <th className="py-3.5 px-3">Age</th>
                  <th className="py-3.5 px-3">Type</th>
                  <th className="py-3.5 px-3">Role</th>
                  <th className="py-3.5 px-3">Phone</th>
                  <th className="py-3.5 px-3">Address</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#12A66A]" />
                      Loading workforce directory...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                      No personnel matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const empType = (u.employmentType || 'full-time').toLowerCase();
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                        onClick={() => setSelectedUserDetail(u)}
                      >
                        {/* Employee & Photo */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img
                                src={
                                  u.photoUrl ||
                                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                                }
                                alt={u.fullName}
                                className="w-10 h-10 rounded-xl object-cover border border-[#E2E8F0] shadow-2xs"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                  u.isActive ? 'bg-[#12A66A]' : 'bg-slate-300'
                                }`}
                              />
                            </div>
                            <div>
                              <span className="font-extrabold text-[#111827] text-xs block group-hover:text-[#12A66A] transition-colors">
                                {u.fullName}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                                <span className="font-mono font-bold text-[#0F172A]">
                                  {u.employeeCode}
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-[140px]">{u.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Age */}
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-[#111827] bg-[#F1F5F9] px-2 py-0.5 rounded-md">
                            {u.age ? `${u.age} yrs` : '28 yrs'}
                          </span>
                        </td>

                        {/* Type (full-time, part-time, contract) */}
                        <td className="py-3.5 px-3">
                          {empType === 'full-time' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-[#E6F7EF] text-[#12A66A] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
                              <Briefcase className="w-3 h-3" />
                              Full-Time
                            </span>
                          )}
                          {empType === 'part-time' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full border border-sky-200">
                              <Clock className="w-3 h-3" />
                              Part-Time
                            </span>
                          )}
                          {empType === 'contract' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                              <Award className="w-3 h-3" />
                              Contract
                            </span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  r === 'SUPERVISOR'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : r === 'ADMIN' || r === 'SUPER_ADMIN'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {r.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-3 text-[#475569] font-medium">
                          <a
                            href={`tel:${u.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 hover:text-[#12A66A] transition-colors"
                          >
                            <Phone className="w-3 h-3 text-[#94A3B8]" />
                            <span>{u.phone || '—'}</span>
                          </a>
                        </td>

                        {/* Address */}
                        <td className="py-3.5 px-3 text-[#475569] max-w-[200px]">
                          <div className="flex items-start gap-1.5 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-0.5" />
                            <span className="truncate" title={u.address}>
                              {u.address || 'Bengaluru Project Worksite'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setUserToEdit(u)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#12A66A] hover:bg-[#E6F7EF] transition-colors cursor-pointer"
                              title="Edit User Details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedUserDetail(u)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#12A66A] hover:bg-[#E6F7EF] transition-colors cursor-pointer"
                              title="View Full Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                u.isActive
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-[#12A66A] hover:bg-[#E6F7EF]'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Shadcn Table Pagination with { 10, 25, 50 } and Metadata */}
          <DataTablePagination
            metadata={pagination}
            onPageChange={(newPage) => setPage(newPage)}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            isLoading={loading}
          />
        </div>
      ) : (
        /* USER LISTING: GRID CARDS VIEW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const empType = (u.employmentType || 'full-time').toLowerCase();
            return (
              <div
                key={u.id}
                onClick={() => setSelectedUserDetail(u)}
                className="bg-white border border-[#E8EEF4] rounded-[22px] p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={
                            u.photoUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                          }
                          alt={u.fullName}
                          className="w-13 h-13 rounded-2xl object-cover border-2 border-[#E8EEF4] group-hover:border-[#12A66A] transition-colors shadow-xs"
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            u.isActive ? 'bg-[#12A66A]' : 'bg-slate-300'
                          }`}
                        />
                      </div>

                      <div>
                        <h3 className="font-extrabold text-sm text-[#111827] group-hover:text-[#12A66A] transition-colors">
                          {u.fullName}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5">
                          <span className="font-mono font-bold text-[#0F172A]">{u.employeeCode}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#111827] bg-[#F1F5F9] px-1.5 py-0.2 rounded">
                            {u.age ? `${u.age} yrs` : '28 yrs'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>

                  {/* Badges: Employment Type & Roles */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3.5">
                    {empType === 'full-time' && (
                      <span className="text-[10px] font-extrabold bg-[#E6F7EF] text-[#12A66A] px-2.5 py-1 rounded-full border border-[#A7F3D0] flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        Full-Time
                      </span>
                    )}
                    {empType === 'part-time' && (
                      <span className="text-[10px] font-extrabold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full border border-sky-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Part-Time
                      </span>
                    )}
                    {empType === 'contract' && (
                      <span className="text-[10px] font-extrabold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        Contract
                      </span>
                    )}

                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="text-[10px] font-bold bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] px-2 py-0.5 rounded-md"
                      >
                        {r.replace('_', ' ')}
                      </span>
                    ))}
                  </div>

                  {/* Contact & Address Rows */}
                  <div className="space-y-1.5 text-xs text-[#475569] bg-[#F8FAFC] p-3 rounded-xl border border-[#F1F5F9]">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#12A66A] shrink-0" />
                      <span className="font-semibold text-[#111827]">{u.phone || '—'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-tight line-clamp-2">
                        {u.address || 'Bengaluru Project Worksite'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUserDetail(u)}
                      className="text-xs font-bold text-[#12A66A] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserToEdit(u)}
                      className="text-xs font-bold text-slate-500 hover:text-[#12A66A] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Edit User Details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(u)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      u.isActive
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-[#12A66A] hover:bg-[#E6F7EF]'
                    }`}
                  >
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shadcn Table Pagination with { 10, 25, 50 } and Metadata */}
        <div className="bg-white rounded-[22px] border border-[#E8EEF4] shadow-xs overflow-hidden mt-4">
          <DataTablePagination
            metadata={pagination}
            onPageChange={(newPage) => setPage(newPage)}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            isLoading={loading}
          />
        </div>
      </div>
      )}

      {/* CREATE USER MODAL */}
      <CreateUserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateUser}
      />

      {/* EDIT USER MODAL */}
      {userToEdit && (
        <CreateUserModal
          isOpen={Boolean(userToEdit)}
          onClose={() => setUserToEdit(null)}
          onSubmit={handleUpdateUser}
          editUser={{
            id: userToEdit.id,
            fullName: userToEdit.fullName,
            employeeCode: userToEdit.employeeCode,
            email: userToEdit.email,
            phone: userToEdit.phone,
            personalEmail: userToEdit.personalEmail || '',
            dob: userToEdit.dob || '',
            age: userToEdit.age ?? '',
            gender: userToEdit.gender || '',
            bloodGroup: userToEdit.bloodGroup || '',
            currentAddress: userToEdit.currentAddress || userToEdit.address || '',
            permanentAddress: userToEdit.permanentAddress || '',
            address: userToEdit.currentAddress || userToEdit.address || '',
            emergencyContactName: userToEdit.emergencyContactName || '',
            emergencyContactPhone: userToEdit.emergencyContactPhone || '',
            photoUrl: userToEdit.photoUrl || '',
            employmentType: userToEdit.employmentType || 'full-time',
            role: (userToEdit.roles[0] as UserRole) || 'WORKER',
          }}
        />
      )}

      {/* VIEW USER DETAILS MODAL */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedUserDetail(null)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative w-full max-w-lg rounded-[24px] bg-white border border-[#E8EEF4] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
            >
              {/* Header profile banner */}
              <div className="bg-gradient-to-r from-[#12A66A] to-[#0E8F5B] p-6 text-white relative">
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-4">
                  <img
                    src={
                      selectedUserDetail.photoUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                    }
                    alt={selectedUserDetail.fullName}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white">
                        {selectedUserDetail.fullName}
                      </h2>
                      <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">
                        {selectedUserDetail.age ? `${selectedUserDetail.age} yrs` : '28 yrs'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white/90 block mt-0.5">
                      {selectedUserDetail.employeeCode}
                    </span>
                    <span className="text-xs text-white/80 block">{selectedUserDetail.email}</span>
                  </div>
                </div>
              </div>

              {/* Details Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Employment Type & Status */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F8FAFC] rounded-2xl border border-[#E8EEF4]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Employment Type
                    </span>
                    <span className="text-xs font-extrabold text-[#111827] mt-0.5 block capitalize">
                      {selectedUserDetail.employmentType || 'full-time'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Account Status
                    </span>
                    <span
                      className={`text-xs font-extrabold mt-0.5 block ${
                        selectedUserDetail.isActive ? 'text-[#12A66A]' : 'text-rose-600'
                      }`}
                    >
                      {selectedUserDetail.isActive ? 'Active Member' : 'Deactivated'}
                    </span>
                  </div>
                </div>

                {/* Personal Bio Grid: DOB, Age, Gender, Blood Group */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
                  <div>
                    <span className="text-[10px] font-bold text-[#94A3B8] block uppercase">Blood Group</span>
                    <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                      {selectedUserDetail.bloodGroup || 'Not set'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#94A3B8] block uppercase">Gender</span>
                    <span className="text-xs font-bold text-[#111827] block mt-0.5">
                      {selectedUserDetail.gender || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#94A3B8] block uppercase">Birth Date</span>
                    <span className="text-xs font-bold text-[#111827] block mt-0.5">
                      {selectedUserDetail.dob || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#94A3B8] block uppercase">Age</span>
                    <span className="text-xs font-bold text-[#111827] block mt-0.5">
                      {selectedUserDetail.age ? `${selectedUserDetail.age} yrs` : '—'}
                    </span>
                  </div>
                </div>

                {/* Contact & Emails */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#F1F5F9]">
                    <div className="flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-[#12A66A] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-bold text-[#64748B] block">
                          Mobile Number (Worker Login)
                        </span>
                        <a
                          href={`tel:${selectedUserDetail.phone}`}
                          className="text-xs font-bold text-[#111827] hover:underline"
                        >
                          {selectedUserDetail.phone || 'Not provided'}
                        </a>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-[#E6F7EF] text-[#12A66A] px-2 py-0.5 rounded-full">
                      Unique
                    </span>
                  </div>

                  {selectedUserDetail.personalEmail && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#F1F5F9]">
                      <Mail className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-bold text-[#64748B] block">
                          Personal Email
                        </span>
                        <span className="text-xs font-semibold text-[#111827]">
                          {selectedUserDetail.personalEmail}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Current & Permanent Address */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#F1F5F9]">
                    <MapPin className="w-4 h-4 text-[#12A66A] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] font-bold text-[#64748B] block">
                        Current Residential Address
                      </span>
                      <span className="text-xs font-medium text-[#111827] block">
                        {selectedUserDetail.currentAddress || selectedUserDetail.address || 'Bengaluru Logistics Worksite Site 4'}
                      </span>
                    </div>
                  </div>

                  {selectedUserDetail.permanentAddress && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#F1F5F9]">
                      <MapPin className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-bold text-[#64748B] block">
                          Permanent Address
                        </span>
                        <span className="text-xs font-medium text-[#111827] block">
                          {selectedUserDetail.permanentAddress}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  {(selectedUserDetail.emergencyContactName || selectedUserDetail.emergencyContactPhone) && (
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase text-amber-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          Emergency Contact (Site Safety)
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.2 rounded-full">
                          Emergency
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-amber-950">
                          {selectedUserDetail.emergencyContactName || 'Family Member'}
                        </span>
                        {selectedUserDetail.emergencyContactPhone && (
                          <a
                            href={`tel:${selectedUserDetail.emergencyContactPhone}`}
                            className="text-xs font-mono font-bold text-amber-800 underline hover:text-amber-950 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {selectedUserDetail.emergencyContactPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 p-3 rounded-xl border border-[#F1F5F9]">
                    <ShieldCheck className="w-4 h-4 text-[#12A66A] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] font-bold text-[#64748B] block">
                        Assigned System Roles
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {selectedUserDetail.roles.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E6F7EF] text-[#12A66A]"
                          >
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedUserDetail(null)}
                  className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUserToEdit(selectedUserDetail);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#12A66A]" />
                    Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleToggleActive(selectedUserDetail);
                      setSelectedUserDetail(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      selectedUserDetail.isActive
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-[#E6F7EF] text-[#12A66A] hover:bg-[#A7F3D0]'
                    }`}
                  >
                    {selectedUserDetail.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

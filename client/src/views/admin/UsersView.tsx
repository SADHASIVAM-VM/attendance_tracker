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
  SlidersHorizontal,
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
import { SearchIcon } from '@astraicons/react/linear';
import { StatCard } from '../../components/common/StatCard';

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

export const getRoleBadgeClasses = (role: string) => {
  switch (role) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    case 'SUPERVISOR':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'ENGINEER':
      return 'bg-sky-50 text-sky-700 border border-sky-200';
    case 'ACCOUNTANT':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'WORKER':
    default:
      return 'bg-slate-100 text-slate-800 border border-slate-200';
  }
};

export const UsersView: React.FC = () => {
  const [usersList, setUsersList] = useState<DirectoryUser[]>([]);
  const [rolesList, setRolesList] = useState<Array<{ id?: string; name: string; description?: string }>>([]);

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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (roleFilter !== 'ALL') count++;
    if (typeFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (sortFilter !== 'createdAt_desc') count++;
    return count;
  }, [roleFilter, typeFilter, statusFilter, sortFilter]);

  const handleClearFilters = () => {
    setRoleFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSortFilter('createdAt_desc');
    setSearchQuery('');
    setPage(1);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = await apiRequest<Array<{ id?: string; name: string; description?: string }>>('/roles');
      if (Array.isArray(res) && res.length > 0) {
        setRolesList(res);
      }
    } catch (err) {
      console.warn('Could not fetch roles from DB:', err);
    }
  };

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
      const rawData = res && res.data ? res.data : Array.isArray(res) ? res : [];

      const formatted: DirectoryUser[] = (rawData || []).map((u: any) => ({
        id: u.id,
        fullName: u.fullName || 'Unnamed Personnel',
        employeeCode: u.employeeCode || '—',
        email: u.email || '',
        phone: u.phone || '',
        personalEmail: u.personalEmail || '',
        dob: u.dob || '',
        age: u.age ?? undefined,
        gender: u.gender || '',
        bloodGroup: u.bloodGroup || '',
        currentAddress: u.currentAddress || u.address || '',
        permanentAddress: u.permanentAddress || '',
        address: u.currentAddress || u.address || '',
        emergencyContactName: u.emergencyContactName || '',
        emergencyContactPhone: u.emergencyContactPhone || '',
        photoUrl: u.photoUrl || '',
        employmentType: (u.employmentType as EmploymentType) || 'full-time',
        roles: Array.isArray(u.roles) ? u.roles : [],
        isActive: u.isActive !== undefined ? u.isActive : true,
        createdAt: u.createdAt || new Date().toISOString(),
      }));

      setUsersList(formatted);

      if (res && res.pagination) {
        setPagination(res.pagination);
      } else {
        setPagination({
          total: formatted.length,
          page,
          limit,
          offset,
          totalPages: Math.ceil(formatted.length / limit) || 1,
          hasNextPage: offset + limit < formatted.length,
          hasPrevPage: page > 1,
        });
      }
    } catch (err: any) {
      console.warn('API error loading users:', err);
      setUsersList([]);
      setPagination({
        total: 0,
        page: 1,
        limit,
        offset: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
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
        await apiRequest(`/users/${user.id}/deactivate`, { method: 'POST' }).catch(() => { });
      } else {
        await apiRequest(`/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: true }),
        }).catch(() => { });
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
  const totalCount = pagination.total || usersList.length;
  const activeCount = usersList.filter((u) => u.isActive).length;
  const inactiveCount = usersList.filter((u) => !u.isActive).length;
  const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100;
  const inactivePercent = totalCount > 0 ? Math.round((inactiveCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Standard Stat Cards: Total Employee, Active, Inactive */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Employee"
          value={totalCount}
          change={`+${totalCount > 0 ? 100 : 0}%`}
          isPositive={true}
          helpText="Total registered workforce"
          icon={Users}
          visualType="sparkline"
          sparklineColor="#01B075"
          iconBgColor="bg-[#E6F7EF]"
          iconColor="text-[#01B075]"
        />
        <StatCard
          title="Active"
          value={activeCount}
          change={`${activePercent}%`}
          isPositive={true}
          helpText="Active personnel on record"
          icon={UserCheck}
          visualType="ring"
          progressPercent={activePercent}
          barColor="#01B075"
          iconBgColor="bg-[#E6F7EF]"
          iconColor="text-[#01B075]"
        />
        <StatCard
          title="Inactive"
          value={inactiveCount}
          change={`${inactivePercent}%`}
          isPositive={false}
          helpText="Deactivated or off-boarded"
          icon={XCircle}
          visualType="bars"
          sparklineColor="#EF4444"
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* Reference Image Header & Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* View Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E1F24] tracking-tight">
            Employees
          </h1>
          <span className="text-xs text-[#94A3B8] font-semibold bg-white border border-[#E8EEF4] px-2.5 py-1 rounded-full shadow-2xs">
            {totalCount} total
          </span>
        </div>

        {/* Right Controls: Search, Filter, Add Employee */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Rounded Pill Search */}
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search employee..."
              className="w-56 sm:w-64 bg-white border border-[#E8EEF4] rounded-full pl-9.5 pr-8 py-2 text-xs font-medium text-[#1E1F24] placeholder-[#94A3B8] shadow-2xs hover:border-[#CBD5E1] focus:outline-none focus:border-[#01B075] focus:ring-1 focus:ring-[#01B075] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E1F24] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Rounded Pill Filter Button */}
          <button
            type="button"
            onClick={() => setFilterOpen((prev) => !prev)}
            className={`bg-white border rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-[#F8FAFC] transition-all cursor-pointer ${
              filterOpen || activeFilterCount > 0
                ? 'border-[#01B075] text-[#01B075] bg-[#E6F7EF]/30'
                : 'border-[#E8EEF4] text-[#1E1F24]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-current" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#01B075] text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Rounded Pill Action Button */}
          <button
            type="button"
            onClick={() => {
              setUserToEdit(null);
              setModalOpen(true);
            }}
            className="bg-[#01B075] hover:bg-[#018F5B] text-white rounded-full px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98 shrink-0"
          >
            <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[11px] font-black leading-none">
              +
            </div>
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {filterOpen && (
        <div className="bg-white border border-[#E8EEF4] rounded-[22px] p-4 sm:p-5 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#01B075]" />
              <span className="text-xs font-bold text-[#1E1F24]">Directory Filter Controls</span>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F7EF] text-[#01B075]">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-[#01B075] hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
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
                className="p-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                title="Reload users"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#01B075]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="space-y-2.5">
            {/* Employment Type */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] w-20">Type:</span>
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
                        ? 'bg-[#01B075] text-white shadow-xs'
                        : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Role Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] w-20">Role:</span>
              {['ALL', ...(rolesList.length > 0 ? rolesList.map((r) => r.name) : ['ADMIN', 'SUPERVISOR', 'ENGINEER', 'ACCOUNTANT', 'WORKER'])].map((r) => {
                const isActive = roleFilter === r;
                const roleLabels: Record<string, string> = {
                  ALL: 'All Roles',
                  ADMIN: 'Admins',
                  SUPERVISOR: 'Supervisors',
                  ENGINEER: 'Engineers',
                  ACCOUNTANT: 'Accountants',
                  WORKER: 'Workers',
                };
                const label = roleLabels[r] || r;
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
                        ? 'bg-[#1E1F24] text-white shadow-xs'
                        : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Status & Sort */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#64748B] w-20">Status:</span>
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
                          ? 'bg-[#1E1F24] text-white shadow-xs'
                          : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active Only' : 'Inactive'}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="text-[11px] font-bold text-[#64748B]">Sort:</span>
                <select
                  value={sortFilter}
                  onChange={(e) => {
                    setSortFilter(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs font-semibold py-1.5 px-3 rounded-full border border-[#CBD5E1] bg-white text-[#1E1F24] focus:outline-none focus:border-[#01B075] cursor-pointer"
                >
                  <option value="createdAt_desc">Newest First</option>
                  <option value="createdAt_asc">Oldest First</option>
                  <option value="name_asc">Name (A → Z)</option>
                  <option value="name_desc">Name (Z → A)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* USER LISTING: TABLE VIEW (Reference Image Style) */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-[22px] border border-[#E8EEF4] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E8EEF4] text-[#94A3B8] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-4 px-4 w-16">SL.</th>
                  <th className="py-4 px-3 w-16">Image</th>
                  <th className="py-4 px-4">Name</th>
                  <th className="py-4 px-3">Department / Role</th>
                  <th className="py-4 px-3">Type</th>
                  <th className="py-4 px-3">Contact</th>
                  <th className="py-4 px-3">Status</th>
                  <th className="py-4 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[#334155]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#01B075]" />
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
                  filteredUsers.map((u, index) => {
                    const empType = (u.employmentType || 'full-time').toLowerCase();
                    const slNo = String((pagination.offset || 0) + index + 1).padStart(2, '0');
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                        onClick={() => setSelectedUserDetail(u)}
                      >
                        {/* SL. */}
                        <td className="py-3.5 px-4 font-mono font-medium text-xs text-[#94A3B8]">
                          {slNo}
                        </td>

                        {/* Image */}
                        <td className="py-3.5 px-3">
                          <div className="relative w-10 h-10 shrink-0">
                            <img
                              src={
                                u.photoUrl ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                              }
                              alt={u.fullName}
                              className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0] shadow-2xs"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                u.isActive ? 'bg-[#01B075]' : 'bg-slate-300'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-bold text-[#1E1F24] text-xs block group-hover:text-[#01B075] transition-colors">
                              {u.fullName}
                            </span>
                            <span className="font-mono text-[11px] text-[#94A3B8]">
                              {u.employeeCode}
                            </span>
                          </div>
                        </td>

                        {/* Department / Role */}
                        <td className="py-3.5 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getRoleBadgeClasses(r)}`}
                              >
                                {r.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-3">
                          {empType === 'full-time' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#E6F7EF] text-[#01B075] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
                              <Briefcase className="w-3 h-3" />
                              Full-Time
                            </span>
                          )}
                          {empType === 'part-time' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full border border-sky-200">
                              <Clock className="w-3 h-3" />
                              Part-Time
                            </span>
                          )}
                          {empType === 'contract' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                              <Award className="w-3 h-3" />
                              Contract
                            </span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-3 text-[#475569]">
                          <div className="text-xs">
                            <span className="font-semibold text-[#1E1F24] block">{u.phone || '—'}</span>
                            <span className="text-[11px] text-[#94A3B8] block truncate max-w-[140px]">{u.email}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setUserToEdit(u)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#01B075] hover:bg-[#E6F7EF] transition-colors cursor-pointer"
                              title="Edit User Details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedUserDetail(u)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#01B075] hover:bg-[#E6F7EF] transition-colors cursor-pointer"
                              title="View Full Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                                u.isActive
                                  ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                                  : 'text-[#01B075] hover:bg-[#E6F7EF] border border-[#A7F3D0]'
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
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${u.isActive ? 'bg-[#12A66A]' : 'bg-slate-300'
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
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getRoleBadgeClasses(r)}`}
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
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${u.isActive
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
            role: ((userToEdit.roles[0] === 'SUPER_ADMIN' ? 'ADMIN' : userToEdit.roles[0]) as UserRole) || 'WORKER',
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
                      className={`text-xs font-extrabold mt-0.5 block ${selectedUserDetail.isActive ? 'text-[#12A66A]' : 'text-rose-600'
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
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${getRoleBadgeClasses(r)}`}
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
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${selectedUserDetail.isActive
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

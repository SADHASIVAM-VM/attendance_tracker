import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  Mail,
  Phone,
  PhoneCall,
  Calendar,
  MapPin,
  HeartPulse,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  UserCheck,
  ChevronDown,
} from 'lucide-react';

interface UserRecord {
  id: string;
  employeeCode: string;
  email: string;
  fullName: string;
  phone?: string | null;
  dob?: string | null;
  photoUrl?: string | null;
  nativePlace?: string | null;
  emergencyPhone?: string | null;
  bloodGroup?: string | null;
  gender?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

export const UsersView: React.FC = () => {
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // View Mode: 'card' or 'table'
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Action Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

  // Active / Selected User
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Form State
  const [formFullName, setFormFullName] = useState<string>('');
  const [formEmployeeCode, setFormEmployeeCode] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('Password123!');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formDob, setFormDob] = useState<string>('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [formNativePlace, setFormNativePlace] = useState<string>('');
  const [formEmergencyPhone, setFormEmergencyPhone] = useState<string>('');
  const [formBloodGroup, setFormBloodGroup] = useState<string>('');
  const [formGender, setFormGender] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formRole, setFormRole] = useState<string>('WORKER');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  useEffect(() => {
    loadUsers();
  }, []);

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-card-menu')) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/users');
      setUsersList(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load user directory', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormFullName('');
    setFormEmployeeCode('');
    setFormEmail('');
    setFormPassword('Password123!');
    setFormPhone('');
    setFormDob('');
    setFormPhotoUrl('');
    setFormNativePlace('');
    setFormEmergencyPhone('');
    setFormBloodGroup('');
    setFormGender('');
    setFormAddress('');
    setFormRole('WORKER');
    setFormIsActive(true);
  };

  const openCreateModal = () => {
    resetForm();
    const nextNum = usersList.length + 1;
    setFormEmployeeCode(`EMP${String(nextNum).padStart(3, '0')}`);
    setCreateModalOpen(true);
  };

  const openEditModal = (u: UserRecord) => {
    setSelectedUser(u);
    setFormFullName(u.fullName || '');
    setFormEmployeeCode(u.employeeCode || '');
    setFormEmail(u.email || '');
    setFormPassword('');
    setFormPhone(u.phone || '');
    setFormDob(u.dob || '');
    setFormPhotoUrl(u.photoUrl || '');
    setFormNativePlace(u.nativePlace || '');
    setFormEmergencyPhone(u.emergencyPhone || '');
    setFormBloodGroup(u.bloodGroup || '');
    setFormGender(u.gender || '');
    setFormAddress(u.address || '');
    setFormRole(u.roles[0] || 'WORKER');
    setFormIsActive(u.isActive);
    setActiveMenuId(null);
    setEditModalOpen(true);
  };

  const openDetailModal = (u: UserRecord) => {
    setSelectedUser(u);
    setActiveMenuId(null);
    setDetailModalOpen(true);
  };

  const openDeleteModal = (u: UserRecord) => {
    setSelectedUser(u);
    setActiveMenuId(null);
    setDeleteModalOpen(true);
  };

  // CREATE USER
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName || !formEmployeeCode || !formEmail) {
      setMessage({ text: 'Full Name, Employee Code, and Email are required.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: formFullName,
          employeeCode: formEmployeeCode,
          email: formEmail,
          password: formPassword || 'Password123!',
          phone: formPhone || undefined,
          dob: formDob || undefined,
          photoUrl: formPhotoUrl || undefined,
          nativePlace: formNativePlace || undefined,
          emergencyPhone: formEmergencyPhone || undefined,
          bloodGroup: formBloodGroup || undefined,
          gender: formGender || undefined,
          address: formAddress || undefined,
          roles: [formRole],
        }),
      });

      setMessage({ text: `Employee ${formFullName} created successfully.`, type: 'success' });
      setCreateModalOpen(false);
      resetForm();
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create user', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // UPDATE USER
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSubmitting(true);
      const payload: any = {
        fullName: formFullName,
        employeeCode: formEmployeeCode,
        email: formEmail,
        phone: formPhone || null,
        dob: formDob || null,
        photoUrl: formPhotoUrl || null,
        nativePlace: formNativePlace || null,
        emergencyPhone: formEmergencyPhone || null,
        bloodGroup: formBloodGroup || null,
        gender: formGender || null,
        address: formAddress || null,
        isActive: formIsActive,
        roles: [formRole],
      };

      if (formPassword && formPassword.trim().length >= 6) {
        payload.password = formPassword;
      }

      await apiRequest(`/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setMessage({ text: `Employee ${formFullName} updated successfully.`, type: 'success' });
      setEditModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update user', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // DELETE USER
  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      const res = await apiRequest(`/users/${selectedUser.id}`, { method: 'DELETE' });
      setMessage({ text: res.message || 'Employee removed successfully', type: 'success' });
      setDeleteModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to delete user', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // TOGGLE STATUS
  const handleToggleStatus = async (u: UserRecord) => {
    try {
      setActiveMenuId(null);
      const res = await apiRequest(`/users/${u.id}/deactivate`, { method: 'POST' });
      setMessage({
        text: `Employee ${u.fullName} is now ${res.isActive ? 'Active' : 'Inactive'}.`,
        type: 'success',
      });
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Status toggle failed', type: 'error' });
    }
  };

  // Helper: Format Joined Date (e.g. 29 Oct 23)
  const formatJoinedDate = (dateStr?: string) => {
    if (!dateStr) return '29 Oct 23';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch {
      return '29 Oct 23';
    }
  };

  // Helper: Format Role display name
  const formatRoleTitle = (roles: string[]) => {
    const role = roles[0] || 'WORKER';
    switch (role) {
      case 'SUPER_ADMIN':
        return 'CEO / Executive';
      case 'ADMIN':
        return 'Operations Manager';
      case 'SUPERVISOR':
        return 'Site Supervisor';
      case 'WORKER':
        return 'Field Specialist';
      default:
        return role.replace('_', ' ');
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.nativePlace && u.nativePlace.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.phone && u.phone.includes(searchQuery));

      const matchRole = roleFilter === 'ALL' || u.roles.includes(roleFilter);

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);

      return matchSearch && matchRole && matchStatus;
    });
  }, [usersList, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Matches "Employee / Manage Employee + Add Employee") */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 m-0">Employee</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Manage Employee</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 sm:py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Notification Toast */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm border flex items-center justify-between shadow-2xs ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FILTER & CONTROLS BAR (Search + Type + Role + All Status + View Switcher) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search input with right-side magnifying glass */}
        <div className="relative flex-1 max-w-lg">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee"
            className="w-full text-xs sm:text-sm pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        </div>

        {/* Filter Dropdowns + View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none text-xs sm:text-sm py-2.5 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Type</option>
              <option value="ONSITE">Onsite</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="CONTRACT">Contract</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none text-xs sm:text-sm py-2.5 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">Role</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="WORKER">Worker</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
          </div>

          {/* All Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none text-xs sm:text-sm py-2.5 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
          </div>

          {/* VIEW SWITCHER: CARD vs TABLE LIST (as requested) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-auto lg:ml-0 shadow-2xs">
            <button
              onClick={() => setViewMode('card')}
              title="Card Grid View"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-white text-sky-600 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table List View"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-sky-600 shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
          Loading employees...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          No employees found matching your criteria.
        </div>
      ) : viewMode === 'card' ? (
        /* ========================================================================= */
        /* 3. CARD GRID VIEW (Pixel-perfect reproduction of screenshot) */
        /* ========================================================================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((u) => {
            const roleTitle = formatRoleTitle(u.roles);
            const joinedText = formatJoinedDate(u.createdAt);
            const isMenuOpen = activeMenuId === u.id;

            return (
              <div
                key={u.id}
                className="bg-white rounded-2xl border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow p-5 flex flex-col justify-between relative group"
              >
                {/* Card Top Row: Status badge & 3-dots Menu */}
                <div className="flex items-center justify-between mb-2">
                  {u.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      Inactive
                    </span>
                  )}

                  {/* 3-dots Dropdown Menu */}
                  <div className="relative user-card-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : u.id);
                      }}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-7 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30 animate-in fade-in zoom-in-95">
                        <button
                          onClick={() => openDetailModal(u)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          View Details
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openDeleteModal(u)}
                          className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-t border-slate-100 mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center Avatar & Identity */}
                <div className="text-center my-1">
                  <div className="inline-block relative">
                    {u.photoUrl ? (
                      <img
                        src={u.photoUrl}
                        alt={u.fullName}
                        className="w-14 h-14 rounded-full mx-auto object-cover ring-3 ring-slate-50 shadow-2xs"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full mx-auto bg-slate-800 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-2xs">
                        {u.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-2 mb-0.5 tracking-tight truncate">
                    {u.fullName}
                  </h3>
                  <p className="text-xs text-sky-500 font-medium m-0 truncate">
                    {roleTitle}
                  </p>

                  {/* Subtitle tag row: "Managerial • Onsite • Full Time" */}
                  <p className="text-[11px] text-slate-400 mt-1 mb-3">
                    {u.roles[0] === 'WORKER' ? 'Field' : 'Managerial'} • {u.nativePlace || 'Onsite'} • Full Time
                  </p>
                </div>

                {/* Key-Value Details List */}
                <div className="space-y-1 text-xs text-slate-500 pt-2 border-t border-slate-50 mb-4">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-400 shrink-0">Email :</span>
                    <span className="text-slate-700 truncate font-normal">{u.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-400 shrink-0">Phone :</span>
                    <span className="text-slate-700 truncate font-normal">{u.phone || '+1 555-0100'}</span>
                  </div>

                  {u.emergencyPhone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-rose-400 shrink-0">Emergency :</span>
                      <span className="text-rose-700 font-mono truncate">{u.emergencyPhone}</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: "Joint : 29 Oct 23" and "Details" Button */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Joint : {joinedText}
                  </span>

                  <button
                    onClick={() => openDetailModal(u)}
                    className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* 4. TABLE LIST VIEW (Second option requested by user) */
        /* ========================================================================= */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">DOB & Native</th>
                  <th className="py-3 px-4">Emergency Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Employee Profile Cell */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {u.photoUrl ? (
                          <img
                            src={u.photoUrl}
                            alt={u.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs tracking-wider">
                            {u.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-slate-900 block leading-tight">
                            {u.fullName}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {u.employeeCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Designation / Role */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold text-sky-600 block">
                        {formatRoleTitle(u.roles)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {u.roles[0]?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-slate-800">{u.email}</div>
                      <div className="text-[11px] text-slate-400">{u.phone || '—'}</div>
                    </td>

                    {/* DOB & Native */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-slate-800">{u.dob || '—'}</div>
                      <div className="text-[11px] text-slate-400">{u.nativePlace || '—'}</div>
                    </td>

                    {/* Emergency Contact */}
                    <td className="py-3.5 px-4">
                      {u.emergencyPhone ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                          <PhoneCall className="w-3 h-3" />
                          {u.emergencyPhone}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetailModal(u)}
                          className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(u)}
                          title="Delete"
                          className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ADD EMPLOYEE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Employee"
        description="Register an employee profile with photo, DOB, native place, and emergency numbers."
        footer={
          <>
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !formFullName || !formEmployeeCode || !formEmail}
              className="px-5 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submitting ? 'Saving...' : 'Add Employee'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="e.g. Rahim Earteza"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Employee Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formEmployeeCode}
                onChange={(e) => setFormEmployeeCode(e.target.value)}
                placeholder="e.g. EMP042"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Work Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="earteza@gmail.com"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Role / Access Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="WORKER">Field Worker / Specialist</option>
                <option value="SUPERVISOR">Site Supervisor</option>
                <option value="ADMIN">Operations Admin</option>
                <option value="SUPER_ADMIN">CEO / Super Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Date of Birth (DOB)</label>
              <input
                type="date"
                value={formDob}
                onChange={(e) => setFormDob(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Native Place / Hometown</label>
              <input
                type="text"
                value={formNativePlace}
                onChange={(e) => setFormNativePlace(e.target.value)}
                placeholder="e.g. Dhaka, Bangladesh"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Primary Phone Number</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+8801873891"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-rose-700 block mb-1">
                Emergency Phone Number
              </label>
              <input
                type="tel"
                value={formEmergencyPhone}
                onChange={(e) => setFormEmergencyPhone(e.target.value)}
                placeholder="+8801999999"
                className="w-full text-xs p-2.5 rounded-xl border border-rose-200 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Blood Group</label>
              <select
                value={formBloodGroup}
                onChange={(e) => setFormBloodGroup(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="">Select Blood Group</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Gender</label>
              <select
                value={formGender}
                onChange={(e) => setFormGender(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Profile Photo URL</label>
            <input
              type="url"
              value={formPhotoUrl}
              onChange={(e) => setFormPhotoUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Residential Address</label>
            <textarea
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              rows={2}
              placeholder="House, road, city, zip code"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Initial Password</label>
            <input
              type="text"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Password123!"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. EDIT EMPLOYEE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Employee: ${formFullName}`}
        description="Update profile details, contact information, or roles."
        footer={
          <>
            <button
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={submitting || !formFullName || !formEmployeeCode || !formEmail}
              className="px-5 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {submitting ? 'Updating...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Employee Code</label>
              <input
                type="text"
                value={formEmployeeCode}
                onChange={(e) => setFormEmployeeCode(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Work Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Role</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
              >
                <option value="WORKER">Field Worker</option>
                <option value="SUPERVISOR">Site Supervisor</option>
                <option value="ADMIN">Operations Admin</option>
                <option value="SUPER_ADMIN">CEO / Super Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">DOB</label>
              <input
                type="date"
                value={formDob}
                onChange={(e) => setFormDob(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Native Place</label>
              <input
                type="text"
                value={formNativePlace}
                onChange={(e) => setFormNativePlace(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Phone</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-rose-700 block mb-1">Emergency Phone</label>
              <input
                type="tel"
                value={formEmergencyPhone}
                onChange={(e) => setFormEmergencyPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-rose-200 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Blood Group</label>
              <select
                value={formBloodGroup}
                onChange={(e) => setFormBloodGroup(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="">Select Blood Group</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Gender</label>
              <select
                value={formGender}
                onChange={(e) => setFormGender(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Photo URL</label>
            <input
              type="url"
              value={formPhotoUrl}
              onChange={(e) => setFormPhotoUrl(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Address</label>
            <textarea
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Reset Password (leave empty to keep current)
            </label>
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. VIEW DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedUser && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="Employee Profile"
          description={`Full profile card for ${selectedUser.fullName}`}
          footer={
            <>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  openEditModal(selectedUser);
                }}
                className="px-5 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl cursor-pointer"
              >
                Edit Profile
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Profile Header */}
            <div className="flex items-center gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              {selectedUser.photoUrl ? (
                <img
                  src={selectedUser.photoUrl}
                  alt={selectedUser.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-slate-100"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                  {selectedUser.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-950 text-base m-0">{selectedUser.fullName}</h3>
                  {selectedUser.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white">
                      ● Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
                      ● Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-sky-600 font-semibold m-0 mt-0.5">
                  {formatRoleTitle(selectedUser.roles)}
                </p>
                <p className="text-[11px] font-mono text-slate-400 m-0 mt-0.5">
                  ID: {selectedUser.employeeCode} • Joined: {formatJoinedDate(selectedUser.createdAt)}
                </p>
              </div>
            </div>

            {/* Profile Attributes Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Work Email</span>
                <span className="font-medium text-slate-800 break-all">{selectedUser.email}</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Phone Number</span>
                <span className="font-medium text-slate-800">{selectedUser.phone || 'Not recorded'}</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Date of Birth (DOB)</span>
                <span className="font-medium text-slate-800">{selectedUser.dob || 'Not recorded'}</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Native Place</span>
                <span className="font-medium text-slate-800">{selectedUser.nativePlace || 'Not recorded'}</span>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-700 block">Emergency Contact</span>
                <span className="font-bold text-rose-900 font-mono">
                  {selectedUser.emergencyPhone || 'Not provided'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Blood Group & Gender</span>
                <span className="font-medium text-slate-800">
                  {selectedUser.bloodGroup || '—'} {selectedUser.gender ? `(${selectedUser.gender})` : ''}
                </span>
              </div>
            </div>

            {selectedUser.address && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Address</span>
                <span className="text-slate-800">{selectedUser.address}</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 8. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {selectedUser && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Delete Employee"
          description={`Are you sure you want to remove ${selectedUser.fullName}?`}
          footer={
            <>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs text-slate-600">
            <p>
              This will remove <strong className="text-slate-900">{selectedUser.fullName}</strong> (
              <code className="text-slate-800 font-mono">{selectedUser.employeeCode}</code>) from the database directory.
            </p>
            <p className="text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Note: Historical attendance logs or assignments associated with this employee will be preserved safely.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

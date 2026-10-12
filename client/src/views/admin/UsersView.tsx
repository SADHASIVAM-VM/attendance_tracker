import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { Users, Plus, ShieldCheck, UserCheck } from 'lucide-react';

export const UsersView: React.FC = () => {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Form State
  const [fullName, setFullName] = useState<string>('');
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('Password123!');
  const [phone, setPhone] = useState<string>('');
  const [role, setRole] = useState<string>('WORKER');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/users');
      setUsersList(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          employeeCode,
          email,
          password,
          phone,
          roles: [role],
        }),
      });

      setMessage({ text: 'User account created successfully.', type: 'success' });
      setModalOpen(false);
      setFullName('');
      setEmployeeCode('');
      setEmail('');
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create user', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await apiRequest(`/users/${id}/deactivate`, { method: 'POST' });
      setMessage({ text: 'User account deactivated.', type: 'success' });
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Deactivation failed', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 m-0">Workforce User Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage organization users, role assignments, and account statuses.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Employee Code</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Roles</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    Loading directory...
                  </td>
                </tr>
              ) : (
                usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{u.fullName}</td>
                    <td className="py-3.5 px-4 text-xs font-mono">{u.employeeCode}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r: string) => (
                          <span
                            key={r}
                            className="text-[11px] font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md"
                          >
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{u.phone || '—'}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.isActive && (
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New User Account"
        description="Add a worker, supervisor, administrator, or platform admin."
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !fullName || !employeeCode || !email}
              className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50"
            >
              Create Account
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rachel Adams"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Employee Code</label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="e.g. EMP042"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@enterprise.com"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="WORKER">Worker</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Temporary Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Phone (Optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

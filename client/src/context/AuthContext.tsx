import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { toast } from './ToastContext';

export interface User {
  id: string;
  orgId: string;
  employeeCode: string;
  email: string;
  fullName: string;
  roles: string[];
  phone?: string | null;
  personalEmail?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  employmentType?: string | null;
  photoUrl?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  timezone: string;
  defaultGeofenceRadius: number;
  maxLocationAccuracy: number;
  clockOutEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (role: 'ADMIN' | 'SUPERVISOR' | 'ENGINEER' | 'ACCOUNTANT' | 'WORKER' | 'SUPER_ADMIN') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRESET_ACCOUNTS: Record<string, { email: string; password: string }> = {
  ADMIN: { email: 'admin@enterprise.com', password: 'Password123!' },
  SUPER_ADMIN: { email: 'admin@enterprise.com', password: 'Password123!' },
  SUPERVISOR: { email: 'supervisor@enterprise.com', password: 'Password123!' },
  ENGINEER: { email: 'engineer@enterprise.com', password: 'Password123!' },
  ACCOUNTANT: { email: 'accountant@enterprise.com', password: 'Password123!' },
  WORKER: { email: 'worker@enterprise.com', password: 'Password123!' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('attendance_token'));
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsInitializing(false);
        return;
      }
      try {
        const res = await apiRequest('/auth/me');
        setUser(res.user);
        setOrganization(res.organization);
      } catch (err) {
        console.error('Failed to load session:', err);
        localStorage.removeItem('attendance_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, email: identifier, phone: identifier, password }),
      });
      localStorage.setItem('attendance_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setOrganization(res.organization);
    } catch (err: any) {
      toast.error(err.message);
      console.warn('Authentication failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: 'ADMIN' | 'SUPERVISOR' | 'ENGINEER' | 'ACCOUNTANT' | 'WORKER' | 'SUPER_ADMIN') => {
    const creds = PRESET_ACCOUNTS[role];
    if (creds) {
      await login(creds.email, creds.password);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('attendance_token');
      setToken(null);
      setUser(null);
      setOrganization(null);
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    const res = await apiRequest('/auth/me');
    setUser(res.user);
    setOrganization(res.organization);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        isLoading,
        isInitializing,
        login,
        quickLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

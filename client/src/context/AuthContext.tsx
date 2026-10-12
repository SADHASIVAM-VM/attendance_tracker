import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export interface User {
  id: string;
  orgId: string;
  employeeCode: string;
  email: string;
  fullName: string;
  roles: string[];
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
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'WORKER') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRESET_ACCOUNTS = {
  SUPER_ADMIN: { email: 'superadmin@enterprise.com', password: 'Password123!' },
  ADMIN: { email: 'admin@enterprise.com', password: 'Password123!' },
  SUPERVISOR: { email: 'supervisor@enterprise.com', password: 'Password123!' },
  WORKER: { email: 'worker@enterprise.com', password: 'Password123!' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('attendance_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
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
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('attendance_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setOrganization(res.organization);
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'WORKER') => {
    const creds = PRESET_ACCOUNTS[role];
    await login(creds.email, creds.password);
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

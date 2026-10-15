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
  token?: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load session via HTTP-only cookie on startup
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await apiRequest('/auth/me');
        setUser(res.user);
        setOrganization(res.organization);
      } catch (err) {
        // No active or valid cookie session
        setUser(null);
        setOrganization(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.token) {
        localStorage.setItem('attendance_token', res.token);
      }
      setUser(res.user);
      setOrganization(res.organization);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Backend clears the HTTP-only cookie
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('attendance_token');
      setUser(null);
      setOrganization(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiRequest('/auth/me');
      setUser(res.user);
      setOrganization(res.organization);
    } catch (e) {
      setUser(null);
      setOrganization(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token: null,
        isLoading,
        login,
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

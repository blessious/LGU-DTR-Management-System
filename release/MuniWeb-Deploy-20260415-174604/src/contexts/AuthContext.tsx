import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiUrl, getAuthHeaders } from '@/lib/authHeaders';

interface Admin {
  id: number;
  username: string;
  name: string;
  level: number;
  levelText: string;
}

interface AuthContextType {
  admin: Admin | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPrivilege: (requiredLevel: number) => boolean;
  canExport: () => boolean;
  canCreate: () => boolean;
  canUpdate: () => boolean;
  canDelete: () => boolean;
  canImport: () => boolean;
  canManageAdmins: () => boolean;
  canManageBiometrics: () => boolean;
  canEditDTR: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Privilege level constants
export const PRIVILEGE_LEVELS = {
  VIEWER: 1,
  HR: 2,
  ADMIN: 3
} as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const savedAdmin = localStorage.getItem('admin');
      if (savedAdmin) {
        setAdmin(JSON.parse(savedAdmin));
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      localStorage.removeItem('admin');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      console.log('🔐 Login attempt for:', username);

      // Regular login - call API
      console.log('🔐 Regular login - calling API');
      const API_URL = getApiUrl();
      
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success && data.admin) {
        setAdmin(data.admin);
        localStorage.setItem('admin', JSON.stringify(data.admin));
        console.log('✅ Regular login successful');
        return true;
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem('admin');
    const API_URL = getApiUrl();
    fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    }).catch(console.error);
  };

  // Privilege check functions
  const hasPrivilege = (requiredLevel: number): boolean => {
    return admin ? admin.level >= requiredLevel : false;
  };

  const canExport = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.HR); 
  };

  const canCreate = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.HR);
  };

  const canUpdate = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.HR);
  };

  const canDelete = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.HR);
  };

  const canImport = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.ADMIN);
  };

  const canManageAdmins = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.ADMIN);
  };

  const canManageBiometrics = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.ADMIN);
  };

  const canEditDTR = (): boolean => {
    return hasPrivilege(PRIVILEGE_LEVELS.ADMIN);
  };

  const value = {
    admin,
    login,
    logout,
    isLoading,
    isAuthenticated: !!admin,
    hasPrivilege,
    canExport,
    canCreate,
    canUpdate,
    canDelete,
    canImport,
    canManageAdmins,
    canManageBiometrics,
    canEditDTR,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
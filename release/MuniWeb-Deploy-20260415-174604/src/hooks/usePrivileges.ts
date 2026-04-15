import { useAuth } from '@/contexts/AuthContext';
import { PRIVILEGE_LEVELS } from '@/contexts/AuthContext';

export function usePrivileges() {
  const { 
    admin, 
    hasPrivilege, 
    canExport, 
    canCreate, 
    canUpdate, 
    canDelete, 
    canImport, 
    canManageAdmins, 
    canManageBiometrics,
    canEditDTR // Destructured from useAuth
  } = useAuth();

  return {
    admin,
    hasPrivilege,
    canExport,
    canCreate,
    canUpdate,
    canDelete,
    canImport,
    canManageAdmins,
    canManageBiometrics,
    canEditDTR, 
    isViewer: admin?.level === PRIVILEGE_LEVELS.VIEWER,
    isHR: admin?.level === PRIVILEGE_LEVELS.HR,
    isAdmin: admin?.level === PRIVILEGE_LEVELS.ADMIN,
  };
}
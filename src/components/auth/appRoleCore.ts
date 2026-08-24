import { createContext } from 'react'

export type AppRole = 'admin' | 'operator' | 'viewer'

export type RolePermissions = {
  canManageEquipment: boolean
  canChangeEquipmentStatus: boolean
  canManageLoans: boolean
  canReviewRequests: boolean
  canManageUsers: boolean
}

export type AppRoleContextValue = {
  role: AppRole
  isLoadingRole: boolean
  isPasswordResetRequired: boolean
  permissions: RolePermissions
}

export const AppRoleContext =
  createContext<AppRoleContextValue | null>(null)

const viewerPermissions: RolePermissions = {
  canManageEquipment: false,
  canChangeEquipmentStatus: false,
  canManageLoans: false,
  canReviewRequests: false,
  canManageUsers: false,
}

export function getPermissions(role: AppRole): RolePermissions {
  if (role === 'admin') {
    return {
      canManageEquipment: true,
      canChangeEquipmentStatus: true,
      canManageLoans: true,
      canReviewRequests: true,
      canManageUsers: true,
    }
  }

  if (role === 'operator') {
    return {
      canManageEquipment: false,
      canChangeEquipmentStatus: true,
      canManageLoans: true,
      canReviewRequests: true,
      canManageUsers: false,
    }
  }

  return viewerPermissions
}

export function normalizeRole(role: unknown): AppRole {
  return role === 'admin' || role === 'operator' || role === 'viewer'
    ? role
    : 'viewer'
}

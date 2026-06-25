import { supabase } from '../../../lib/supabase'
import type { AppRole } from '../../../components/auth/appRoleCore'

export type AdminUserRecord = {
  id: string
  email: string
  displayName: string
  role: AppRole
  passwordResetRequired: boolean
  createdAt: string | null
  lastSignInAt: string | null
}

export type AdminUserInput = {
  email: string
  displayName: string
  role: AppRole
}

export type BulkAdminUserInput = AdminUserInput

export type AdminUserUpdateInput = {
  userId: string
  displayName: string
  role: AppRole
}

export type AdminUserMutationResult = {
  user: AdminUserRecord
  temporaryPassword?: string | null
  created?: boolean
}

export type BulkAdminUserResult = {
  users: AdminUserRecord[]
  createdCount: number
  updatedCount: number
  passwordResetCount: number
  temporaryPassword: string
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'The user management request could not be completed.',
    )
  }

  return payload as T
}

export async function fetchAdminUsers() {
  const response = await fetch('/api/admin-users', {
    headers: await getAuthHeaders(),
  })

  const payload = await parseApiResponse<{ users: AdminUserRecord[] }>(
    response,
  )

  return payload.users
}

export async function createAdminUser(input: AdminUserInput) {
  const response = await fetch('/api/admin-users', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(input),
  })

  return parseApiResponse<AdminUserMutationResult>(response)
}

export async function bulkCreateAdminUsers({
  users,
  temporaryPassword,
  resetExistingPasswords,
}: {
  users: BulkAdminUserInput[]
  temporaryPassword: string
  resetExistingPasswords: boolean
}) {
  const response = await fetch('/api/admin-users', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      action: 'bulkCreate',
      users,
      temporaryPassword,
      resetExistingPasswords,
    }),
  })

  return parseApiResponse<BulkAdminUserResult>(response)
}

export async function updateAdminUser(input: AdminUserUpdateInput) {
  const response = await fetch('/api/admin-users', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(input),
  })

  return parseApiResponse<AdminUserMutationResult>(response)
}

export async function resetAdminUserPassword(userId: string) {
  const response = await fetch('/api/admin-users', {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      action: 'resetPassword',
      userId,
    }),
  })

  return parseApiResponse<AdminUserMutationResult>(response)
}

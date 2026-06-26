import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../../lib/supabase'
import {
  AppRoleContext,
  getPermissions,
  normalizeRole,
  type AppRole,
  type AppRoleContextValue,
} from './appRoleCore'

async function getCurrentUserStatus() {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) {
    throw new Error('Missing session token.')
  }

  const response = await fetch('/api/current-user-status', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'Account status could not be loaded.',
    )
  }

  return payload as {
    role?: unknown
    passwordResetRequired?: unknown
  }
}

export function AppRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>('viewer')
  const [isLoadingRole, setIsLoadingRole] = useState(true)
  const [isPasswordResetRequired, setIsPasswordResetRequired] =
    useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadRole() {
      setIsLoadingRole(true)

      try {
        const userStatus = await getCurrentUserStatus()

        if (!isMounted) {
          return
        }

        setRole(normalizeRole(userStatus.role))
        setIsPasswordResetRequired(
          Boolean(userStatus.passwordResetRequired),
        )
        setIsLoadingRole(false)
        return
      } catch {
        const [{ data: roleData, error: roleError }, { data: userData }] =
          await Promise.all([
            supabase.rpc('current_app_role'),
            supabase.auth.getUser(),
          ])

        let passwordResetRequired = false

        if (userData.user) {
          const { data: roleRecord } = await supabase
            .from('app_user_roles')
            .select('password_reset_required')
            .eq('user_id', userData.user.id)
            .maybeSingle()

          passwordResetRequired = Boolean(
            roleRecord?.password_reset_required,
          )
        }

        if (!isMounted) {
          return
        }

        setRole(roleError ? 'viewer' : normalizeRole(roleData))
        setIsPasswordResetRequired(passwordResetRequired)
        setIsLoadingRole(false)
      }
    }

    void loadRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadRole()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AppRoleContextValue>(
    () => ({
      role,
      isLoadingRole,
      isPasswordResetRequired,
      permissions: getPermissions(role),
    }),
    [isLoadingRole, isPasswordResetRequired, role],
  )

  return (
    <AppRoleContext.Provider value={value}>
      {children}
    </AppRoleContext.Provider>
  )
}

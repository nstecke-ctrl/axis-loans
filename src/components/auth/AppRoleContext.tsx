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

export function AppRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>('viewer')
  const [isLoadingRole, setIsLoadingRole] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadRole() {
      setIsLoadingRole(true)

      const { data, error } = await supabase.rpc('current_app_role')

      if (!isMounted) {
        return
      }

      setRole(error ? 'viewer' : normalizeRole(data))
      setIsLoadingRole(false)
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
      permissions: getPermissions(role),
    }),
    [isLoadingRole, role],
  )

  return (
    <AppRoleContext.Provider value={value}>
      {children}
    </AppRoleContext.Provider>
  )
}

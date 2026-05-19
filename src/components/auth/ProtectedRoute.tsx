import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { supabase } from '../../lib/supabase'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setHasSession(Boolean(data.session))
      setIsCheckingSession(false)
    }

    void checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return
      }

      setHasSession(Boolean(session))
      setIsCheckingSession(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f3] px-6 text-[#171717]">
        <div className="rounded-3xl border border-[#e5e5e2] bg-white px-8 py-7 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
            Axis Demo Assets
          </p>

          <p className="mt-3 text-base font-medium text-[#171717]">
            Validating session...
          </p>
        </div>
      </div>
    )
  }

  if (!hasSession) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
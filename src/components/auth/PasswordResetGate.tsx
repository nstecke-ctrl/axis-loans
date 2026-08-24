import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAppRole } from './useAppRole'

export function PasswordResetGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { isLoadingRole, isPasswordResetRequired } = useAppRole()

  if (isLoadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f3] px-6 text-[#171717]">
        <div className="rounded-3xl border border-[#e5e5e2] bg-white px-8 py-7 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
            Demo Assets Control
          </p>

          <p className="mt-3 text-base font-medium text-[#171717]">
            Checking account status...
          </p>
        </div>
      </div>
    )
  }

  if (
    isPasswordResetRequired &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}

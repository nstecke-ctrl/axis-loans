import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAppRole } from './useAppRole'

type PermissionName =
  | 'canManageEquipment'
  | 'canChangeEquipmentStatus'
  | 'canManageLoans'
  | 'canReviewRequests'

export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionName
  children: ReactNode
}) {
  const { isLoadingRole, permissions, role } = useAppRole()

  if (isLoadingRole) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-[#171717]">
            Checking permissions...
          </p>
        </div>
      </div>
    )
  }

  if (!permissions[permission]) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Current role: {role}
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Access Restricted
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#555555]">
            Your account can view operational information, but this action is
            limited to users with a higher permission level.
          </p>

          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

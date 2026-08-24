import { useEffect, useState } from 'react'
import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router'
import type { User } from '@supabase/supabase-js'
import type { RolePermissions } from '../auth/appRoleCore'
import { useAppRole } from '../auth/useAppRole'
import { supabase } from '../../lib/supabase'

type NavigationItem = {
  label: string
  to: string
  permission?: keyof RolePermissions
}

const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Inventory', to: '/inventory' },
  { label: 'Loans', to: '/loans' },
  { label: 'Loan Requests', to: '/loan-requests' },
  { label: 'Activity Log', to: '/movements' },
  { label: 'Users', to: '/admin/users', permission: 'canManageUsers' },
]

export function AppLayout() {
  const navigate = useNavigate()
  const { role, isLoadingRole, permissions } = useAppRole()

  const [user, setUser] = useState<User | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      const { data } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      setUser(data.user ?? null)
    }

    void loadCurrentUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return
      }

      setUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  async function handleSignOut() {
    setIsSigningOut(true)

    const { error } = await supabase.auth.signOut({
      scope: 'local',
    })

    if (error) {
      setIsSigningOut(false)
      return
    }

    setMobileMenuOpen(false)
    navigate('/', { replace: true })
  }

  const visibleNavigationItems = navigationItems.filter(
    (item) => !item.permission || permissions[item.permission],
  )

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#171717]">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-80 flex-col border-r border-black/10 bg-[#181818] text-white lg:flex">
          <div className="border-b border-white/10 px-7 pb-7 pt-8">
            <img
              src="/branding/axis-logo-white.png"
              alt="Axis Communications"
              className="h-auto w-full max-w-[235px]"
            />

            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffda00]">
                Internal Operations
              </p>

              <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-white">
                Demo Assets Control
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/65">
                Inventory &amp; Loan Control
              </p>
            </div>
          </div>

          <nav className="px-5 py-6">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Navigation
            </p>

            <div className="space-y-2">
              {visibleNavigationItems.map((item) => (
                <DesktopNavigationLink
                  key={item.to}
                  label={item.label}
                  to={item.to}
                />
              ))}
            </div>
          </nav>

          <div className="mt-auto px-5 pb-6">
            <SessionCard
              userEmail={user?.email ?? 'Authenticated user'}
              role={role}
              isLoadingRole={isLoadingRole}
              isSigningOut={isSigningOut}
              onSignOut={handleSignOut}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {/* Mobile Top Bar */}
          <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <img
                  src="/branding/axis-logo-dark.png"
                  alt="Axis Communications"
                  className="h-auto w-[118px]"
                />

                <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#777777]">
                  Demo Assets
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8d8d4] bg-white text-[#171717] shadow-sm transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
              >
                <span className="flex flex-col gap-1.5">
                  <span className="h-0.5 w-5 rounded-full bg-[#171717]" />
                  <span className="h-0.5 w-5 rounded-full bg-[#171717]" />
                  <span className="h-0.5 w-5 rounded-full bg-[#171717]" />
                </span>
              </button>
            </div>
          </header>

          <Outlet />
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/45"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-[#181818] text-white shadow-2xl">
            <div className="border-b border-white/10 px-6 pb-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <img
                    src="/branding/axis-logo-white.png"
                    alt="Axis Communications"
                    className="h-auto w-[185px]"
                  />

                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffda00]">
                    Internal Operations
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white">
                    Demo Assets Control
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/65">
                    Inventory &amp; Loan Control
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-xl font-light text-white transition hover:bg-white/[0.12]"
                >
                  ×
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-5 py-6">
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Navigation
              </p>

              <div className="space-y-2">
                {visibleNavigationItems.map((item) => (
                  <MobileNavigationLink
                    key={item.to}
                    label={item.label}
                    to={item.to}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>
            </nav>

            <div className="border-t border-white/10 px-5 py-5">
              <SessionCard
                userEmail={user?.email ?? 'Authenticated user'}
                role={role}
                isLoadingRole={isLoadingRole}
                isSigningOut={isSigningOut}
                onSignOut={handleSignOut}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function DesktopNavigationLink({
  label,
  to,
}: {
  label: string
  to: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group relative flex w-full items-center rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
          isActive
            ? 'bg-[#ffda00] text-[#111111] shadow-[0_14px_35px_rgba(0,0,0,0.24)]'
            : 'text-white/72 hover:bg-white/[0.06] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`mr-3 h-2.5 w-2.5 rounded-full transition ${
              isActive
                ? 'bg-[#ef3340]'
                : 'bg-white/25 group-hover:bg-[#ffda00]'
            }`}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

function MobileNavigationLink({
  label,
  to,
  onNavigate,
}: {
  label: string
  to: string
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex w-full items-center rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
          isActive
            ? 'bg-[#ffda00] text-[#111111] shadow-[0_14px_35px_rgba(0,0,0,0.24)]'
            : 'text-white/72 hover:bg-white/[0.06] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`mr-3 h-2.5 w-2.5 rounded-full transition ${
              isActive
                ? 'bg-[#ef3340]'
                : 'bg-white/25 group-hover:bg-[#ffda00]'
            }`}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

function SessionCard({
  userEmail,
  role,
  isLoadingRole,
  isSigningOut,
  onSignOut,
}: {
  userEmail: string
  role: string
  isLoadingRole: boolean
  isSigningOut: boolean
  onSignOut: () => void
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
        Active Session
      </p>

      <p className="mt-4 break-words text-base font-semibold text-white">
        {userEmail}
      </p>

      <div className="mt-2 inline-flex rounded-full border border-[#ffda00]/30 bg-[#ffda00]/10 px-3 py-1 text-xs font-semibold text-[#ffda00]">
        {isLoadingRole ? 'Loading role...' : role}
      </div>

      <div className="mt-5 h-px bg-white/10" />

      <p className="mt-4 text-xs leading-5 text-white/50">
        Demo inventory and equipment loan control.
      </p>

      <button
        type="button"
        onClick={onSignOut}
        disabled={isSigningOut}
        className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
          isSigningOut
            ? 'cursor-not-allowed bg-white/10 text-white/45'
            : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]'
        }`}
      >
        {isSigningOut ? 'Signing Out...' : 'Sign Out'}
      </button>
    </div>
  )
}

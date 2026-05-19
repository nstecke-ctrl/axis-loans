import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

const navigationItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Inventory', to: '/inventory' },
  { label: 'Loans', to: '/loans' },
  { label: 'Loan Requests', to: '/loan-requests' },
  { label: 'Activity Log', to: '/movements' },
]

export function AppLayout() {
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

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

  async function handleSignOut() {
    setIsSigningOut(true)

    const { error } = await supabase.auth.signOut({
      scope: 'local',
    })

    if (error) {
      setIsSigningOut(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#171717]">
      <div className="flex min-h-screen">
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
                Axis Demo Assets
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
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="mt-auto px-5 pb-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Active Session
              </p>

              <p className="mt-4 break-words text-base font-semibold text-white">
                {user?.email ?? 'Authenticated user'}
              </p>

              <div className="mt-2 inline-flex rounded-full border border-[#ffda00]/30 bg-[#ffda00]/10 px-3 py-1 text-xs font-semibold text-[#ffda00]">
                Administrator
              </div>

              <div className="mt-5 h-px bg-white/10" />

              <p className="mt-4 text-xs leading-5 text-white/50">
                Demo inventory and equipment loan control.
              </p>

              <button
                type="button"
                onClick={handleSignOut}
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
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
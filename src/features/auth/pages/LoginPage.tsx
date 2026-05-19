import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function checkExistingSession() {
      const { data } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (data.session) {
        navigate('/dashboard', { replace: true })
        return
      }

      setIsCheckingSession(false)
    }

    void checkExistingSession()

    return () => {
      isMounted = false
    }
  }, [navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setLoginError('Enter your email and password.')
      return
    }

    setIsLoading(true)
    setLoginError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setLoginError('Unable to sign in. Check your email and password.')
      setIsLoading(false)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f3] px-6 text-[#171717]">
        <div className="rounded-3xl border border-[#e5e5e2] bg-white px-8 py-7 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
            Axis Demo Assets
          </p>

          <p className="mt-3 text-base font-medium text-[#171717]">
            Checking active session...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#171717]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#181818] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,218,0,0.18),transparent_34rem)]" />

          <div className="relative">
            <img
              src="/branding/axis-logo-white.png"
              alt="Axis Communications"
              className="h-auto w-full max-w-[290px]"
            />

            <div className="mt-16 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ffda00]">
                Internal Operations
              </p>

              <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-white">
                Axis Demo Assets
              </h1>

              <p className="mt-5 text-xl leading-8 text-white/72">
                Inventory &amp; Loan Control for demo equipment, approvals,
                traceability and returns.
              </p>
            </div>
          </div>

          <div className="relative max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
              System Scope
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-2xl font-semibold text-[#ffda00]">
                  Inventory
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Track physical assets and current status.
                </p>
              </div>

              <div>
                <p className="text-2xl font-semibold text-[#ffda00]">
                  Loans
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Control checkouts, returns and owners.
                </p>
              </div>

              <div>
                <p className="text-2xl font-semibold text-[#ffda00]">
                  Requests
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Review and approve public equipment requests.
                </p>
              </div>
            </div>
          </div>
        </section>

        <main className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-14">
          <div className="w-full max-w-xl">
            <div className="lg:hidden">
              <img
                src="/branding/axis-logo-dark.png"
                alt="Axis Communications"
                className="h-auto w-full max-w-[250px]"
              />
            </div>

            <div className="mt-10 lg:mt-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
                Axis Demo Assets
              </p>

              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[#171717]">
                Sign In
              </h2>

              <p className="mt-4 max-w-lg text-base leading-7 text-[#555555]">
                Access the internal inventory, equipment loans, returns and
                administrative approval workflows.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm md:p-8"
            >
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444444]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@axis.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#444444]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                  />
                </div>
              </div>

              {loginError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {loginError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
                  isLoading
                    ? 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                    : 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                }`}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>

              <p className="mt-4 text-center text-sm leading-6 text-[#666666]">
                Access restricted to authorized administrators.
              </p>
            </form>

            <div className="mt-6 rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-[#171717]">
                Need to request demo equipment?
              </p>

              <p className="mt-2 text-sm leading-6 text-[#555555]">
                Submit a public request using the official Axis pricelist. The
                request will be reviewed by the administrator before any loan is
                created.
              </p>

              <Link
                to="/request-equipment"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#181818] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
              >
                Request Demo Equipment
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
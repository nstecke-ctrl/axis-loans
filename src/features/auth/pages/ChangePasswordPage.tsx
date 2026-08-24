import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'

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

export function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('Use at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Both passwords must match.')
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        throw error
      }

      const response = await fetch('/api/complete-password-change', {
        method: 'POST',
        headers: await getAuthHeaders(),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Password status could not be updated.',
        )
      }

      window.location.assign('/dashboard')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Password could not be changed.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#171717]">
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <img
            src="/branding/axis-logo-dark.png"
            alt="Axis Communications"
            className="h-auto w-full max-w-[250px]"
          />

          <div className="mt-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
              Demo Assets Control
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#171717]">
              Create New Password
            </h1>

            <p className="mt-4 text-base leading-7 text-[#555555]">
              Your administrator issued a temporary password. Create a new one
              before entering the system.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm md:p-8"
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
                isSaving
                  ? 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                  : 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

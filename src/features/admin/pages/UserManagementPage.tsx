import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { AppRole } from '../../../components/auth/appRoleCore'
import {
  createAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUserRecord,
} from '../data/adminUsers'

const roleOptions: Array<{
  value: AppRole
  label: string
  description: string
}> = [
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full access, user management and system configuration.',
  },
  {
    value: 'operator',
    label: 'Operator',
    description: 'Can approve requests, create loans and register returns.',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to operational information.',
  },
]

function formatDate(value: string | null) {
  if (!value) {
    return 'Never'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value))
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  )
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [resettingUserId, setResettingUserId] = useState<string | null>(
    null,
  )

  const [newEmail, setNewEmail] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newRole, setNewRole] = useState<AppRole>('viewer')
  const [isCreating, setIsCreating] = useState(false)

  const roleCounts = useMemo(
    () => ({
      admin: users.filter((user) => user.role === 'admin').length,
      operator: users.filter((user) => user.role === 'operator').length,
      viewer: users.filter((user) => user.role === 'viewer').length,
    }),
    [users],
  )

  async function loadUsers() {
    setIsLoading(true)
    setLoadError(null)

    try {
      setUsers(await fetchAdminUsers())
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load users.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // The first user list load is the page's external data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers()
  }, [])

  function updateUserDraft(
    userId: string,
    fields: Partial<Pick<AdminUserRecord, 'displayName' | 'role'>>,
  ) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId ? { ...user, ...fields } : user,
      ),
    )
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError(null)
    setSuccessMessage(null)
    setTemporaryPassword(null)

    const email = newEmail.trim().toLowerCase()
    const displayName = newDisplayName.trim()

    if (!isEmail(email)) {
      setActionError('Enter a valid email address.')
      return
    }

    if (!displayName) {
      setActionError('Enter the user display name.')
      return
    }

    setIsCreating(true)

    try {
      const result = await createAdminUser({
        email,
        displayName,
        role: newRole,
      })

      setUsers((currentUsers) => {
        const withoutUser = currentUsers.filter(
          (user) => user.id !== result.user.id,
        )

        return [...withoutUser, result.user].sort((a, b) =>
          a.email.localeCompare(b.email),
        )
      })

      setTemporaryPassword(result.temporaryPassword ?? null)
      setSuccessMessage(
        result.created
          ? `${result.user.email} was created. Share the temporary password directly with the user.`
          : `${result.user.email} already existed and was updated.`,
      )
      setNewEmail('')
      setNewDisplayName('')
      setNewRole('viewer')
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'User could not be created.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleSaveUser(user: AdminUserRecord) {
    setActionError(null)
    setSuccessMessage(null)
    setTemporaryPassword(null)
    setSavingUserId(user.id)

    try {
      const result = await updateAdminUser({
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
      })

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === result.user.id ? result.user : currentUser,
        ),
      )
      setSuccessMessage(`${result.user.email} was updated.`)
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'User could not be updated.',
      )
      void loadUsers()
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleResetPassword(user: AdminUserRecord) {
    setActionError(null)
    setSuccessMessage(null)
    setTemporaryPassword(null)
    setResettingUserId(user.id)

    try {
      const result = await resetAdminUserPassword(user.id)

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === result.user.id ? result.user : currentUser,
        ),
      )
      setTemporaryPassword(result.temporaryPassword ?? null)
      setSuccessMessage(
        `${result.user.email} must sign in with the temporary password and create a new one.`,
      )
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Password could not be reset.',
      )
    } finally {
      setResettingUserId(null)
    }
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div>
          <p className="text-sm font-medium text-[#666666]">
            Administration
          </p>

          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
            Users & Permissions
          </h2>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Administrators" value={roleCounts.admin} />
          <MetricCard label="Operators" value={roleCounts.operator} />
          <MetricCard label="Viewers" value={roleCounts.viewer} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <form
            onSubmit={handleCreateUser}
            className="rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm"
          >
            <div>
              <h3 className="text-lg font-semibold text-[#171717]">
                Create User
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#555555]">
                New users receive a temporary password and must create their
                own password on first sign-in.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                />
              </Field>

              <Field label="Display Name">
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(event) =>
                    setNewDisplayName(event.target.value)
                  }
                  placeholder="Nicolas Steck"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                />
              </Field>

              <Field label="Role">
                <select
                  value={newRole}
                  onChange={(event) =>
                    setNewRole(event.target.value as AppRole)
                  }
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                isCreating
                  ? 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                  : 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
              }`}
            >
              {isCreating ? 'Creating...' : 'Create User'}
            </button>
          </form>

          <div className="rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[#171717]">
              Permission Levels
            </h3>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {roleOptions.map((option) => (
                <div
                  key={option.value}
                  className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4"
                >
                  <p className="text-sm font-semibold text-[#171717]">
                    {option.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    {option.description}
                  </p>
                </div>
              ))}
            </div>

            {(actionError || successMessage || temporaryPassword) && (
              <div className="mt-5 space-y-3">
                {actionError && (
                  <Notice tone="error" title="Action could not be completed">
                    {actionError}
                  </Notice>
                )}

                {successMessage && (
                  <Notice tone="success" title="User management updated">
                    {successMessage}
                  </Notice>
                )}

                {temporaryPassword && (
                  <Notice tone="warning" title="Temporary Password">
                    <span className="block break-all font-mono text-sm">
                      {temporaryPassword}
                    </span>
                    <span className="mt-2 block">
                      This password is only shown now. The user will be forced
                      to replace it after signing in.
                    </span>
                  </Notice>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
          <div className="border-b border-[#e5e5e2] p-5">
            <h3 className="text-lg font-semibold text-[#171717]">
              Active Users
            </h3>
          </div>

          {loadError && (
            <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Users could not be loaded
              </p>
              <p className="mt-2 text-sm leading-6 text-red-700">
                {loadError}
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e5e5e2]">
              <thead className="bg-[#fafaf8]">
                <tr>
                  <TableHeader>User</TableHeader>
                  <TableHeader>Role</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Last Sign-In</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeeeb] bg-white">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm font-medium text-[#666666]"
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm font-medium text-[#666666]"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="min-w-[280px] px-5 py-4">
                        <input
                          type="text"
                          value={user.displayName}
                          onChange={(event) =>
                            updateUserDraft(user.id, {
                              displayName: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-[#d8d8d4] bg-white px-3 py-2.5 text-sm font-semibold text-[#171717] outline-none transition focus:border-[#ffda00]"
                        />
                        <p className="mt-2 break-all text-sm text-[#666666]">
                          {user.email}
                        </p>
                      </td>

                      <td className="min-w-[190px] px-5 py-4">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            updateUserDraft(user.id, {
                              role: event.target.value as AppRole,
                            })
                          }
                          className="w-full rounded-xl border border-[#d8d8d4] bg-white px-3 py-2.5 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                        >
                          {roleOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="min-w-[180px] px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            user.passwordResetRequired
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {user.passwordResetRequired
                            ? 'Password change required'
                            : 'Active'}
                        </span>
                      </td>

                      <td className="min-w-[150px] px-5 py-4 text-sm text-[#555555]">
                        {formatDate(user.lastSignInAt)}
                      </td>

                      <td className="min-w-[240px] px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveUser(user)}
                            disabled={savingUserId === user.id}
                            className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                              savingUserId === user.id
                                ? 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                                : 'bg-[#181818] text-white hover:bg-black'
                            }`}
                          >
                            {savingUserId === user.id ? 'Saving...' : 'Save'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            disabled={resettingUserId === user.id}
                            className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                              resettingUserId === user.id
                                ? 'cursor-not-allowed border-[#e5e5e2] bg-[#ecece8] text-[#888888]'
                                : 'border-[#d8d8d4] bg-white text-[#171717] hover:border-[#bfbfba] hover:bg-[#fafaf8]'
                            }`}
                          >
                            {resettingUserId === user.id
                              ? 'Resetting...'
                              : 'Reset Password'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#171717]">
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </span>
      {children}
    </label>
  )
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: 'error' | 'success' | 'warning'
  title: string
  children: ReactNode
}) {
  const toneClasses = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6">{children}</p>
    </div>
  )
}

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#666666]">
      {children}
    </th>
  )
}

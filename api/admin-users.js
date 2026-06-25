import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

const validRoles = new Set(['admin', 'operator', 'viewer'])

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, jsonHeaders)
  res.end(JSON.stringify(payload))
}

function getBearerToken(req) {
  const authorization = req.headers.authorization ?? ''

  if (!authorization.startsWith('Bearer ')) {
    return ''
  }

  return authorization.slice('Bearer '.length).trim()
}

function normalizeBody(req) {
  if (!req.body) {
    return {}
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return req.body
}

function normalizeRole(role) {
  return validRoles.has(role) ? role : ''
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function normalizeDisplayName(displayName, fallbackEmail) {
  const value = String(displayName ?? '').trim()

  if (value) {
    return value
  }

  return fallbackEmail.split('@')[0] || 'Demo Assets user'
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function createTemporaryPassword() {
  return `Dac-${randomBytes(12).toString('base64url')}!9`
}

function normalizeTemporaryPassword(value) {
  const password = String(value ?? '').trim()

  return password.length >= 8 ? password : createTemporaryPassword()
}

function mapUser(authUser, roleRecord) {
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    displayName:
      roleRecord?.display_name ??
      authUser.user_metadata?.display_name ??
      authUser.email?.split('@')[0] ??
      '',
    role: normalizeRole(roleRecord?.role) || 'viewer',
    passwordResetRequired: Boolean(roleRecord?.password_reset_required),
    createdAt: authUser.created_at ?? null,
    lastSignInAt: authUser.last_sign_in_at ?? null,
  }
}

async function createServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function requireAdmin(req, supabase) {
  const token = getBearerToken(req)

  if (!token) {
    return { error: { status: 401, message: 'Missing session token.' } }
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token)

  if (userError || !userData.user) {
    return { error: { status: 401, message: 'Invalid session token.' } }
  }

  const { data: roleRecord, error: roleError } = await supabase
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (roleError || roleRecord?.role !== 'admin') {
    return { error: { status: 403, message: 'Admin access required.' } }
  }

  return { user: userData.user }
}

async function listAuthUsers(supabase) {
  const users = []
  let page = 1
  const perPage = 100

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw error
    }

    users.push(...(data.users ?? []))

    if (!data.users || data.users.length < perPage) {
      break
    }

    page += 1
  }

  return users
}

async function findAuthUserByEmail(supabase, email) {
  const users = await listAuthUsers(supabase)

  return users.find((user) => user.email?.toLowerCase() === email) ?? null
}

async function getRoleRecordsByUserId(supabase) {
  const { data, error } = await supabase
    .from('app_user_roles')
    .select('user_id, role, display_name, password_reset_required')

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((record) => [record.user_id, record]))
}

async function assertCanChangeRole(supabase, userId, requestedRole) {
  if (requestedRole === 'admin') {
    return
  }

  const { count, error } = await supabase
    .from('app_user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin')

  if (error) {
    throw error
  }

  const { data: currentRoleRecord, error: currentRoleError } = await supabase
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (currentRoleError) {
    throw currentRoleError
  }

  if (currentRoleRecord?.role === 'admin' && Number(count ?? 0) <= 1) {
    const error = new Error('At least one administrator must remain active.')
    error.status = 400
    throw error
  }
}

async function handleListUsers(req, res, supabase) {
  const adminCheck = await requireAdmin(req, supabase)

  if (adminCheck.error) {
    sendJson(res, adminCheck.error.status, { error: adminCheck.error.message })
    return
  }

  const [authUsers, roleRecordsByUserId] = await Promise.all([
    listAuthUsers(supabase),
    getRoleRecordsByUserId(supabase),
  ])

  const users = authUsers
    .map((authUser) => mapUser(authUser, roleRecordsByUserId.get(authUser.id)))
    .sort((a, b) => a.email.localeCompare(b.email))

  sendJson(res, 200, { users })
}

async function handleCreateUser(req, res, supabase) {
  const adminCheck = await requireAdmin(req, supabase)

  if (adminCheck.error) {
    sendJson(res, adminCheck.error.status, { error: adminCheck.error.message })
    return
  }

  const body = normalizeBody(req)
  const email = normalizeEmail(body.email)
  const role = normalizeRole(body.role)
  const displayName = normalizeDisplayName(body.displayName, email)
  const requestedTemporaryPassword = body.temporaryPassword

  if (!isValidEmail(email)) {
    sendJson(res, 400, { error: 'A valid email address is required.' })
    return
  }

  if (!role) {
    sendJson(res, 400, { error: 'A valid role is required.' })
    return
  }

  let authUser = await findAuthUserByEmail(supabase, email)
  let temporaryPassword = null
  let created = false

  if (!authUser) {
    temporaryPassword = normalizeTemporaryPassword(requestedTemporaryPassword)

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    })

    if (error || !data.user) {
      throw error ?? new Error('User could not be created.')
    }

    authUser = data.user
    created = true
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: {
          ...authUser.user_metadata,
          display_name: displayName,
        },
      },
    )

    if (error || !data.user) {
      throw error ?? new Error('User could not be updated.')
    }

    authUser = data.user
  }

  await assertCanChangeRole(supabase, authUser.id, role)

  const { data: roleRecord, error: roleError } = await supabase
    .from('app_user_roles')
    .upsert(
      {
        user_id: authUser.id,
        role,
        display_name: displayName,
        password_reset_required: created,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, role, display_name, password_reset_required')
    .single()

  if (roleError) {
    throw roleError
  }

  sendJson(res, created ? 201 : 200, {
    user: mapUser(authUser, roleRecord),
    temporaryPassword,
    created,
  })
}

async function createOrUpdateManagedUser(supabase, input) {
  const email = normalizeEmail(input.email)
  const role = normalizeRole(input.role)
  const displayName = normalizeDisplayName(input.displayName, email)
  const temporaryPassword = normalizeTemporaryPassword(
    input.temporaryPassword,
  )
  const resetExistingPassword = Boolean(input.resetExistingPassword)

  if (!isValidEmail(email)) {
    throw new Error(`${email || 'User'} does not have a valid email.`)
  }

  if (!role) {
    throw new Error(`${email} does not have a valid role.`)
  }

  let authUser = await findAuthUserByEmail(supabase, email)
  let created = false
  let passwordWasSet = false

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    })

    if (error || !data.user) {
      throw error ?? new Error(`${email} could not be created.`)
    }

    authUser = data.user
    created = true
    passwordWasSet = true
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(
      authUser.id,
      {
        ...(resetExistingPassword ? { password: temporaryPassword } : {}),
        user_metadata: {
          ...authUser.user_metadata,
          display_name: displayName,
        },
      },
    )

    if (error || !data.user) {
      throw error ?? new Error(`${email} could not be updated.`)
    }

    authUser = data.user
    passwordWasSet = resetExistingPassword
  }

  await assertCanChangeRole(supabase, authUser.id, role)

  const { data: roleRecord, error: roleError } = await supabase
    .from('app_user_roles')
    .upsert(
      {
        user_id: authUser.id,
        role,
        display_name: displayName,
        password_reset_required: created || passwordWasSet,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, role, display_name, password_reset_required')
    .single()

  if (roleError) {
    throw roleError
  }

  return {
    user: mapUser(authUser, roleRecord),
    created,
    passwordWasSet,
  }
}

async function handleBulkCreateUsers(req, res, supabase) {
  const adminCheck = await requireAdmin(req, supabase)

  if (adminCheck.error) {
    sendJson(res, adminCheck.error.status, { error: adminCheck.error.message })
    return
  }

  const body = normalizeBody(req)
  const users = Array.isArray(body.users) ? body.users : []
  const temporaryPassword = normalizeTemporaryPassword(body.temporaryPassword)
  const resetExistingPasswords = Boolean(body.resetExistingPasswords)

  if (users.length === 0) {
    sendJson(res, 400, { error: 'At least one user is required.' })
    return
  }

  if (users.length > 50) {
    sendJson(res, 400, { error: 'Bulk creation is limited to 50 users.' })
    return
  }

  const results = []

  for (const user of users) {
    const result = await createOrUpdateManagedUser(supabase, {
      ...user,
      temporaryPassword,
      resetExistingPassword: resetExistingPasswords,
    })

    results.push(result)
  }

  sendJson(res, 200, {
    users: results.map((result) => result.user),
    createdCount: results.filter((result) => result.created).length,
    updatedCount: results.filter((result) => !result.created).length,
    passwordResetCount: results.filter((result) => result.passwordWasSet)
      .length,
    temporaryPassword,
  })
}

async function handleUpdateUser(req, res, supabase) {
  const adminCheck = await requireAdmin(req, supabase)

  if (adminCheck.error) {
    sendJson(res, adminCheck.error.status, { error: adminCheck.error.message })
    return
  }

  const body = normalizeBody(req)
  const action = String(body.action ?? 'updateProfile')
  const userId = String(body.userId ?? '').trim()
  const role = normalizeRole(body.role)

  if (!userId) {
    sendJson(res, 400, { error: 'userId is required.' })
    return
  }

  if (action === 'resetPassword') {
    await handleResetPassword(res, supabase, userId)
    return
  }

  if (!role) {
    sendJson(res, 400, { error: 'A valid role is required.' })
    return
  }

  const { data: authUserData, error: authUserError } =
    await supabase.auth.admin.getUserById(userId)

  if (authUserError || !authUserData.user) {
    sendJson(res, 404, { error: 'User not found.' })
    return
  }

  const email = normalizeEmail(authUserData.user.email)
  const displayName = normalizeDisplayName(body.displayName, email)

  await assertCanChangeRole(supabase, userId, role)

  const { data: updatedAuthUserData, error: updateAuthError } =
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...authUserData.user.user_metadata,
        display_name: displayName,
      },
    })

  if (updateAuthError || !updatedAuthUserData.user) {
    throw updateAuthError ?? new Error('User could not be updated.')
  }

  const { data: roleRecord, error: roleError } = await supabase
    .from('app_user_roles')
    .upsert(
      {
        user_id: userId,
        role,
        display_name: displayName,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, role, display_name, password_reset_required')
    .single()

  if (roleError) {
    throw roleError
  }

  sendJson(res, 200, {
    user: mapUser(updatedAuthUserData.user, roleRecord),
  })
}

async function handleResetPassword(res, supabase, userId) {
  const { data: authUserData, error: authUserError } =
    await supabase.auth.admin.getUserById(userId)

  if (authUserError || !authUserData.user) {
    sendJson(res, 404, { error: 'User not found.' })
    return
  }

  const temporaryPassword = createTemporaryPassword()

  const { data: updatedAuthUserData, error: updateAuthError } =
    await supabase.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
    })

  if (updateAuthError || !updatedAuthUserData.user) {
    throw updateAuthError ?? new Error('Password could not be reset.')
  }

  const { data: existingRoleRecord, error: existingRoleError } =
    await supabase
      .from('app_user_roles')
      .select('role, display_name')
      .eq('user_id', userId)
      .maybeSingle()

  if (existingRoleError) {
    throw existingRoleError
  }

  const email = normalizeEmail(updatedAuthUserData.user.email)
  const role = normalizeRole(existingRoleRecord?.role) || 'viewer'
  const displayName = normalizeDisplayName(
    existingRoleRecord?.display_name ??
      updatedAuthUserData.user.user_metadata?.display_name,
    email,
  )

  const { data: roleRecord, error: roleError } = await supabase
    .from('app_user_roles')
    .upsert(
      {
        user_id: userId,
        role,
        display_name: displayName,
        password_reset_required: true,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, role, display_name, password_reset_required')
    .single()

  if (roleError) {
    throw roleError
  }

  sendJson(res, 200, {
    user: mapUser(updatedAuthUserData.user, roleRecord),
    temporaryPassword,
  })
}

export default async function handler(req, res) {
  try {
    const supabase = await createServiceClient()

    if (req.method === 'GET') {
      await handleListUsers(req, res, supabase)
      return
    }

    if (req.method === 'POST') {
      const body = normalizeBody(req)

      if (body.action === 'bulkCreate') {
        await handleBulkCreateUsers(req, res, supabase)
        return
      }

      await handleCreateUser(req, res, supabase)
      return
    }

    if (req.method === 'PATCH') {
      await handleUpdateUser(req, res, supabase)
      return
    }

    sendJson(res, 405, { error: 'Method not allowed.' })
  } catch (error) {
    const statusCode =
      typeof error?.status === 'number' ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Unexpected server error.'

    sendJson(res, statusCode, { error: message })
  }
}

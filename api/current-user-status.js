import { createClient } from '@supabase/supabase-js'

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
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

function normalizeRole(role) {
  return validRoles.has(role) ? role : 'viewer'
}

function createServiceClient() {
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' })
    return
  }

  try {
    const supabase = createServiceClient()
    const token = getBearerToken(req)

    if (!token) {
      sendJson(res, 401, { error: 'Missing session token.' })
      return
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token)

    if (userError || !userData.user) {
      sendJson(res, 401, { error: 'Invalid session token.' })
      return
    }

    const { data: roleRecord, error: roleError } = await supabase
      .from('app_user_roles')
      .select('role, display_name, password_reset_required')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (roleError) {
      throw roleError
    }

    sendJson(res, 200, {
      email: userData.user.email ?? '',
      displayName:
        roleRecord?.display_name ??
        userData.user.user_metadata?.display_name ??
        userData.user.email?.split('@')[0] ??
        '',
      role: normalizeRole(roleRecord?.role),
      passwordResetRequired: Boolean(
        roleRecord?.password_reset_required,
      ),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error.'

    sendJson(res, 500, { error: message })
  }
}

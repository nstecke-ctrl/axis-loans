import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const temporaryPassword = process.env.TEMPORARY_PASSWORD ?? 'axis2827'
const resetExistingPasswords = process.env.RESET_EXISTING_PASSWORDS === 'true'

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const users = [
  ['nicolas.steck@axis.com', 'Nicolás Steck', 'admin'],
  ['tamara.castro@axis.com', 'Tamara Castro', 'operator'],
  ['estivalia.sanchez@axis.com', 'Estivalía Sanchez', 'viewer'],
  ['mariano.vega@axis.com', 'Mariano Vega', 'operator'],
  ['israel.soto@axis.com', 'Israel Soto', 'operator'],
  ['oswaldo.suescun@axis.com', 'Oswaldo Suescún', 'viewer'],
  ['daniel.fuente@axis.com', 'Daniel Fuente', 'viewer'],
  ['cristian.aguilera@axis.com', 'Cristian Aguilera', 'viewer'],
  ['jimena.ginetti@axis.com', 'Jimena Ginetti', 'viewer'],
].map(([email, displayName, role]) => ({ email, displayName, role }))

async function findUserByEmail(email) {
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

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    )

    if (user) {
      return user
    }

    if (data.users.length < perPage) {
      return null
    }

    page += 1
  }

  return null
}

for (const user of users) {
  const existingUser = await findUserByEmail(user.email)
  let authUser = existingUser
  let action = 'updated'

  if (!existingUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        display_name: user.displayName,
      },
    })

    if (error || !data.user) {
      throw error ?? new Error(`${user.email} could not be created.`)
    }

    authUser = data.user
    action = 'created'
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        ...(resetExistingPasswords ? { password: temporaryPassword } : {}),
        user_metadata: {
          ...existingUser.user_metadata,
          display_name: user.displayName,
        },
      },
    )

    if (error || !data.user) {
      throw error ?? new Error(`${user.email} could not be updated.`)
    }

    authUser = data.user
  }

  const { error: roleError } = await supabase.from('app_user_roles').upsert(
    {
      user_id: authUser.id,
      display_name: user.displayName,
      role: user.role,
      password_reset_required: true,
    },
    { onConflict: 'user_id' },
  )

  if (roleError) {
    throw roleError
  }

  console.log(`${action}: ${user.email} -> ${user.role}`)
}

console.log('Done. Temporary password:', temporaryPassword)

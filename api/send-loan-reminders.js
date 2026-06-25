import { createClient } from '@supabase/supabase-js'
import {
  hasEmailProviderEnv,
  sendTransactionalEmail,
} from './_email.js'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getAppUrl() {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '')
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return ''
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00Z`)
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(startDate, endDate) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24
  return Math.round(
    (parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) /
      millisecondsPerDay,
  )
}

function formatDate(value) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function getReminderKind(loan, todayKey) {
  const daysUntilReturn = daysBetween(todayKey, loan.expected_return_date)

  if (daysUntilReturn < 0) {
    return {
      kind: 'overdue',
      label:
        daysUntilReturn === -1
          ? '1 day overdue'
          : `${Math.abs(daysUntilReturn)} days overdue`,
      priorityColor: '#991b1b',
      title: `Overdue demo loan ${loan.code}`,
    }
  }

  if (daysUntilReturn <= 7) {
    return {
      kind: 'due_soon',
      label:
        daysUntilReturn === 0
          ? 'Due today'
          : daysUntilReturn === 1
            ? 'Due tomorrow'
            : `Due in ${daysUntilReturn} days`,
      priorityColor: '#92400e',
      title: `Demo loan due soon ${loan.code}`,
    }
  }

  return null
}

function shouldSendReminder(loan, reminder, todayKey) {
  if (!reminder) {
    return false
  }

  const lastSentDate = loan.loan_reminder_last_sent_at
    ? loan.loan_reminder_last_sent_at.slice(0, 10)
    : null

  return (
    loan.loan_reminder_last_kind !== reminder.kind ||
    lastSentDate !== todayKey
  )
}

function getEquipmentSummary(loan) {
  return (loan.loan_items ?? [])
    .filter((item) => item.item_status === 'On Loan')
    .map((item) => {
      const equipment = Array.isArray(item.equipment)
        ? item.equipment[0]
        : item.equipment

      if (!equipment) {
        return null
      }

      return `${equipment.code} - ${equipment.model} (${equipment.serial_number})`
    })
    .filter(Boolean)
}

function buildReminderHtml({ appUrl, loan, reminder, equipmentSummary }) {
  const detailUrl = appUrl
    ? `${appUrl}/loans/${encodeURIComponent(loan.code)}`
    : ''

  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#171717">
      <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(reminder.title)}</h1>
      <p style="margin:0 0 18px;color:${reminder.priorityColor}">
        <strong>${escapeHtml(reminder.label)}</strong>
      </p>

      <table style="border-collapse:collapse;width:100%;max-width:680px">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Loan</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(loan.code)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Company</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(loan.company)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Contact</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(loan.contact_name || 'Not registered')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Follow-up owner</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(loan.responsible)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Delivered by</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(loan.checkout_handler || 'Not registered')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Expected return</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(formatDate(loan.expected_return_date))}</td></tr>
        </tbody>
      </table>

      <p style="margin:18px 0 0"><strong>Equipment still on loan</strong></p>
      <ul style="margin:8px 0 18px;padding-left:20px">
        ${
          equipmentSummary.length > 0
            ? equipmentSummary
                .map((equipment) => `<li>${escapeHtml(equipment)}</li>`)
                .join('')
            : '<li>No equipment detail available.</li>'
        }
      </ul>

      ${
        detailUrl
          ? `<p><a href="${detailUrl}" style="display:inline-block;background:#181818;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px">Review loan</a></p>`
          : ''
      }
    </div>
  `
}

function buildReminderText({ appUrl, loan, reminder, equipmentSummary }) {
  const detailUrl = appUrl
    ? `${appUrl}/loans/${encodeURIComponent(loan.code)}`
    : ''

  return [
    reminder.title,
    reminder.label,
    '',
    `Loan: ${loan.code}`,
    `Company: ${loan.company}`,
    `Contact: ${loan.contact_name || 'Not registered'}`,
    `Follow-up owner: ${loan.responsible}`,
    `Delivered by: ${loan.checkout_handler || 'Not registered'}`,
    `Expected return: ${formatDate(loan.expected_return_date)}`,
    '',
    'Equipment still on loan:',
    ...(equipmentSummary.length > 0
      ? equipmentSummary.map((equipment) => `- ${equipment}`)
      : ['- No equipment detail available.']),
    detailUrl ? `Review: ${detailUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function updateLoanReminderStatus(supabase, loanCode, fields) {
  await supabase.from('loans').update(fields).eq('code', loanCode)
}

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return false
  }

  return req.headers.authorization === `Bearer ${cronSecret}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, jsonHeaders)
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (!isAuthorized(req)) {
    res.writeHead(401, jsonHeaders)
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const mailFrom = process.env.MAIL_FROM
  const fallbackEmail = process.env.NOTIFICATION_FALLBACK_EMAIL
  const auditBccEmail =
    process.env.NOTIFICATION_AUDIT_BCC_EMAIL ??
    'admin@assetloancontrol.com'
  const dryRun = req.query?.dryRun === '1' || req.query?.dryRun === 'true'

  if (!supabaseUrl || !serviceRoleKey) {
    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Supabase server env missing' }))
    return
  }

  if (!dryRun && !hasEmailProviderEnv()) {
    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Email provider env missing' }))
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const todayKey = toDateKey(new Date())
  const nextWeekKey = toDateKey(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  )

  const { data: loans, error: loansError } = await supabase
    .from('loans')
    .select(
      `
      code,
      company,
      contact_name,
      checkout_handler,
      responsible,
      expected_return_date,
      status,
      loan_reminder_last_sent_at,
      loan_reminder_last_kind,
      loan_reminder_error,
      loan_items (
        item_status,
        equipment (
          code,
          model,
          serial_number
        )
      )
    `,
    )
    .in('status', ['Active', 'Due Soon', 'Overdue'])
    .lte('expected_return_date', nextWeekKey)
    .order('expected_return_date', { ascending: true })

  if (loansError) {
    res.writeHead(500, jsonHeaders)
    res.end(JSON.stringify({ error: loansError.message }))
    return
  }

  const { data: contacts } = await supabase
    .from('internal_contact_emails')
    .select('display_name, email, notification_enabled')

  const contactByName = new Map(
    (contacts ?? []).map((contact) => [contact.display_name, contact]),
  )

  const appUrl = getAppUrl()
  const results = []

  for (const loan of loans ?? []) {
    const reminder = getReminderKind(loan, todayKey)

    if (!shouldSendReminder(loan, reminder, todayKey)) {
      results.push({
        code: loan.code,
        skipped: true,
        reason: 'Already reminded today or not due',
      })
      continue
    }

    const contact = contactByName.get(loan.responsible)
    const recipient =
      contact?.notification_enabled && contact.email
        ? contact.email
        : fallbackEmail

    if (!recipient) {
      await updateLoanReminderStatus(supabase, loan.code, {
        loan_reminder_error: 'Reminder skipped: missing responsible email and fallback email.',
      })

      results.push({
        code: loan.code,
        skipped: true,
        reason: 'Missing recipient',
      })
      continue
    }

    const equipmentSummary = getEquipmentSummary(loan)
    const payload = {
      subject: `${reminder.title} - ${loan.company}`,
      html: buildReminderHtml({
        appUrl,
        loan,
        reminder,
        equipmentSummary,
      }),
      text: buildReminderText({
        appUrl,
        loan,
        reminder,
        equipmentSummary,
      }),
    }

    if (dryRun) {
      results.push({
        code: loan.code,
        dryRun: true,
        kind: reminder.kind,
        to: recipient,
      })
      continue
    }

    try {
      await sendTransactionalEmail({
        from: mailFrom,
        to: recipient,
        bcc: auditBccEmail,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      })

      await updateLoanReminderStatus(supabase, loan.code, {
        loan_reminder_last_sent_at: new Date().toISOString(),
        loan_reminder_last_kind: reminder.kind,
        loan_reminder_error: null,
      })

      results.push({
        code: loan.code,
        sent: true,
        kind: reminder.kind,
        to: recipient,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Email provider rejected request.'

      await updateLoanReminderStatus(supabase, loan.code, {
        loan_reminder_error: message,
      })

      results.push({
        code: loan.code,
        sent: false,
        kind: reminder.kind,
        reason: message,
      })
    }
  }

  res.writeHead(200, jsonHeaders)
  res.end(
    JSON.stringify({
      dryRun,
      checked: loans?.length ?? 0,
      results,
    }),
  )
}

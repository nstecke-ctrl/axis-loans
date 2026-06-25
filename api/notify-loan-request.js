import { createClient } from '@supabase/supabase-js'
import {
  hasEmailProviderEnv,
  sendTransactionalEmail,
} from './_email.js'

const jsonHeaders = {
  'Content-Type': 'application/json',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildEmailHtml({ request }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#171717">
      <h1 style="font-size:20px;margin:0 0 12px">Asset Loan Control - ${escapeHtml(request.code)}</h1>
      <p style="margin:0 0 16px">
        A new equipment request was assigned to ${escapeHtml(request.requested_handler)}.
      </p>
      <p style="margin:0 0 4px"><strong>Requester:</strong> ${escapeHtml(request.requester_name)}</p>
      <p style="margin:0 0 4px"><strong>Company:</strong> ${escapeHtml(request.requester_company)}</p>
      <p style="margin:0 0 4px"><strong>Email:</strong> ${escapeHtml(request.requester_email)}</p>
      <p style="margin:0 0 4px"><strong>Expected return:</strong> ${escapeHtml(request.expected_return_date)}</p>
      <p style="margin:0 0 16px"><strong>MSRP total:</strong> ${formatCurrency(request.msrp_total_amount)}</p>
      <p style="margin:0 0 4px"><strong>Use case:</strong></p>
      <p style="margin:0">${escapeHtml(request.requested_use_case)}</p>
    </div>
  `
}

function buildEmailText({ request }) {
  return [
    `Asset Loan Control - ${request.code}`,
    '',
    `A new equipment request was assigned to ${request.requested_handler}.`,
    '',
    `Request: ${request.code}`,
    `Requested to: ${request.requested_handler}`,
    `Requester: ${request.requester_name}`,
    `Company: ${request.requester_company}`,
    `Email: ${request.requester_email}`,
    `Expected return: ${request.expected_return_date}`,
    `MSRP total: ${formatCurrency(request.msrp_total_amount)}`,
    '',
    `Use case: ${request.requested_use_case}`,
    '',
    'Open Asset Loan Control to review this request.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function updateNotificationStatus(supabase, requestCode, fields) {
  await supabase
    .from('loan_requests')
    .update(fields)
    .eq('code', requestCode)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, jsonHeaders)
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const mailFrom = process.env.MAIL_FROM
  const fallbackEmail = process.env.NOTIFICATION_FALLBACK_EMAIL
  const auditBccEmail =
    process.env.NOTIFICATION_AUDIT_BCC_EMAIL ??
    'admin@assetloancontrol.com'

  if (!supabaseUrl || !serviceRoleKey) {
    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Supabase server env missing' }))
    return
  }

  let requestCode = ''

  try {
    requestCode =
      typeof req.body === 'string'
        ? JSON.parse(req.body).requestCode
        : req.body?.requestCode
  } catch {
    requestCode = ''
  }

  if (!requestCode) {
    res.writeHead(400, jsonHeaders)
    res.end(JSON.stringify({ error: 'requestCode is required' }))
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: request, error: requestError } = await supabase
    .from('loan_requests')
    .select(
      `
      code,
      requester_name,
      requester_company,
      requester_email,
      requested_handler,
      requested_use_case,
      expected_return_date,
      msrp_total_amount,
      request_notification_sent_at,
      request_notification_error
    `,
    )
    .eq('code', requestCode)
    .maybeSingle()

  if (requestError || !request) {
    res.writeHead(404, jsonHeaders)
    res.end(JSON.stringify({ error: 'Loan request not found' }))
    return
  }

  if (request.request_notification_sent_at) {
    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Already notified' }))
    return
  }

  const { data: contact } = await supabase
    .from('internal_contact_emails')
    .select('email, notification_enabled')
    .eq('display_name', request.requested_handler)
    .maybeSingle()

  const recipient =
    contact?.notification_enabled && contact.email
      ? contact.email
      : fallbackEmail

  if (!recipient || !hasEmailProviderEnv()) {
    await updateNotificationStatus(supabase, requestCode, {
      request_notification_error:
        'Email skipped: missing recipient or email provider configuration.',
    })

    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Email env or recipient missing' }))
    return
  }

  try {
    await sendTransactionalEmail({
      from: mailFrom,
      to: recipient,
      bcc: auditBccEmail,
      subject: `Asset Loan Control ${request.code}`,
      html: buildEmailHtml({ request }),
      text: buildEmailText({ request }),
    })
  } catch (error) {
    const errorText =
      error instanceof Error
        ? error.message
        : 'Email provider rejected request'

    await updateNotificationStatus(supabase, requestCode, {
      request_notification_error: errorText.slice(0, 1000),
    })

    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Email provider rejected request' }))
    return
  }

  await updateNotificationStatus(supabase, requestCode, {
    request_notification_sent_at: new Date().toISOString(),
    request_notification_error: null,
  })

  res.writeHead(200, jsonHeaders)
  res.end(JSON.stringify({ sent: true, to: recipient }))
}

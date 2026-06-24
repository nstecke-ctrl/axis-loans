import { createClient } from '@supabase/supabase-js'

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

function getAppUrl() {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '')
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return ''
}

function buildEmailHtml({ appUrl, request }) {
  const detailUrl = appUrl
    ? `${appUrl}/loan-requests/${encodeURIComponent(request.code)}`
    : ''

  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#171717">
      <h1 style="font-size:22px;margin:0 0 12px">New demo equipment request</h1>
      <p style="margin:0 0 18px">
        A new request was submitted for <strong>${escapeHtml(request.requested_handler)}</strong>.
      </p>

      <table style="border-collapse:collapse;width:100%;max-width:640px">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Request</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(request.code)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Requester</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(request.requester_name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Company</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(request.requester_company)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Email</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(request.requester_email)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>Expected return</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${escapeHtml(request.expected_return_date)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e5e2"><strong>MSRP total</strong></td><td style="padding:8px;border:1px solid #e5e5e2">${formatCurrency(request.msrp_total_amount)}</td></tr>
        </tbody>
      </table>

      <p style="margin:18px 0 0"><strong>Use case</strong></p>
      <p style="margin:4px 0 18px">${escapeHtml(request.requested_use_case)}</p>

      ${
        detailUrl
          ? `<p><a href="${detailUrl}" style="display:inline-block;background:#181818;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px">Review request</a></p>`
          : ''
      }
    </div>
  `
}

function buildEmailText({ appUrl, request }) {
  const detailUrl = appUrl
    ? `${appUrl}/loan-requests/${encodeURIComponent(request.code)}`
    : ''

  return [
    'New demo equipment request',
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
    detailUrl ? `Review: ${detailUrl}` : '',
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
  const resendApiKey = process.env.RESEND_API_KEY
  const mailFrom = process.env.MAIL_FROM
  const fallbackEmail = process.env.NOTIFICATION_FALLBACK_EMAIL

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

  if (!recipient || !resendApiKey || !mailFrom) {
    await updateNotificationStatus(supabase, requestCode, {
      request_notification_error:
        'Email skipped: missing recipient or email provider configuration.',
    })

    res.writeHead(200, jsonHeaders)
    res.end(JSON.stringify({ skipped: true, reason: 'Email env or recipient missing' }))
    return
  }

  const appUrl = getAppUrl()
  const emailPayload = {
    from: mailFrom,
    to: [recipient],
    subject: `New demo request ${request.code} - ${request.requester_company}`,
    html: buildEmailHtml({ appUrl, request }),
    text: buildEmailText({ appUrl, request }),
  }

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  })

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text()

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

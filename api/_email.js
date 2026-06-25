function parseMailFrom(mailFrom) {
  const value = String(mailFrom ?? '').trim()
  const match = value.match(/^(.*)<([^<>]+)>$/)

  if (!match) {
    return {
      name: '',
      email: value,
    }
  }

  return {
    name: match[1].trim().replace(/^"|"$/g, ''),
    email: match[2].trim(),
  }
}

export function hasEmailProviderEnv() {
  return Boolean(
    process.env.MAIL_FROM &&
      (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY),
  )
}

export async function sendTransactionalEmail({
  from,
  to,
  subject,
  html,
  text,
}) {
  if (process.env.BREVO_API_KEY) {
    const sender = parseMailFrom(from)

    const emailResponse = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      },
    )

    if (!emailResponse.ok) {
      throw new Error((await emailResponse.text()).slice(0, 1000))
    }

    return { provider: 'brevo' }
  }

  if (process.env.RESEND_API_KEY) {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!emailResponse.ok) {
      throw new Error((await emailResponse.text()).slice(0, 1000))
    }

    return { provider: 'resend' }
  }

  throw new Error('Email provider env missing')
}

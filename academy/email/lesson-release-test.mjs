const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function readJson(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 10_000) throw new Error('Request body is too large')
  }
  return JSON.parse(body || '{}')
}

export async function handleLessonReleaseTest(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const missing = []
  if (!config?.cronSecret) missing.push('CRON_SECRET')
  if (!config?.lessonReleaseMessage) missing.push('ACA_LESSON_RELEASE_MESSAGE')
  if (!config?.resend) missing.push('RESEND_API_KEY')
  if (!config?.emailFrom) missing.push('ACA_EMAIL_FROM')
  if (!config?.appUrl) missing.push('ACA_APP_URL')
  if (missing.length) {
    return json(res, 503, { error: 'Lesson release test is not configured', missing })
  }
  if (req.headers.authorization !== `Bearer ${config.cronSecret}`) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  let body
  try {
    body = await readJson(req)
  } catch {
    return json(res, 400, { error: 'A valid JSON request body is required' })
  }

  const recipient = String(body.to || '').trim().toLowerCase()
  if (!recipient || recipient.length > 254 || !emailPattern.test(recipient)) {
    return json(res, 400, { error: 'A valid test recipient email is required' })
  }

  const approved = config.lessonReleaseMessage({
    pageId: 'TEST',
    lessonTitle: 'ACA email delivery test',
  }, {
    appUrl: config.appUrl,
    learnerFirstName: body.firstName ? String(body.firstName).trim().slice(0, 80) : null,
  })
  const html = `<div style="font-family:Arial,sans-serif;background:#fff7dd;border:2px solid #d7aa35;color:#173d62;margin-bottom:20px;padding:12px 16px"><strong>ACA DELIVERY TEST</strong><br>This message verifies the Academy email connection. It does not release a lesson or change learner access.</div>${approved.html}`

  try {
    const result = await config.resend.emails.send({
      from: config.emailFrom,
      to: recipient,
      subject: `[TEST] ${approved.subject}`,
      html,
    }, { idempotencyKey: `aca-email-test:${recipient}:${Date.now()}` })
    if (result.error) throw new Error('Email provider rejected the test')
    return json(res, 200, {
      ok: true,
      recipient,
      providerMessageId: result.data?.id || result.id || null,
    })
  } catch {
    return json(res, 502, { error: 'ACA test email could not be sent' })
  }
}

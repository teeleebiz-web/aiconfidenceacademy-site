const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

const body = (req, limit = 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size > limit) reject(new Error('Webhook payload is too large'))
    else chunks.push(chunk)
  })
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  req.on('error', reject)
})

const eventStatus = event => {
  if (event.type === 'email.sent') return { status: 'sent', last_error: null }
  if (event.type === 'email.delivered') return { status: 'delivered', delivered_at: event.created_at, last_error: null }
  if (event.type === 'email.bounced') return { status: 'bounced', last_error: event.data.bounce?.message || 'Email bounced' }
  if (event.type === 'email.complained') return { status: 'complained', last_error: 'Recipient reported the email as spam' }
  if (event.type === 'email.suppressed') return { status: 'suppressed', last_error: event.data.suppressed?.message || 'Email suppressed' }
  if (event.type === 'email.failed') return { status: 'failed', last_error: event.data.failed?.reason || 'Email delivery failed' }
  return null
}

const terminalStatuses = new Set(['bounced', 'complained', 'suppressed', 'failed'])

export async function recordResendEvent(config, event) {
  const update = eventStatus(event)
  const providerMessageId = event?.data?.email_id
  if (!update || !providerMessageId) return { received: true, ignored: true }

  const { data: existing, error: lookupError } = await config.db.from('aca_email_events')
    .select('id,status').eq('provider_message_id', providerMessageId).maybeSingle()
  if (lookupError) throw lookupError
  if (!existing) return { received: true, ignored: true }

  if (terminalStatuses.has(existing.status)) return { received: true, duplicate: true }
  if (existing.status === 'delivered' && update.status === 'sent') return { received: true, duplicate: true }

  const { error: updateError } = await config.db.from('aca_email_events').update(update).eq('id', existing.id)
  if (updateError) throw updateError
  return { received: true, status: update.status }
}

export async function handleResendWebhook(req, res, config) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.resend || !config?.resendWebhookSecret || !config?.db) {
    return json(res, 503, { error: 'Email delivery tracking is not configured' })
  }

  let event
  try {
    event = config.resend.webhooks.verify({
      payload: await body(req),
      headers: {
        id: req.headers['svix-id'],
        timestamp: req.headers['svix-timestamp'],
        signature: req.headers['svix-signature'],
      },
      webhookSecret: config.resendWebhookSecret,
    })
  } catch {
    return json(res, 400, { error: 'Invalid webhook signature' })
  }

  try {
    return json(res, 200, await recordResendEvent(config, event))
  } catch {
    return json(res, 500, { error: 'Email delivery event processing failed' })
  }
}

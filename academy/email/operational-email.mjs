const finalStatuses = new Set(['sent', 'delivered'])

const failureMessage = result => result?.error?.message || 'Email provider rejected the message'

export async function sendOperationalEmail(config, message) {
  if (!message?.eventKey || !message?.templateKey || !message?.to || !message?.subject) {
    throw new Error('Operational email requires an event key, template key, recipient, and subject')
  }

  const recipient = String(message.to).trim().toLowerCase()
  const { data: existing, error: lookupError } = await config.db.from('aca_email_events')
    .select('id,status').eq('event_key', message.eventKey).maybeSingle()
  if (lookupError) throw lookupError
  if (existing && finalStatuses.has(existing.status)) return { duplicate: true, id: existing.id }

  const event = {
    event_key: message.eventKey,
    template_key: message.templateKey,
    template_version: message.templateVersion || 1,
    recipient,
    subject: message.subject,
    status: 'sending',
    enrollment_id: message.enrollmentId || null,
    learner_id: message.learnerId || null,
    metadata: message.metadata || {},
    last_error: null,
  }
  const { data: recorded, error: recordError } = await config.db.from('aca_email_events')
    .upsert(event, { onConflict: 'event_key' }).select('id,attempts').single()
  if (recordError) throw recordError

  const attempts = Number(recorded.attempts || 0) + 1
  const result = await config.resend.emails.send({
    from: config.emailFrom,
    to: recipient,
    subject: message.subject,
    html: message.html,
  }, { idempotencyKey: message.eventKey })

  if (result.error) {
    const lastError = failureMessage(result)
    await config.db.from('aca_email_events').update({
      status: 'failed', attempts, last_error: lastError,
    }).eq('id', recorded.id)
    throw new Error('Academy email could not be sent')
  }

  const providerMessageId = result.data?.id || result.id || null
  const { error: updateError } = await config.db.from('aca_email_events').update({
    status: 'sent', attempts, provider_message_id: providerMessageId,
    sent_at: new Date().toISOString(), last_error: null,
  }).eq('id', recorded.id)
  if (updateError) throw updateError
  return { duplicate: false, id: recorded.id, providerMessageId }
}

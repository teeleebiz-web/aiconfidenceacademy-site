import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Readable, Writable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'
import { handleStripeEnrollment } from './stripe-webhook.mjs'
import { formatAcademyEmailFrom } from '../email/sender.mjs'
import { sendOperationalEmail } from '../email/operational-email.mjs'
import { Resend } from 'resend'

const portalOrigin = 'https://aiconfidenceacademy.org'
const projectUrl = 'https://ymmkodlifpxutynpjnxm.supabase.co'
const publicKey = 'sb_publishable_YK7q6HJhUO1z18lwAVbi9w_tOBG2pee'
const checked = (result, label) => {
  if (result.error) throw new Error(label + ': ' + (result.error.code || result.error.name || 'provider_error'))
  return result.data
}
class CaptureResponse extends Writable {
  statusCode = 200
  chunks = []
  writeHead(status) { this.statusCode = status; return this }
  _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback() }
  result() { return JSON.parse(Buffer.concat(this.chunks).toString() || '{}') }
}

export async function verifySandboxEnrollment(stripe, paidSession, { deliver = false } = {}) {
  assert.equal(process.env.VERCEL_ENV, 'preview', 'Enrollment verification requires Preview')
  assert.equal(process.env.SUPABASE_URL, projectUrl, 'The test must use the known Academy database')
  assert.equal(process.env.VITE_SUPABASE_URL || projectUrl, projectUrl, 'The portal and server must use the same database')
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'The server database credential must be configured')
  assert.equal(process.env.ACA_PHASE_ONE_COURSE_ID, 'e4c32a76-a59c-42cf-b473-1fe860c37784', 'The test must use the existing Phase One course')
  const db = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const learner = createClient(projectUrl, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const deliveryKey = 'aca-sandbox-access-test:' + paidSession.id
  const recipient = String(paidSession.customer_details?.email || paidSession.customer_email || '').trim().toLowerCase()
  let resend
  const readDelivery = async providerId => {
    let lastEvent = 'sent'
    for (let attempt = 0; attempt < 10; attempt++) {
      const delivery = await resend.emails.get(providerId)
      if (delivery.error) return 'accepted_status_unavailable'
      assert.ok(delivery.data?.to?.includes(recipient), 'The email provider must confirm the Checkout recipient')
      lastEvent = delivery.data.last_event || 'sent'
      if (['delivered', 'opened', 'clicked'].includes(lastEvent)) return lastEvent
      assert.ok(!['bounced', 'failed', 'complained', 'suppressed'].includes(lastEvent), 'The test email must not fail delivery')
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
    return lastEvent
  }
  if (deliver) {
    assert.ok(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient), 'The completed Checkout must contain a valid recipient')
    assert.ok(!/@(?:example\.(?:com|net|org)|resend\.dev)$/.test(recipient), 'The delivery test requires the real Checkout email address')
    assert.ok(process.env.RESEND_API_KEY, 'The Academy email connection must be configured')
    resend = new Resend(process.env.RESEND_API_KEY)
    const previous = checked(await db.from('aca_email_events')
      .select('learner_id,enrollment_id,provider_message_id,status,metadata')
      .eq('event_key', deliveryKey).maybeSingle(), 'Read prior access test')
    if (previous) {
      assert.ok(['sent', 'delivered'].includes(previous.status), 'An unfinished access test must be reviewed before retrying')
      assert.equal(previous.metadata?.source_session, paidSession.id, 'The prior access test must match the verified Checkout')
      assert.equal(previous.metadata?.sign_in_verified, true, 'The previous test must have verified learner sign-in')
      const account = checked(await db.auth.admin.getUserById(previous.learner_id), 'Read prior test learner')
      assert.equal(account.user.app_metadata?.aca_test_fixture, previous.metadata?.fixture, 'The saved access test must use its marked temporary account')
      const status = await readDelivery(previous.provider_message_id)
      console.log('[ACA sandbox access email] Existing test email status:', status)
      return
    }
  }
  const fixture = randomUUID()
  const email = 'aca-enrollment-test-' + fixture + '@example.com'
  const eventId = 'evt_aca_fixture_' + fixture
  const sessionId = 'cs_test_aca_fixture_' + fixture
  const emailEventKey = 'enrollment-access:' + sessionId
  const secret = 'whsec_' + randomUUID()
  const messages = []
  let testUserId
  let invitation
  let generatedLinks = 0
  let stage = 'read_test_price'
  let invitationError
  let keepTestLearner = false

  try {
    const actualItems = await stripe.checkout.sessions.listLineItems(paidSession.id, { limit: 100 })
    assert.equal(actualItems.data.length, 1, 'The source test payment must have one line item')
    assert.equal(actualItems.data[0].price?.id, process.env.ACA_PHASE_ONE_PRICE_ID, 'The source payment must use the approved test price')
    const config = {
      stripe: {
        webhooks: stripe.webhooks,
        checkout: { sessions: { listLineItems: async id => {
          assert.equal(id, sessionId, 'Only the fixture session may be processed')
          return actualItems
        } } },
      },
      webhookSecret: secret,
      phaseOnePriceId: process.env.ACA_PHASE_ONE_PRICE_ID,
      courseId: process.env.ACA_PHASE_ONE_COURSE_ID,
      appUrl: portalOrigin,
      preview: true,
      emailFrom: formatAcademyEmailFrom(process.env.ACA_EMAIL_FROM),
      resend: { emails: { send: async (message, options) => {
        assert.equal(message.to, email, 'The rehearsal must address only the reserved fixture email')
        messages.push({ message, options })
        return { data: { id: randomUUID() }, error: null }
      } } },
      db: {
        from: (...args) => db.from(...args),
        auth: { admin: { generateLink: async args => {
          assert.equal(args.email, email, 'Invitation generation must be restricted to the fixture')
          stage = 'generate_invitation'
          const result = await db.auth.admin.generateLink(args)
          if (result.error) invitationError = result.error.code || result.error.name || 'invitation_error'
          if (!result.error && result.data?.user?.id) {
            testUserId = result.data.user.id
            invitation = result.data.properties?.action_link
            checked(await db.auth.admin.updateUserById(testUserId, {
              app_metadata: { aca_test_fixture: fixture },
            }), 'Tag temporary learner')
            generatedLinks++
          }
          return result
        } } },
      },
    }
    const fixtureSession = {
      ...paidSession,
      id: sessionId,
      customer_email: email,
      customer_details: { ...paidSession.customer_details, email, name: 'ACA Test Learner' },
    }
    const payload = JSON.stringify({
      id: eventId, object: 'event', type: 'checkout.session.completed',
      livemode: false, data: { object: fixtureSession },
    })
    const invoke = async () => {
      const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
      const req = Object.assign(Readable.from([Buffer.from(payload)]), {
        method: 'POST', headers: { 'stripe-signature': signature },
      })
      const res = new CaptureResponse()
      await handleStripeEnrollment(req, res, config)
      assert.equal(res.statusCode, 200, 'The signed enrollment fixture must process successfully')
      return res.result()
    }
    stage = 'process_signed_webhook'
    const result = await invoke()
    assert.equal(result.enrolled, true, 'The fixture learner must be enrolled')
    assert.equal(generatedLinks, 1, 'One secure invitation must be created')
    assert.equal(messages.length, 1, 'One enrollment access email must be prepared')
    assert.ok(invitation, 'The enrollment email must contain a secure invitation')
    assert.ok(messages[0].message.html.includes(invitation), 'The email must contain the generated entrance link')
    assert.equal(messages[0].options.idempotencyKey, emailEventKey, 'The access email must use its stable event key')

    const enrolled = checked(await db.from('enrollments').select('id,status,course_id,learner_id')
      .eq('learner_id', testUserId).eq('course_id', config.courseId).single(), 'Read fixture enrollment')
    assert.equal(enrolled.status, 'active', 'The fixture enrollment must be active')
    const duplicate = await invoke()
    assert.equal(duplicate.duplicate, true, 'A repeated Stripe event must be ignored')
    assert.equal(generatedLinks, 1, 'A repeated event must not generate another invitation')
    assert.equal(messages.length, 1, 'A repeated event must not resend access email')

    stage = 'verify_invitation_redirect'
    const link = new URL(invitation)
    assert.equal(link.origin, projectUrl, 'The entrance link must use the known Supabase Auth service')
    const authResponse = await fetch(link, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    assert.ok([302, 303].includes(authResponse.status), 'The secure invitation must redirect successfully')
    const destination = new URL(authResponse.headers.get('location'))
    assert.equal(destination.origin, portalOrigin, 'The invitation must return to the official Academy')
    assert.equal(destination.pathname, '/learn/', 'The invitation must open the learner portal')
    const tokens = new URLSearchParams(destination.hash.slice(1))
    assert.ok(tokens.get('access_token') && tokens.get('refresh_token'), 'The entrance link must establish a learner session')
    stage = 'sign_in_temporary_learner'
    checked(await learner.auth.setSession({
      access_token: tokens.get('access_token'),
      refresh_token: tokens.get('refresh_token'),
    }), 'Sign in the fixture learner')
    const identity = checked(await learner.auth.getUser(), 'Verify fixture identity')
    assert.equal(identity.user.id, testUserId, 'The secure link must sign in the fixture learner')

    stage = 'read_learner_enrollment'
    const owned = checked(await learner.from('enrollments').select('id,status')
      .eq('learner_id', testUserId).single(), 'Read enrollment through learner access rules')
    assert.equal(owned.id, enrolled.id, 'The learner must see its own enrollment')
    assert.equal(owned.status, 'active', 'Learner access must be active')
    const owner = checked(await learner.rpc('is_aca_curriculum_owner'), 'Verify learner role')
    assert.equal(owner, false, 'The fixture must have ordinary learner access')
    stage = 'read_first_lesson_access'
    const access = checked(await learner.rpc('get_learner_lesson_access', { p_enrollment_id: enrolled.id }), 'Read initial lesson access')
    assert.equal(access[0]?.access_status, 'available', 'The first lesson must be available to the new learner')
    stage = 'read_lesson_1_1'
    const lesson = checked(await learner.from('lessons').select('id,page_id,status')
      .eq('id', access[0].current_lesson_id).single(), 'Read the first available lesson')
    assert.equal(lesson.page_id, '1.1', 'A new learner must begin at Lesson 1.1')
    assert.equal(lesson.status, 'published', 'The first lesson must be published')
    console.log('[ACA sandbox enrollment rehearsal] Passed: signed enrollment processing, email entrance link, duplicate event, Supabase sign-in, learner access rules, and Lesson 1.1')
    if (deliver) {
      stage = 'prepare_fresh_access_link'
      checked(await learner.auth.signOut({ scope: 'global' }), 'Sign out the rehearsal session')
      const fresh = checked(await db.auth.admin.generateLink({
        type: 'magiclink', email, options: { redirectTo: portalOrigin + '/learn/' },
      }), 'Create the unconsumed test entrance')
      const freshLink = new URL(fresh.properties.action_link)
      assert.equal(freshLink.origin, projectUrl, 'The email entrance must use the verified Auth service')
      assert.equal(freshLink.searchParams.get('redirect_to'), portalOrigin + '/learn/', 'The email entrance must open the official learner portal')
      const banner = '<div style="font-family:Arial,sans-serif;background:#fff7dd;border:2px solid #d7aa35;color:#173d62;margin-bottom:20px;padding:12px 16px"><strong>ACA ENROLLMENT ACCESS TEST</strong><br>This link opens a temporary test learner account to verify the Academy email and Lesson 1.1.</div>'
      const html = banner + messages[0].message.html.replaceAll(invitation, fresh.properties.action_link)
      stage = 'send_test_access_email'
      const metadata = {
        fixture, source_session: paidSession.id, sign_in_verified: true,
        first_lesson_verified: '1.1', test_only: true,
      }
      const sent = await sendOperationalEmail({
        db,
        emailFrom: formatAcademyEmailFrom(process.env.ACA_EMAIL_FROM),
        resend: { emails: { send: async (...args) => {
          const result = await resend.emails.send(...args)
          if (!result.error && result.data?.id) keepTestLearner = true
          return result
        } } },
      }, {
        eventKey: deliveryKey, templateKey: 'aca_sandbox_enrollment_access_test',
        enrollmentId: enrolled.id, learnerId: testUserId,
        to: recipient, subject: '[TEST] ' + messages[0].message.subject, html, metadata,
      })
      assert.ok(sent.providerMessageId, 'The email provider must accept the test access email')
      stage = 'verify_test_email_delivery'
      const delivery = await readDelivery(sent.providerMessageId)
      checked(await db.from('aca_email_events').update({
        ...(['delivered', 'opened', 'clicked'].includes(delivery)
          ? { status: 'delivered', delivered_at: new Date().toISOString() } : {}),
        metadata: { ...metadata, provider_status: delivery },
      }).eq('event_key', deliveryKey), 'Record the test delivery result')
      console.log('[ACA sandbox access email] New test email status:', delivery)
    }

  } catch (error) {
    const message = String(error.message || error.name || 'verification_failed').replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_-]+|re_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+/g, '[redacted]').slice(0, 1200)
    await db.from('aca_payment_events').upsert({
      stripe_event_id: 'aca_sandbox_rehearsal_20261003', stripe_session_id: 'aca_sandbox_rehearsal_20261003',
      customer_email: 'aca-test-diagnostic@example.com', amount_total: 0, currency: 'usd',
      status: 'failed', error_message: JSON.stringify({ stage, invitationError, message }),
    }, { onConflict: 'stripe_event_id' })
    throw error
  } finally {
    await learner.auth.signOut({ scope: 'global' })
    if (testUserId) {
      const identity = checked(await db.auth.admin.getUserById(testUserId), 'Verify fixture cleanup identity')
      assert.equal(identity.user.email, email, 'Only the temporary fixture learner may be cleaned up')
      assert.equal(identity.user.app_metadata?.aca_test_fixture, fixture, 'Cleanup requires the server-created fixture marker')
      checked(await db.from('aca_email_events').delete().eq('event_key', emailEventKey), 'Remove fixture email ledger')
      checked(await db.from('aca_payment_events').delete().eq('stripe_event_id', eventId), 'Remove fixture payment ledger')
      if (!keepTestLearner) {
        checked(await db.auth.admin.deleteUser(testUserId), 'Remove temporary fixture learner')
        const remaining = checked(await db.from('enrollments').select('id').eq('learner_id', testUserId), 'Verify fixture enrollment cleanup')
        assert.equal(remaining.length, 0, 'Temporary enrollment cleanup must finish')
      }
    }
  }
}

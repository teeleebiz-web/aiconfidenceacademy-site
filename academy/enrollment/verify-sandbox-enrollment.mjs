import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Readable, Writable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'
import { handleStripeEnrollment } from './stripe-webhook.mjs'
import { formatAcademyEmailFrom } from '../email/sender.mjs'

const previewOrigin = 'https://aiconfidenceacademy-site-mk-git-c2bdae-teeleebiz-7751s-projects.vercel.app'
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

export async function verifySandboxEnrollment(stripe, paidSession) {
  assert.equal(process.env.VERCEL_ENV, 'preview', 'Enrollment verification requires Preview')
  assert.equal(process.env.SUPABASE_URL, projectUrl, 'The test must use the known Academy database')
  assert.equal(process.env.VITE_SUPABASE_URL || projectUrl, projectUrl, 'The portal and server must use the same database')
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'The server database credential must be configured')
  assert.equal(process.env.ACA_PHASE_ONE_COURSE_ID, 'e4c32a76-a59c-42cf-b473-1fe860c37784', 'The test must use the existing Phase One course')
  const db = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const learner = createClient(projectUrl, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicKey, { auth: { persistSession: false, autoRefreshToken: false } })
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
      appUrl: previewOrigin,
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
          const result = await db.auth.admin.generateLink(args)
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

    const link = new URL(invitation)
    assert.equal(link.origin, projectUrl, 'The entrance link must use the known Supabase Auth service')
    const authResponse = await fetch(link, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    assert.ok([302, 303].includes(authResponse.status), 'The secure invitation must redirect successfully')
    const destination = new URL(authResponse.headers.get('location'))
    assert.equal(destination.origin, previewOrigin, 'The invitation must return to the exact Academy Preview')
    assert.equal(destination.pathname, '/learn/', 'The invitation must open the learner portal')
    const tokens = new URLSearchParams(destination.hash.slice(1))
    assert.ok(tokens.get('access_token') && tokens.get('refresh_token'), 'The entrance link must establish a learner session')
    checked(await learner.auth.setSession({
      access_token: tokens.get('access_token'),
      refresh_token: tokens.get('refresh_token'),
    }), 'Sign in the fixture learner')
    const identity = checked(await learner.auth.getUser(), 'Verify fixture identity')
    assert.equal(identity.user.id, testUserId, 'The secure link must sign in the fixture learner')

    const owned = checked(await learner.from('enrollments').select('id,status')
      .eq('learner_id', testUserId).single(), 'Read enrollment through learner access rules')
    assert.equal(owned.id, enrolled.id, 'The learner must see its own enrollment')
    assert.equal(owned.status, 'active', 'Learner access must be active')
    const owner = checked(await learner.rpc('is_aca_curriculum_owner'), 'Verify learner role')
    assert.equal(owner, false, 'The fixture must have ordinary learner access')
    const access = checked(await learner.rpc('get_learner_lesson_access', { p_enrollment_id: enrolled.id }), 'Read initial lesson access')
    assert.equal(access[0]?.access_status, 'available', 'The first lesson must be available to the new learner')
    const lesson = checked(await learner.from('lessons').select('id,page_id,status')
      .eq('id', access[0].current_lesson_id).single(), 'Read the first available lesson')
    assert.equal(lesson.page_id, '1.1', 'A new learner must begin at Lesson 1.1')
    assert.equal(lesson.status, 'published', 'The first lesson must be published')
    console.log('[ACA sandbox enrollment rehearsal] Passed: signed enrollment processing, email entrance link, duplicate event, Supabase sign-in, learner access rules, and Lesson 1.1')
  } finally {
    await learner.auth.signOut({ scope: 'global' })
    if (testUserId) {
      const identity = checked(await db.auth.admin.getUserById(testUserId), 'Verify fixture cleanup identity')
      assert.equal(identity.user.email, email, 'Only the temporary fixture learner may be cleaned up')
      assert.equal(identity.user.app_metadata?.aca_test_fixture, fixture, 'Cleanup requires the server-created fixture marker')
      checked(await db.from('aca_email_events').delete().eq('event_key', emailEventKey), 'Remove fixture email ledger')
      checked(await db.from('aca_payment_events').delete().eq('stripe_event_id', eventId), 'Remove fixture payment ledger')
      checked(await db.auth.admin.deleteUser(testUserId), 'Remove temporary fixture learner')
      const remaining = checked(await db.from('enrollments').select('id').eq('learner_id', testUserId), 'Verify fixture enrollment cleanup')
      assert.equal(remaining.length, 0, 'Temporary enrollment cleanup must finish')
    }
  }
}

import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const projectUrl = 'https://ymmkodlifpxutynpjnxm.supabase.co'
const learnerId = '3219e24b-0d33-4043-8cfa-5d228bdc1713'
const enrollmentId = '8651d43e-17c3-432f-901e-a3246bb3f9c5'
const eventId = '5cd347e9-856d-43d1-9b9d-bc4761cb7858'
const mediaPath = 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'
const publicKey = 'sb_publishable_YK7q6HJhUO1z18lwAVbi9w_tOBG2pee'
const options = { auth: { persistSession: false, autoRefreshToken: false } }
let learner

function checked(result) {
  assert.equal(result.error, null, 'An authenticated onboarding check failed')
  return result.data
}

try {
  assert.equal(process.env.VERCEL_ENV, 'preview', 'Verification is limited to Preview builds')
  assert.equal(process.env.SUPABASE_URL, projectUrl, 'Verification must use the existing Academy project')
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Preview server credential is required')
  const db = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, options)
  learner = createClient(projectUrl, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicKey, options)
  const anonymous = createClient(projectUrl, process.env.VITE_SUPABASE_PUBLISHABLE_KEY || publicKey, options)
  const user = checked(await db.auth.admin.getUserById(learnerId)).user
  const event = checked(await db.from('aca_email_events').select('metadata,learner_id').eq('id', eventId).single())
  assert.equal(event.learner_id, learnerId)
  assert.equal(event.metadata.test_only, true)
  assert.ok(event.metadata.fixture)
  assert.equal(user.app_metadata.aca_test_fixture, event.metadata.fixture)
  assert.match(user.email, /^aca-enrollment-test-[a-f0-9-]+@example\.com$/)
  const link = checked(await db.auth.admin.generateLink({ type: 'magiclink', email: user.email }))
  const authentication = checked(await learner.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token }))
  assert.equal(authentication.user.id, learnerId)
  const enrollment = checked(await learner.from('enrollments').select('id,status,access_expires_at').eq('id', enrollmentId).single())
  assert.equal(enrollment.status, 'active')
  assert.ok(Date.parse(enrollment.access_expires_at) > Date.now())
  assert.equal(checked(await learner.rpc('is_aca_curriculum_owner', undefined, { get: true })), false)
  const access = checked(await learner.rpc('get_learner_lesson_access', { p_enrollment_id: enrollmentId }))[0]
  assert.ok(['available', 'active'].includes(access.access_status))
  const lesson = checked(await learner.from('lessons').select('page_id,status').eq('id', access.current_lesson_id).single())
  assert.equal(lesson.page_id, '1.1')
  assert.equal(lesson.status, 'published')
  const signed = checked(await learner.storage.from('aca-learning-media').createSignedUrl(mediaPath, 3600))
  assert.ok(signed.signedUrl)
  const response = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-255' } })
  assert.equal(response.status, 206, 'The approved founder film must support partial video loading')
  assert.match(response.headers.get('content-type') || '', /video\/mp4/)
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.equal(bytes.length, 256)
  assert.equal(Buffer.from(bytes.subarray(4, 8)).toString(), 'ftyp')
  const denied = await anonymous.storage.from('aca-learning-media').createSignedUrl(mediaPath, 3600)
  assert.ok(denied.error, 'Unsigned visitors must not receive protected founder media')
  console.log('[ACA onboarding verification] Passed: existing temporary learner, ordinary role, active enrollment, Lesson 1.1, exact founder film byte range, and anonymous denial. No email or payment was submitted.')
} catch {
  console.error('[ACA onboarding verification] Failed. No credentials or authentication links are logged.')
  process.exitCode = 1
} finally {
  if (learner) await learner.auth.signOut({ scope: 'local' })
}

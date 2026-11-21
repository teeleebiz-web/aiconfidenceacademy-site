import test from 'node:test'
import assert from 'node:assert/strict'
import { handlePhaseTwoMedia, phaseTwoMediaFiles, signPhaseTwoMedia } from './phase-two-media.mjs'

const learner = '00000000-0000-4000-8000-000000000001'
const enrollment = '00000000-0000-4000-8000-000000000002'
const lesson = '00000000-0000-4000-8000-000000000003'
const course = '00000000-0000-4000-8000-000000000004'
function fixture(options = {}) {
  const calls = [], signed = []
  const db = { auth: { getUser: async token => { calls.push(['auth', token]); return { data: { user: options.badUser ? null : { id: learner, is_anonymous: options.anonymous } } } } },
    from(table) {
      const filters = {}
      const q = { select() { return q }, eq(k, v) { filters[k] = v; return q }, async maybeSingle() {
        calls.push([table, filters])
        if (table === 'enrollments') return { data: !options.noEnrollment && filters.id === enrollment && filters.learner_id === learner && filters.course_id === course && filters.status === 'active' ? { id: enrollment } : null }
        return { data: !options.noLesson && filters.id === lesson && filters.course_id === course && filters.status === 'published' ? { page_id: '1.1' } : null }
      } }; return q
    }, storage: { from(bucket) { assert.equal(bucket, 'aca-learning-media'); return { async createSignedUrls(paths, ttl) {
      signed.push({ paths, ttl }); return options.signFailure ? { error: 'private provider details' } : { data: paths.map(path => ({ path, signedUrl: 'https://private.test/' + path })) }
    } } } } }
  const config = { db, courseId: course, lessonId: lesson, enabled: true,
    reviewerCheck: async token => { calls.push(['owner', token]); return options.owner === true },
    accessCheck: async (token, id, lessonId) => { calls.push(['access', token, id, lessonId]); if (options.accessFailure) throw Error('private database details'); return { access_status: options.accessStatus ?? 'active', remaining_seconds: options.remaining ?? 90 } }, ...options.config }
  return { db, config, calls, signed }
}
async function run(f, options = {}) {
  let status, body, headers
  const req = { method: options.method ?? 'GET', url: `/api/learner/phase-two-media/${lesson}${options.ownerRoute ? '' : '?enrollment=' + (options.enrollmentId ?? enrollment)}`, headers: { 'x-aca-access-token': options.token ?? 'verified-session' } }
  await handlePhaseTwoMedia(req, { writeHead(s, h) { status = s; headers = h }, end(value) { body = JSON.parse(value) } }, f.config)
  return { status, body, headers }
}
test('private media is disabled until the coordinated migration is activated', async () => {
  const f = fixture({ config: { enabled: false } }); assert.equal((await run(f)).status, 503); assert.equal(f.calls.length, 0); assert.equal(f.signed.length, 0)
})
test('invalid and anonymous sessions cannot receive signed media', async () => {
  for (const options of [{ badUser: true }, { anonymous: true }, {}]) {
    const f = fixture(options); assert.equal((await run(f, !Object.keys(options).length ? { token: '' } : {})).status, 401); assert.equal(f.signed.length, 0)
  }
})
test('learner identity and phase enrollment are checked before the scoped access RPC', async () => {
  for (const id of [learner, '../another', '']) {
    const f = fixture(); assert.equal((await run(f, { enrollmentId: id })).status, 403); assert.equal(f.signed.length, 0); assert.ok(!f.calls.some(c => c[0] === 'access'))
  }
  const f = fixture({ noEnrollment: true }); assert.equal((await run(f)).status, 403); assert.equal(f.signed.length, 0)
})
test('unopened, scheduled, closed and exhausted lessons never mint a link', async () => {
  for (const options of [{ accessStatus: 'available' }, { accessStatus: 'scheduled' }, { accessStatus: 'closed' }, { remaining: 0 }, { remaining: NaN }, { noLesson: true }]) {
    const f = fixture(options); assert.equal((await run(f)).status, 403); assert.equal(f.signed.length, 0)
  }
})
test('authorized links contain only the selected lesson and expire within remaining time', async () => {
  const f = fixture(), result = await run(f)
  assert.equal(result.status, 200); assert.match(result.headers['Cache-Control'], /no-store/)
  assert.deepEqual(f.calls.find(c => c[0] === 'access'), ['access', 'verified-session', enrollment, lesson])
  assert.ok(f.signed[0].ttl > 0 && f.signed[0].ttl < 90)
  assert.ok(f.signed[0].paths.every(p => p.startsWith('phase-two/lessons/1-1/')))
  assert.ok(Object.keys(result.body.files).every(p => p.startsWith('/assets/videos/phase-two-lesson-1-1/')))
  assert.ok(Date.parse(result.body.expiresAt) < Date.now() + 90000)
  assert.deepEqual(Object.keys(result.body.introductions), ['revised'])
  assert.equal(typeof result.body.introductions.revised, 'string')
})
test('owner review requires the server owner check and does not allocate learner access', async () => {
  const denied = fixture(); assert.equal((await run(denied, { ownerRoute: true })).status, 403); assert.equal(denied.signed.length, 0)
  const owner = fixture({ owner: true }); assert.equal((await run(owner, { ownerRoute: true })).status, 200)
  assert.ok(!owner.calls.some(c => c[0] === 'access' || c[0] === 'enrollments'))
})
test('provider failures fail closed without returning private details or partial URLs', async () => {
  for (const options of [{ signFailure: true }, { accessFailure: true }]) {
    const result = await run(fixture(options)); assert.equal(result.status, 503); assert.equal(result.body.files, undefined); assert.doesNotMatch(JSON.stringify(result.body), /provider|database/)
  }
})
test('media endpoint is read-only and paths cannot escape their lesson', async () => {
  const f = fixture(); assert.equal((await run(f, { method: 'POST' })).status, 405); assert.equal(f.calls.length, 0)
  for (const page of ['../1.1', '1.10', '7.1', '1.1/../../']) assert.throws(() => phaseTwoMediaFiles(page))
})
test('all 36 lesson inventories retain recordings, captions, posters and metadata', () => {
  let count = 0
  for (let journey = 1; journey <= 6; journey++) for (let lesson = 1; lesson <= 6; lesson++) {
    const files = phaseTwoMediaFiles(`${journey}.${lesson}`); count += files.length
    for (const extension of ['.mp4', '.m4a', '.vtt', '.webp', '.json']) assert.ok(files.some(f => f.path.endsWith(extension)))
    assert.equal(new Set(files.map(f => f.object)).size, files.length)
  }
  assert.equal(count, 525)
})
test('an incomplete signing response cannot yield an apparently usable bundle', async () => {
  const f = fixture(); f.db.storage.from = () => ({ createSignedUrls: async () => ({ data: [] }) })
  await assert.rejects(signPhaseTwoMedia(f.db, '1.1', 90), /unavailable/)
})

test('introduction text follows the same authentication, enrollment and timing boundaries', async () => {
  for (const options of [{ badUser: true }, { anonymous: true }, { noEnrollment: true }, { noLesson: true }, { accessStatus: 'closed' }, { remaining: 0 }, { signFailure: true }]) {
    const result = await run(fixture(options))
    assert.notEqual(result.status, 200)
    assert.equal(result.body.introductions, undefined)
  }
  const f = fixture()
  const second = await signPhaseTwoMedia(f.db, '2.1', 90)
  assert.deepEqual(Object.keys(second.introductions), ['original'])
  assert.equal(typeof second.introductions.original, 'string')
  assert.equal(second.introductions.revised, undefined)
})

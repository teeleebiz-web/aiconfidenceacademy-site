const allPages = Array.from({ length: 32 }, (_, index) => index + 1)
const configurations = {
  'journey-four': { journey: 4, pages: [1, 2, 3, 4, 5, 6, 7, 8], start: 1, fallback: 1 },
  'journey-one': { journey: 1, pages: allPages, start: 5, fallback: 2 },
  'journey-three': { journey: 3, pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26], start: 1, fallback: 1 },
}
const columns = 'answers,last_page,revision,updated_at'
const reply = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' })
  res.end(JSON.stringify(data))
}
const fault = (status, message) => Object.assign(new Error(message), { status })
async function body(req) {
  // Vercel's /api handler can supply an already parsed request body.
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body)
    if (Buffer.byteLength(raw) > 60000) throw fault(413, 'Please save a smaller set of answers at a time.')
    try { return JSON.parse(raw.toString()) }
    catch { throw fault(400, 'The workbook could not read this save. Please try again.') }
  }
  let size = 0; const chunks = []
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > 60000) throw fault(413, 'Please save a smaller set of answers at a time.')
    chunks.push(Buffer.from(chunk))
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw fault(400, 'The workbook could not read this save. Please try again.') }
}

// Only the already authenticated private owner entrance may use owner-review.
// A supplied learner token is always verified; an invalid token never falls back.
export async function workbookIdentity(req, db, courseId, ownerAuthenticated, workbookKey = 'journey-one') {
  const config = configurations[workbookKey]
  if (!config) throw fault(404, 'This workbook is not available.')
  const token = req.headers['x-aca-access-token']
  if (!token) {
    if (!ownerAuthenticated) throw fault(401, 'Please sign in to your Academy account.')
    return { scope: 'owner-review', learnerId: null, allowedPages: config.pages }
  }
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user || data.user.is_anonymous) throw fault(401, 'Your Academy session has ended. Please sign in again.')
  const id = data.user.id
  const result = await db.from('enrollments')
    .select('status,starts_at,enrolled_at,access_expires_at,course:courses(status,drip_enabled)')
    .eq('learner_id', id).eq('course_id', courseId).in('status', ['active', 'completed']).maybeSingle()
  if (result.error) throw fault(503, 'Your workbook access could not be checked. Please try again.')
  const e = result.data; const now = Date.now()
  if (!e || e.course?.status !== 'published' || (e.starts_at && Date.parse(e.starts_at) > now) || (e.access_expires_at && Date.parse(e.access_expires_at) <= now)) {
    throw fault(403, 'This workbook is available with your active Phase One enrollment.')
  }
  const j = await db.from('course_journeys').select('id,status').eq('course_id', courseId).eq('journey_number', config.journey).maybeSingle()
  if (j.error) throw fault(503, 'Your workbook access could not be checked. Please try again.')
  if (j.data?.status !== 'published') throw fault(403, 'This journey is not available yet.')
  const l = await db.from('lessons').select('page_id,unlock_offset_days,status').eq('course_id', courseId).eq('journey_id', j.data.id)
  if (l.error) throw fault(503, 'Your workbook access could not be checked. Please try again.')
  const lessonNumbers = (l.data ?? []).filter(item => item.status === 'published' && (!e.course.drip_enabled || now >= Date.parse(e.starts_at ?? e.enrolled_at) + item.unlock_offset_days * 86400000)).map(item => Number(item.page_id.split('.')[1]))
  const allowedPages = config.pages.filter(page => workbookKey === 'journey-four' ? lessonNumbers.includes(page <= 4 ? 1 : 2) : workbookKey === 'journey-three' ? lessonNumbers.includes(page <= 6 ? 1 : page <= 10 ? 2 : page <= 14 ? 3 : page <= 18 ? 4 : page <= 22 ? 5 : 6) : page <= 4 || page >= 29 || lessonNumbers.includes(Math.floor((page - 5) / 4) + 1))
  if (!allowedPages.length) throw fault(403, 'This workbook is available when its lesson opens.')
  return { scope: id, learnerId: id, allowedPages }
}

export async function handleWorkbook(req, res, { db, courseId, ownerAuthenticated, workbookKey = 'journey-one' }) {
  if (!['GET', 'PATCH'].includes(req.method)) { res.setHeader('Allow', 'GET, PATCH'); reply(res, 405, { error: 'Method not allowed.' }); return }
  try {
    const config = configurations[workbookKey]
    if (!config) throw fault(404, 'This workbook is not available.')
    if (req.headers['x-aca-workbook'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site') throw fault(403, 'Open your workbook from the Academy website.')
    if (req.method === 'PATCH' && !req.headers['content-type']?.startsWith('application/json')) throw fault(415, 'A workbook save must contain JSON.')
    const identity = await workbookIdentity(req, db, courseId, ownerAuthenticated, workbookKey)
    const definition = await db.from('aca_workbook_definitions').select('content').eq('course_id', courseId).eq('workbook_key', workbookKey).maybeSingle()
    if (definition.error || !Array.isArray(definition.data?.content?.pages)) throw fault(503, 'Your workbook could not be opened. Please try again.')
    const workbook = definition.data.content
    const fieldPages = new Map()
    function fields(block, page) {
      if (block.type === 'field') fieldPages.set(block.id, page)
      for (const child of block.items ?? []) fields(child, page)
      for (const row of block.rows ?? []) for (const child of row.fields) fields(child, page)
    }
    for (const page of workbook.pages) for (const block of page.blocks) fields(block, page.number)
    const where = query => query.eq('course_id', courseId).eq('workbook_key', workbookKey).eq('scope_key', identity.scope)
    const result = await where(db.from('aca_workbook_responses').select(columns)).maybeSingle()
    if (result.error) throw fault(503, 'Your workbook could not be opened. Please try again.')
    const fallbackPage = identity.allowedPages.includes(config.fallback) ? config.fallback : identity.allowedPages[0]
    const current = result.data ?? { answers: {}, last_page: identity.allowedPages.includes(config.start) ? config.start : fallbackPage, revision: 0, updated_at: null }
    const present = row => ({ ...row, answers: Object.fromEntries(Object.entries(row.answers).filter(([key]) => identity.allowedPages.includes(fieldPages.get(key)))), last_page: identity.allowedPages.includes(row.last_page) ? row.last_page : fallbackPage, allowedPages: identity.allowedPages, scope: identity.scope, workbook: { ...workbook, pages: workbook.pages.filter(page => identity.allowedPages.includes(page.number)) } })
    if (req.method === 'GET') { reply(res, 200, present(current)); return }
    const patch = await body(req)
    if (!patch || !Number.isSafeInteger(patch.baseRevision) || patch.baseRevision < 0 || !Number.isInteger(patch.page) || !identity.allowedPages.includes(patch.page) || !patch.answers || Array.isArray(patch.answers) || typeof patch.answers !== 'object') throw fault(400, 'The workbook save is incomplete. Please try again.')
    for (const [key, value] of Object.entries(patch.answers)) {
      if (!fieldPages.has(key) || !identity.allowedPages.includes(fieldPages.get(key)) || typeof value !== 'string' || value.length > 4000) throw fault(400, 'One answer could not be saved. Keep each answer within 4,000 characters.')
    }
    if (current.revision !== patch.baseRevision) { reply(res, 409, { error: 'Another window has saved newer work.', current: present(current) }); return }
    const next = { answers: { ...current.answers, ...patch.answers }, last_page: patch.page, revision: current.revision + 1, updated_at: new Date().toISOString() }
    const saved = current.revision === 0
      ? await db.from('aca_workbook_responses').insert({ ...next, course_id: courseId, workbook_key: workbookKey, scope_key: identity.scope, learner_id: identity.learnerId }).select(columns).single()
      : await where(db.from('aca_workbook_responses').update(next)).eq('revision', current.revision).select(columns).maybeSingle()
    if (saved.error?.code === '23505' || (!saved.error && !saved.data)) { reply(res, 409, { error: 'Another window saved at the same time. Select Save to try again.' }); return }
    if (saved.error) throw fault(503, 'Your answers have not saved yet. Keep this page open and select Save to try again.')
    reply(res, 200, present(saved.data))
  } catch (error) { reply(res, error.status ?? 503, { error: error.status ? error.message : 'Your workbook is temporarily unavailable. Please try again.' }) }
}

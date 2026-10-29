import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { sendOperationalEmail } from '../email/operational-email.mjs'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = value => createHash('sha256').update(String(value)).digest('hex')
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const redact = value => String(value ?? '').replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9+/=_-]+\b|\bre_[A-Za-z0-9_-]{15,}\b/g, '[redacted]')
const clean = value => JSON.parse(JSON.stringify(value).replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9+/=_-]+\b|\bre_[A-Za-z0-9_-]{15,}\b/g, '[redacted]'))
const reply = (res, status, data) => {
  res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'private, no-store' })
  res.end(JSON.stringify(clean(data)))
}
async function readJson(req) {
  let text = ''
  for await (const part of req) { text += part; if (text.length > 16000) throw Object.assign(new Error('Request is too large.'), {status:413}) }
  try { const value = JSON.parse(text || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value }
  catch { throw Object.assign(new Error('A valid JSON request is required.'), {status:400}) }
}
async function identity(req, db) {
  const token = req.headers['x-aca-access-token']
  if (typeof token !== 'string' || !token) throw Object.assign(new Error('Sign in to your Academy account.'), {status:401})
  const {data,error} = await db.auth.getUser(token)
  if (error || !data?.user || data.user.is_anonymous) throw Object.assign(new Error('Your session has ended. Please sign in again.'), {status:401})
  return {user:data.user,token}
}
function checked(result) { if (result.error) throw result.error; return result.data }
function actionPayload(action, payload) {
  const fields = {
    trial_create:['email','course_id','cohort_id','starts_at','expires_at','code'], trial_revoke:['id'],
    lesson_schedule:['id','updated_at','offset_days'], course_status:['id','updated_at','status'],
    enrollment_access:['id','updated_at','status'], label_record:['id','label'],
    cohort_save:['id','updated_at','course_id','code','starts_monday','timezone','release_time','status'],
    access_extension:['enrollment_id','lesson_id','begins_at','ends_at','reason'],
    feedback_update:['id','updated_at','status','note'],
  }[action]
  if (!fields || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw Object.assign(new Error('Choose a valid owner action.'), {status:400})
  const result = Object.fromEntries(fields.filter(key => payload[key] !== undefined).map(key => [key,payload[key]]))
  if (Object.values(result).some(v => typeof v !== 'string' && typeof v !== 'number' && v !== null)) throw Object.assign(new Error('Invalid action values.'), {status:400})
  if (action === 'trial_create') {
    if (!/^ACA_[a-f0-9]{64}$/i.test(result.code || '')) throw Object.assign(new Error('Create a fresh secure invitation code.'), {status:400})
    result.code_hash = hash(result.code); delete result.code
  }
  return result
}

export function diagnoseLessons(detail, now = Date.now()) {
  const e = detail.enrollment
  return (detail.lessons || []).map(lesson => {
    let state = 'restricted', reason = ''
    const released = Date.parse(lesson.scheduled_release)
    const deadline = lesson.extension_ends_at || lesson.weekend_ends_at || lesson.phase_two_deadline || lesson.phase_one_deadline
    if (e.effective_access !== 'active') reason = `Enrollment access: ${e.effective_access}`
    else if (e.course_status !== 'published') reason = 'This phase is not published.'
    else if (lesson.status !== 'published' || lesson.journey_status !== 'published') reason = 'Lesson or journey is not published.'
    else if (e.phase_number === 2 && lesson.cohort_status !== 'active') reason = 'An active cohort assignment is required.'
    else if (e.phase_number === 1 && !e.onboarding_completed_at) reason = 'Founder welcome and Learning ChatGPT orientation are required.'
    else if (e.phase_number === 1) {
      const access = detail.access_state
      if (lesson.id === access?.current_lesson_id) {
        state = access.access_status
        reason = state === 'scheduled' ? 'Waiting for the release time or the interval after the previous lesson.' : state === 'active' ? 'Lesson window is open.' : 'Ready to open; the two-hour window starts at first opening.'
      } else if (lesson.window_status === 'completed' || lesson.window_status === 'expired' || (lesson.phase_one_deadline && Date.parse(lesson.phase_one_deadline) <= now)) {
        state = lesson.window_status === 'completed' ? 'completed' : 'closed'; reason = 'Lesson window ended. Released workbook pages remain available.'
      } else reason = 'An earlier lesson must finish or its access window must close first.'
    } else if (released > now) { state = 'scheduled'; reason = 'Waiting for the cohort release time.' }
    else if (deadline && Date.parse(deadline) <= now) { state = 'closed'; reason = 'The lesson access window has ended.' }
    else { state = deadline ? 'active' : 'available'; reason = lesson.weekend_ends_at ? 'Extended weekend access follows the cohort schedule.' : deadline ? 'The lesson access window is open.' : 'Ready to open; weekday access lasts two hours from first opening.' }
    return {...lesson, access_status:state, restriction_reason:reason, deadline_at:deadline || null}
  })
}

export async function handleControlCenter(req, res, config) {
  const {db,reviewerCheck,automation} = config
  if (!['GET','POST'].includes(req.method)) return reply(res,405,{error:'Method not allowed.'})
  let actor
  try {
    const identified = await identity(req,db); actor = identified.user.id
    if (typeof reviewerCheck !== 'function' || !await reviewerCheck(identified.token)) return reply(res,403,{error:'Academy owner access is required.'})
    const url = new URL(req.url,'http://localhost')
    if (req.method === 'POST') {
      const body = await readJson(req)
      if (!uuid.test(body.requestId || '')) return reply(res,400,{error:'A valid request identifier is required.'})
      const payload = actionPayload(body.action,body.payload)
      const result = checked(await db.rpc('aca_control_action',{p_actor:actor,p_request:body.requestId,p_action:body.action,p_payload:payload}))
      return reply(res,200,{...result,...(body.action==='trial_create'?{code:body.payload.code}:{} )})
    }
    const history = url.searchParams.get('history')
    if (history) {
      const scope = url.searchParams.get('scope') || 'operational'
      if (!['emails','payments','refunds','trials','feedback','activity'].includes(history) || !['operational','all','sandbox'].includes(scope)) return reply(res,400,{error:'Choose a valid history section and collection.'})
      return reply(res,200,checked(await db.rpc('aca_control_history',{
        p_section:history,p_offset:Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0)),
        p_phase:[1,2].includes(Number(url.searchParams.get('phase')))?Number(url.searchParams.get('phase')):0,p_scope:scope,p_search:(url.searchParams.get('search')||'').slice(0,100),
      })))
    }
    const lessonId = url.searchParams.get('lesson')
    if (lessonId) {
      if (!uuid.test(lessonId)) return reply(res,400,{error:'Choose a valid lesson.'})
      const lesson = checked(await db.from('lessons').select('id,course_id,page_id,title,content').eq('id',lessonId).single())
      const course = checked(await db.from('courses').select('phase_number').eq('id',lesson.course_id).single())
      const media = []
      if (course.phase_number===2 && /^[1-6]\.[1-6]$/.test(lesson.page_id) && config.root) {
        const suffix=lesson.page_id.replace('.','-'),folder=`assets/videos/phase-two-lesson-${suffix}`
        let report={};try{report=JSON.parse(await readFile(join(config.root,folder,'production-report.json'),'utf8'))}catch{ /* Report availability is displayed through the returned media list. */ }
        const entries=[{label:'Instructor introduction',file:`ACA-Phase-Two-Lesson-${suffix}-Introduction.mp4`,kind:'video'},
          ...(report.guided_audio?.file?[{label:'Guided instruction',file:report.guided_audio.file,kind:'audio'}]:[]),
          ...(report.demonstrations||[]).map((item,index)=>({label:`Demonstration ${index+1} · ${item.title}`,file:item.file,kind:'video'}))]
        for(const item of entries){if(typeof item.file!=='string'||basename(item.file)!==item.file)continue;try{const file=await stat(join(config.root,folder,item.file));if(file.isFile())media.push({label:item.label,kind:item.kind,url:`${automation.appUrl.replace(/\/$/,'')}/${folder}/${encodeURIComponent(item.file)}`})}catch{ /* An absent asset is not represented as ready. */ }}
      } else {
        for(const [key,title,kind] of [['video_path','Lesson video','video'],['audio_path','Guided audio','audio']]){
          if(!lesson.content?.[key])continue
          const signed=checked(await db.storage.from('aca-learning-media').createSignedUrl(lesson.content[key],900))
          media.push({label:title,kind,url:signed.signedUrl})
        }
      }
      return reply(res,200,{title:lesson.title,page_id:lesson.page_id,phase_number:course.phase_number,media,outcomes:lesson.content?.outcomes||[]})
    }
    const enrollmentId = url.searchParams.get('enrollment')
    if (enrollmentId) {
      if (!uuid.test(enrollmentId)) return reply(res,400,{error:'Choose a valid enrollment.'})
      const detail = checked(await db.rpc('aca_control_learner',{p_enrollment_id:enrollmentId}))
      return reply(res,200,{...detail,lessons:diagnoseLessons(detail)})
    }
    const started = Date.now()
    const scope = url.searchParams.get('scope') || 'operational'
    if (!['operational','all','sandbox'].includes(scope)) return reply(res,400,{error:'Invalid record filter.'})
    const snapshot = checked(await db.rpc('aca_control_snapshot',{
      p_offset:Math.max(0,Math.min(100000,Number(url.searchParams.get('offset')) || 0)),
      p_search:(url.searchParams.get('search') || '').slice(0,100),
      p_phase:[1,2].includes(Number(url.searchParams.get('phase')))?Number(url.searchParams.get('phase')):0,p_scope:scope,
    }))
    return reply(res,200,{...snapshot,configuration:{database:'connected',payments:!!automation?.stripe,email:!!automation?.resend,emailTracking:!!automation?.resendWebhookSecret,paymentTracking:!!automation?.webhookSecret,scheduler:!!automation?.cronSecret},request_duration_ms:Date.now()-started})
  } catch (error) {
    if (error.status) return reply(res,error.status,{error:error.message})
    if (error.code === 'P0001') return reply(res,409,{error:redact(error.message)})
    if (['23505','23514','22P02','22007','22008','23502'].includes(error.code)) return reply(res,400,{error:'Check the values and dates. A record may already exist.'})
    const reference = randomUUID()
    console.warn('[ACA operations]',{reference,actor,code:error.code || 'unavailable'})
    return reply(res,503,{error:'Academy records could not load. Refresh and check System activity.',reference})
  }
}

export async function handleTrialEntry(req,res,config) {
  if (req.method !== 'POST') return reply(res,405,{error:'Method not allowed.'})
  try {
    if (!config?.db || !config.resend || !config.emailFrom || !config.appUrl) return reply(res,503,{error:'Invitation access is temporarily unavailable.'})
    const body = await readJson(req)
    const email = String(body.email || '').trim().toLowerCase()
    const code = String(body.code || '').trim()
    if (!/^ACA_[a-f0-9]{64}$/i.test(code) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return reply(res,400,{error:'Check your invitation code and the email it was assigned to.'})
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    const key = hash(`${ip}:${Math.floor(Date.now()/900000)}`)
    if (!checked(await config.db.rpc('aca_trial_rate_limit',{p_key:key}))) return reply(res,429,{error:'Please wait before requesting another invitation email.'})
    const grant = checked(await config.db.from('aca_trial_grants').select('id,allowed_email,course_id,starts_at,expires_at,status').eq('code_hash',hash(code)).maybeSingle())
    if (!grant || grant.allowed_email!==email || !['ready','redeemed'].includes(grant.status) || Date.parse(grant.expires_at)<=Date.now()) return reply(res,400,{error:'Check your invitation code and the email it was assigned to.'})
    const course = checked(await config.db.from('courses').select('id,title,phase_number,status').eq('id',grant.course_id).single())
    if (course.status!=='published') return reply(res,409,{error:'This phase is awaiting release by the Academy owner.'})
    const redirect = `${config.appUrl.replace(/\/$/,'')}/learn/${course.phase_number===2?'?course=phase-two':''}`
    const options = {redirectTo:redirect}
    let link = await config.db.auth.admin.generateLink({type:'invite',email,options})
    if (['email_exists','user_already_exists'].includes(link.error?.code)) link = await config.db.auth.admin.generateLink({type:'magiclink',email,options})
    if (link.error || !link.data?.user?.id || !link.data.properties?.action_link) throw Error('Invitation link unavailable')
    const result = checked(await config.db.rpc('aca_redeem_trial',{p_hash:hash(code),p_email:email,p_user:link.data.user.id}))
    await sendOperationalEmail(config,{
      eventKey:`trial-access:${grant.id}`,templateKey:'trial_access',enrollmentId:result.enrollment_id,learnerId:link.data.user.id,to:email,
      subject:'Your AI Confidence Academy trial access',
      html:`<div style="font-family:Arial,sans-serif;color:#102d4f;line-height:1.6"><h1>Your Academy trial access</h1><p>You have been invited to ${escape(course.title)}.</p><p>Your access begins ${escape(new Date(grant.starts_at).toUTCString())} and ends ${escape(new Date(grant.expires_at).toUTCString())}.</p><p><a href="${escape(link.data.properties.action_link)}">Sign in to your Academy account</a></p><p>The Academy lesson schedule and access windows apply. Use Help &amp; feedback in your learning space to share your experience or report a difficulty.</p><p>AI Confidence Academy · AI assists, humans verify.</p></div>`,
    })
    return reply(res,200,{ok:true,message:'Check your assigned email for your secure Academy sign-in link.'})
  } catch (error) {
    if (error.status) return reply(res,error.status,{error:error.message})
    if (error.code==='P0001') return reply(res,409,{error:'This invitation needs Academy owner review.'})
    return reply(res,503,{error:'Your access email could not be completed. Please contact the Academy owner.'})
  }
}

export async function handleLearnerFeedback(req,res,{db}) {
  if (req.method!=='POST') return reply(res,405,{error:'Method not allowed.'})
  try {
    const {user}=await identity(req,db)
    const body=await readJson(req)
    if (!uuid.test(body.requestId||'') || !uuid.test(body.enrollmentId||'') || !['access','video','audio','workbook','payment','email','feedback','other'].includes(body.category) || typeof body.message!=='string' || body.message.trim().length<5 || body.message.length>4000) return reply(res,400,{error:'Choose an enrollment, a category, and a message of 5–4,000 characters.'})
    const enrollment=checked(await db.from('enrollments').select('id,course_id').eq('id',body.enrollmentId).eq('learner_id',user.id).maybeSingle())
    if (!enrollment) return reply(res,403,{error:'This enrollment is unavailable.'})
    if (body.lessonId) {
      if (!uuid.test(body.lessonId)) return reply(res,400,{error:'Invalid lesson.'})
      const lesson=checked(await db.from('lessons').select('id').eq('id',body.lessonId).eq('course_id',enrollment.course_id).maybeSingle())
      if (!lesson) return reply(res,400,{error:'Choose a lesson in this enrollment.'})
    }
    const count=await db.from('aca_learner_feedback').select('id',{count:'exact',head:true}).eq('learner_id',user.id).gte('created_at',new Date(Date.now()-86400000).toISOString())
    if (count.error) throw count.error
    if (count.count>=30) return reply(res,429,{error:'Your messages are recorded. Please wait before sending more.'})
    const prior=checked(await db.from('aca_learner_feedback').select('id').eq('request_id',body.requestId).eq('learner_id',user.id).maybeSingle())
    if (prior) return reply(res,200,{ok:true,id:prior.id})
    const inserted=checked(await db.from('aca_learner_feedback').insert({request_id:body.requestId,enrollment_id:enrollment.id,learner_id:user.id,lesson_id:body.lessonId||null,category:body.category,message:body.message.trim()}).select('id').single())
    return reply(res,200,{ok:true,id:inserted.id})
  } catch(error) { return reply(res,error.status||503,{error:error.status?error.message:'Your feedback could not be saved. Please try again.'}) }
}

// Cron authorization remains in each original handler. Unauthorized probes are never recorded as runs.
export async function recordAutomationRun(req,res,config,job,handler) {
  if (!config?.db || !config.cronSecret || req.headers.authorization!==`Bearer ${config.cronSecret}` || req.method!=='GET') return handler(req,res,config)
  let runId
  try { const row=await config.db.from('aca_automation_runs').insert({job}).select('id').single();runId=row.data?.id } catch { /* Keep the established job operational if diagnostics fail. */ }
  let status=200,headers={},payload=''
  const captured={writeHead(code,value){status=code;headers=value||{}},end(body){payload=body||''}}
  try { await handler(req,captured,config) }
  catch {status=500;payload=JSON.stringify({error:'Automation failed.'});headers={'Content-Type':'application/json'}}
  if(runId) {
    let result;try{result=clean(JSON.parse(payload))}catch{result={summary:'No structured result'}}
    try {await config.db.from('aca_automation_runs').update({finished_at:new Date().toISOString(),status:status>=400?'failed':Number(result.failed)>0?'warning':'completed',result}).eq('id',runId)}catch{ /* The job result still reaches its caller. */ }
  }
  res.writeHead(status,headers);res.end(payload)
}

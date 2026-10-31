import {createHash,timingSafeEqual} from 'node:crypto'
import {sendOperationalEmail} from '../email/operational-email.mjs'
import {findAnswers,policyVersion} from './knowledge.mjs'
import {withdrawalStatement,withdrawalReceiptText} from './cancellation.mjs'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const hash=v=>createHash('sha256').update(String(v)).digest('hex')
const categories=['enrollment','sign-in','technical','payment','privacy','accessibility','general']
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const checked=r=>{if(r.error)throw r.error;return r.data}
const fail=(status,message)=>Object.assign(new Error(message),{status})
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(value))}
async function body(req){
 let text=''
 if(req.body!==undefined)text=typeof req.body==='string'||Buffer.isBuffer(req.body)?String(req.body):JSON.stringify(req.body)
 else for await(const part of req){text+=part;if(text.length>16000)throw fail(413,'Keep the request under 16 KB.')}
 if(text.length>16000)throw fail(413,'Keep the request under 16 KB.')
 try{const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v}catch{throw fail(400,'Send a valid support request.')}
}
function validKey(value){return typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)}
async function limited(req,db,email){
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
 for(const scope of [`ip:${ip}:${Math.floor(Date.now()/60000)}`,...(email?[`email:${email}:${Math.floor(Date.now()/86400000)}`]:[])]){
  if(!checked(await db.rpc('aca_trial_rate_limit',{p_key:hash('support:'+scope)})))throw fail(429,'Please wait before sending another request. Your saved cases remain available.')
 }
}
async function authorizeCase(req,db,id){
 const key=req.headers['x-aca-support-key'];if(!uuid.test(id)||!validKey(key))throw fail(404,'This private case link is unavailable.')
 const row=checked(await db.from('aca_support_cases').select('*').eq('id',id).maybeSingle())
 if(!row||!timingSafeEqual(Buffer.from(row.access_hash),Buffer.from(hash(key))))throw fail(404,'This private case link is unavailable.')
 return row
}
function privateLink(config,id,key){const url=new URL('/contact/',config.appUrl);url.hash=new URLSearchParams({case:id,key});return url.href}
async function messageMail(config,row,message,key,ack=false,withdrawal=false){
 if(!config?.resend||!config?.emailFrom||!config?.appUrl)return false
 const url=key?privateLink(config,row.id,key):null
 const receipt=withdrawal?withdrawalReceiptText({id:row.id,receivedAt:row.created_at,statement:message.body}):null
 try{await sendOperationalEmail(config,{eventKey:`support:${message.id}`,templateKey:withdrawal?'withdrawal_received':ack?'support_received':'support_reply',to:row.email,subject:withdrawal?`ACA withdrawal received · ${row.id.slice(0,8)}`:`ACA support ${ack?'received':'update'} · ${row.id.slice(0,8)}`,metadata:{support_case_id:row.id,policy_version:policyVersion},html:`<div style="font-family:Arial,sans-serif;color:#102d4f;line-height:1.6"><h1>${withdrawal?'Your withdrawal notice is received':ack?'Your ACA request is saved':'An ACA support reply is ready'}</h1><p>Reference: ${row.id.slice(0,8)}</p>${withdrawal?`<p style="white-space:pre-wrap">${escape(receipt)}</p>`:ack?'<p>Your request has been recorded. Automatic help is available on our contact page. Requests needing account, billing, privacy, or accessibility decisions are reviewed by authorized Academy staff.</p>':`<p>${escape(message.body).replace(/\n/g,'<br>')}</p>`}${url?`<p><a href="${escape(url)}">Open your private support case</a></p><p>Keep this link private. Anyone with the link can read and update this case.</p>`:'<p>To continue, use the private case link in your original confirmation email or open your saved case in the browser where you submitted it.</p>'}<p>Use your private case or <a href="${escape(new URL('/contact/',config.appUrl).href)}">ACA contact</a> for follow-up. This sending address does not accept replies.</p></div>`});return true}catch{return false}
}
async function notifyOwner(config,row,message){
 if(!config?.resend||!config?.emailFrom||!config?.appUrl)return false
 try{
  const recipients=checked(await config.db.rpc('aca_support_alert_recipients'))
  if(!Array.isArray(recipients)||!recipients.length)return false
  for(const {email} of recipients)await sendOperationalEmail(config,{eventKey:`support-alert:${message.id}:${hash(email).slice(0,12)}`,templateKey:'support_owner_alert',to:email,subject:`ACA support needs review · ${row.id.slice(0,8)}`,metadata:{support_case_id:row.id},html:`<div style="font-family:Arial,sans-serif;color:#102d4f;line-height:1.6"><h1>A support case needs review</h1><p>Category: ${escape(row.category)}. Reference: ${row.id.slice(0,8)}.</p><p><a href="${escape(new URL('/control-center/',config.appUrl).href)}">Open the control center</a> and select Support &amp; feedback. The request and its history are available there.</p><p>Confirm identity before disclosing account information or authorizing a billing or access change.</p></div>`})
  return true
 }catch{return false}
}
export async function handleSupport(req,res,config,{reviewerCheck}={}){
 const db=config?.db
 try{
  if(!db)throw fail(503,'Support is temporarily unavailable. Please try again.')
  const url=new URL(req.url,'http://localhost'),owner=url.pathname==='/api/operations/support'
  if(owner){
   const token=req.headers['x-aca-access-token'];if(typeof token!=='string')throw fail(401,'Sign in to the control center.')
   const identity=await db.auth.getUser(token)
   if(identity.error||!identity.data?.user||identity.data.user.is_anonymous)throw fail(401,'Sign in again.')
   if(!reviewerCheck||!await reviewerCheck(token))throw fail(403,'Academy owner access is required.')
   if(req.method==='GET'){
    const cases=checked(await db.from('aca_support_cases').select('id,email,name,category,subject,status,created_at,updated_at').order('updated_at',{ascending:false}).limit(100))
    const messages=cases.length?checked(await db.from('aca_support_messages').select('id,case_id,author,body,created_at').in('case_id',cases.map(x=>x.id)).order('created_at')):[]
    return reply(res,200,{cases,messages})
   }
   if(req.method!=='POST')return reply(res,405,{error:'Method not allowed.'})
   const v=await body(req);if(!uuid.test(v.caseId||'')||!uuid.test(v.requestId||''))throw fail(400,'Choose a valid case and request.')
   const row=checked(await db.from('aca_support_cases').select('*').eq('id',v.caseId).single())
   if(v.action==='status'){
    if(!['open','reviewing','resolved'].includes(v.status))throw fail(400,'Choose a valid case status.')
    checked(await db.from('aca_support_cases').update({status:v.status,last_actor_id:identity.data.user.id,updated_at:new Date().toISOString()}).eq('id',row.id))
    return reply(res,200,{ok:true})
   }
   if(v.action!=='reply'||typeof v.message!=='string'||v.message.trim().length<5||v.message.length>4000)throw fail(400,'Write a reply of 5–4,000 characters.')
   const old=checked(await db.from('aca_support_messages').select('*').eq('id',v.requestId).maybeSingle())
   if(old&&(old.case_id!==row.id||old.author!=='academy'||old.body!==v.message.trim()))throw fail(409,'This request reference has already been used.')
   const message=old||checked(await db.from('aca_support_messages').insert({id:v.requestId,case_id:row.id,author:'academy',actor_id:identity.data.user.id,body:v.message.trim()}).select('*').single())
   checked(await db.from('aca_support_cases').update({updated_at:new Date().toISOString()}).eq('id',row.id))
   const emailSent=await messageMail(config,row,message,null)
   return reply(res,200,{ok:true,emailSent})
  }
  if(url.pathname==='/api/support/answers'&&req.method==='GET')return reply(res,200,{answers:findAnswers(url.searchParams.get('q')?.slice(0,500)),version:policyVersion})
  const id=url.pathname.match(/^\/api\/support\/cases\/([a-f0-9-]+)(?:\/messages)?$/i)?.[1]
  if(id){
   await limited(req,db)
   const row=await authorizeCase(req,db,id)
   if(req.method==='GET'){
    const messages=checked(await db.from('aca_support_messages').select('id,author,body,created_at').eq('case_id',id).order('created_at'))
    return reply(res,200,{case:{id:row.id,subject:row.subject,status:row.status,category:row.category,created_at:row.created_at},messages})
   }
   if(req.method==='POST'){
    const v=await body(req);if(!uuid.test(v.requestId||'')||typeof v.message!=='string'||v.message.trim().length<5||v.message.length>4000)throw fail(400,'Write a message of 5–4,000 characters.')
    const old=checked(await db.from('aca_support_messages').select('case_id,author,body').eq('id',v.requestId).maybeSingle())
    if(old&&(old.case_id!==id||old.author!=='requester'||old.body!==v.message.trim()))throw fail(409,'This request reference has already been used.')
    if(!old)checked(await db.from('aca_support_messages').insert({id:v.requestId,case_id:id,author:'requester',body:v.message.trim()}))
    await notifyOwner(config,row,{id:v.requestId})
    checked(await db.from('aca_support_cases').update({status:'open',last_actor_id:null,updated_at:new Date().toISOString()}).eq('id',id))
    return reply(res,200,{ok:true})
   }
  }
  const withdrawal=url.pathname==='/api/support/withdrawals'
  if((url.pathname!=='/api/support/cases'&&!withdrawal)||req.method!=='POST')return reply(res,405,{error:'Method not allowed.'})
  let v=await body(req)
  if(withdrawal){
   const name=String(v.name||'').trim(),email=String(v.email||'').trim().toLowerCase(),contract=String(v.contract||'').trim()
   if(!name||name.length>120||contract.length<5||contract.length>1000)throw fail(400,'Enter your name and enough details to identify the enrollment you are withdrawing from.')
   v={...v,name,email,category:'payment',subject:'Enrollment withdrawal notice',message:withdrawalStatement({name,email,contract}),consent:true}
  }
  if(v.website)return reply(res,400,{error:'Please submit the form directly.'})
  const email=String(v.email||'').trim().toLowerCase(),name=String(v.name||'').trim(),subject=String(v.subject||'').trim(),message=String(v.message||'').trim()
  if(!uuid.test(v.requestId||'')||!validKey(v.key)||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||name.length>120||!categories.includes(v.category)||subject.length<5||subject.length>160||message.length<5||message.length>4000||v.consent!==true)throw fail(400,'Check your email, category, subject, message, and contact consent.')
  await limited(req,db,email)
  let row=checked(await db.from('aca_support_cases').select('*').eq('request_id',v.requestId).maybeSingle())
  if(row&&(row.email!==email||row.access_hash!==hash(v.key)||(withdrawal&&row.subject!==subject)))throw fail(409,'This request reference has already been used.')
  if(!row){const result=await db.from('aca_support_cases').insert({id:v.requestId,request_id:v.requestId,access_hash:hash(v.key),email,name,category:v.category,subject}).select('*').single();if(result.error?.code==='23505'){row=checked(await db.from('aca_support_cases').select('*').eq('request_id',v.requestId).single());if(row.email!==email||row.access_hash!==hash(v.key)||(withdrawal&&row.subject!==subject))throw fail(409,'This request reference has already been used.')}else row=checked(result)}
  const old=checked(await db.from('aca_support_messages').select('*').eq('id',v.requestId).maybeSingle())
  if(withdrawal&&old&&(old.body!==message||old.case_id!==row.id||old.author!=='requester'))throw fail(409,'This request reference has already been used. Keep your original acknowledgment.')
  let first=old
  if(!first){
   const result=await db.from('aca_support_messages').insert({id:v.requestId,case_id:row.id,author:'requester',body:message}).select('*').single()
   if(withdrawal&&result.error?.code==='23505'){
    first=checked(await db.from('aca_support_messages').select('*').eq('id',v.requestId).single())
    if(first.body!==message||first.case_id!==row.id||first.author!=='requester')throw fail(409,'This request reference has already been used.')
   }else first=checked(result)
  }
  const emailSent=await messageMail(config,row,first,v.key,true,withdrawal)
  const ownerNotified=await notifyOwner(config,row,first)
  return reply(res,200,{ok:true,id:row.id,emailSent,ownerNotified,...(withdrawal?{receipt:{id:row.id,receivedAt:row.created_at,statement:first.body,text:withdrawalReceiptText({id:row.id,receivedAt:row.created_at,statement:first.body})}}:{})})
 }catch(e){return reply(res,e.status||503,{error:e.status?e.message:'Your request could not be completed. Keep your message and try again.'})}
}

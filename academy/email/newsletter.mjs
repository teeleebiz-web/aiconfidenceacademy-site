import { readFile } from 'node:fs/promises'
import { dispatchReadyEditions } from './newsletter-delivery.mjs'

export const SEGMENT_ID = '033a0032-dddd-41f2-823d-227123b2b3f4'
export const TOPIC_ID = 'b5614546-57b7-4804-80ea-b814ad786794'
const checked = result => { if (result.error) throw result.error; return result.data }
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const json = (res, code, value) => { res.writeHead(code, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(value)) }

export function videoCatalog(html) {
  return [...html.matchAll(/<h3\b[^>]*\bid="((?:topic-|explore-video-)[a-z0-9-]+)"[^>]*>([^<]+)<\/h3>/g)].map(([,id,title]) => ({
    id: `video:${id}`, title: title.replace(/&amp;/g,'&'), url: `https://aiconfidenceacademy.org/videos/#${id}`, kind:'video',
  }))
}

export function weekKey(now = new Date()) {
  const date = new Date(now); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0,10)
}

export async function syncSubscriber(config, row, now) {
  if (!row.consent_at) return 'no_explicit_consent'
  const call = async task => { const result=await task(); if(!config.testMode) await new Promise(resolve=>setTimeout(resolve,600)); return result }
  const result = await call(()=>config.resend.contacts.get({ email: row.email }))
  if (result.error && result.error.statusCode !== 404) throw result.error
  let contact = result.data
  let topicOptOut = false
  if(contact) {
    const topics=checked(await call(()=>config.resend.contacts.topics.list({id:contact.id})))
    topicOptOut=topics.data?.some(topic=>topic.id===TOPIC_ID && topic.subscription==='opt_out') || false
  }
  // Never restore a provider unsubscribe when a form is submitted again.
  if ((contact?.unsubscribed || topicOptOut) && row.status === 'active') {
    checked(await config.db.from('aca_update_subscriptions').update({status:'unsubscribed'}).eq('email',row.email))
    row = {...row,status:'unsubscribed'}
  }
  if (row.status !== 'active') {
    if (contact) {
      checked(await call(()=>config.resend.contacts.topics.update({id:contact.id,topics:[{id:TOPIC_ID,subscription:'opt_out'}]})))
      const removed=await call(()=>config.resend.contacts.segments.remove({contactId:contact.id,segmentId:SEGMENT_ID}))
      if(removed.error?.statusCode !== 404) checked(removed)
    }
  } else {
    if (!contact) contact = checked(await call(()=>config.resend.contacts.create({email:row.email,firstName:row.first_name,lastName:row.last_name})))
    checked(await call(()=>config.resend.contacts.segments.add({contactId:contact.id,segmentId:SEGMENT_ID})))
  }
  checked(await config.db.from('aca_update_subscriptions').update({synced_at:now,sync_error:null}).eq('email',row.email))
  return row.status
}

export async function prepareEdition(db, catalog, now = new Date()) {
  if (!catalog.length) throw new Error('Published catalog is empty; baseline preserved')
  const previous = checked(await db.from('aca_newsletter_state').select('value').eq('id','catalog').maybeSingle())
  if (!previous) {
    checked(await db.from('aca_newsletter_state').insert({id:'catalog',value:catalog.map(item=>item.id)}))
    return {baseline:catalog.length,added:0}
  }
  const fresh = catalog.filter(item => !previous.value.includes(item.id))
  if (!fresh.length) return {added:0}
  const week = weekKey(now)
  const existing = checked(await db.from('aca_newsletter_editions').select('items,status').eq('week',week).maybeSingle())
  // A reviewed edition is immutable. Unseen items remain pending for the following week.
  if (existing && existing.status !== 'draft') return {added:0,pending:fresh.length}
  const items = [...new Map([...(existing?.items || []),...fresh].map(item=>[item.id,item])).values()]
  checked(await db.from('aca_newsletter_editions').upsert({week,status:'draft',items,updated_at:now.toISOString()},{onConflict:'week'}))
  checked(await db.from('aca_newsletter_state').update({value:[...new Set([...previous.value,...fresh.map(item=>item.id)])],updated_at:now.toISOString()}).eq('id','catalog'))
  return {week,added:fresh.length}
}

export async function runNewsletterMaintenance(config, catalog, now = new Date()) {
  const started = now.toISOString()
  const settings = checked(await config.db.from('aca_newsletter_state').select('value').eq('id','settings').maybeSingle())
  const syncEnabled = settings?.value?.contact_sync_enabled === true
  const rows = syncEnabled ? checked(await config.db.from('aca_update_subscriptions').select('*')
    .order('synced_at',{ascending:true,nullsFirst:true}).limit(5)) : []
  const summary = {mode:settings?.value?.delivery_enabled ? 'weekly_delivery' : 'prepare_only',contact_sync_enabled:syncEnabled,checked:rows.length,synced:0,failed:0,edition:null}
  // Read-only verification of the deployed credential's marketing permissions.
  // Transactional sending keys may work for notices but not contact management.
  if(config.resend.segments?.get) {
    try { const access=await config.resend.segments.get(SEGMENT_ID); summary.provider_access=access.error?'not_verified':'verified' }
    catch { summary.provider_access='not_verified' }
    await new Promise(resolve=>setTimeout(resolve,600))
  }
  for (const row of rows) {
    try { await syncSubscriber(config,row,started); summary.synced++ }
    catch { summary.failed++; checked(await config.db.from('aca_update_subscriptions').update({sync_error:'Contact synchronization failed; retry scheduled',synced_at:started}).eq('email',row.email)) }
    // Stay below the provider request rate without retry storms.
    await new Promise(resolve=>setTimeout(resolve,1600))
  }
  summary.edition = await prepareEdition(config.db,catalog,now)
  summary.delivery = syncEnabled && !summary.failed ? await dispatchReadyEditions(config,settings.value,weekKey(now)) : {held:'subscriber_sync_not_ready'}
  checked(await config.db.from('aca_newsletter_state').upsert({id:'last_run',value:{...summary,at:started},updated_at:started}))
  return summary
}

export async function handleNewsletterMaintenance(req,res,config,root) {
  if(req.method !== 'GET') return json(res,405,{error:'Method not allowed'})
  if(!config?.cronSecret || !config?.db || !config?.resend) return json(res,503,{error:'Newsletter maintenance is not configured'})
  if(req.headers.authorization !== `Bearer ${config.cronSecret}`) return json(res,401,{error:'Unauthorized'})
  try {
    const catalog = JSON.parse(await readFile(`${root}/newsletter-catalog.json`,'utf8'))
    return json(res,200,await runNewsletterMaintenance(config,catalog))
  } catch { return json(res,500,{error:'Newsletter preparation failed'}) }
}

export async function handleNewsletterUnsubscribe(req,res,config) {
  if(!['GET','POST'].includes(req.method)) return json(res,405,{error:'Method not allowed'})
  // The shared Vercel entry rewrites req.url to its path; query stays on req.query.
  const token = typeof req.query?.token === 'string' ? req.query.token : new URL(req.url,'https://checkout.aiconfidenceacademy.org').searchParams.get('token') || ''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return json(res,400,{error:'Invalid unsubscribe link'})
  if(!config?.db) return json(res,503,{error:'Please try again shortly'})
  try {
    let store='aca_update_subscriptions'
    let row = checked(await config.db.from(store).select('email,status,consent_at').eq('unsubscribe_token',token).maybeSingle())
    // Previously issued welcome links stay valid. They change only the original
    // optional-interest preference, never enrollment or payment records.
    if(!row) { store='aca_interest_list'; row=checked(await config.db.from(store).select('id,email,status,first_name,last_name,last_submitted_at').eq('unsubscribe_token',token).maybeSingle()) }
    if(!row) return json(res,400,{error:'Invalid unsubscribe link'})
    if(req.method === 'POST') {
      if(store==='aca_interest_list') {
        checked(await config.db.from(store).update({status:'unsubscribed'}).eq('id',row.id))
        // Preserve opt-outs from old welcome links in the dedicated preference
        // store so a temporary provider failure can be retried safely.
        const consentAt=row.last_submitted_at || new Date().toISOString()
        checked(await config.db.from('aca_update_subscriptions').upsert({email:row.email,first_name:row.first_name || '',last_name:row.last_name || '',status:'unsubscribed',consent_at:consentAt,source:'legacy_link_opt_out',synced_at:null},{onConflict:'email'}))
        row={...row,consent_at:consentAt}
      }
      checked(await config.db.from('aca_update_subscriptions').update({status:'unsubscribed',synced_at:null}).eq('email',row.email))
      if(config.resend && row.consent_at) { try { await syncSubscriber(config,{...row,status:'unsubscribed'},new Date().toISOString()) } catch { /* Daily maintenance retries. */ } }
    }
    const done=req.method==='POST' || row.status==='unsubscribed'
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"})
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ACA email preferences</title><body style="background:#f7f2e6;color:#102d50;font-family:Arial,sans-serif;padding:40px"><main style="max-width:580px;margin:auto;background:white;border:1px solid #c6a264;padding:32px"><h1>AI Confidence Academy</h1><p>${done?'You have been unsubscribed from ACA learning updates.':'Would you like to stop receiving ACA learning updates?'}</p>${done?'<p>Your learning access is unchanged.</p>':`<form method="post" action="?token=${escape(token)}"><button style="background:#102d50;color:white;padding:12px 24px;border:0">Unsubscribe</button></form>`}<p><a href="https://aiconfidenceacademy.org/">Visit the Academy</a></p></main></body></html>`)
  } catch { return json(res,503,{error:'Please try again shortly'}) }
}

import {newsletterMessage} from './newsletter-message.mjs'
const checked = result => {if(result.error) throw result.error;return result.data}
const pause = config => config.testMode ? Promise.resolve() : new Promise(resolve=>setTimeout(resolve,600))

// Each edition has one provider broadcast. Uncertain creation is held for review,
// never blindly recreated; uncertainty after sending is checked against that ID.
export async function dispatchEdition(config, edition, settings) {
  if(!settings.delivery_enabled) return {held:'delivery_not_enabled'}
  if(!settings.mailing_address?.trim()) return {held:'mailing_address_required'}
  if(!settings.topic_id || !settings.segment_id) return {held:'recipient_group_required'}
  if(!edition.items?.length) return {held:'empty_edition'}
  if(edition.dispatch_state==='needs_review') return {held:'needs_review'}
  const table=()=>config.db.from('aca_newsletter_editions')
  let id=edition.broadcast_id
  if(!id) {
    const claimed=checked(await table().update({dispatch_state:'creating',status:'approved',updated_at:new Date().toISOString()})
      .eq('week',edition.week).eq('dispatch_state','pending').select('week').maybeSingle())
    if(!claimed) return {held:'already_claimed'}
    try {
      const message=newsletterMessage(edition.items,settings.mailing_address)
      const result=checked(await config.resend.broadcasts.create({
        ...message,name:`ACA weekly learning ${edition.week}`,from:config.emailFrom,
        segmentId:settings.segment_id,topicId:settings.topic_id,send:false,
      }))
      id=result.id
      if(!id) throw new Error('Provider did not return a broadcast identifier')
      checked(await table().update({broadcast_id:id,dispatch_state:'ready',last_error:null}).eq('week',edition.week))
      await pause(config)
    } catch {
      checked(await table().update({dispatch_state:'needs_review',last_error:'Broadcast creation requires review before retry'}).eq('week',edition.week))
      return {held:'needs_review'}
    }
  }
  try {
    const broadcast=checked(await config.resend.broadcasts.get(id));await pause(config)
    if(['sent','queued','scheduled','sending'].includes(broadcast.status)) {
      checked(await table().update({dispatch_state:'submitted',status:'sent',submitted_at:broadcast.sent_at || new Date().toISOString(),last_error:null}).eq('week',edition.week))
      return {submitted:true,broadcastId:id}
    }
    if(broadcast.status!=='draft') return {held:'provider_status_requires_review'}
    // Only one worker may issue the send request. A sending row is reconciled on
    // the next run, but never sends a second time merely because status is stale.
    const claim=checked(await table().update({dispatch_state:'sending'}).eq('week',edition.week).eq('dispatch_state','ready').select('week').maybeSingle())
    if(!claim) return {held:'send_in_progress_or_requires_review'}
    const sent=await config.resend.broadcasts.send(id)
    if(sent.error) throw sent.error
    checked(await table().update({dispatch_state:'submitted',status:'sent',submitted_at:new Date().toISOString(),last_error:null}).eq('week',edition.week))
    return {submitted:true,broadcastId:id}
  } catch {
    checked(await table().update({last_error:'Delivery needs reconciliation with the recorded broadcast'}).eq('week',edition.week))
    return {held:'provider_reconciliation_required'}
  }
}

export async function dispatchReadyEditions(config,settings,currentWeek) {
  if(!settings.delivery_enabled) return {held:'delivery_not_enabled'}
  if(!settings.mailing_address?.trim()) return {held:'mailing_address_required'}
  // Any unresolved local preference change blocks dispatch until synchronization.
  const pending=checked(await config.db.from('aca_update_subscriptions').select('email').or('synced_at.is.null,sync_error.not.is.null').limit(1))
  if(pending.length) return {held:'subscriber_preferences_pending'}
  const active=checked(await config.db.from('aca_update_subscriptions').select('email').eq('status','active').limit(1))
  if(!active.length) return {held:'no_opted_in_subscribers'}
  const editions=checked(await config.db.from('aca_newsletter_editions').select('*').lt('week',currentWeek).neq('status','sent').order('week',{ascending:true}).limit(1))
  if(!editions.length) return {held:'no_new_edition'}
  return dispatchEdition(config,editions[0],settings)
}

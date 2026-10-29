// Temporary sandbox acceptance entry. Never merge into production.
import Stripe from 'stripe'
import {createClient} from '@supabase/supabase-js'
import {Resend} from 'resend'
import {Readable} from 'node:stream'
import {timingSafeEqual} from 'node:crypto'
import {handleInstallmentCheckout,handlePaidInFullCheckout,attachApprovedInstallmentSchedule} from '../academy/enrollment/installment-plan.mjs'
import {handleStripeEnrollment} from '../academy/enrollment/stripe-webhook.mjs'
import {phaseTwoConfig} from '../academy/enrollment/offers.mjs'
const ref='xylhbkplcrktlztqfyvk'
const course='00000000-0000-4000-8000-000000000002', cohort='00000000-0000-4000-8000-000000000003'
const prices={phaseTwoPaidInFullPriceId:'price_1UVoLwISbjgQbMXEqlivPAdz',phaseTwoStandardPriceId:'price_1UVoPXISbjgQbMXEk2mS9aKj',installment67PriceId:'price_1UVoRIISbjgQbMXE10eXn0m4',installment66PriceId:'price_1UVoVEISbjgQbMXEmqzhdGYz'}
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&x.length>30&&timingSafeEqual(x,y)}
async function setup(){
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='test/aca-sandbox-checkout'||!/^([sr]k)_test_/.test(process.env.STRIPE_SECRET_KEY||'')||!process.env.ACA_PHASE_TWO_ACCEPTANCE_TOKEN)throw Error('Sandbox guard refused execution')
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY)
 const account=await stripe.accounts.retrieve();if(account.id!=='acct_1UGt8vISbjgQbMXE')throw Error('Wrong sandbox account')
 const existing=await stripe.prices.list({product:'prod_VWs6RUFv6gSdN1',active:true,limit:100})
 for(const [key,amount]of [['phaseTwoPaidInFullPriceId',17900],['installment67PriceId',6700],['installment66PriceId',6600]]){
  const recurring=key.startsWith('installment')
  const price=existing.data.find(p=>p.currency==='usd'&&p.unit_amount===amount&&p.tax_behavior==='inclusive'&&(recurring?p.recurring?.interval==='week'&&p.recurring.interval_count===1:p.type==='one_time'))||await stripe.prices.create({product:'prod_VWs6RUFv6gSdN1',currency:'usd',unit_amount:amount,tax_behavior:'inclusive',...(recurring?{recurring:{interval:'week',interval_count:1}}:{}),nickname:'Phase Two inclusive USD sandbox acceptance'})
  prices[key]=price.id
 }
 const db=createClient(`https://${ref}.supabase.co`,'acceptance-proxy',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options={})=>{
  const parsed=new URL(url),headers=Object.fromEntries(new Headers(options.headers).entries())
  delete headers.apikey;delete headers.authorization
  return fetch(`https://${ref}.supabase.co/functions/v1/phase-two-test-proxy`,{method:'POST',headers:{Authorization:`Bearer ${process.env.ACA_PHASE_TWO_ACCEPTANCE_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({path:parsed.pathname+parsed.search,method:options.method||'GET',headers,body:options.body})})
 }}})
 const appUrl='https://aiconfidenceacademy.org'
 return {stripe,db,config:{stripe,db,courseId:'sandbox-phase-one-unused',phaseOnePriceId:'sandbox-phase-one-unused',phaseTwoCourseId:course,phaseTwoCohortId:cohort,...prices,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,resend:new Resend(process.env.RESEND_API_KEY),emailFrom:process.env.ACA_EMAIL_FROM,appUrl}}
}
const unwrap=r=>{if(r.error)throw Error(r.error.message);return r.data}
async function state(db){return unwrap(await db.from('aca_p2_acceptance_state').select('payload').eq('id','run').maybeSingle())?.payload||{}}
async function save(db,value){unwrap(await db.from('aca_p2_acceptance_state').upsert({id:'run',payload:value}));return value}
async function checkout(config,handler){let created
 const stripe=config.stripe
 const proxy=Object.create(stripe);proxy.checkout={sessions:{create:async input=>{created=await stripe.checkout.sessions.create({...input,customer_email:'delivered@resend.dev'});return created}}}
 const req=Object.assign(Readable.from(['termsAccepted=yes&policyVersion=2026-10-28']),{method:'POST',headers:{origin:config.appUrl}})
 const res={writeHead(status,headers){this.status=status;this.headers=headers},end(value){this.body=value}}
 await handler(req,res,phaseTwoConfig({...config,stripe:proxy}))
 if(res.status!==303)throw Error(`Checkout creation failed: ${res.status} ${res.body}`)
 return {id:created.id,url:created.url}
}
export default async function handler(req,res){
 try{
 const {stripe,db,config}=await setup()
 const path=req.query?.__aca_path||new URL(req.url,'https://sandbox.invalid').pathname.replace(/^\//,'')
 if(path==='api/webhooks/stripe'){
  // Only verified sandbox payment events can reach the isolated fixture database.
  const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks)
  let event;try{event=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],config.webhookSecret)}catch{return json(res,400,{error:'Invalid signature'})}
  if(event.livemode!==false)return json(res,400,{error:'Live events refused'})
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','invoice.payment_succeeded','invoice.payment_failed'].includes(event.type))return json(res,200,{received:true,ignored:true})
  if(event.type.startsWith('checkout.')&&event.data.object.metadata?.aca_course_id!==course)return json(res,200,{received:true,ignored:true})
  const cloned=Object.assign(Readable.from([raw]),{method:'POST',headers:req.headers})
  return handleStripeEnrollment(cloned,res,config)
 }
 if(path!=='api/phase-two-acceptance')return json(res,404,{error:'Isolated Phase Two sandbox acceptance only'})
 if(req.method==='GET'&&!req.headers.authorization){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; form-action 'self'; base-uri 'none'"});return res.end('<!doctype html><title>Phase Two isolated sandbox test</title><h1>Phase Two isolated sandbox acceptance</h1><p>No real money. Disposable database only.</p><form method="post"><label>Test authorization <input name="token" type="password" required autocomplete="off"></label><label>Action <select name="action"><option value="start">Start checkouts</option><option value="status">Read results</option><option value="clock">Attach simulation clock</option><option value="advance">Advance simulation</option></select></label><label>Stage <select name="stage"><option>2</option><option>3</option><option>4</option></select></label><button>Run sandbox action</button></form>')}
 let input=req.body||{};if(typeof input==='string')input=req.headers['content-type']?.includes('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(input)):JSON.parse(input)
 if(req.method==='POST'&&(!input||!input.action)){let raw='';for await(const c of req)raw+=c;input=raw?(req.headers['content-type']?.includes('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(raw)):JSON.parse(raw)):{}}
 if(!equal(req.headers.authorization||`Bearer ${input.token||''}`,`Bearer ${process.env.ACA_PHASE_TWO_ACCEPTANCE_TOKEN}`))return json(res,401,{error:'Unauthorized'})
 if(input.stage)input.stage=Number(input.stage)
 const account=await stripe.accounts.retrieve();if(account.id!=='acct_1UGt8vISbjgQbMXE')throw Error('Wrong sandbox account')
 let s=await state(db)
 if(req.method==='POST'&&input.action==='start'){
  if(s.installment&&s.pricingVersion!=='inclusive-usd-v1'){
   for(const item of [s.paidInFull,s.installment])if(item){const old=await stripe.checkout.sessions.retrieve(item.id);if(old.status==='open')await stripe.checkout.sessions.expire(item.id);else if(old.payment_status==='paid')throw Error('An earlier test session was paid; preserve it for review')}
   s={};await save(db,s)
  }
  if(!s.installment){
   const product=await stripe.products.retrieve('prod_VWs6RUFv6gSdN1');
   if(!product.tax_code)await stripe.products.update(product.id,{tax_code:'txcd_20060158'});
   else if(product.tax_code!=='txcd_20060158')throw Error('Sandbox course category differs from existing Academy category');
   for(const [key,id]of Object.entries(prices)){const p=await stripe.prices.retrieve(id);if(p.livemode||!p.active||p.currency!=='usd'||p.unit_amount!==({phaseTwoPaidInFullPriceId:17900,phaseTwoStandardPriceId:19900,installment67PriceId:6700,installment66PriceId:6600})[key])throw Error('Wrong sandbox price');if(key.startsWith('installment')&&(p.recurring?.interval!=='week'||p.recurring.interval_count!==1))throw Error('Wrong interval')}
   s.paidInFull=await checkout(config,handlePaidInFullCheckout);s.installment=await checkout(config,handleInstallmentCheckout);s.prices={...prices};s.pricingVersion='inclusive-usd-v1';s=await save(db,s)
  }
  return json(res,200,s)
 }
 if(req.method==='POST'&&input.action==='clock'){
  const session=await stripe.checkout.sessions.retrieve(s.installment.id);if(session.payment_status!=='paid'||!session.subscription)throw Error('Installment checkout is not paid')
  const plans=unwrap(await db.from('aca_installment_plans').select('*').eq('stripe_subscription_id',session.subscription));if(plans.length!==1)throw Error('Webhook has not saved its installment plan')
  if(!s.clock){const clock=await stripe.testHelpers.testClocks.create({customer:session.customer,frozen_time:Math.floor(Date.now()/1000)+2,name:'ACA Phase Two acceptance - disposable'});s.clock=clock.id;s.subscription=session.subscription;s.customer=session.customer;s.secondDue=Date.parse(plans[0].second_due_at)/1000;s.thirdDue=Date.parse(plans[0].third_due_at)/1000;await save(db,s)}
  return json(res,200,{clock:s.clock,secondDue:s.secondDue,thirdDue:s.thirdDue})
 }
 if(req.method==='POST'&&input.action==='advance'){
  if(![2,3,4].includes(input.stage)||!s.clock)throw Error('Invalid stage')
  const target=({2:s.secondDue+7200,3:s.thirdDue+7200,4:s.thirdDue+7*86400+7200})[input.stage]
  const clock=await stripe.testHelpers.testClocks.retrieve(s.clock);if(clock.status!=='ready')return json(res,202,{status:clock.status})
  if(clock.frozen_time<target)await stripe.testHelpers.testClocks.advance(s.clock,{frozen_time:target})
  return json(res,200,{clock:s.clock,target})
 }
 const paidInFull=s.paidInFull?await stripe.checkout.sessions.retrieve(s.paidInFull.id):null,installment=s.installment?await stripe.checkout.sessions.retrieve(s.installment.id):null
 const plans=unwrap(await db.from('aca_installment_plans').select('*'))
 const events=unwrap(await db.from('aca_payment_events').select('stripe_event_id,status,event_type,error_message,amount_total'))
 const emails=unwrap(await db.from('aca_email_events').select('template_key,status,provider_message_id,last_error'))
 const enrollments=unwrap(await db.from('enrollments').select('id,learner_id,course_id,status,access_expires_at'))
 const members=unwrap(await db.from('aca_phase_two_memberships').select('enrollment_id,cohort_id'))
 const invoices=s.subscription?await stripe.invoices.list({subscription:s.subscription,limit:100}):null
 const subscription=s.subscription?await stripe.subscriptions.retrieve(s.subscription):null
 return json(res,200,{sessions:{paidInFull:paidInFull&&{id:paidInFull.id,status:paidInFull.status,payment_status:paidInFull.payment_status,amount_total:paidInFull.amount_total},installment:installment&&{id:installment.id,status:installment.status,payment_status:installment.payment_status,amount_total:installment.amount_total,subscription:installment.subscription}},plans,events,emails,enrollments,members,clock:s.clock?await stripe.testHelpers.testClocks.retrieve(s.clock):null,subscription:subscription&&{id:subscription.id,status:subscription.status,schedule:subscription.schedule},invoices:invoices?.data.map(i=>({id:i.id,status:i.status,amount_paid:i.amount_paid,amount_due:i.amount_due,period_start:i.period_start}))})
 }catch(error){json(res,500,{error:String(error.message).replace(/\b(?:[sr]k)_(?:live|test)_[A-Za-z0-9]+\b|\bwhsec_[A-Za-z0-9]+\b/g,'[redacted]').slice(0,500)})}
}

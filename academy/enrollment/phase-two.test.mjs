import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {handleInstallmentCheckout, handlePaidInFullCheckout, attachApprovedInstallmentSchedule, installmentConfirmationHtml} from './installment-plan.mjs'
import {phaseTwoConfig, installmentAmounts} from './offers.mjs'
const request = (raw='termsAccepted=yes&ageConfirmed=yes&policyVersion=2026-10-30') => Object.assign(Readable.from([raw]),{method:'POST',headers:{origin:'https://aca.example'}})
const response = () => ({writeHead(status,headers){this.status=status;this.headers=headers},end(value){this.value=value}})
const options = ({published=true,cohort=true,wrongPrice=false,taxBehavior='inclusive'}={}) => {
 const calls=[]
 const config=phaseTwoConfig({phaseTwoCourseId:'phase-two-course',phaseTwoCohortId:'cohort',phaseTwoPaidInFullPriceId:'p179',installment67PriceId:'p67',installment66PriceId:'p66',appUrl:'https://aca.example',db:{from(table){return {select(){return this},eq(){return this},async single(){return {data:table==='courses'?{status:published?'published':'draft'}:{status:cohort?'active':'closed'},error:null}}}}},stripe:{prices:{retrieve:async id=>({active:true,currency:'usd',tax_behavior:taxBehavior,unit_amount:wrongPrice?5000:{p179:17900,p67:6700,p66:6600}[id],type:id==='p179'?'one_time':'recurring',recurring:{interval:'week',interval_count:1}})},checkout:{sessions:{create:async value=>{calls.push(value);return {url:'https://checkout.stripe.test/p2'}}}}}})
 return {config,calls}
}
test('Phase Two checkout is blocked before Stripe when course or cohort is not open',async()=>{
 for(const state of [{published:false},{cohort:false}])for(const handler of [handlePaidInFullCheckout,handleInstallmentCheckout]){
  const {config,calls}=options(state),res=response();await handler(request(),res,config);assert.equal(res.status,503);assert.equal(calls.length,0)
 }
})
test('Phase Two uses its course, cohort and approved amounts for both choices',async()=>{
 for(const [handler,price,total,mode] of [[handlePaidInFullCheckout,'p179','17900','payment'],[handleInstallmentCheckout,'p67','19900','subscription']]){
  const {config,calls}=options(),res=response();await handler(request(),res,config);assert.equal(res.status,303)
  assert.equal(calls[0].metadata.aca_age_18_or_older,'yes');assert.equal((calls[0].subscription_data?.metadata||calls[0].metadata).aca_age_18_or_older,'yes');assert.equal(calls[0].mode,mode);assert.equal(calls[0].line_items[0].price,price);assert.equal(calls[0].metadata.aca_course_id,'phase-two-course');assert.equal(calls[0].metadata.aca_cohort_id,'cohort')
  assert.equal((calls[0].subscription_data?.metadata||calls[0].metadata).aca_total_cents,total)
 }
})
test('Phase Two rejects mismatched Stripe prices and missing agreement',async()=>{
 for(const handler of [handlePaidInFullCheckout,handleInstallmentCheckout]){
  const {config,calls}=options({wrongPrice:true}),res=response();await handler(request(),res,config);assert.equal(res.status,502);assert.equal(calls.length,0)
  const r=response();await handler(request(''),r,config);assert.equal(r.status,400)
 }
})
test('Phase Two stops its weekly schedule after $67, $66, $66',async()=>{
 let value
 const stripe={subscriptions:{retrieve:async()=>({schedule:null})},subscriptionSchedules:{create:async()=>({id:'sched',current_phase:{start_date:1000,end_date:605800}}),update:async(id,v)=>{value=v;return {id}}}}
 await attachApprovedInstallmentSchedule(stripe,'sub',options().config)
 assert.equal(value.end_behavior,'cancel');assert.deepEqual(value.phases.map(x=>x.items[0].price),['p67','p66','p66']);assert.equal(value.phases.length,3)
 const html=installmentConfirmationHtml({secondDueAt:new Date(),thirdDueAt:new Date(),amounts:[6700,6600,6600]});assert.match(html,/first \$67.00/);assert.equal((html.match(/\$66.00/g)||[]).length,2)
 assert.deepEqual(installmentAmounts({total_amount:19900}),[6700,6600,6600]);assert.throws(()=>installmentAmounts({total_amount:1}))
})

test('Phase Two rejects tax-exclusive prices before creating checkout',async()=>{
 for(const handler of [handlePaidInFullCheckout,handleInstallmentCheckout]){
  const {config,calls}=options({taxBehavior:'exclusive'}),res=response();await handler(request(),res,config);assert.equal(res.status,502);assert.equal(calls.length,0)
 }
})

test('Phase Two preserves the exact accepted disclosure version and rejects the Phase One legacy bundle',async()=>{
 for(const handler of [handlePaidInFullCheckout,handleInstallmentCheckout]){
  for(const version of ['2026-10-31','2026-10-30','2026-10-29','2026-10-28']){
   const {config,calls}=options(),res=response();await handler(request(`termsAccepted=yes&ageConfirmed=yes&policyVersion=${version}`),res,config);assert.equal(res.status,303);assert.equal(calls[0].metadata.aca_policy_version,version)
  }
  const {config,calls}=options(),res=response();await handler(request('termsAccepted=yes&ageConfirmed=yes&policyVersion=2026-10-17'),res,config);assert.equal(res.status,400);assert.equal(calls.length,0)
 }
})


test('new Phase Two checkout requires an explicit adult declaration for every released policy version',async()=>{
 for(const handler of [handlePaidInFullCheckout,handleInstallmentCheckout])for(const version of ['2026-10-31','2026-10-30','2026-10-29','2026-10-28'])for(const age of ['', '&ageConfirmed=no']){
  const {config,calls}=options(),res=response()
  await handler(request(`termsAccepted=yes&policyVersion=${version}${age}`),res,config)
  assert.equal(res.status,400);assert.equal(calls.length,0)
 }
})

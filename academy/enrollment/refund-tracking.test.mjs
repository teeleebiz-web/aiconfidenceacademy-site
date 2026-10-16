import test from 'node:test'
import assert from 'node:assert/strict'
import {recordStripeRefund} from './stripe-webhook.mjs'
test('verified refund events use atomic ordering and preserve expanded charge identifiers',async()=>{
 const calls=[];const config={db:{rpc:async(name,args)=>{calls.push({name,args});return {error:null}}}}
 const event={type:'refund.updated',created:1792128000,livemode:true,data:{object:{id:'re_actual',charge:{id:'ch_actual'},amount:5000,currency:'usd',status:'succeeded'}}}
 const result=await recordStripeRefund(event,config)
 assert.equal(result.refundsRecorded,1);assert.equal(calls[0].name,'aca_record_refund');assert.equal(calls[0].args.p_created,event.created);assert.equal(calls[0].args.p_refund.charge_id,'ch_actual');assert.equal(calls[0].args.p_refund.livemode,true)
 const charge={type:'charge.refunded',created:1792128001,livemode:false,data:{object:{id:'ch_original',billing_details:{email:'OWNER@EXAMPLE.COM'},refunds:{data:[{id:'re_second',amount:1000,currency:'usd',status:'succeeded'}]}}}}
 await recordStripeRefund(charge,config);assert.equal(calls[1].args.p_refund.charge_id,'ch_original');assert.equal(calls[1].args.p_refund.customer_email,'owner@example.com')
})

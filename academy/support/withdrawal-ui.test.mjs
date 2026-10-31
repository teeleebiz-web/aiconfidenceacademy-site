import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {JSDOM} from 'jsdom'

const html=await readFile(new URL('../../contact/index.html',import.meta.url),'utf8')
const source=(await readFile(new URL('../../support.js',import.meta.url),'utf8')).replace(/^import .*\n/,'')
const tick=()=>new Promise(resolve=>setImmediate(resolve))

test('withdrawal review is local; only explicit confirmation submits, and a failed email retains a downloadable receipt and retry',async()=>{
 const dom=new JSDOM(html,{url:'https://aiconfidenceacademy.org/contact/',runScripts:'outside-only'})
 const w=dom.window,calls=[]
 w.answers=[];w.findAnswers=()=>[];w.URL.createObjectURL=()=> 'blob:receipt';w.URL.revokeObjectURL=()=>{}
 w.fetch=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)})
  return {ok:true,json:async()=>({ok:true,id:calls[0].body.requestId,emailSent:false,receipt:{receivedAt:'2026-10-31T18:00:00.000Z',text:'Saved immutable withdrawal notice',statement:'I withdraw'}})}
 }
 w.eval(source)
 const form=w.document.getElementById('withdrawal-form'),review=w.document.getElementById('withdrawal-review')
 for(const [name,value] of Object.entries({name:'Fictional Learner',email:'learner@example.test',contract:'Phase One, purchased October 31'}))form.elements.namedItem(name).value=value
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))
 assert.equal(calls.length,0);assert.equal(review.hidden,false);assert.equal(form.hidden,true)
 assert.match(w.document.getElementById('withdrawal-statement').textContent,/Fictional Learner/)
 w.document.getElementById('withdrawal-edit').click();assert.equal(form.hidden,false)
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))
 w.document.getElementById('withdrawal-confirm').click();await tick()
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://checkout.aiconfidenceacademy.org/api/support/withdrawals')
 assert.equal(calls[0].body.contract,'Phase One, purchased October 31')
 const panel=w.document.getElementById('withdrawal-status')
 assert.match(panel.textContent,/notice is still recorded/)
 assert.ok(panel.querySelector('a[download]'))
 const privateLink=[...panel.querySelectorAll('a')].find(x=>x.textContent.includes('private'))
 assert.match(privateLink.href,/#case=/);assert.equal(review.hidden,true)
 panel.querySelector('button').click();await tick()
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body,calls[1].body)
 dom.window.close()
})

test('enrollment displays the cancellation notice before payment and retains prices, schedules, and required assent',async()=>{
 const page=await readFile(new URL('../../enroll/index.html',import.meta.url),'utf8')
 const dom=new JSDOM(page,{url:'https://aiconfidenceacademy.org/enroll/',runScripts:'outside-only'})
 dom.window.eval(await readFile(new URL('../../site.js',import.meta.url),'utf8'))
 const d=dom.window.document
 assert.match(d.querySelector('.purchase-notice').textContent,/14 days after the day/)
 assert.ok(d.querySelector('.purchase-notice a[href="/refund-policy/#cancellation"]'))
 assert.ok(d.querySelector('.purchase-notice a[href="/contact/#withdrawal"]'))
 assert.equal(d.querySelectorAll('form[action*="/api/enrollment/"]').length,2)
 for(const form of d.querySelectorAll('form[action*="/api/enrollment/"]')){
  assert.equal(form.elements.namedItem('policyVersion').value,'2026-10-31-cancellation')
  assert.equal(form.elements.namedItem('termsAccepted').required,true)
  assert.equal(form.checkValidity(),false)
 }
 assert.match(d.querySelector('.payment-card-featured').textContent,/\$129/)
 assert.match(d.querySelector('.payment-card-installments').textContent,/\$149 total/)
 assert.match(d.body.textContent,/Phase Two enrollment is closed/)
 dom.window.close()
})

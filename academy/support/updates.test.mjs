import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeed, sources, createUpdatesService } from './updates.mjs'
const now = Date.parse('2026-11-07T05:00:00Z')
const item = (link='https://openai.com/index/example', date='Fri, 06 Nov 2026 12:00:00 GMT') => `<item><title><![CDATA[A &amp; B]]></title><link>${link}</link><pubDate>${date}</pubDate></item>`
test('feeds retain dates and safe source links, reject redirects and unsafe or undated entries',()=>{
 const result=parseFeed(`<rss>${item()}${item()}${item('https://evil.example/')}${item('javascript:alert(1)')}${item('https://openai.com:444/')}${item(undefined,'bad')}${item(undefined,'Fri, 06 Nov 2030 12:00:00 GMT')}</rss>`,sources[0],now)
 assert.equal(result.length,1);assert.equal(result[0].title,'A & B');assert.equal(result[0].collectedAt,new Date(now).toISOString())
 assert.throws(()=>parseFeed('<!DOCTYPE x><rss/>',sources[0],now))
})
test('partial failure is explicit; concurrent checks share a bounded cache and do not return stale success',async()=>{
 let calls=0, time=now, failed=false
 const read=createUpdatesService({clock:()=>time,ttl:100,fetcher:async(url,options)=>{calls++;assert.equal(options.redirect,'error');if(failed||url.includes('google'))throw Error('private provider error');return new Response(`<rss>${item()}</rss>`)}})
 const [a,b]=await Promise.all([read(),read()]);assert.equal(calls,2);assert.equal(a,b);assert.equal(a.items.length,1);assert.equal(a.sources[1].status,'unavailable')
 await read();assert.equal(calls,2);time+=101;failed=true;const c=await read();assert.equal(c.items.length,0);assert.equal(c.sources[0].status,'unavailable');assert.ok(!JSON.stringify(c).includes('private provider error'))
})

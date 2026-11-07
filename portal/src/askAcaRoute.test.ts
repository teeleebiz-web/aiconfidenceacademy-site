import {isAskAcaEntry} from './askAcaRoute'
const now=10000000
const url=(path:string)=>new URL(path,'https://academy.example')
const storage=(value:string|null)=>({getItem:()=>value})
it('only consumes a valid callback hint and never redirects normal learning or owner entry',()=>{
  for(const path of ['/learn/','/learn/?view=trial-access&code=x','/learn/?course=phase-two&code=x','/control-center/?code=x'])expect(isAskAcaEntry(url(path),storage(String(now+1000)),now)).toBe(false)
  expect(isAskAcaEntry(url('/learn/?code=x'),storage(String(now+1000)),now)).toBe(true)
  for(const expiry of [null,'garbage',String(now-1),String(now+3600001)])expect(isAskAcaEntry(url('/learn/?code=x'),storage(expiry),now)).toBe(false)
})

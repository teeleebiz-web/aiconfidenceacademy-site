import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {waitFor} from '@testing-library/react'
beforeEach(()=>{
 vi.resetModules();vi.stubGlobal('fetch',vi.fn())
 document.body.innerHTML='<form id="ask-aca-form"><textarea id="ask-aca-question"></textarea><button type="submit" disabled>Find an answer</button></form><div id="ask-aca-results" aria-live="polite"></div>'
})
afterEach(()=>vi.unstubAllGlobals())
const ask=async(value)=>{
 document.querySelector('textarea').value=value
 document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}))
 await waitFor(()=>expect(document.querySelector('button').disabled).toBe(false))
}
it('gets AI guidance without sign-in and renders only approved source text',async()=>{
 fetch.mockResolvedValue({ok:true,json:async()=>({mode:'assisted',answers:[{id:'media',answer:'invented',url:'https://evil.example'}]})})
 await import('../../assets/ask-aca.js')
 await ask('The picture is frozen and I cannot hear anything')
 expect(document.querySelector('#ask-aca-results').textContent).toContain('Video or audio will not play.')
 expect(document.querySelector('#ask-aca-results').textContent).not.toContain('invented')
 expect(document.querySelector('#ask-aca-results a').getAttribute('href')).toBe('/contact/#request')
 const [url,options]=fetch.mock.calls[0]
 expect(url).toBe('https://checkout.aiconfidenceacademy.org/api/support/ask')
 expect(options.credentials).toBe('omit')
 expect(options.headers).toEqual({'Content-Type':'application/json'})
 expect(JSON.parse(options.body)).toEqual({question:'The picture is frozen and I cannot hear anything',topic:'all',consent:true})
})
it('falls back locally on network failure and safely replaces prior answers',async()=>{
 fetch.mockRejectedValue(Error('offline'))
 await import('../../assets/ask-aca.js')
 await ask('verify');expect(document.querySelector('#ask-aca-results').textContent).toContain('Check an AI answer')
 await ask('<img src=x onerror=alert(1)>')
 expect(document.querySelector('#ask-aca-results').textContent).toContain('No matching answer')
 expect(document.querySelector('#ask-aca-results img')).toBeNull()
})
it('rejects unapproved IDs and blocks duplicate submits while a request is pending',async()=>{
 let resolve
 fetch.mockReturnValue(new Promise(r=>{resolve=r}))
 await import('../../assets/ask-aca.js')
 document.querySelector('textarea').value='My video will not play'
 const form=document.querySelector('form')
 form.dispatchEvent(new Event('submit',{cancelable:true}))
 form.dispatchEvent(new Event('submit',{cancelable:true}))
 expect(fetch).toHaveBeenCalledTimes(1)
 resolve({ok:true,json:async()=>({mode:'assisted',answers:[{id:'invented'}]})})
 await waitFor(()=>expect(document.querySelector('button').disabled).toBe(false))
 expect(document.querySelector('#ask-aca-results').textContent).toContain('Video or audio will not play.')
 expect(document.querySelector('#ask-aca-results').textContent).toContain('AI assistance is unavailable')
})

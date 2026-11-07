import {beforeEach,afterEach,it,expect,vi} from 'vitest'
beforeEach(()=>{
 vi.resetModules();vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Public answers must not use a service')}))
 document.body.innerHTML='<form id="ask-aca-form"><textarea id="ask-aca-question"></textarea><button type="submit" disabled>Find an answer</button></form><div id="ask-aca-results" aria-live="polite"></div>'
})
afterEach(()=>vi.unstubAllGlobals())
it('answers a public question without sign-in, email or a model request',async()=>{
 await import('../../assets/ask-aca.js')
 expect(document.querySelector('button').disabled).toBe(false)
 document.querySelector('textarea').value='My video will not play'
 document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}))
 expect(document.querySelector('#ask-aca-results').textContent).toContain('Video or audio will not play.')
 expect(document.querySelector('#ask-aca-results a').getAttribute('href')).toBe('/contact/#request')
 expect(fetch).not.toHaveBeenCalled()
})
it('replaces earlier answers and keeps unsupported questions as plain text',async()=>{
 await import('../../assets/ask-aca.js')
 expect(document.querySelector('button').disabled).toBe(false)
 const ask=value=>{document.querySelector('textarea').value=value;document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}))}
 ask('verify');expect(document.querySelector('#ask-aca-results').textContent).toContain('Check an AI answer')
 ask('<img src=x onerror=alert(1)>');expect(document.querySelector('#ask-aca-results').textContent).toContain('No matching answer')
 expect(document.querySelector('#ask-aca-results img')).toBeNull();expect(fetch).not.toHaveBeenCalled()
})

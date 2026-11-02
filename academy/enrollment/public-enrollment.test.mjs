import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'

const read = path => readFileSync(new URL('../../'+path,import.meta.url),'utf8')

test('public enrollment offers either phase with the approved prices and required purchase acknowledgment',()=>{
  const dom=new JSDOM(read('enroll/index.html'),{url:'https://aiconfidenceacademy.org/enroll/',runScripts:'outside-only'})
  try {
    dom.window.fetch=()=>{throw Error('Opening the enrollment page must not start a checkout')}
    dom.window.eval(read('site.js'))
    const document=dom.window.document
    const forms=[...document.querySelectorAll('form[action*="/api/enrollment/"]')]
    assert.equal(forms.length,4)
    for(const [phase,mode,button] of [
      ['one','paid-in-full','Pay $129 today'],['one','installments','Start with $50 today'],
      ['two','paid-in-full','Pay $179 today'],['two','installments','Start with $67 today'],
    ]) {
      const form=forms.find(f=>f.action===`https://checkout.aiconfidenceacademy.org/api/enrollment/phase-${phase}/${mode}`)
      assert.ok(form,`${phase} ${mode} must use its own existing checkout route`)
      assert.equal(form.method,'post')
      assert.equal(form.querySelector('button[type=submit]').textContent,button)
      const assent=form.elements.namedItem('termsAccepted')
      assert.equal(assent.checked,false)
      assert.equal(assent.required,true)
      assert.equal(form.checkValidity(),false)
      assert.equal(form.elements.namedItem('ageConfirmed').value,'yes')
      assert.equal(form.elements.namedItem('policyVersion').value,'2026-10-31')
      assert.match(form.textContent,/18 or older/)
      for(const path of ['/terms','/refund-policy','/privacy'])assert.ok(form.querySelector(`a[href="${path}"]`))
      if(mode==='installments')assert.match(form.textContent,/authorize the three payments/)
      assent.checked=true
      assert.equal(form.checkValidity(),true)
    }
    const phaseTwo=document.querySelector('[aria-labelledby=phase-two-enrollment-title]')
    assert.match(phaseTwo.textContent,/enroll directly in Phase Two/)
    assert.match(phaseTwo.textContent,/\$199 total/)
    assert.deepEqual([...phaseTwo.querySelectorAll('.payment-schedule strong')].map(x=>x.textContent),['$67','$66','$66'])
    assert.match(phaseTwo.textContent,/120 minutes/)
    assert.match(phaseTwo.textContent,/Saturday lesson access continues through Sunday/)
    assert.doesNotMatch(phaseTwo.textContent,/enrollment is closed|No payment is being collected/)
  } finally {dom.window.close()}
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

test('public enrollment forms submit to the separate backend and retain consent', async () => {
  const script = await readFile(new URL('../../site.js', import.meta.url), 'utf8')
  const dom = new JSDOM('<div class="enrollment-layout"><form name="aca-interest-list"></form></div>', {
    url: 'https://aiconfidenceacademy.org/enroll/',
    runScripts: 'outside-only',
  })
  dom.window.eval(script)
  assert.match(dom.window.document.querySelector('.payment-card-featured')?.textContent ?? '', /\$149/)
  assert.doesNotMatch(dom.window.document.querySelector('.payment-card-featured')?.textContent ?? '', /\$129/)
  const forms = [...dom.window.document.querySelectorAll('.payment-options form')]
  assert.deepEqual(forms.map(form => form.action), [
    'https://checkout.aiconfidenceacademy.org/api/enrollment/phase-one/paid-in-full',
    'https://checkout.aiconfidenceacademy.org/api/enrollment/phase-one/installments',
  ])
  for (const form of forms) {
    assert.equal(form.method, 'post')
    assert.equal(form.querySelector('input[type="checkbox"]')?.required, true)
  }
})

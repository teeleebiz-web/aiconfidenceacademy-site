import {answers as supportAnswers, learningGuidance, findGuidance} from '../support-knowledge.js'

const form = document.getElementById('ask-aca-form')
const question = document.getElementById('ask-aca-question')
const results = document.getElementById('ask-aca-results')
const button = form?.querySelector('button[type="submit"]')
const catalog = [...supportAnswers, ...learningGuidance]
const endpoint = 'https://checkout.aiconfidenceacademy.org/api/support/ask'
let busy = false
function show(answers, fallback = false) {
  results.replaceChildren()
  if (fallback) {
    const notice = document.createElement('p')
    notice.textContent = 'AI assistance is unavailable right now. Showing matching ACA guidance.'
    results.append(notice)
  }
  for (const answer of answers) {
    const article = document.createElement('article')
    const heading = document.createElement('h2'); heading.textContent = answer.title
    const text = document.createElement('p'); text.textContent = answer.answer
    const link = document.createElement('a'); link.textContent = 'Read the Academy source →'; link.href = answer.url
    article.append(heading, text, link); results.append(article)
  }
  if (!answers.length) {
    const text = document.createElement('p')
    text.textContent = 'No matching answer was found. Try a more specific question or contact ACA support below.'
    results.append(text)
  }
}
form?.addEventListener('submit', async event => {
  event.preventDefault()
  if (busy || !question.value.trim()) return
  busy = true; button.disabled = true; button.textContent = 'Finding an answer…'
  const value = question.value.trim()
  results.textContent = 'Finding relevant ACA guidance…'
  try {
    const response = await fetch(endpoint, {
      method:'POST', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(15000),
      body:JSON.stringify({question:value,topic:'all',consent:true}),
    })
    if (!response.ok) throw Error('Unavailable')
    const body = await response.json()
    if (!['standard','assisted'].includes(body.mode) || !Array.isArray(body.answers) || body.answers.length > 3) throw Error('Invalid guidance')
    const approved = body.answers.map(item => catalog.find(entry => entry.id === item.id))
    if (approved.some(item => !item)) throw Error('Unknown source')
    show(approved, body.mode !== 'assisted')
  } catch {
    show(findGuidance(value), true)
  } finally {
    busy = false; button.disabled = false; button.textContent = 'Find an answer'
  }
})
button?.removeAttribute('disabled')

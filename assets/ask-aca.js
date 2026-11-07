import {findGuidance} from '../support-knowledge.js'

const form = document.getElementById('ask-aca-form')
const question = document.getElementById('ask-aca-question')
const results = document.getElementById('ask-aca-results')
form?.addEventListener('submit', event => {
  event.preventDefault()
  results.replaceChildren()
  const answers = findGuidance(question.value)
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
})

form?.querySelector('button[type="submit"]')?.removeAttribute('disabled')

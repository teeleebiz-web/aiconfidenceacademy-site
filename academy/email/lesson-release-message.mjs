const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export function lessonReleaseMessage(candidate, { appUrl, learnerFirstName }) {
  const greeting = learnerFirstName ? `Hello ${escapeHtml(learnerFirstName)},` : 'Hello,'
  const lesson = `Lesson ${escapeHtml(candidate.pageId)}: ${escapeHtml(candidate.lessonTitle)}`
  const portalUrl = `${appUrl.replace(/\/$/, '')}/learn/${candidate.phaseNumber === 2 ? '?course=phase-two' : ''}`
  const accessNote = candidate.phaseNumber === 2 && candidate.weekend
    ? 'This Saturday lesson follows your extended weekend window. Check your learning home for its closing time.'
    : 'You have 120 minutes of study time. Pause when you need a break, then resume with your unused minutes.'
  return {
    subject: 'Your next ACA lesson is ready',
    html: `<div style="font-family:Arial,sans-serif;color:#173d62;line-height:1.6">
      <p>${greeting}</p>
      <p>Your next AI Confidence Academy lesson is now available:</p>
      <p><strong>${lesson}</strong></p>
      <p>Open your learner portal when you are ready to begin. ${accessNote} Your released workbook pages and saved answers remain available afterward.</p>
      <p>Your released workbook pages remain available for your continued study.</p>
      <p><a href="${escapeHtml(portalUrl)}" style="background:#173d62;color:#fff;padding:12px 18px;text-decoration:none">Open Your Learner Portal</a></p>
      <p>AI Confidence Academy<br>People come first. AI is the tool. Confidence is the product.</p>
    </div>`,
  }
}

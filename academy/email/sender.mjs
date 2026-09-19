const emailAddressPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function formatAcademyEmailFrom(value) {
  const address = String(value || '').match(emailAddressPattern)?.[0]
  return address ? `AI Confidence Academy <${address.toLowerCase()}>` : null
}

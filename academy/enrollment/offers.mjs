// Prices and course selection are server controlled; request bodies never choose them.
export function enrollmentOffer(config = {}) {
  const phaseTwo = config.phaseNumber === 2
  return {
    phaseNumber: phaseTwo ? 2 : 1,
    label: phaseTwo ? 'Phase Two' : 'Phase One',
    planPrefix: phaseTwo ? 'phase_two' : 'phase_one',
    paidInFullAmount: phaseTwo ? 17900 : 12900,
    totalAmount: phaseTwo ? 19900 : 14900,
    amounts: phaseTwo ? [6700, 6600, 6600] : [5000, 5000, 4900],
    paidInFullPriceId: phaseTwo ? config.phaseTwoPaidInFullPriceId : config.phaseOneFoundingPriceId || config.phaseOnePriceId,
    priceIds: phaseTwo ? [config.installment67PriceId, config.installment66PriceId, config.installment66PriceId] : [config.installment50PriceId, config.installment50PriceId, config.installment49PriceId],
    portalPath: phaseTwo ? '/learn/?course=phase-two' : '/learn/',
  }
}
export function phaseTwoConfig(config) {
  return { ...config, phaseNumber: 2, courseId: config?.phaseTwoCourseId }
}
export function installmentAmounts(plan) {
  if (plan.total_amount === 19900) return [6700, 6600, 6600]
  if (plan.total_amount == null || plan.total_amount === 14900) return [5000, 5000, 4900]
  throw new Error('Unknown installment purchase total')
}
export async function checkEnrollmentOpen(config) {
  const offer = enrollmentOffer(config)
  if (offer.phaseNumber !== 2) return true // Preserve the established Phase One checkout.
  if (!config.courseId || !config.db) return false
  const {data, error} = await config.db.from('courses').select('id,status,enrollment_opens_at,enrollment_closes_at').eq('id', config.courseId).single()
  if (error) throw error
  const now = Date.now()
  if (!config.phaseTwoCohortId) return false
  const cohortResult = await config.db.from('aca_phase_two_cohorts').select('id,status,course_id,starts_monday,iana_timezone,release_local_time').eq('id', config.phaseTwoCohortId).eq('course_id', config.courseId).single()
  if (cohortResult.error) throw cohortResult.error
  if (cohortResult.data?.status !== 'active') return false
  return data?.status === 'published' && (!data.enrollment_opens_at || Date.parse(data.enrollment_opens_at) <= now) && (!data.enrollment_closes_at || Date.parse(data.enrollment_closes_at) > now)
}

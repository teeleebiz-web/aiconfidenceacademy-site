import { publicPhaseTwoMedia, privateMediaAccess } from './PhaseTwoPrivateMedia'
import catalog from '../../../academy/phase-two-introductions.json'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('keeps the existing site text unchanged until the coordinated private cutover', async () => {
  vi.stubEnv('VITE_ACA_PRIVATE_PHASE_TWO_MEDIA', 'false'); vi.resetModules()
  const { lessonIntroduction } = await import('./phaseTwoIntroductionAccess')
  expect(lessonIntroduction(publicPhaseTwoMedia, '1.2', 'original')).toBe(catalog.original['1.2'])
  expect(lessonIntroduction(publicPhaseTwoMedia, '1.1', 'revised')).toBe(catalog.revised['1.1'])
})
it('uses only the authorized lesson response in private mode, with no public text fallback', async () => {
  const { lessonIntroduction } = await import('./phaseTwoIntroductionAccess')
  const access = privateMediaAccess({ files: {}, expiresAt: '2030-01-01T00:00:00Z', introductions: { revised: 'Authorized fixture text' } })
  expect(lessonIntroduction(access, '1.1', 'revised')).toBe('Authorized fixture text')
  expect(lessonIntroduction(access, '1.1', 'original')).toBe('')
  expect(lessonIntroduction(privateMediaAccess({ files: {}, expiresAt: '2030-01-01T00:00:00Z' }), '1.2', 'original')).toBe('')
})
it('disables the legacy catalog in a protected build even if a public access object is passed', async () => {
  vi.stubEnv('VITE_ACA_PRIVATE_PHASE_TWO_MEDIA', 'true'); vi.resetModules()
  const { lessonIntroduction } = await import('./phaseTwoIntroductionAccess')
  expect(lessonIntroduction(publicPhaseTwoMedia, '1.2', 'original')).toBe('')
})

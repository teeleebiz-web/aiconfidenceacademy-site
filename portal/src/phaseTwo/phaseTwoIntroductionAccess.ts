import catalog from '../../../academy/phase-two-introductions.json'
import type { PhaseTwoMediaAccess } from './PhaseTwoPrivateMedia'

// Preserve the existing site until cutover. Vite removes this catalog completely
// from the protected build; its public-output guard independently checks that.
const legacy = import.meta.env.VITE_ACA_PRIVATE_PHASE_TWO_MEDIA === 'true' ? null : catalog

export function lessonIntroduction(access: PhaseTwoMediaAccess, pageId: string, kind: 'original' | 'revised'): string {
  if (access.private) return access.introductions?.[kind] ?? ''
  return (legacy?.[kind] as Record<string, string> | undefined)?.[pageId] ?? ''
}

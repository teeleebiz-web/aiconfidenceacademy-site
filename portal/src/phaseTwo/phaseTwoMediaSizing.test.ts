import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('./phaseTwoLessonExperience.css', import.meta.url), 'utf8')

describe('ACA instructor video presentation contract', () => {
  it('preserves the established maximum 640-pixel instructor size and widescreen ratio', () => {
    expect(styles).toMatch(/\.p2-lesson-avatar video\s*\{[^}]*max-width:\s*640px;/)
    expect(styles).toMatch(/\.p2-lesson-avatar video\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/)
    expect(styles).toMatch(/\.p2-lesson-avatar video\s*\{[^}]*height:\s*auto;/)
    expect(styles).toMatch(/\.p2-lesson-avatar video\s*\{[^}]*width:\s*100%/)
  })
  it('retains a responsive compact layout for narrow phones', () => {
    expect(styles).toMatch(/@media\s*\(max-width:430px\)/)
    expect(styles).toMatch(/\.p2-lesson-avatar h2/)
  })
})

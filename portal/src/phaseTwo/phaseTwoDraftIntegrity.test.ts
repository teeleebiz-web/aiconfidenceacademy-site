import { inspectPhaseTwoDraft, type DraftIntegrityJourney, type DraftIntegrityLesson } from './phaseTwoDraftIntegrity'

const journeys: DraftIntegrityJourney[] = Array.from({length:6}, (_,index) => ({
  id: 'j-'+(index+1),
  journey_number:index+1,
  title:'Approved Journey '+(index+1),
  status:'draft',
}))
const lessons: DraftIntegrityLesson[] = Array.from({length:36}, (_,index) => {
  const j = Math.floor(index/6)+1
  const l = index%6+1
  return {
    id:'l-'+(index+1),
    journey_id:'j-'+j,
    page_id:j+'.'+l,
    course_position:index+1,
    journey_position:l,
    title:'Approved lesson '+j+'.'+l,
    status:'draft',
    content: {
      planned_media: l <= 3 ? 'video':'audio',
      phase_two: {
        source_version:'2.0',
        teaching:'Teaching brief.',
        worked_case:'Verified case.',
        apply_to_project:'Project task.',
        ai_request:'AI request.',
        verify_and_save:'Evidence requirement.',
        applied_completion_check:'Applied check.',
        ...(l===1 ? {
          journey:{
            prerequisite:'Prior approved evidence.',
            journey_result:'Clear journey output.',
            independent_application:'Two hours for revision.',
            evidence_review:'Confirm meaningful corrections.',
          },
        }: {}),
      },
    },
  }
})

const copy = () => ({
  journeys: structuredClone(journeys),
  lessons: structuredClone(lessons),
})

describe('Phase Two source integrity', () => {
  it('accepts a complete unpublished six-journey v2.0 draft', () => {
    const result=inspectPhaseTwoDraft(journeys,lessons)
    expect(result.ready).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('rejects an omitted lesson, missing teaching field, or mixed media allocation', () => {
    const missing=copy()
    missing.lessons=missing.lessons.filter(x=>x.page_id!=='3.5')
    expect(inspectPhaseTwoDraft(missing.journeys,missing.lessons).issues.some(x=>/Lesson 3.5 is missing/.test(x))).toBe(true)

    const blank=copy()
    blank.lessons[0].content.phase_two!.ai_request=''
    expect(inspectPhaseTwoDraft(blank.journeys,blank.lessons).issues).toContain('Lesson 1.1 lacks ai_request.')

    const imbalance=copy()
    imbalance.lessons[0].content.planned_media='audio'
    expect(inspectPhaseTwoDraft(imbalance.journeys,imbalance.lessons).issues.some(x=>/three video and three audio/.test(x))).toBe(true)
  })

  it('blocks invalid sequencing, duplicated identities and a non-draft lesson', () => {
    const broken=copy()
    broken.lessons[2].page_id='1.2'
    broken.lessons[3].course_position=3
    broken.lessons[4].status='published'
    const errors=inspectPhaseTwoDraft(broken.journeys,broken.lessons).issues
    expect(errors.some(x=>/Duplicate lesson page IDs/.test(x))).toBe(true)
    expect(errors.some(x=>/incorrect position/.test(x))).toBe(true)
    expect(errors.some(x=>/not a titled unpublished draft/.test(x))).toBe(true)
  })

  it('rejects an incorrect curriculum source version', () => {
    const changed=copy()
    changed.lessons[8].content.phase_two!.source_version='1.0'
    expect(inspectPhaseTwoDraft(changed.journeys,changed.lessons).issues).toContain('Lesson 2.3 has an inconsistent curriculum version.')
  })
})

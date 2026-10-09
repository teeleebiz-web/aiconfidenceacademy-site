/**
 * Phase Two draft completeness contract — version 2.0.
 *
 * Read-only checks used before showing the owner the curriculum as a complete
 * six-journey, 36-lesson build. These checks cannot publish or modify records.
 */
export type DraftIntegrityJourney = {
  id: string
  journey_number: number
  status: string
  title: string
}
export type DraftIntegrityLesson = {
  id: string
  journey_id: string
  page_id: string
  course_position: number
  journey_position: number
  status: string
  title: string
  content: {
    planned_media?: 'video' | 'audio'
    phase_two?: {
      source_version?: string
      journey?: {
        journey_result: string
        prerequisite: string
        independent_application: string
        evidence_review: string
      }
      teaching: string
      worked_case: string
      apply_to_project: string
      ai_request: string
      verify_and_save: string
      applied_completion_check: string
    }
  }
}

const REQUIRED_FIELDS = [
  'teaching', 'worked_case', 'apply_to_project',
  'ai_request', 'verify_and_save', 'applied_completion_check',
] as const

export function inspectPhaseTwoDraft(
  journeys: DraftIntegrityJourney[],
  lessons: DraftIntegrityLesson[],
): { ready: boolean; issues: string[] } {
  const issues: string[] = []
  const orderedJourneys = [...journeys].sort((a,b) => a.journey_number - b.journey_number)
  const orderedLessons = [...lessons].sort((a,b) => a.course_position - b.course_position)
  if (journeys.length !== 6) issues.push('Expected six journeys.')
  if (lessons.length !== 36) issues.push('Expected 36 lessons.')
  if (new Set(journeys.map(j => j.id)).size !== journeys.length) issues.push('Duplicate journey identifiers.')
  if (new Set(lessons.map(l => l.id)).size !== lessons.length) issues.push('Duplicate lesson identifiers.')
  if (new Set(lessons.map(l => l.page_id)).size !== lessons.length) issues.push('Duplicate lesson page IDs.')

  for (let journeyNumber = 1; journeyNumber <= 6; journeyNumber++) {
    const journey = orderedJourneys.find(j => j.journey_number === journeyNumber)
    if (!journey || !journey.title.trim() || journey.status !== 'draft') {
      issues.push('Journey ' + journeyNumber + ' is missing or not an unpublished draft.')
      continue
    }
    const members = orderedLessons.filter(l => l.journey_id === journey.id)
    if (members.length !== 6) issues.push('Journey ' + journeyNumber + ' must contain six lessons.')
    let videoCount = 0
    let audioCount = 0
    for (let lessonNumber = 1; lessonNumber <= 6; lessonNumber++) {
      const pageId = journeyNumber + '.' + lessonNumber
      const lesson = members.find(l => l.page_id === pageId)
      if (!lesson) {
        issues.push('Lesson ' + pageId + ' is missing.')
        continue
      }
      if (lesson.journey_position !== lessonNumber || lesson.course_position !== (journeyNumber - 1) * 6 + lessonNumber) {
        issues.push('Lesson ' + pageId + ' has an incorrect position.')
      }
      if (lesson.status !== 'draft' || !lesson.title.trim()) issues.push('Lesson ' + pageId + ' is not a titled unpublished draft.')
      if (lesson.content.planned_media === 'video') videoCount++
      else if (lesson.content.planned_media === 'audio') audioCount++
      else issues.push('Lesson ' + pageId + ' has no designated primary media placeholder.')

      const source = lesson.content.phase_two
      if (!source) {
        issues.push('Lesson ' + pageId + ' has no approved teaching source.')
      } else {
        if (source.source_version && source.source_version !== '2.0') {
          issues.push('Lesson ' + pageId + ' has an inconsistent curriculum version.')
        }
        for (const field of REQUIRED_FIELDS) {
          if (!source[field] || !source[field].trim()) {
            issues.push('Lesson ' + pageId + ' lacks ' + field + '.')
          }
        }
        if (lessonNumber === 1 && (!source.journey ||
          !source.journey.journey_result?.trim() ||
          !source.journey.independent_application?.trim())) {
          issues.push('Journey ' + journeyNumber + ' has no complete journey result or independent application.')
        }
      }
    }
    if (videoCount !== 3 || audioCount !== 3) {
      issues.push('Journey ' + journeyNumber + ' must have three video and three audio lesson placeholders.')
    }
  }
  if (orderedJourneys.some((j,i) => j.journey_number !== i+1)) {
    issues.push('Journey numbers are missing, repeated or out of range.')
  }
  if (orderedLessons.some((l,i) => l.course_position !== i+1)) {
    issues.push('The 36 lesson positions are incomplete or repeated.')
  }
  return { ready: issues.length === 0, issues }
}

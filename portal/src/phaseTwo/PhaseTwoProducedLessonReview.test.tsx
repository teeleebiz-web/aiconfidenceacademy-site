import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  PhaseTwoProducedLessonReview,
  validProducedLesson,
  type PhaseTwoProducedLesson,
} from './PhaseTwoProducedLessonReview'

const draft: PhaseTwoProducedLesson = {
  production_version: 'synthetic-review-01',
  approval_status: 'founder_review_not_published',
  curriculum_version: '2.0',
  lesson_id: '1.1',
  primary_media: 'audio',
  title: 'Synthetic professional judgment lesson',
  learner_promise: 'Demonstrate one human responsibility with evidence.',
  pacing: [
    { key: 'teaching', label: 'Teaching', minutes: 15 },
    { key: 'worked_case', label: 'Case', minutes: 10 },
    { key: 'application', label: 'Application', minutes: 25 },
    { key: 'verification', label: 'Verification', minutes: 10 },
  ],
  outcomes: [
    'Distinguish activity from capability.',
    'Name a professional business setting.',
    'Identify human responsibility.',
    'Verify an important report claim.',
  ],
  teaching: [
    { heading: 'Purpose', paragraphs: ['People define the result.'], think_prompt: 'Whom does this work serve?' },
    { heading: 'Context', paragraphs: ['Records inform decisions.'], think_prompt: 'What facts are approved?' },
    { heading: 'Judgment', paragraphs: ['Check before acting.'], think_prompt: 'Who approves?' },
  ],
  worked_case: {
    label: 'Fictional case',
    setup: 'A polished report contains an unsupported claim.',
    evidence_table: [
      { claim: 'Claim one', evidence: 'Source one', action: 'Review one' },
      { claim: 'Claim two', evidence: 'Source two', action: 'Review two' },
      { claim: 'Claim three', evidence: 'No supporting source', action: 'Withhold pending review' },
    ],
    revised_example: 'The source establishes some results but not the unsupported number.',
    demonstration_steps: ['Trace the claim.', 'Review the source.', 'Name the reviewer.'],
    question: 'What could mislead an audience?',
  },
  application: [
    { minutes: 5, heading: 'Select a business setting', instruction: 'Name a useful problem.', evidence: 'Setting notes' },
    { minutes: 6, heading: 'List capabilities', instruction: 'Provide work samples.', evidence: 'Capability notes' },
    { minutes: 3, heading: 'List gaps', instruction: 'Identify uncertainty.', evidence: 'Gap notes' },
    { minutes: 7, heading: 'Map responsibility', instruction: 'Name a reviewer.', evidence: 'Human roles' },
    { minutes: 4, heading: 'Challenge assumptions', instruction: 'Review AI output.', evidence: 'Decision note' },
  ],
  approved_ai_request: 'Only use approved sanitized notes. Do not invent results.',
  responsibility_map_fields: ['Purpose', 'Approved facts', 'AI support', 'Human reviewer'],
  verification: [
    { minutes: 3, heading: 'Trace a claim', prompt: 'Which source supports it?' },
    { minutes: 3, heading: 'Name the owner', prompt: 'Who makes the decision?' },
    { minutes: 2, heading: 'Reject unsupported output', prompt: 'What must change?' },
    { minutes: 2, heading: 'Save evidence', prompt: 'What will you retain?' },
  ],
  completion_criteria: [
    'Capability evidence is visible.',
    'Human accountability is named.',
    'Unsupported claims are rejected.',
    'One meaningful correction is retained.',
  ],
  handoff: 'Use the reviewed record to investigate a need in the next lesson.',
  editorial_notes: {
    status: 'Draft only, subject to founder review.',
    media: 'No recorded audio is present.',
    source: 'Approved master preserved as a separate teaching brief.',
    example_data: 'Illustrative case, not a real report.',
  },
}

describe('protected Phase Two lesson production', () => {
  it('rejects incomplete, mismatched or implicitly approved content', () => {
    expect(validProducedLesson(draft, '1.1')).toBe(true)
    expect(validProducedLesson(draft, '1.2')).toBe(false)
    expect(validProducedLesson({ ...draft, approval_status: 'published' }, '1.1')).toBe(false)
    expect(validProducedLesson({ ...draft, pacing: draft.pacing.slice(1) }, '1.1')).toBe(false)
    expect(validProducedLesson({ ...draft, application: draft.application.slice(1) }, '1.1')).toBe(false)
    expect(validProducedLesson({ ...draft, worked_case: undefined }, '1.1')).toBe(false)
  })

  it('shows real learning stages, evidence, and completion criteria without credit or submission', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoProducedLessonReview production={draft} />)
    expect(screen.getByRole('heading', { name: 'What you will be able to demonstrate' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Develop professional judgment' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Fictional case' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Develop your continuing project' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Show the evidence behind your judgment' })).toBeTruthy()
    expect(screen.getByText('No supporting source')).toBeTruthy()
    expect(screen.getByText('Only use approved sanitized notes. Do not invent results.')).toBeTruthy()
    expect(screen.getByText(/not automatic completion credit/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /submit|complete lesson/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Hide evidence review' }))
    expect(screen.queryByText('No supporting source')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show evidence review' }))
    expect(screen.getByText('No supporting source')).toBeTruthy()
  })

  it('integrates a visual practice demonstration into the real learner-facing lesson', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoProducedLessonReview production={draft} learnerMode />)
    expect(screen.getByRole('heading', { name: 'From a confident answer to a checked answer' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Start with the approved record' })).toBeTruthy()
    expect(screen.getByLabelText('Lesson teaching and practice')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Next step/i }))
    expect(screen.getByRole('heading', { name: 'Spot the unsupported claim' })).toBeTruthy()
    expect(screen.queryByText(/Production status:|Media status:|founder review/i)).toBeNull()
  })
})

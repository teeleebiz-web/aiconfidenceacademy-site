import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoNeedPractice, restoreNeedDraft, needRecordText } from './PhaseTwoNeedPractice'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({
  loadPhaseTwoProject: api.load,
  savePhaseTwoProjectUpdate: api.save,
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue(null)
  api.save.mockResolvedValue({ saved_version: 3, saved_at: '2026-10-10T01:00:00Z' })
})

describe('Lesson 1.2 practical evidence investigation', () => {
  it('keeps founder review interactive but never claims it saved learner data', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoNeedPractice />)
    expect(screen.getByRole('heading', { name: /Investigate a need in your continuing project/ })).toBeTruthy()
    expect(screen.getByText(/Founder preview: work locally and copy your draft/)).toBeTruthy()
    expect(screen.getAllByText(/Possible need [123]/).length).toBe(3)
    await user.click(screen.getByRole('button', { name: /Verify and save/ }))
    expect(screen.getByText(/No verified active Project Record is connected/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save in My Project Record' })).toBeNull()
    expect(api.save).not.toHaveBeenCalled()
  })

  it('requires a privacy check before sending notes to an independent AI tool', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoNeedPractice />)
    await user.click(screen.getByRole('button', { name: /Investigate with AI/ }))
    const button = screen.getByRole('button', { name: /Copy AI request/i })
    expect(button).toHaveProperty('disabled', true)
    await user.type(screen.getByRole('textbox', { name: 'Only sanitized notes to share' }), 'Public example: repeated support questions.')
    expect(button).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('checkbox', { name: /removed private, confidential and unauthorized details/ }))
    expect(button).toHaveProperty('disabled', false)
    expect(screen.getByRole('textbox', {name:/AI request \(selectable text\)/})).toHaveProperty('value',
      expect.stringContaining('Do not invent interviews, counts, customer demand'))
  })

  it('loads Lesson 1.1 context and saves only the nested Lesson 1.2 extension', async () => {
    const user = userEvent.setup()
    api.load.mockResolvedValue({
      project_path: 'B', project_title: 'New digital offer', version_number: 2,
      sections: {
        professional_ai_operating_model: { personServed: 'Customers', humanPurpose: 'Help people', evidence: ['Approved sample'] },
      },
    })
    render(<PhaseTwoNeedPractice enrollmentId="only-enrollment-1" />)
    expect(await screen.findByText(/Continuing: New digital offer · Path B/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Verify and save/ }))
    await user.click(screen.getByRole('button', { name: 'Save in My Project Record' }))
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    const call = api.save.mock.calls[0][0]
    expect(call.enrollmentId).toBe('only-enrollment-1')
    expect(call.path).toBe('B')
    expect(call.title).toBe('New digital offer')
    expect(Object.keys(call.patch)).toEqual(['professional_ai_operating_model'])
    expect(Object.keys(call.patch.professional_ai_operating_model)).toEqual(['need_validation_l12'])
    expect(call.patch.professional_ai_operating_model.need_validation_l12.candidates).toHaveLength(3)
    expect(screen.getByText(/Saved version 3 to the SAME Project Record/)).toBeTruthy()
  })

  it('restores three candidates and five questions but rejects invalid selection or evidence', () => {
    const restored = restoreNeedDraft({
      chosen: 7,
      candidates: [{ person: 'Staff', symptom: 'Reported repeated questions', evidenceType: 'invented' }],
      neutralQuestions: ['What do you do first?'],
    })
    expect(restored.candidates).toHaveLength(3)
    expect(restored.candidates[0].evidenceType).toBe('not_established')
    expect(restored.chosen).toBeNull()
    expect(restored.neutralQuestions).toHaveLength(5)
    expect(needRecordText(restored,'Example')).toContain('Need (no technology prescribed):')
  })
})

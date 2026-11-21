import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoProjectWorkspace } from './PhaseTwoProjectWorkspace'

const api = vi.hoisted(() => ({
  record: vi.fn(),
  revisions: vi.fn(),
  save: vi.fn(),
}))

vi.mock('./phaseTwoProject', () => ({
  PHASE_TWO_EVIDENCE_SECTIONS: [
    { key: 'professional_ai_operating_model', label: 'Professional AI Operating Model', lessons: '1.1, 1.6' },
    { key: 'workflow_design_artifact', label: 'Workflow Design Artifact', lessons: '2.1, 5.4' },
  ],
  loadPhaseTwoProject: api.record,
  loadPhaseTwoRevisionHistory: api.revisions,
  savePhaseTwoProjectUpdate: api.save,
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.record.mockResolvedValue(null)
  api.revisions.mockResolvedValue([])
  api.save.mockResolvedValue({ saved_version: 1, saved_at: new Date().toISOString() })
})

describe('Phase Two continuing project workspace (staged)', () => {
  it('starts with no invented project path or project title', async () => {
    render(<PhaseTwoProjectWorkspace enrollmentId="phase-two-enrollment" />)
    await screen.findByRole('heading', { name: 'My Project Record' })
    expect(await screen.findByLabelText('Your project path')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Project name')).toHaveProperty('value', '')
    expect(screen.getByRole('button', { name: 'Save project' })).toHaveProperty('disabled', true)
    expect(api.save).not.toHaveBeenCalled()
  })

  it('saves one project section and keeps version history', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoProjectWorkspace enrollmentId="phase-two-enrollment" />)
    await screen.findByLabelText('Your project path')
    await user.selectOptions(screen.getByLabelText('Your project path'), 'A')
    await user.type(screen.getByLabelText('Project name'), 'Better intake workflow')
    await user.type(screen.getByLabelText('Work, decisions and verified evidence'), 'Reviewer checks every important claim.')
    await user.type(screen.getByLabelText('Decision note (optional)'), 'Revised after source review.')
    await user.click(screen.getByRole('button', { name: 'Save project' }))
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({
      enrollmentId: 'phase-two-enrollment',
      path: 'A',
      title: 'Better intake workflow',
      patch: { professional_ai_operating_model: { text: 'Reviewer checks every important claim.' } },
      decisionNote: 'Revised after source review.',
    }))
    expect(await screen.findByText(/Project draft saved securely/i)).toBeTruthy()
    expect(screen.getByText('Version 1')).toBeTruthy()
    expect(screen.getByText(/Saving a draft does not award lesson completion/i)).toBeTruthy()
  })

  it('does not invent completion or erase unsaved text after an error', async () => {
    api.save.mockRejectedValueOnce(new Error('temporarily unavailable'))
    const user = userEvent.setup()
    render(<PhaseTwoProjectWorkspace enrollmentId="phase-two-enrollment" />)
    await screen.findByLabelText('Your project path')
    await user.selectOptions(screen.getByLabelText('Your project path'), 'B')
    await user.type(screen.getByLabelText('Project name'), 'Service test')
    await user.type(screen.getByLabelText('Work, decisions and verified evidence'), 'Original draft is retained.')
    await user.click(screen.getByRole('button', { name: 'Save project' }))
    expect(await screen.findByText(/Autosave could not complete/i)).toBeTruthy()
    expect(screen.getByLabelText('Work, decisions and verified evidence')).toHaveProperty('value', 'Original draft is retained.')
    expect(screen.queryByText('Version 1')).toBeNull()
  })
})

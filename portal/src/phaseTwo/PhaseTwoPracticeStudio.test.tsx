import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoPracticeStudio } from './PhaseTwoPracticeStudio'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({
  loadPhaseTwoProject: api.load,
  savePhaseTwoProjectUpdate: api.save,
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue(null)
  api.save.mockResolvedValue({ saved_version: 1, saved_at: '2026-10-09T20:00:00Z' })
})

describe('Phase Two tool-independent applied practice', () => {
  it('accepts a learner-selected AI tool without requiring any particular vendor', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoPracticeStudio approvedAiRequest="Use only my notes: [sanitized notes]" />)
    expect(screen.getByRole('heading', { name: 'Your first professional AI responsibility map' })).toBeTruthy()
    const tool = screen.getByRole('textbox', { name: /Which AI tool will you use/i })
    await user.type(tool, 'My company assistant')
    expect(tool).toHaveProperty('value', 'My company assistant')
    expect(screen.queryByText(/practice with ChatGPT|Paste into ChatGPT/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Check and keep/i }))
    expect(screen.getByRole('heading', { name: 'Practice with your chosen AI tool' })).toBeTruthy()
    expect(screen.getByText(/If your tool has different controls, follow its input method/i)).toBeTruthy()
    expect(screen.getByText(/AI tool chosen \(optional\): My company assistant/)).toBeTruthy()
  })

  it('does not force choosing an AI provider or create any project record in review mode', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoPracticeStudio approvedAiRequest="Use only my notes: [sanitized notes]" />)
    expect(screen.getByRole('textbox', { name: /Which AI tool will you use/i })).toHaveProperty('value', '')
    await user.click(screen.getByRole('button', { name: /Check and keep/i }))
    expect(screen.getByText(/AI tool chosen \(optional\): To be selected by the learner/)).toBeTruthy()
    expect(api.save).not.toHaveBeenCalled()
  })

  it('restores a previously chosen AI tool from the learner Project Record', async () => {
    api.load.mockResolvedValue({
      project_path: 'A',
      project_title: 'A clear service response',
      version_number: 2,
      sections: { professional_ai_operating_model: {
        aiTool: 'Approved internal AI assistant',
        personServed: 'Customers',
      } },
    })
    render(<PhaseTwoPracticeStudio
      approvedAiRequest="Use only my notes: [sanitized notes]"
      enrollmentId="enrollment-a"
    />)
    const field=await screen.findByRole('textbox', { name: /Which AI tool will you use/i })
    expect(field).toHaveProperty('value', 'Approved internal AI assistant')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JourneyIntroductionView } from './JourneyIntroductionView'
import type { JourneyIntroduction } from '../types'

const introduction: JourneyIntroduction = {
  id: 'intro-4',
  journey_id: 'journey-4',
  media_kind: 'video',
  media_path: null,
  caption_path: null,
  duration_seconds: 310,
  status: 'draft',
  source_version: 'synthetic-test-v1',
  content: {
    eyebrow: 'Begin Journey 4',
    title: 'A Synthetic Journey Welcome',
    lead: 'This fixture verifies the learner experience without embedding protected curriculum.',
    outcomes: ['Know how the journey will work.'],
    roadmap: [{
      page_id: '4.1',
      title: 'A Synthetic First Lesson',
      purpose: 'Test the roadmap display.',
    }],
    transcript: [{
      timecode: '00:00–00:10',
      text: 'This synthetic transcript verifies that a no-media welcome remains accessible.',
    }],
    closing: 'Continue when ready.',
  },
}

describe('JourneyIntroductionView', () => {
  it('remains complete and actionable when media has not been attached', async () => {
    const user = userEvent.setup()
    let continued = false

    render(
      <JourneyIntroductionView
        introduction={introduction}
        mediaUrl={null}
        captionUrl={null}
        onBack={() => undefined}
        onContinue={() => { continued = true }}
      />,
    )

    expect(screen.queryByRole('video')).toBeNull()
    expect(screen.getByText('A Synthetic Journey Welcome')).toBeTruthy()
    expect(screen.getByText('A Synthetic First Lesson')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /journey 4/i })).toBeTruthy()
    expect(screen.getAllByText(/production placeholder/i)).toHaveLength(2)

    await user.click(screen.getByText(/founder\/avatar welcome transcript/i))
    expect(screen.getByText(/no-media welcome remains accessible/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /continue to lesson 4.1/i }))
    expect(continued).toBe(true)
  })
})

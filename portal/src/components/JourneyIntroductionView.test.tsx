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
    expect(screen.getByRole('heading', { name: 'Lessons in Journey 4' })).toBeTruthy()
    expect(screen.getByText('Video coming soon')).toBeTruthy()
    expect(screen.getByText('Audio coming soon')).toBeTruthy()

    await user.click(screen.getByText('Video transcript'))
    expect(screen.getByText(/no-media welcome remains accessible/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /continue to lesson 4.1/i }))
    expect(continued).toBe(true)
  })
})


it('shows one approved video and keeps workbook access below the roadmap',()=>{
  const current={...introduction,status:'published' as const,content:{...introduction.content,presentation:'single_video' as const,roadmap:[{page_id:'3.1',title:'First lesson',purpose:'Practice'}]}}
  const {container}=render(<JourneyIntroductionView introduction={current} mediaUrl="/approved-video.mp4" captionUrl={null} workbookHref="/academy/phase-one/?workbook=journey-three&lesson=3.1" onBack={()=>undefined} onContinue={()=>undefined} />)
  expect(container.querySelectorAll('video')).toHaveLength(1)
  expect(container.querySelector('video source')?.getAttribute('src')).toBe('/approved-video.mp4')
  expect(screen.queryByText('Audio coming soon')).toBeNull()
  expect(screen.queryByText('Video coming soon')).toBeNull()
  const link=screen.getByRole('link',{name:'Open Workbook'})
  expect(link.getAttribute('target')).toBe('_blank')
  expect(container.querySelector('.roadmap-list')!.compareDocumentPosition(link)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

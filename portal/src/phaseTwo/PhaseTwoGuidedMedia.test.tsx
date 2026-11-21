import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoGuidedAudio, PhaseTwoDemoClips, type GuidedInstructionMedia, type VisualDemoClip } from './PhaseTwoGuidedMedia'

const media: GuidedInstructionMedia = {
  url: 'https://aiconfidenceacademy.org/assets/videos/phase-two-lesson-1-1/guided.m4a',
  duration_seconds: 600,
  approvalStatus: 'founder_approved',
  voice_id: 'ac277b338cf64d8b9686784c43c563da',
  chapters: [
    { title:'Work you can stand behind', start_seconds:0, transcript:'State the purpose and source.' },
    { title:'Capability needs evidence', start_seconds:140, transcript:'Evidence supports the ability.' },
    { title:'Human responsibilities', start_seconds:300, transcript:'Name the decision owner.' },
    { title:'Check before acting', start_seconds:460, transcript:'Withhold unsupported claims.' },
  ],
}

const clips: VisualDemoClip[] = [
  { key:'01-source', title:'Start with the source', url:'https://aiconfidenceacademy.org/source.mp4',
    captions_url:'https://aiconfidenceacademy.org/source.vtt', transcript:'Read approved notes first.',
    duration_seconds:22, fictional_training_example:true },
  { key:'02-draft', title:'Read the AI draft', url:'https://aiconfidenceacademy.org/draft.mp4',
    captions_url:'https://aiconfidenceacademy.org/draft.vtt', transcript:'The percentage has no source.',
    duration_seconds:23, fictional_training_example:true },
  { key:'03-review', title:'Trace and challenge', url:'https://aiconfidenceacademy.org/review.mp4',
    captions_url:'https://aiconfidenceacademy.org/review.vtt', transcript:'Check the record.',
    duration_seconds:23, fictional_training_example:true },
  { key:'04-correct', title:'Correct and save', url:'https://aiconfidenceacademy.org/correct.mp4',
    captions_url:'https://aiconfidenceacademy.org/correct.vtt', transcript:'Save the correction.',
    duration_seconds:24, fictional_training_example:true },
]

describe('ACA Phase Two guided instruction media', () => {
  it('opens the authentic-voice instruction with a transcript and audio chapters', async () => {
    const user=userEvent.setup()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    render(<PhaseTwoGuidedAudio lessonId="1.1" media={media} />)
    const player=screen.getByLabelText('Lesson 1.1 guided instruction audio') as HTMLAudioElement
    expect(player.tagName.toLowerCase()).toBe('audio')
    expect(player.controls).toBe(true)
    expect(player.getAttribute('preload')).toBe('auto')
    expect(screen.getByRole('heading',{name:'Guided instruction'})).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Capability needs evidence/}))
    expect(player.currentTime).toBe(140)
    expect(screen.getByRole('button',{name:/Capability needs evidence/}).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByText('Read the guided instruction transcript'))
    expect(screen.getByText('Evidence supports the ability.')).toBeTruthy()
  })

  it('lets learners choose each video independently with matching caption track', async () => {
    const user=userEvent.setup()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const play=vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    render(<PhaseTwoDemoClips clips={clips} />)
    expect(screen.getByRole('heading',{name:'A report you can examine, step by step'})).toBeTruthy()
    const first=screen.getByLabelText('Start with the source screen demonstration') as HTMLVideoElement
    expect(first.getAttribute('src')).toBe('https://aiconfidenceacademy.org/source.mp4')
    await user.click(screen.getByRole('button',{name:/Read the AI draft/}))
    const second=screen.getByLabelText('Read the AI draft screen demonstration') as HTMLVideoElement
    expect(second.getAttribute('src')).toBe('https://aiconfidenceacademy.org/draft.mp4')
    expect(play).toHaveBeenCalled()
    const track=second.querySelector('track')
    expect(track?.getAttribute('src')).toBe('https://aiconfidenceacademy.org/draft.vtt')
    await user.click(screen.getByText('Read this demonstration'))
    expect(screen.getByText('The percentage has no source.')).toBeTruthy()
    expect(screen.getByText(/fictional training data/)).toBeTruthy()
  })

  it('keeps the illustrated screen videos separate from the instructor avatar', () => {
    render(<PhaseTwoDemoClips clips={clips} />)
    expect(screen.queryByText(/rendering avatar|presenter generating/i)).toBeNull()
    expect(screen.getByText(/fictional training data/)).toBeTruthy()
  })
})

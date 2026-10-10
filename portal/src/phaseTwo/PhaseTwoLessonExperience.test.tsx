import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoLessonExperience } from './PhaseTwoLessonExperience'

const api = vi.hoisted(() => ({ validate: vi.fn() }))
vi.mock('./PhaseTwoProducedLessonReview', () => ({
  validProducedLesson: api.validate,
  PhaseTwoProducedLessonReview: ({ learnerMode }: { learnerMode?: boolean }) =>
    <section aria-label="Expanded learner instruction">{learnerMode ? 'Lesson teaching and practice' : 'Administrative presentation'}</section>,
}))

const lessonProduction = {
  lesson_id: '1.1',
  pacing: [
    { key: 'teaching', label: 'Teaching', minutes: 15 },
    { key: 'worked_case', label: 'Worked case', minutes: 10 },
    { key: 'application', label: 'Application', minutes: 25 },
    { key: 'verification', label: 'Verification', minutes: 10 },
  ],
} as never

beforeEach(() => { vi.clearAllMocks(); api.validate.mockReturnValue(true) })

describe('Phase Two learner lesson presentation', () => {
  it('opens directly on the lesson with one medium placeholder and no build administration', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Identify human responsibility, capability and evidence."
      medium="audio"
      production={lessonProduction}
    />)
    expect(screen.getByRole('heading', { name: 'Professional AI judgment and direction' })).toBeTruthy()
    expect(screen.getByText('Audio placeholder')).toBeTruthy()
    expect(screen.getAllByText('Audio placeholder')).toHaveLength(1)
    expect(screen.queryByText('Video placeholder')).toBeNull()
    expect(screen.getByText('Lesson teaching and practice')).toBeTruthy()
    expect(screen.queryByText(/founder|unpublished|publishing|preview|provisional|video slots|audio slots|course inventory/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /submit|award|publish/i })).toBeNull()
  })

  it('shows one video introduction but no competing audio when the lesson is video-led', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.2" lessonTitle="Find the need and establish the evidence"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Find an actual problem and test assumptions."
      medium="video" production={lessonProduction}
    />)
    expect(screen.getByText('Video placeholder')).toBeTruthy()
    expect(screen.getAllByText('Video placeholder')).toHaveLength(1)
    expect(screen.queryByText('Audio placeholder')).toBeNull()
  })

  it('displays a supplied instructor video at the established 16:9 media position without replacing teaching', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Choose and verify a professional task."
      medium="audio"
      production={lessonProduction}
      introVideo={{ url: 'https://aiconfidenceacademy.org/assets/test-approved-instructor.mp4',
        transcript: 'Welcome to the Academy.\n\nLet us begin.', approvalStatus: 'founder_approved' }}
    />)
    const video = screen.getByLabelText('Lesson 1.1 instructor introduction video')
    expect(video.tagName.toLowerCase()).toBe('video')
    expect(video.getAttribute('src')).toBe('https://aiconfidenceacademy.org/assets/test-approved-instructor.mp4')
    expect(video).toHaveProperty('controls', true)
    expect(video.getAttribute('preload')).toBe('auto')
    expect(video.getAttribute('poster')).toBe('/assets/videos/phase-two-lesson-1-1/poster.webp')
    expect(screen.getByText('Lesson teaching and practice')).toBeTruthy()
    expect(screen.getByText('Audio placeholder')).toBeTruthy()
    expect(screen.getByText('Read the lesson introduction')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Listen to guided instruction' })).toBeTruthy()
  })

  it('rejects a video marked as pending founder review even if its URL and transcript exist', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Practice sound professional judgment."
      medium="audio"
      production={lessonProduction}
      introVideo={{
        url: 'https://aiconfidenceacademy.org/assets/pending-instructor.mp4',
        transcript: 'An unapproved recording must not appear.',
        approvalStatus: 'pending_review' as never,
      }}
    />)
    expect(screen.queryByLabelText('Lesson 1.1 instructor introduction video')).toBeNull()
  })

  it('does not attach a presenter video by default while its preview awaits acceptance', () => {
    render(<PhaseTwoLessonExperience
      pageId="1.1"
      lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Choose and verify a professional task."
      medium="audio"
      production={lessonProduction}
    />)
    expect(screen.queryByLabelText('Lesson 1.1 instructor introduction video')).toBeNull()
  })

  it('keeps unreviewed teaching audio out of enrolled-learner lessons', () => {
    const pending = {
      url: 'https://aiconfidenceacademy.org/assets/demo-guided.m4a',
      duration_seconds: 65,
      voice_id: 'ac277b338cf64d8b9686784c43c563da',
      approvalStatus: 'founder_review_pending' as const,
      chapters: [
        { title: 'Purpose', start_seconds: 0, transcript: 'Define the purpose.' },
        { title: 'Evidence', start_seconds: 16, transcript: 'Verify the evidence.' },
        { title: 'Human responsibility', start_seconds: 32, transcript: 'Human approval remains.' },
        { title: 'Correct', start_seconds: 48, transcript: 'Correct the report.' },
      ],
    }
    const standard = {
      pageId:'1.1', lessonTitle:'Professional AI judgment and direction',
      journeyTitle:'Journey 1', purpose:'Direct a task.', medium:'audio' as const,
      production:lessonProduction, guidedInstruction:pending,
    }
    const view = render(<PhaseTwoLessonExperience {...standard} />)
    expect(screen.queryByLabelText('Lesson 1.1 guided instruction audio')).toBeNull()
    expect(screen.getByText('Audio placeholder')).toBeTruthy()
    view.rerender(<PhaseTwoLessonExperience {...standard} allowMediaReview />)
    expect(screen.getByLabelText('Lesson 1.1 guided instruction audio')).toBeTruthy()
    expect(screen.queryByText('Audio placeholder')).toBeNull()
  })

  it('reuses existing lesson and project navigation for an enrolled learner', async () => {
    const user=userEvent.setup()
    const back=vi.fn(), project=vi.fn()
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1 · AI Strategy and Business Opportunity"
      purpose="Identify human responsibility." medium="audio"
      production={lessonProduction}
      remainingSeconds={3410} onBackToLessons={back} onOpenProject={project}
    />)
    expect(screen.getByText('Time remaining: 56 min')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Your lessons' }))
    await user.click(screen.getByRole('button', { name: 'Open My Project Record' }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(project).toHaveBeenCalledTimes(1)
  })

  it('does not display a partial instructional package as a completed lesson', () => {
    api.validate.mockReturnValue(false)
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI judgment and direction"
      journeyTitle="Journey 1" purpose="Judgment." medium="audio"
      production={undefined}
    />)
    expect(screen.getByRole('alert').textContent).toMatch(/lesson is temporarily unavailable/i)
    expect(screen.queryByText('Lesson teaching and practice')).toBeNull()
  })
  it('substitutes only validated revised lesson introduction in protected founder review', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:true,
      json:async()=>({
        lesson:'1.1',intro_closing:"Let's begin.",
        instructor_voice_id:'ac277b338cf64d8b9686784c43c563da',
        video_file:'ACA-Phase-Two-Lesson-1-1-Introduction-v2.mp4',
        captions_file:'ACA-Phase-Two-Lesson-1-1-Introduction-v2.vtt',
        poster_file:'poster-v2.webp',
      }),
    }))
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI Judgment and Direction"
      journeyTitle="Journey 1" purpose="Review the report." medium="audio"
      production={lessonProduction} allowMediaReview
      introVideo={{url:'https://aiconfidenceacademy.org/old-approved.mp4',
        transcript:'Original approved introduction.',approvalStatus:'founder_approved'}}
    />)
    const player=screen.getByLabelText('Lesson 1.1 instructor introduction video') as HTMLVideoElement
    await waitFor(()=>expect(globalThis.fetch).toHaveBeenCalledWith('/assets/videos/phase-two-lesson-1-1/intro-v2-manifest.json',{cache:'no-store'}))
    await waitFor(()=>expect(player.getAttribute('src')).toContain('Introduction-v2.mp4'),{timeout:4000})
    expect(player.getAttribute('poster')).toContain('poster-v2.webp')
    const track=player.querySelector('track[kind="captions"]')
    expect(track?.getAttribute('src')).toContain('Introduction-v2.vtt')
    expect(screen.getByText(/Phase Two, Journey One, Lesson One: Professional AI Judgment and Direction/)).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('preserves previously approved introduction when revised media fails verification', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({
      lesson:'1.1',intro_closing:'Unapproved alternate phrase',
      instructor_voice_id:'ac277b338cf64d8b9686784c43c563da',
      video_file:'ACA-Phase-Two-Lesson-1-1-Introduction-v2.mp4',
      captions_file:'ACA-Phase-Two-Lesson-1-1-Introduction-v2.vtt',
      poster_file:'poster-v2.webp',
    })}))
    render(<PhaseTwoLessonExperience
      pageId="1.1" lessonTitle="Professional AI Judgment and Direction"
      journeyTitle="Journey 1" purpose="Review the report." medium="audio"
      production={lessonProduction} allowMediaReview
      introVideo={{url:'https://aiconfidenceacademy.org/old-approved.mp4',
        transcript:'Original approved introduction.',approvalStatus:'founder_approved'}}
    />)
    await waitFor(()=>expect(globalThis.fetch).toHaveBeenCalled())
    expect((screen.getByLabelText('Lesson 1.1 instructor introduction video') as HTMLVideoElement).src)
      .toContain('old-approved.mp4')
    vi.unstubAllGlobals()
  })

  it.each([{pageId:'2.1',voice:'8NNnQuXc0FKua22CvviM'},{pageId:'2.2',voice:'8NNnQuXc0FKua22CvviM'},{pageId:'2.3',voice:'8NNnQuXc0FKua22CvviM'},{pageId:'2.4',voice:'8NNnQuXc0FKua22CvviM'},{pageId:'2.5',voice:'8NNnQuXc0FKua22CvviM'},{pageId:'2.2',voice:'wrong-voice'}])('loads verified review media for $pageId with its established voice ($voice)', async ({pageId,voice}) => {
    vi.stubGlobal('location', {origin: 'https://aiconfidenceacademy.org'})
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('guided-chapters.json') ? {
      duration_seconds: 614, chapters: [1,2,3,4].map(n => ({title: `Chapter ${n}`, start_seconds: (n-1)*150, transcript: `Teaching ${n}`})),
    } : {lesson: pageId, voice_id: voice, guided_audio: {file: 'ACA-Phase-Two-Lesson-2-2-Guided-Instruction.m4a'},
      demonstrations: [1,2,3,4].map(n=>({key:`demo-${n}`,title:`Demo ${n}`,file:`demo-${n}.mp4`,captions:`demo-${n}.vtt`,transcript:`Example ${n}`,duration_seconds:20,fictional_training_example:true})),
    }})))
    try {
      render(<PhaseTwoLessonExperience pageId={pageId} lessonTitle="Communication and workflow review"
        journeyTitle="Journey 2" purpose="Support the reader's next action." medium="audio" production={lessonProduction} allowMediaReview />)
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
      if (voice === '8NNnQuXc0FKua22CvviM') {
        await waitFor(() => expect(screen.getByLabelText(`Lesson ${pageId} guided instruction audio`)).toBeTruthy())
        expect(screen.getByLabelText(`Lesson ${pageId} instructor introduction video`).getAttribute('src')).toContain(pageId==='2.1'?'Lesson-2-1-Introduction-landscape.mp4':'Lesson-'+pageId.replace('.','-')+'-Introduction.mp4')
        expect(screen.getByText(pageId==='2.1'?/Journey Two, Lesson One: Map the Work and Locate Friction/:pageId==='2.2'?/Journey Two, Lesson Two: Produce Communication That Serves the Audience/:pageId==='2.3'?/Journey Two, Lesson Three: Verify and Revise with CLEAR/:pageId==='2.4'?/Journey Two, Lesson Four: Choose Assistants, Automation and Agents/:/Journey Two, Lesson Five: Build a Bounded Working Prototype/)).toBeTruthy()
      } else {
        expect(screen.queryByLabelText(`Lesson ${pageId} guided instruction audio`)).toBeNull()
        expect(screen.queryByLabelText(`Lesson ${pageId} instructor introduction video`)).toBeNull()
      }
    } finally { vi.unstubAllGlobals() }
  })

})

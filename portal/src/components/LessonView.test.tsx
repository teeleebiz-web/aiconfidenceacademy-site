import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LessonView } from './LessonView'
import type { Lesson } from '../types'

const lesson: Lesson = {
  id: 'lesson-1',
  course_id: 'course-1',
  journey_id: 'journey-1',
  page_id: '1.1',
  title: 'A Sample Learner Lesson',
  purpose: 'Verify the learner interaction without embedding curriculum content.',
  estimated_minutes: 35,
  course_position: 1,
  journey_position: 1,
  unlock_offset_days: 0,
  status: 'published',
  content: {
    outcomes: ['Complete a guided practice and save a reflection.'],
    vocabulary: { Reflection: 'A short record of what the learner noticed.' },
    teaching: ['This synthetic fixture tests the lesson interface only.'],
    examples: [],
    practice_prompt: 'Help me organize a simple, non-private practice task.',
    practice_steps: ['Begin the practice.', 'Review the result.', 'Make one revision.'],
    revision: 'Revise the result until it fits the stated purpose.',
    artifact: 'My Sample Reflection',
    stay_engaged: 'Name one next practice step.',
    optional: 'Write one question for the next lesson.',
    knowledge_check: [{ q: 'Who makes the final decision about using an AI response?' }],
    review_questions: ['Does this response fit your purpose?'],
    rhythm: 'See it -> Say it -> Ask it -> Shape it -> Check it -> Use it -> Save it',
    accessibility: 'Use readable text and keyboard-accessible controls.',
  },
}

describe('LessonView', () => {
  it('presents 5.1 as a video lesson with its workbook directly above practice',()=>{
    const current={...lesson,page_id:'5.1'}
    const href='/academy/phase-one/?workbook=journey-five&lesson=5.1'
    const {container}=render(<LessonView lesson={current} videoSrc="/approved-5.1.mp4" workbookHref={href} reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('audio,details')).toBeNull()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.getAttribute('href')).toBe(href)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
  })

  it('presents 5.2 as an audio lesson with its script and workbook above practice',()=>{
    const current={...lesson,page_id:'5.2',content:{...lesson.content,audio_overview_script:'Welcome to Lesson 5.2.'}}
    const href='/academy/phase-one/?workbook=journey-five&lesson=5.2'
    const {container}=render(<LessonView lesson={current} audioSrc="/approved-5.2.mp3" workbookHref={href} reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect(container.querySelectorAll('audio')).toHaveLength(1)
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByText('Read the lesson introduction')).toBeTruthy()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.getAttribute('href')).toBe(href)
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
  })

  it('presents 5.3 with its curriculum and workbook placeholder but no substitute media',()=>{
    const current={...lesson,page_id:'5.3'}
    const href='/academy/phase-one/?workbook=journey-five&lesson=5.3'
    const {container}=render(<LessonView lesson={current} workbookHref={href} reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect(container.querySelector('video,audio,details')).toBeNull()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.getAttribute('href')).toBe(href)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
  })

  it('presents 5.5 with its curriculum and workbook but no substitute media',()=>{
    const current={...lesson,page_id:'5.5'}
    const href='/academy/phase-one/?workbook=journey-five&lesson=5.5'
    const {container}=render(<LessonView lesson={current} workbookHref={href} reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect(container.querySelector('video,audio,details')).toBeNull()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.getAttribute('href')).toBe(href)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
  })

  it('presents 5.6 with its audio reminder, readable script, and workbook above practice',()=>{
    const current={...lesson,page_id:'5.6',content:{...lesson.content,audio_overview_script:'Welcome to Lesson 5.6.'}}
    const href='/academy/phase-one/?workbook=journey-five&lesson=5.6'
    const {container}=render(<LessonView lesson={current} workbookHref={href} reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect(container.querySelector('video,audio')).toBeNull()
    expect(screen.getByText('Audio will be available here.')).toBeTruthy()
    expect(screen.getByText('Read the lesson introduction')).toBeTruthy()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.getAttribute('href')).toBe(href)
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
  })

  it('opens 4.1 without a media placeholder and accepts the later video without replacing its curriculum',()=>{
    const current={...lesson,page_id:'4.1'}
    const props={lesson:current,workbookHref:'/academy/phase-one/?workbook=journey-four&lesson=4.1',reviewMode:true,onBack:()=>{},onSave:async()=>{}}
    const {container,rerender}=render(<LessonView {...props} />)
    expect(container.querySelector('video,audio,details')).toBeNull()
    expect(screen.queryByRole('heading',{name:'Watch Lesson 4.1'})).toBeNull()
    expect(screen.getByText(current.content.teaching[0])).toBeTruthy()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('href')).toBe(props.workbookHref)
    rerender(<LessonView {...props} videoSrc="/approved-4.1.mp4" />)
    expect(screen.getByText(current.content.teaching[0])).toBeTruthy()
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video')!.autoplay).toBe(false)
  })

  it('presents 3.6 with a white title, the native video, and workbook before practice',()=>{
    const current={...lesson,page_id:'3.6'}
    const {container}=render(<LessonView lesson={current} videoSrc="/3.6.mp4" workbookHref="/academy/phase-one/?workbook=journey-three&lesson=3.6" reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect((screen.getByRole('heading',{name:current.title}) as HTMLElement).style.color).toBe('rgb(255, 255, 255)')
    expect(screen.getByRole('heading',{name:'Watch Lesson 3.6'})).toBeTruthy()
    const video=container.querySelector('video')!
    expect(video.getAttribute('src')).toBe('/3.6.mp4')
    expect(video.controls).toBe(true)
    expect(video.autoplay).toBe(false)
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('audio,details')).toBeNull()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('href')).toBe('/academy/phase-one/?workbook=journey-three&lesson=3.6')
  })

  it('presents 3.5 with its white title, audio, script, and workbook above practice', () => {
    const current = {...lesson, page_id:'3.5', content:{...lesson.content, audio_overview_script:'Welcome to the practice.'}}
    const {container} = render(<LessonView lesson={current} audioSrc="/3.5.mp3" workbookHref="/academy/phase-one/?workbook=journey-three&lesson=3.5" reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect((screen.getByRole('heading',{name:current.title}) as HTMLElement).style.color).toBe('rgb(255, 255, 255)')
    expect(screen.getByText('Read the lesson introduction')).toBeTruthy()
    const audio=container.querySelector('audio')!
    expect(audio.getAttribute('src')).toBe('/3.5.mp3')
    expect(audio.controls).toBe(true)
    expect(audio.autoplay).toBe(false)
    expect(container.querySelector('video')).toBeNull()
    const workbook=screen.getByRole('link',{name:'Open Workbook'})
    expect(workbook.getAttribute('href')).toBe('/academy/phase-one/?workbook=journey-three&lesson=3.5')
    expect(workbook.getAttribute('target')).toBe('_blank')
    expect(workbook.nextElementSibling?.textContent).toBe('Guided practice')
  })

  it('presents the approved 3.4 script and workbook before audio is attached', () => {
    const current={...lesson,page_id:'3.4',content:{...lesson.content,audio_overview_script:'Welcome to the practice.'}}
    const {container,rerender}=render(<LessonView lesson={current} workbookHref="/academy/phase-one/?workbook=journey-three&lesson=3.4" reviewMode onBack={()=>{}} onSave={async()=>{}} />)
    expect(screen.getByRole('heading',{name:'Lesson introduction'})).toBeTruthy()
    expect(screen.getByText('Read the lesson introduction')).toBeTruthy()
    expect(screen.queryByText('Audio will be available here.')).toBeNull()
    const link=screen.getByRole('link',{name:'Open Workbook'})
    expect(link.nextElementSibling?.textContent).toBe('Guided practice')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(container.querySelectorAll('video,audio').length).toBe(0)
    rerender(<LessonView lesson={current} audioSrc="/3.4.mp3" onBack={()=>{}} onSave={async()=>{}} />)
    expect(screen.getByRole('heading',{name:'Listen to Lesson 3.4'})).toBeTruthy()
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('/3.4.mp3')
  })

  it('requires meaningful work, then saves the learner artifact', async () => {
    const user = userEvent.setup()
    const saved: string[] = []

    render(
      <LessonView
        lesson={lesson}
        onBack={() => undefined}
        onSave={async (response) => {
          saved.push(response)
        }}
      />,
    )

    expect(screen.getByText(/45 minute session/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /complete learning rhythm/i })).toBeTruthy()
    expect(screen.getByText(/optional continuation is available after the core session/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /save and complete/i }))
    expect(screen.getByRole('status').textContent).toMatch(/thoughtful words/i)

    await user.type(
      screen.getByLabelText(/evidence you want to save/i),
      'I want to use AI with better judgment. I want confidence to shape and verify what it gives me.',
    )
    await user.click(screen.getByRole('button', { name: /save and complete/i }))

    expect(saved).toEqual([
      'I want to use AI with better judgment. I want confidence to shape and verify what it gives me.',
    ])
    expect(screen.getByRole('status').textContent).toMatch(/lesson 1.1 is complete/i)
  })

  it('never renders answer keys in learner-facing knowledge checks', () => {
    render(
      <LessonView
        lesson={lesson}
        onBack={() => undefined}
        onSave={async () => undefined}
      />,
    )

    expect(screen.getByText('Who makes the final decision about using an AI response?')).toBeTruthy()
    expect(screen.queryByText(/^The learner\.$/)).toBeNull()
  })

  it('keeps owner review read-only and supports adjacent-lesson navigation', async () => {
    const user = userEvent.setup()
    const nextLesson = { ...lesson, id: 'lesson-2', page_id: '1.2', status: 'draft' as const }
    const opened: string[] = []

    render(
      <LessonView
        lesson={{ ...lesson, status: 'draft' }}
        reviewMode
        nextLesson={nextLesson}
        onBack={() => undefined}
        onSave={async () => { throw new Error('Review mode must not save.') }}
        onOpenLesson={(item) => opened.push(item.id)}
      />,
    )

    expect(screen.queryByText(/unpublished draft|owner review|review mode is read-only/i)).toBeNull()
    expect(screen.queryByLabelText(/evidence you want to save/i)).toBeNull()
    expect(screen.getByText(/what to save/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /lesson 1.2/i }))
    expect(opened).toEqual(['lesson-2'])
  })
})

 it('uses one video player instead of a duplicate audio player', () => {
  const { container } = render(<LessonView lesson={lesson} videoSrc="/video.mp4" audioSrc="/audio.mp3" workbookHref="/academy/phase-one/?workbook=journey-one&lesson=1.1" onBack={() => undefined} onSave={async () => undefined} />)
  expect(container.querySelectorAll('video')).toHaveLength(1)
  expect(container.querySelector('audio')).toBeNull()
  expect(container.querySelector('video')?.getAttribute('src')).toBe('/video.mp4')
  expect(container.querySelector('video')?.style.maxWidth).toBe('640px')
  const workbook=screen.getByRole('link',{name:'Open Workbook'})
  expect(workbook.getAttribute('target')).toBe('_blank')
  expect(workbook.getAttribute('href')).toBe('/academy/phase-one/?workbook=journey-one&lesson=1.1')
  expect(workbook.nextElementSibling?.textContent).toBe('Guided practice')
 })

it('does not offer backward navigation even when a prior lesson is supplied', () => {
 render(<LessonView lesson={lesson} previousLesson={{...lesson, page_id:'1.0'}} nextLesson={{...lesson,page_id:'1.2'}} onBack={() => undefined} onOpenLesson={() => undefined} onSave={async () => undefined} />)
 expect(screen.queryByRole('button', {name:/previous lesson|back to|return to/i})).toBeNull()
 expect(screen.getByRole('button', {name:/next lesson 1.2/i})).toBeTruthy()
})

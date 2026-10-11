import { fireEvent, render, screen, within } from '@testing-library/react'
import data from '../../../academy/phase-two-production/J6-L6-1-production.json'
import { PhaseTwoLessonExperience } from './PhaseTwoLessonExperience'
import { validProducedLesson, type PhaseTwoProducedLesson } from './PhaseTwoProducedLessonReview'
it('renders the actual Lesson 6.1 package with working chapter and demonstration choices and workbook entry', () => {
  expect(validProducedLesson(data,'6.1')).toBe(true)
  const production=data as PhaseTwoProducedLesson
  const open=vi.fn()
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{})
  render(<PhaseTwoLessonExperience pageId="6.1" lessonTitle={data.title} journeyTitle="Journey Six — Demonstrate and Execute"
    purpose={data.learner_promise} medium="audio" production={production} onOpenWorkbook={open}
    introVideo={{url:'https://aiconfidenceacademy.org/assets/videos/phase-two-lesson-6-1/ACA-Phase-Two-Lesson-6-1-Introduction.mp4',transcript:data.media_transcripts.introduction,approvalStatus:'founder_review_pending'}}
    guidedInstruction={{url:'https://aiconfidenceacademy.org/assets/videos/phase-two-lesson-6-1/ACA-Phase-Two-Lesson-6-1-Guided-Instruction.m4a',duration_seconds:750,voice_id:'Ufzf3hcVZVWx3QjtOPI5',approvalStatus:'founder_review_pending',chapters:data.teaching.map((x,i)=>({title:x.heading,start_seconds:i*180,transcript:data.media_transcripts.chapters[i]}))}}
    demoClips={data.media_transcripts.demonstrations.map((transcript,i)=>({key:'example-'+i,title:'Example '+(i+1),url:'/example-'+i+'.mp4',captions_url:'/example-'+i+'.vtt',transcript,duration_seconds:45,fictional_training_example:true}))} allowMediaReview />)
  expect(screen.getByLabelText('Lesson 6.1 instructor introduction video')).toHaveProperty('controls',true)
  const instructor=screen.getByLabelText('Lesson 6.1 instructor introduction video')
  expect(instructor.style.aspectRatio).toBe('9 / 16')
  expect(instructor.style.maxWidth).toBe('360px')
  expect(screen.queryByText('Audio placeholder')).toBeNull()
  const audio=screen.getByLabelText('Lesson 6.1 guided instruction audio') as HTMLAudioElement
  for (const [i,button] of within(screen.getByRole('group',{name:'Guided instruction chapters'})).getAllByRole('button').entries()) {
    fireEvent.click(button);expect(button.getAttribute('aria-pressed')).toBe('true');expect(audio.currentTime).toBe(i*180)
  }
  for (const [i,button] of within(screen.getByRole('group',{name:'Choose a screen demonstration'})).getAllByRole('button').entries()) {
    fireEvent.click(button);expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Example '+(i+1)+' screen demonstration').getAttribute('src')).toContain('/example-'+i+'.mp4')
  }
  fireEvent.click(screen.getByRole('button',{name:'Hide evidence review'}));expect(screen.queryByRole('table')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Show evidence review'}));expect(screen.getByRole('table')).toBeTruthy()
  expect(screen.getByLabelText(/^Capability 10:/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Open Workbook — Lesson 6.1'}));expect(open).toHaveBeenCalledOnce()
  vi.restoreAllMocks()
})

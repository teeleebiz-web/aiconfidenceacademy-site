import { render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoLessonExperience } from './PhaseTwoLessonExperience'
import type { PhaseTwoMediaAccess } from './PhaseTwoPrivateMedia'

const fixture = vi.hoisted(() => ({ page: '1.1', voice: '', json: vi.fn() }))
vi.mock('./PhaseTwoPrivateMedia', () => ({ PhaseTwoPrivateMedia: ({children}: {children:(access:PhaseTwoMediaAccess)=>unknown}) => children({
  private:true, introductions: { original: 'Approved introduction', revised: 'Approved revised introduction' }, resolve:url=>url ? 'https://storage.test' + new URL(url,'https://aiconfidenceacademy.org').pathname : undefined, json:fixture.json,
}) }))
vi.mock('./PhaseTwoProducedLessonReview', () => ({validProducedLesson:()=>true,
  PhaseTwoProducedLessonReview:({demoClips}: {demoClips?:Array<{key:string;url:string;captions_url:string}>}) => <div>{demoClips?.map(clip=><video key={clip.key} aria-label={'Demo '+clip.key} src={clip.url}><track src={clip.captions_url} /></video>)}</div>,
}))
const pages=Array.from({length:6},(_,j)=>Array.from({length:6},(_,l)=>`${j+1}.${l+1}`)).flat()
it.each(pages)('uses the existing instructor version, audio and four private demonstrations for %s', async page => {
  const suffix=page.replace('.','-'),root='/assets/videos/phase-two-lesson-'+suffix+'/'
  const voice=page==='6.1'?'0db3abd83c74452fb2460b0dd113daad':({'1':'ac277b338cf64d8b9686784c43c563da','2':'8NNnQuXc0FKua22CvviM','3':'50ab8f40f8a34d66aa4338729900c1b0','4':'00e3d285aba44b27a83c47c02c9c2d9c','5':'beda795369e7487b863b0e7b82a82bd3','6':'Ufzf3hcVZVWx3QjtOPI5'}[page[0]]!)
  const chapters=Array.from({length:4},(_,i)=>({title:'Chapter '+i,start_seconds:i*30,transcript:'Approved transcript'}))
  const demos=Array.from({length:4},(_,i)=>({key:String(i),title:'Demonstration '+i,file:`demo-${i}.mp4`,captions:`demo-${i}.vtt`,transcript:'Approved demonstration',duration_seconds:30,fictional_training_example:true as const}))
  fixture.json.mockImplementation(async (url:string) => url.endsWith('intro-v2-manifest.json') ? {lesson:page,intro_closing:"Let's begin.",instructor_voice_id:voice,video_file:`ACA-Phase-Two-Lesson-${suffix}-Introduction-v2.mp4`,captions_file:`ACA-Phase-Two-Lesson-${suffix}-Introduction-v2.vtt`,poster_file:'poster-v2.webp'} : url.endsWith('guided-chapters.json') ? {chapters,duration_seconds:120} : {lesson:page,voice_id:voice,guided_audio:{file:'guided.m4a'},demonstrations:demos})
  render(<PhaseTwoLessonExperience lessonId="lesson-uuid" enrollmentId="enrollment-uuid" pageId={page} lessonTitle="Existing approved lesson" journeyTitle="Journey" purpose="Existing purpose" medium="audio"
    production={{pacing:[],media_transcripts:{introduction:'Approved introduction',chapters:chapters.map(c=>c.transcript),demonstrations:demos.map(c=>c.transcript)}} as never}
    {...(page==='1.1'?{introVideo:{url:'https://aiconfidenceacademy.org'+root+`ACA-Phase-Two-Lesson-${suffix}-Introduction.mp4`,transcript:'Approved introduction',approvalStatus:'founder_approved' as const},guidedInstruction:{url:'https://aiconfidenceacademy.org'+root+'guided.m4a',voice_id:voice,chapters,duration_seconds:120,approvalStatus:'founder_approved' as const},demoClips:demos.map(c=>({...c,url:'https://aiconfidenceacademy.org'+root+c.file,captions_url:'https://aiconfidenceacademy.org'+root+c.captions}))}:{})}
  />)
  const intro = await screen.findByLabelText(`Lesson ${page} instructor introduction video`)
  const variant=['1.1','1.2','1.3','1.4'].includes(page)?'-v2':page==='2.1'?'-landscape':page.startsWith('6.')?'-wide':''
  expect(intro.getAttribute('src')).toBe('https://storage.test'+root+`ACA-Phase-Two-Lesson-${suffix}-Introduction${variant}.mp4`)
  await waitFor(()=>expect(screen.getAllByLabelText(/^Demo /)).toHaveLength(4))
  expect(screen.getByLabelText(`Lesson ${page} guided instruction audio`).getAttribute('src')).toBe('https://storage.test'+root+'guided.m4a')
  for(const element of document.querySelectorAll('video,audio,track')) expect(element.getAttribute('src')).toMatch(/^https:\/\/storage\.test\//)
  expect(intro.getAttribute('poster')).toMatch(/^https:\/\/storage\.test\//)
})

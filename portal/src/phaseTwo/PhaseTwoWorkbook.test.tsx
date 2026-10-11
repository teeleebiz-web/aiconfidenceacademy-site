import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { PhaseTwoWorkbook } from './PhaseTwoWorkbook'
import { supabase } from '../lib/supabase'

const fixture = (pages = [1]) => ({
  answers: { 'p2-j1-1-capability': 'Verified example' },
  last_page: 1, revision: 0, updated_at: null,
  allowedPages: pages,
  scope: 'owner-review',
  workbook: {
    key:'phase-two-journey-one',version:1,title:'Phase Two Journey 1 Workbook',
    pages:pages.map(number=>({
      number,lesson_id:'1.'+number,kicker:'Journey One',
      title: number===1?'Professional AI Judgment and Direction':'Find the Need and Establish the Evidence',
      blocks:[{type:'heading',text:'Study and review'},
        {type:'text',text:'The current lesson content is available for study.'},
        {type:'field',id:number===1?'p2-j1-1-capability':'p2-j1-2-first',label:'Your evidence',hint:'Name the source.',lines:4}],
    })),
  },
})
it('opens Lesson 4.4, retains offer and sample answers, locks future pages, prints and returns to 4.4',async()=>{
  const data=fixture([1,2,3,4])
  data.workbook.key='phase-two-journey-four';data.workbook.title='Phase Two Journey 4 Workbook'
  data.answers={'p2-j4-1-offerSentence':'Earlier bounded offer','p2-j4-2-sample':'Earlier complete sample','p2-j4-3-revisedSample':'Previous content retained','p2-j4-4-failureCorrections':'Saved checked content'} as never
  data.workbook.pages=['Define the Offer and Its Promise','Design a Useful Product or Learning Experience','Create Content with Voice, Accuracy, and Agency','Map Customer and Digital Delivery'].map((title,i)=>({number:i+1,lesson_id:'4.'+(i+1),kicker:'Journey Four',title,blocks:[{type:'field',id:['p2-j4-1-offerSentence','p2-j4-2-sample','p2-j4-3-revisedSample','p2-j4-4-failureCorrections'][i],label:['Saved offer','My complete sample','Previous content review','My revised content'][i],hint:'',lines:5}]})) as never
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const onBack=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{})
  render(<PhaseTwoWorkbook journey={4} initialLesson={4} onBack={onBack}/>)
  expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('4');expect([...chooser.options].slice(4).every(x=>x.disabled)).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Previous content retained')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier complete sample')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier bounded offer')).toBeTruthy()
  fireEvent.change(chooser,{target:{value:'4'}});expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('My revised content'),{target:{value:'Reviewed revision'}})
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 4.4/}));expect(onBack).toHaveBeenCalledOnce()
  print.mockRestore()
})
it('opens Lesson 4.3, retains offer and sample answers, locks future pages, prints and returns to 4.3',async()=>{
  const data=fixture([1,2,3])
  data.workbook.key='phase-two-journey-four';data.workbook.title='Phase Two Journey 4 Workbook'
  data.answers={'p2-j4-1-offerSentence':'Earlier bounded offer','p2-j4-2-sample':'Earlier complete sample','p2-j4-3-revisedSample':'Saved checked content'} as never
  data.workbook.pages=['Define the Offer and Its Promise','Design a Useful Product or Learning Experience','Create Content with Voice, Accuracy, and Agency'].map((title,i)=>({number:i+1,lesson_id:'4.'+(i+1),kicker:'Journey Four',title,blocks:[{type:'field',id:['p2-j4-1-offerSentence','p2-j4-2-sample','p2-j4-3-revisedSample'][i],label:['Saved offer','My complete sample','My revised content'][i],hint:'',lines:5}]})) as never
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const onBack=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{})
  render(<PhaseTwoWorkbook journey={4} initialLesson={3} onBack={onBack}/>)
  expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('3');expect([...chooser.options].slice(3).every(x=>x.disabled)).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier complete sample')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier bounded offer')).toBeTruthy()
  fireEvent.change(chooser,{target:{value:'3'}});expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('My revised content'),{target:{value:'Reviewed revision'}})
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 4.3/}));expect(onBack).toHaveBeenCalledOnce()
  print.mockRestore()
})
it('opens Lesson 4.2, retains the offer answers, locks future pages, prints and returns to 4.2',async()=>{
  const data=fixture([1,2])
  data.workbook.key='phase-two-journey-four';data.workbook.title='Phase Two Journey 4 Workbook'
  data.answers={'p2-j4-1-offerSentence':'Earlier bounded offer','p2-j4-2-sample':'Saved complete estimate sample'} as never
  data.workbook.pages=[{number:1,lesson_id:'4.1',kicker:'Journey Four',title:'Define the Offer and Its Promise',blocks:[{type:'field',id:'p2-j4-1-offerSentence',label:'Saved offer',hint:'',lines:5}]},{number:2,lesson_id:'4.2',kicker:'Journey Four',title:'Design a Useful Product or Learning Experience',blocks:[{type:'field',id:'p2-j4-2-sample',label:'My complete sample',hint:'',lines:5}]}] as never
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const onBack=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{})
  render(<PhaseTwoWorkbook journey={4} initialLesson={2} onBack={onBack}/>)
  expect(await screen.findByDisplayValue('Saved complete estimate sample')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('2');expect([...chooser.options].slice(2).every(x=>x.disabled)).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}))
  expect(await screen.findByDisplayValue('Earlier bounded offer')).toBeTruthy()
  fireEvent.change(chooser,{target:{value:'2'}})
  expect(await screen.findByDisplayValue('Saved complete estimate sample')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('My complete sample'),{target:{value:'Reviewed complete sample'}})
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 4.2/}));expect(onBack).toHaveBeenCalledOnce()
  print.mockRestore()
})
it('opens the Journey Four offer workbook, keeps future sections locked, prints and returns to Lesson 4.1',async()=>{
  const data=fixture()
  data.workbook.key='phase-two-journey-four';data.workbook.title='Phase Two Journey 4 Workbook'
  data.answers={'p2-j4-1-offerSentence':'Retained bounded offer'} as never
  data.workbook.pages=[{number:1,lesson_id:'4.1',kicker:'Journey Four',title:'Define the Offer and Its Promise',blocks:[{type:'field',id:'p2-j4-1-offerSentence',label:'My bounded offer',hint:'Keep promises within capacity.',lines:5}]}] as never
  const rpc=vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const onBack=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{})
  render(<PhaseTwoWorkbook journey={4} initialLesson={1} onBack={onBack}/>)
  expect(await screen.findByDisplayValue('Retained bounded offer')).toBeTruthy()
  expect(rpc).toHaveBeenCalledWith('get_aca_phase_two_workbook',{p_enrollment_id:null,p_journey:4})
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('1');expect(chooser.options[0].textContent).toContain('4.1 · Define the Offer and Its Promise')
  expect([...chooser.options].slice(1).every(x=>x.disabled)).toBe(true)
  fireEvent.change(screen.getByLabelText('My bounded offer'),{target:{value:'Reviewed offer notes'}})
  expect(screen.getByDisplayValue('Reviewed offer notes')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 4.1/}));expect(onBack).toHaveBeenCalledOnce()
  print.mockRestore()
})
it('allows founder review to see only released pages, print, and return in the same tab', async ()=>{
  vi.spyOn(supabase,'rpc').mockResolvedValue({data:fixture(),error:null} as never)
  const onBack=vi.fn()
  const print=vi.spyOn(window,'print').mockImplementation(()=>{})
  render(<PhaseTwoWorkbook journey={1} initialLesson={1} onBack={onBack}/>)
  expect(await screen.findByRole('heading',{name:'Professional AI Judgment and Direction'})).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  const lesson2=[...chooser.options].find(x=>x.value==='2')
  expect(lesson2?.disabled).toBe(true)
  expect(screen.getByDisplayValue('Verified example')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Your evidence'),{target:{value:'Founder practice notes'}})
  expect(screen.getByDisplayValue('Founder practice notes')).toBeTruthy()
  expect(screen.getByText(/test notes are not saved/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}))
  expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 1.1/}))
  await waitFor(()=>expect(onBack).toHaveBeenCalledOnce())
})
it('opens released Lesson 1.2 without exposing later lesson sections',async()=>{
  vi.spyOn(supabase,'rpc').mockResolvedValue({data:fixture([1,2]),error:null} as never)
  render(<PhaseTwoWorkbook journey={1} initialLesson={2} onBack={()=>{}}/>)
  expect(await screen.findByRole('heading',{name:'Find the Need and Establish the Evidence'})).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('2')
  expect([...chooser.options].find(x=>x.value==='3')?.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}))
  expect(await screen.findByRole('heading',{name:'Professional AI Judgment and Direction'})).toBeTruthy()
})

it('opens Lesson 3.2, retains Lesson 3.1 notes and returns to the correct lesson while later pages remain locked', async () => {
  const data = fixture([1, 2])
  data.workbook.key = 'phase-two-journey-three'
  data.workbook.title = 'Phase Two Journey 3 Workbook'
  data.answers = { 'p2-j3-1-map': 'Earlier people map', 'p2-j3-2-summary': 'Simulated listening summary' } as never
  data.workbook.pages = ['Understand the People Affected by Change', 'Listen and Use Reflective Guidance'].map((title, i) => ({
    number: i + 1, lesson_id: '3.' + (i + 1), kicker: 'Journey Three', title,
    blocks: [{ type: 'field', id: i ? 'p2-j3-2-summary' : 'p2-j3-1-map', label: i ? 'Listening summary' : 'People map', hint: '', lines: 4 }],
  })) as never
  vi.spyOn(supabase, 'rpc').mockResolvedValue({ data, error: null } as never)
  const onBack = vi.fn()
  render(<PhaseTwoWorkbook journey={3} initialLesson={2} onBack={onBack} />)
  expect(await screen.findByDisplayValue('Simulated listening summary')).toBeTruthy()
  const chooser = screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect([...chooser.options].find(x => x.value === '2')?.textContent).toContain('Listen and Use Reflective Guidance')
  expect(screen.getByRole('button', { name: /Lesson 3.1\s*Understand the People Affected by Change/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Lesson 3.2\s*Listen and Use Reflective Guidance/ })).toBeTruthy()
  expect([...chooser.options].find(x => x.value === '3')?.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Previous lesson/ }))
  expect(await screen.findByDisplayValue('Earlier people map')).toBeTruthy()
  fireEvent.change(chooser, { target: { value: '2' } })
  expect(await screen.findByDisplayValue('Simulated listening summary')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Back to Lesson 3.2/ }))
  expect(onBack).toHaveBeenCalledOnce()
})

it('opens Lesson 3.3 and preserves earlier workbook answers while future pages remain locked', async () => {
  const data = fixture([1, 2, 3])
  data.workbook.key = 'phase-two-journey-three'
  data.answers = { 'p2-j3-1-context': 'People map retained', 'p2-j3-2-context': 'Listening retained', 'p2-j3-3-context': 'Change message retained' } as never
  data.workbook.pages = ['Understand the People Affected by Change', 'Listen and Use Reflective Guidance', 'Communicate Change with Evidence'].map((title, i) => ({
    number: i + 1, lesson_id: '3.' + (i + 1), kicker: 'Journey Three', title,
    blocks: [{ type: 'field', id: 'p2-j3-' + (i + 1) + '-context', label: 'Continuing context', hint: '', lines: 4 }],
  })) as never
  vi.spyOn(supabase, 'rpc').mockResolvedValue({ data, error: null } as never)
  const onBack = vi.fn()
  render(<PhaseTwoWorkbook journey={3} initialLesson={3} onBack={onBack} />)
  expect(await screen.findByDisplayValue('Change message retained')).toBeTruthy()
  const chooser = screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect([...chooser.options].find(x => x.value === '3')?.textContent).toContain('Communicate Change with Evidence')
  expect([...chooser.options].find(x => x.value === '4')?.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Previous lesson/ }))
  expect(await screen.findByDisplayValue('Listening retained')).toBeTruthy()
  fireEvent.change(chooser, { target: { value: '1' } })
  expect(await screen.findByDisplayValue('People map retained')).toBeTruthy()
  fireEvent.change(chooser, { target: { value: '3' } })
  expect(await screen.findByDisplayValue('Change message retained')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Back to Lesson 3.3/ }))
  expect(onBack).toHaveBeenCalledOnce()
})
it('opens Lesson 4.5, retains offer and sample answers, locks future pages, prints and returns to 4.5',async()=>{
  const data=fixture([1,2,3,4,5])
  data.workbook.key='phase-two-journey-four';data.workbook.title='Phase Two Journey 4 Workbook'
  data.answers={'p2-j4-1-offerSentence':'Earlier bounded offer','p2-j4-2-sample':'Earlier complete sample','p2-j4-3-revisedSample':'Previous content retained','p2-j4-4-failureCorrections':'Earlier delivery map','p2-j4-5-reviewDecision':'Saved checked content'} as never
  data.workbook.pages=['Define the Offer and Its Promise','Design a Useful Product or Learning Experience','Create Content with Voice, Accuracy, and Agency','Map Customer and Digital Delivery','Test Usefulness, Economics and Deliverability'].map((title,i)=>({number:i+1,lesson_id:'4.'+(i+1),kicker:'Journey Four',title,blocks:[{type:'field',id:['p2-j4-1-offerSentence','p2-j4-2-sample','p2-j4-3-revisedSample','p2-j4-4-failureCorrections','p2-j4-5-reviewDecision'][i],label:['Saved offer','My complete sample','Previous content review','Earlier delivery map','My reviewed test'][i],hint:'',lines:5}]})) as never
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const onBack=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{});print.mockClear()
  render(<PhaseTwoWorkbook journey={4} initialLesson={5} onBack={onBack}/>)
  expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('5');expect([...chooser.options].slice(5).every(x=>x.disabled)).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier delivery map')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Previous content retained')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier complete sample')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier bounded offer')).toBeTruthy()
  fireEvent.change(chooser,{target:{value:'5'}});expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('My reviewed test'),{target:{value:'Reviewed revision'}})
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 4.5/}));expect(onBack).toHaveBeenCalledOnce()
  print.mockRestore()
})
it('opens Lesson 4.6, retains offer and sample answers, shows exactly six Journey Four pages, prints and returns to 4.6',async()=>{
  const data=fixture([1,2,3,4,5,6])
  data.workbook.key='phase-two-journey-four';data.workbook.title='Phase Two Journey 4 Workbook'
  data.answers={'p2-j4-1-offerSentence':'Earlier bounded offer','p2-j4-2-sample':'Earlier complete sample','p2-j4-3-revisedSample':'Previous content retained','p2-j4-4-failureCorrections':'Earlier delivery map','p2-j4-5-reviewDecision':'Earlier business review','p2-j4-6-completion':'Saved checked content'} as never
  data.workbook.pages=['Define the Offer and Its Promise','Design a Useful Product or Learning Experience','Create Content with Voice, Accuracy, and Agency','Map Customer and Digital Delivery','Test Usefulness, Economics and Deliverability','Run the Delivery Test and Improve the Artifact'].map((title,i)=>({number:i+1,lesson_id:'4.'+(i+1),kicker:'Journey Four',title,blocks:[{type:'field',id:['p2-j4-1-offerSentence','p2-j4-2-sample','p2-j4-3-revisedSample','p2-j4-4-failureCorrections','p2-j4-5-reviewDecision','p2-j4-6-completion'][i],label:['Saved offer','My complete sample','Previous content review','Earlier delivery map','Earlier business review','My complete artifact'][i],hint:'',lines:5}]})) as never
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const onBack=vi.fn();const print=vi.spyOn(window,'print').mockImplementation(()=>{});print.mockClear()
  render(<PhaseTwoWorkbook journey={4} initialLesson={6} onBack={onBack}/>)
  expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('6');expect(chooser.options).toHaveLength(6);expect([...chooser.options].every(x=>!x.disabled)).toBe(true);expect(screen.getByRole('button',{name:/Next lesson/})).toHaveProperty('disabled',true)
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier business review')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier delivery map')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Previous content retained')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier complete sample')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Earlier bounded offer')).toBeTruthy()
  fireEvent.change(chooser,{target:{value:'6'}});expect(await screen.findByDisplayValue('Saved checked content')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('My complete artifact'),{target:{value:'Reviewed revision'}})
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 4.6/}));expect(onBack).toHaveBeenCalledOnce()
  print.mockRestore()
})

it('opens Journey Six Lesson 1 with retained notes, locks future pages, prints and returns',async()=>{
  const data=fixture([1]);data.workbook.key='journey-6';data.workbook.title='Journey Six Workbook'
  data.answers={'p2_j6_l1_story':'Saved privacy-safe Evidence Story'} as never
  data.workbook.pages=[{number:1,lesson_id:'6.1',kicker:'Journey Six',title:'Recognize Capability and Connect It to Value',blocks:[{type:'field',id:'p2_j6_l1_story',label:'My Evidence Story',hint:'Use actual work.',lines:6}]}] as never
  const rpc=vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const back=vi.fn(),print=vi.spyOn(window,'print').mockImplementation(()=>{})
  render(<PhaseTwoWorkbook journey={6} initialLesson={1} onBack={back}/>)
  expect(await screen.findByDisplayValue('Saved privacy-safe Evidence Story')).toBeTruthy()
  expect(rpc).toHaveBeenCalledWith('get_aca_phase_two_workbook',{p_enrollment_id:null,p_journey:6})
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('1');expect([...chooser.options].slice(1).every(x=>x.disabled)).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 6.1/}));expect(back).toHaveBeenCalledOnce()
  print.mockRestore()
})

it('opens the actual Journey Six Lesson Two workbook, saves and reopens notes, preserves Lesson One, locks future lessons, prints and returns',async()=>{
  const first=(await import('../../../academy/phase-two-production/J6-L6-1-workbook-page.json')).default
  const second=(await import('../../../academy/phase-two-production/J6-L6-2-workbook-page.json')).default
  const data=fixture([1,2]);data.workbook.key='journey-6';data.workbook.title='Journey Six Workbook'
  data.workbook.pages=[first,second] as never
  data.answers={p2_j6_l1_story:'Retained Lesson One story',p2_j6_l2_revision:'Saved material correction'} as never
  let saved={...data.answers}
  const rpc=vi.spyOn(supabase,'rpc').mockImplementation((async(name:string,args:any)=>{
    if(name==='save_aca_phase_two_workbook'){
      saved={...saved,...(args as {p_answers:Record<string,string>}).p_answers} as never
      return {data:{...data,answers:saved,revision:1},error:null} as never
    }
    return {data:{...data,answers:saved},error:null} as never
  }) as never)
  const back=vi.fn(),print=vi.spyOn(window,'print').mockImplementation(()=>{})
  const view=render(<PhaseTwoWorkbook enrollmentId="existing" journey={6} initialLesson={2} onBack={back}/>)
  expect(await screen.findByDisplayValue('Saved material correction')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect(chooser.value).toBe('2');expect([...chooser.options].slice(2).every(x=>x.disabled)).toBe(true)
  fireEvent.change(screen.getByLabelText(/^Material correction:/),{target:{value:'Retested version 2 correction'}})
  fireEvent.click(screen.getByRole('button',{name:'Save'}))
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('save_aca_phase_two_workbook',expect.objectContaining({p_journey:6,p_answers:expect.objectContaining({p2_j6_l2_revision:'Retested version 2 correction'})})))
  fireEvent.click(screen.getByRole('button',{name:/Previous lesson/}));expect(await screen.findByDisplayValue('Retained Lesson One story')).toBeTruthy()
  fireEvent.change(chooser,{target:{value:'2'}});expect(await screen.findByDisplayValue('Retested version 2 correction')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Print / Save PDF'}));expect(print).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson 6.2/}));await waitFor(()=>expect(back).toHaveBeenCalledOnce())
  view.unmount();render(<PhaseTwoWorkbook enrollmentId="existing" journey={6} initialLesson={2} onBack={back}/>);expect(await screen.findByDisplayValue('Retested version 2 correction')).toBeTruthy()
  print.mockRestore()
})

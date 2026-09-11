import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Workbook } from '../../academy/workbook/Workbook'
const auth=vi.hoisted(()=>({getSession:vi.fn(async()=>({data:{session:null}})),onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}}))}))
vi.mock('./lib/supabase',()=>({supabase:{auth}}))
afterEach(()=>vi.restoreAllMocks())
it('opens the approved pages, saves typed answers and restores the page after reopening',async()=>{
  let record={answers:{} as Record<string,string>,last_page:5,revision:0,updated_at:null as string|null,allowedPages:Array.from({length:32},(_,i)=>i+1),scope:'owner-review',workbook:{key:'journey-one',version:1,title:'Workbook test fixture',pages:Array.from({length:32},(_,i)=>({number:i+1,kicker:'Practice',title:`Practice page ${i+1}`,blocks:[{type:'field',id:`field-${i+1}`,label:'My answer'}]}))}}
  const request=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{
    if(init?.method==='PATCH') {const p=JSON.parse(init.body as string);record={...record,answers:{...record.answers,...p.answers},last_page:p.page,revision:record.revision+1,updated_at:'2026-09-10T00:00:00Z'}}
    return {ok:true,json:async()=>structuredClone(record)} as Response
  })
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
  const first=render(<StrictMode><Workbook /></StrictMode>)
  await screen.findByRole('heading',{level:1,name:'Practice page 5'})
  const input=screen.getByRole('textbox',{name:'My answer'}) as HTMLTextAreaElement
  fireEvent.change(input,{target:{value:'I want to use AI with confidence.'}})
  fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}))
  await waitFor(()=>expect(screen.getByText('Saved',{exact:true})).not.toBeNull())
  const fieldId=input.id
  fireEvent.change(screen.getByLabelText('Choose a page'),{target:{value:'6'}})
  fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}))
  await waitFor(()=>expect(record.last_page).toBe(6))
  first.unmount();render(<Workbook />)
  await waitFor(()=>expect((screen.getByLabelText('Choose a page') as HTMLSelectElement).value).toBe('6'))
  fireEvent.change(screen.getByLabelText('Choose a page'),{target:{value:'5'}})
  expect((document.getElementById(fieldId) as HTMLTextAreaElement).value).toBe('I want to use AI with confidence.')
  expect(request.mock.calls.every(([url])=>url==='/api/academy/workbooks/journey-one')).toBe(true)
})

it.each([[1,5],[2,9],[3,13],[4,17],[5,21],[6,25]])('opens lesson 1.%i at its workbook section without losing saved answers',async(lessonNumber,pageNumber)=>{
  const record={answers:{[`field-${pageNumber}`]:'My saved work'},last_page:6,revision:3,updated_at:'2026-09-10T00:00:00Z',allowedPages:Array.from({length:32},(_,i)=>i+1),scope:'owner-review',workbook:{key:'journey-one',version:1,title:'Workbook test fixture',pages:Array.from({length:32},(_,i)=>({number:i+1,kicker:'Practice',title:`Practice page ${i+1}`,blocks:[{type:'field',id:`field-${i+1}`,label:'My answer'}]}))}}
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  const view=render(<StrictMode><Workbook lessonId={`1.${lessonNumber}`} /></StrictMode>)
  await screen.findByRole('heading',{level:1,name:`Practice page ${pageNumber}`})
  expect((screen.getByRole('textbox',{name:'My answer'}) as HTMLTextAreaElement).value).toBe('My saved work')
  view.unmount()
})

it('does not open a workbook section outside the account’s allowed pages',async()=>{
  const record={answers:{},last_page:5,revision:0,updated_at:null,allowedPages:[5],scope:'learner-test',workbook:{key:'journey-one',version:1,title:'Workbook test fixture',pages:[{number:5,kicker:'Practice',title:'Available section',blocks:[]}]}}
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  const view=render(<Workbook lessonId="1.6" />)
  await screen.findByRole('heading',{level:1,name:'Available section'})
  expect((screen.getByLabelText('Choose a page') as HTMLSelectElement).value).toBe('5')
  view.unmount()
})


it('opens and saves the third workbook through its own endpoint with compact fields',async()=>{
  let record={answers:{} as Record<string,string>,last_page:1,revision:0,updated_at:null as string|null,allowedPages:[1,2,3,4,5,6],scope:'owner-review',workbook:{key:'journey-three',version:1,title:'Separate workbook',navigationLabel:'Third workbook',subtitle:'Opening practice',pageCount:6,contents:[{page:1,text:'First practice'}],pages:[{number:1,kicker:'Practice',title:'First practice',blocks:[{type:'field',id:'third-name',label:'Name',compact:true}]}]}}
  const request=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{
    if(init?.method==='PATCH'){const p=JSON.parse(init.body as string);record={...record,answers:p.answers,revision:1,updated_at:'2026-09-10T00:00:00Z'}}
    return {ok:true,json:async()=>structuredClone(record)} as Response
  })
  render(<Workbook workbookKey="journey-three" lessonId="3.1" />)
  await screen.findByRole('heading',{name:'First practice',level:1})
  expect(screen.getByText('Page 1 of 6')).toBeTruthy()
  const input=screen.getByRole('textbox',{name:'Name'}) as HTMLTextAreaElement
  expect(input.rows).toBe(1)
  fireEvent.change(input,{target:{value:'Practice learner'}})
  fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}))
  await waitFor(()=>expect(screen.getByText('Saved',{exact:true})).toBeTruthy())
  expect(record.answers['third-name']).toBe('Practice learner')
  expect(request.mock.calls.every(([url])=>url==='/api/academy/workbooks/journey-three')).toBe(true)
})


it('lesson 3.2 opens its Task and Context section and preserves existing responses',async()=>{
  const record={answers:{'j32-task':'Plan two dinners','j3-first-prompt':'Keep earlier work'},last_page:2,revision:3,updated_at:'2026-09-10T00:00:00Z',allowedPages:[1,2,3,4,5,6,7,8,9,10],scope:'owner-review',workbook:{key:'journey-three',version:2,title:'Journey Three workbook',navigationLabel:'Journey Three workbook',pageCount:10,contents:[{page:7,text:'Task and Context'}],pages:[{number:2,kicker:'Practice',title:'Earlier work',blocks:[]},{number:7,kicker:'Task and Context',title:'Start with the task',blocks:[{type:'field',id:'j32-task',label:'My task'}]}]}}
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  render(<Workbook workbookKey="journey-three" lessonId="3.2" />)
  await screen.findByRole('heading',{level:1,name:'Start with the task'})
  expect((screen.getByRole('textbox',{name:'My task'}) as HTMLTextAreaElement).value).toBe('Plan two dinners')
  expect(screen.getByText('Page 7 of 10')).toBeTruthy()
})

it('lesson 3.4 opens page 15 with its saved answers',async()=>{
  const record={answers:{'third-15':'My boundary'},last_page:11,revision:4,updated_at:'2026-09-11T00:00:00Z',allowedPages:Array.from({length:18},(_,i)=>i+1),scope:'owner-review',workbook:{key:'journey-three',version:4,title:'Journey Three workbook',navigationLabel:'Journey Three workbook',pageCount:18,contents:[{page:15,text:'Boundaries'}],pages:[{number:11,kicker:'Practice',title:'Earlier lesson',blocks:[]},{number:15,kicker:'Boundaries',title:'Lesson 3.4 practice',blocks:[{type:'field',id:'third-15',label:'Boundary'}]}]}}
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  render(<Workbook workbookKey="journey-three" lessonId="3.4" />)
  await screen.findByRole('heading',{level:1,name:'Lesson 3.4 practice'})
  expect((screen.getByLabelText('Boundary') as HTMLTextAreaElement).value).toBe('My boundary')
  expect(screen.getByText('Page 15 of 18')).toBeTruthy()
})

it('lesson 3.3 opens page 11 with its saved answers',async()=>{
  const record={answers:{'third-11':'My reader','third-7':'Earlier response'},last_page:7,revision:3,updated_at:'2026-09-10T00:00:00Z',allowedPages:Array.from({length:14},(_,i)=>i+1),scope:'owner-review',workbook:{key:'journey-three',version:3,title:'Journey Three workbook',navigationLabel:'Journey Three workbook',pageCount:14,contents:[{page:11,text:'Format and Tone'}],pages:[{number:7,kicker:'Practice',title:'Earlier lesson',blocks:[]},{number:11,kicker:'Format and Tone',title:'Lesson 3.3 practice',blocks:[{type:'field',id:'third-11',label:'Reader'}]}]}}
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  render(<Workbook workbookKey="journey-three" lessonId="3.3" />)
  await screen.findByRole('heading',{level:1,name:'Lesson 3.3 practice'})
  expect((screen.getByRole('textbox',{name:'Reader'}) as HTMLTextAreaElement).value).toBe('My reader')
  expect(screen.getByText('Page 11 of 14')).toBeTruthy()
})

it('lesson 3.5 opens page 19 with its saved answers',async()=>{
  const record={answers:{'third-19':'My boundary'},last_page:11,revision:4,updated_at:'2026-09-11T00:00:00Z',allowedPages:Array.from({length:22},(_,i)=>i+1),scope:'owner-review',workbook:{key:'journey-three',version:4,title:'Journey Three workbook',navigationLabel:'Journey Three workbook',pageCount:22,contents:[{page:19,text:'Boundaries'}],pages:[{number:11,kicker:'Practice',title:'Earlier lesson',blocks:[]},{number:19,kicker:'Boundaries',title:'Lesson 3.5 practice',blocks:[{type:'field',id:'third-19',label:'Boundary'}]}]}}
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  render(<Workbook workbookKey="journey-three" lessonId="3.5" />)
  await screen.findByRole('heading',{level:1,name:'Lesson 3.5 practice'})
  expect((screen.getByLabelText('Boundary') as HTMLTextAreaElement).value).toBe('My boundary')
  expect(screen.getByText('Page 19 of 22')).toBeTruthy()
})

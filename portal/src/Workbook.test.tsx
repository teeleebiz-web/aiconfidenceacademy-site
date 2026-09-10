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

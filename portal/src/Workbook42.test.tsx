import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Workbook } from '../../academy/workbook/Workbook'
const auth=vi.hoisted(()=>({getSession:vi.fn(async()=>({data:{session:null}})),onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}}))}))
vi.mock('./lib/supabase',()=>({supabase:{auth}}))
afterEach(()=>vi.restoreAllMocks())

it('4.2 opens its workbook at page 5 with the saved purpose and a compact date field',async()=>{
  const record={answers:{'j42-purpose':'Share practical experience'},last_page:2,revision:3,updated_at:null,allowedPages:[1,2,3,4,5,6,7,8],scope:'owner-review',workbook:{key:'journey-four',version:2,title:'Journey Four Workbook',pageCount:8,contents:[{page:5,text:'Begin with your purpose'}],pages:[{number:2,kicker:'Practice',title:'Earlier work',blocks:[]},{number:5,kicker:'Purpose and Ask Plainly',title:'Begin with your purpose',blocks:[{type:'field',id:'j42-purpose',label:'Why this work matters to me'},{type:'field',id:'j42-date',label:'Date',compact:true}]}]}}
  const request=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>structuredClone(record)} as Response)
  render(<StrictMode><Workbook workbookKey="journey-four" lessonId="4.2" /></StrictMode>)
  await screen.findByRole('heading',{level:1,name:'Begin with your purpose'})
  expect((screen.getByLabelText('Why this work matters to me') as HTMLTextAreaElement).value).toBe('Share practical experience')
  expect((screen.getByLabelText('Date') as HTMLTextAreaElement).rows).toBe(1)
  expect(screen.getByText('Page 5 of 8')).toBeTruthy()
  expect(request.mock.calls.every(([url])=>url==='/api/academy/workbooks/journey-four')).toBe(true)
})

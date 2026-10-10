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
  expect([...chooser.options].find(x => x.value === '3')?.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Previous lesson/ }))
  expect(await screen.findByDisplayValue('Earlier people map')).toBeTruthy()
  fireEvent.change(chooser, { target: { value: '2' } })
  expect(await screen.findByDisplayValue('Simulated listening summary')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Back to Lesson 3.2/ }))
  expect(onBack).toHaveBeenCalledOnce()
})

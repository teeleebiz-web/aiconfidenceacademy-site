import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import { PhaseTwoWorkbook } from './PhaseTwoWorkbook'
import { PhaseTwoExceptionPractice } from './PhaseTwoExceptionPractice'
import { PhaseTwoEvidenceGuidance, type PhaseTwoStrengthening } from './PhaseTwoEvidenceGuidance'
import { supabase } from '../lib/supabase'

const repair={label:'Supplied fictional repair exercise',setup:'Keep project and supplied results separate.',input:'20 received; 12 resolved; no timing or approval.',faulty_artifact:'All 20 resolved on time. Send now.',task:'Repair, inspect and retest the same record.'}

it('keeps saved detailed answers visible and editable while offering concise evidence without unlocking later lessons',async()=>{
  const data={answers:{old:'My retained test result'},last_page:1,revision:4,allowedPages:[1],scope:'owner-review',updated_at:null,
    workbook:{key:'p2-j1',version:2,title:'Journey One',pages:[{number:1,title:'Current lesson',blocks:[
      {type:'field',id:'concise',label:'Required work and reference',display_group:'concise',lines:4},
      {type:'field',id:'old',label:'Earlier test',display_group:'detail',lines:4}]}]}}
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  const back=vi.fn();render(<PhaseTwoWorkbook journey={1} initialLesson={1} onBack={back}/>)
  expect(await screen.findByDisplayValue('My retained test result')).toBeTruthy()
  const detail=screen.getByText('Study instructions and earlier detailed notes').closest('details')!
  expect(detail.open).toBe(true)
  fireEvent.change(screen.getByLabelText('Required work and reference'),{target:{value:'Project Record section A version 4'}})
  expect(screen.getByDisplayValue('My retained test result')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Earlier test'),{target:{value:'Original test plus reviewed correction'}})
  expect(screen.getByDisplayValue('Original test plus reviewed correction')).toBeTruthy()
  const chooser=screen.getByLabelText('Choose a released lesson') as HTMLSelectElement
  expect([...chooser.options].slice(1).every(x=>x.disabled)).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:/Back to Lesson/}));expect(back).toHaveBeenCalledOnce()
})

it('starts with four concise fields, keeps unsaved detail folded and retains saved work in the study download',async()=>{
  const data={answers:{},last_page:1,revision:0,allowedPages:[1],scope:'owner-review',updated_at:null,
    workbook:{key:'p2-j1',version:2,title:'Journey One',pages:[{number:1,title:'Current lesson',blocks:[
      ...['Work','Decision','Check','Limit'].map((label,i)=>({type:'field',id:'c'+i,label,display_group:'concise'})),
      {type:'field',id:'old',label:'Earlier detail',display_group:'detail'}]}]}}
  vi.spyOn(supabase,'rpc').mockResolvedValue({data,error:null} as never)
  render(<PhaseTwoWorkbook journey={1} initialLesson={1} onBack={()=>{}}/>)
  await screen.findByLabelText('Work')
  expect(screen.getByText('Study instructions and earlier detailed notes').closest('details')).toHaveProperty('open',false)
  fireEvent.change(screen.getByLabelText('Work'),{target:{value:'Retained concise reference'}})
  fireEvent.click(screen.getByText('Study instructions and earlier detailed notes'))
  fireEvent.change(screen.getByLabelText('Earlier detail'),{target:{value:'Retained earlier explanation'}})
  const blobs:Blob[]=[]
  vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn((b:Blob)=>{blobs.push(b);return 'blob:copy'}),revokeObjectURL:vi.fn()}))
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
  fireEvent.click(screen.getByRole('button',{name:'Download study copy'}))
  const reader=new FileReader();const text=await new Promise<string>(resolve=>{reader.onload=()=>resolve(String(reader.result));reader.readAsText(blobs[0])})
  expect(text).toContain('Retained concise reference');expect(text).toContain('Retained earlier explanation')
  expect(text).not.toContain('Lesson 2:')
})

it('does not turn evidence guidance or a supplied repair selection into an automatic passing result',()=>{
  render(<PhaseTwoExceptionPractice approvedAiRequest="Inspect [brief]" repairCase={repair}/>)
  fireEvent.change(screen.getByLabelText('Source of the correction evidence'),{target:{value:'supplied_exercise'}})
  expect(screen.getByText('All 20 resolved on time. Send now.')).toBeTruthy()
  const record=screen.getByLabelText('Lesson 2.6 test record') as HTMLTextAreaElement
  const e=JSON.parse(record.value)
  expect(e.repair_source).toBe('supplied_exercise')
  expect(e.supplied_exercise_proves_project_failure).toBe(false)
  expect(e.draft.failure).toBe('');expect(e.draft.retest).toBe('')
  expect(screen.queryByRole('button',{name:/complete journey|issue credential/i})).toBeNull()
})

it('shows the independent scenario and preserves the human credential boundary without exposing an answer key',()=>{
  const g={version:'2.1',lesson_id:'5.2',heading:'What acceptable evidence looks like',criteria:['Actual source and human judgment'],focus_evidence:['Retained work'],acceptable_example:'A complete reference',workload_guidance:'Do the work once',pacing_guidance:'Use planned independent work',framework_guidance:'Use full names',revision_guidance:'Correct the gap',credential_boundary:'Only the authorized human reviewer decides credentials.',independent_check:{scenario:'A new conflicting record',question:'Which claim must be checked?',instruction:'Answer before asking AI.'}} satisfies PhaseTwoStrengthening
  render(<PhaseTwoEvidenceGuidance guidance={g}/>)
  expect(screen.getByText('A new conflicting record')).toBeTruthy()
  expect(screen.getByText('Answer before asking AI.')).toBeTruthy()
  expect(screen.getByText('Only the authorized human reviewer decides credentials.')).toBeTruthy()
  expect(screen.queryByRole('button',{name:/pass|approve|credential/i})).toBeNull()
})

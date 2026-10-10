import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { WorkbookStore, type Transport } from '../../../academy/workbook/store'
import '../../../academy/workbook/workbook.css'
import './phaseTwoWorkbook.css'

type Block = { type: string; id?: string; text?: string; title?: string; theme?: string; label?: string; hint?: string; lines?: number }
const approvedTitles: Record<number, string[]> = {
  1: ['Professional AI Judgment and Direction','Find the Need and Establish the Evidence',
      'Select AI Roles and Define Business Value','Direct Professional Requests and Decision Support',
      'Scope a Solution and a Project Worth Completing','Stress Test the Professional Operating Model'],
}

function transportFor(enrollmentId: string | null, journey: number): Transport {
  const read = async () => {
    const { data, error } = await supabase.rpc('get_aca_phase_two_workbook', {
      p_enrollment_id: enrollmentId, p_journey: journey,
    })
    if (error || !data?.workbook) throw new Error('Your released workbook could not load. Please try again.')
    return data
  }
  return async (method, patch) => {
    if (method === 'GET') return read()
    if (!enrollmentId || !patch) throw new Error('Owner review is read-only.')
    const { error } = await supabase.rpc('save_aca_phase_two_workbook', {
      p_enrollment_id: enrollmentId, p_journey: journey,
      p_page: patch.page, p_base_revision: patch.baseRevision, p_answers: patch.answers,
    })
    if (error) {
      if (/revision|changed in another session/i.test(error.message)) {
        throw Object.assign(new Error('Another window saved newer workbook work. Reload before saving.'), { status:409 })
      }
      throw new Error('Your workbook answers could not be saved. Please try again.')
    }
    return read()
  }
}

function buildStudyCopy(title: string, pages: Array<{number:number;title:string;blocks:Block[]}>, answers:Record<string,string>) {
  return [
    '# AI CONFIDENCE ACADEMY — PHASE TWO',
    '# ' + title,
    'Released lesson material and your saved notes only. Future lesson content is not included.',
    ...pages.flatMap(page => [
      '',
      '## Lesson ' + page.number + ': ' + page.title,
      ...page.blocks.flatMap(block =>
        block.type === 'heading' ? ['', '### '+block.text]
        : block.type === 'note' ? ['', '**'+block.title+'**', block.text??'']
        : block.type === 'text' ? ['',block.text??'']
        : block.type === 'field' ? ['', '**'+block.label+'**',
            block.hint??'', answers[block.id??''] || '(Your notes)']
        : [])
    ]),
    '',
    'AI assists. Humans verify.',
  ].join('\n')
}

export function PhaseTwoWorkbook({ enrollmentId, journey, initialLesson, onBack }: {
  enrollmentId?: string
  journey: number
  initialLesson?: number
  onBack: () => void
}) {
  const transport = useMemo(() => transportFor(enrollmentId ?? null,journey),[enrollmentId,journey])
  const store = useMemo(() => new WorkbookStore(transport),[transport])
  const state = useSyncExternalStore(store.subscribe,store.snapshot)
  const [notice,setNotice] = useState('')
  useEffect(() => {
    void store.load(initialLesson)
    return () => store.dispose()
  },[store,initialLesson])
  useEffect(() => {
    if (!enrollmentId) return
    const handleHidden=()=>{ if (document.visibilityState==='hidden') void store.save() }
    const handleUnload=(event:BeforeUnloadEvent)=>{
      if (store.pending) { void store.save(); event.preventDefault() }
    }
    document.addEventListener('visibilitychange',handleHidden)
    window.addEventListener('beforeunload',handleUnload)
    return () => {
      document.removeEventListener('visibilitychange',handleHidden)
      window.removeEventListener('beforeunload',handleUnload)
    }
  },[store,enrollmentId])
  const page=state.workbook?.pages.find(p=>p.number===state.last_page)
  const released=state.workbook?.pages ?? []
  const titles=approvedTitles[journey] ?? []
  const goBack=async()=>{
    if(enrollmentId && store.pending) {
      await store.save()
      if(store.pending) { setNotice('Please save your workbook answers before leaving.'); return }
    }
    onBack()
  }
  const download=()=>{
    if(!state.workbook)return
    const text=buildStudyCopy(state.workbook.title,released as Array<{number:number;title:string;blocks:Block[]}>,state.answers)
    const blob=new Blob([text],{type:'text/markdown;charset=utf-8'})
    const href=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=href; a.download='ACA-Phase-Two-Journey-'+journey+'-Released-Workbook.md'
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(href)
    setNotice('Your downloadable study copy includes only released lessons.')
  }
  const move=(lesson:number)=>store.page(lesson)
  if(state.status==='loading') return <main className="wb-shell"><p role="status">Opening your Phase Two workbook…</p></main>
  if(!state.workbook||!page) return <main className="wb-shell">
    <p role="alert">{state.message || 'This workbook is not available yet.'}</p>
    <button type="button" onClick={onBack}>Back to learning</button>
  </main>
  return <main className="wb-shell p2-workbook" aria-label="Phase Two released workbook">
    <div className="wb-toolbar">
      <button className="wb-back p2-workbook-back" type="button" onClick={()=>void goBack()}>← Back to {initialLesson?'Lesson '+journey+'.'+initialLesson:'My Workbooks'}</button>
      <div className="wb-save">
        <span role="status">{enrollmentId ? state.status==='saved'?'Saved':state.status==='saving'?'Saving…':state.status==='unsaved'?'Changes to save':'Save needed' : 'Founder preview — read only'}</span>
        <button type="button" className="wb-print" onClick={()=>window.print()}>Print / Save PDF</button>
        <button type="button" onClick={download}>Download study copy</button>
        {enrollmentId && <button type="button" disabled={state.status==='saving'} onClick={()=>void store.save()}>Save</button>}
      </div>
    </div>
    {notice&&<p role="status">{notice}</p>}
    {state.message&&<p className="wb-error" role="alert">{state.message}</p>}
    <div className="wb-layout">
      <nav className="wb-navigation" aria-label={'Journey '+journey+' released workbook lessons'}>
        <p className="wb-eyebrow">AI Confidence Academy · Phase Two</p>
        <h2>Journey {journey} Workbook</h2>
        <label htmlFor="p2-wb-lesson">Choose a released lesson</label>
        <select id="p2-wb-lesson" value={page.number} onChange={e=>move(Number(e.target.value))}>
          {Array.from({length:6},(_,i)=>i+1).map(n=><option key={n} value={n} disabled={!state.allowedPages.includes(n)}>
            {journey}.{n} · {titles[n-1]??'Upcoming lesson'}{state.allowedPages.includes(n)?'':' — Locked'}
          </option>)}
        </select>
        <p>Previously released lessons remain available to study even after their teaching window ends. Upcoming lessons remain locked.</p>
        <div className="wb-chapters">
          {Array.from({length:6},(_,i)=>i+1).map(n=><button key={n} type="button" aria-current={page.number===n?'page':undefined}
            disabled={!state.allowedPages.includes(n)} onClick={()=>move(n)}>
            <strong>Lesson {journey}.{n}</strong>
            <span>{titles[n-1]??'Upcoming lesson'}{state.allowedPages.includes(n)?'':' · Locked'}</span>
          </button>)}
        </div>
      </nav>
      <article className="wb-paper" aria-label={'Workbook Lesson '+journey+'.'+page.number}>
        <header className="wb-page-hero">
          <p className="wb-eyebrow">Journey {journey} · Lesson {journey}.{page.number}</p>
          <h1>{page.title}</h1>
          <p>Study, reflect, and keep your evidence. AI assists. Humans verify.</p>
        </header>
        <div className="wb-page-body">
          {(page.blocks as Block[]).map((b,i)=>
            b.type==='heading'?<h2 key={i} className="wb-section-title">{b.text}</h2>
            :b.type==='text'?<p key={i} className="wb-copy">{b.text}</p>
            :b.type==='note'?<aside key={i} className="wb-note"><h2>{b.title}</h2><p>{b.text}</p></aside>
            :b.type==='field'&&b.id?<div key={b.id} className="wb-answer">
              <label htmlFor={b.id}>{b.label}</label>
              {b.hint&&<p className="wb-hint">{b.hint}</p>}
              <textarea id={b.id} rows={b.lines??4} maxLength={4000}
                readOnly={!enrollmentId}
                value={state.answers[b.id]??''}
                onChange={e=>store.change(b.id!,e.target.value)}
                placeholder={enrollmentId?'Write your notes here…':'Owner preview — editable answers require learner enrollment'} />
              <div className="p2-wb-print-answer">{state.answers[b.id]||'Notes: ___________________________________________________'}</div>
            </div>:null)}
        </div>
        <footer className="wb-page-footer"><span>AI assists. Humans verify.</span><span>Lesson {journey}.{page.number} · Released material</span></footer>
        <div className="wb-page-actions">
          <button type="button" className="wb-secondary" disabled={!state.allowedPages.includes(page.number-1)} onClick={()=>move(page.number-1)}>Previous lesson</button>
          <button type="button" disabled={!state.allowedPages.includes(page.number+1)} onClick={()=>move(page.number+1)}>
            {state.allowedPages.includes(page.number+1)?'Next released lesson →':'Next lesson locked'}
          </button>
        </div>
      </article>
    </div>
  </main>
}

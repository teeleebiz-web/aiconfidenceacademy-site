import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { supabase } from '../../portal/src/lib/supabase'
import sealUrl from '../../aca-official-seal.png'
import { WorkbookStore, type RecordState, type Transport } from './store'
import './workbook.css'

type Block = { type: string; compact?: boolean; id?: string; label?: string; hint?: string; lines?: number; text?: string; title?: string; intro?: string; theme?: string; page?: number; items?: Block[]; headers?: string[]; rows?: { label: string; fields: Block[] }[] }
const dateFields = new Set(['p02-f002', 'p05-f003', 'p09-f016', 'p13-f035', 'p17-f047', 'p21-f059', 'p25-f075', 'p31-f089', 'p32-f094', 'j3-date'])
const shortAnswerFields = new Set([...dateFields, 'p02-f001', 'p05-f004', 'p09-f017', 'p31-f090', 'p32-f095'])
const makeTransport = (workbookKey: string): Transport => async (method, patch): Promise<RecordState> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (patch && patch.scope !== (session?.user.id ?? 'owner-review')) throw new Error('Your Academy account changed. Reopen your workbook before continuing.')
  const body = patch ? JSON.stringify({ answers: patch.answers, page: patch.page, baseRevision: patch.baseRevision }) : undefined
  const response = await fetch('/api/academy/workbooks/' + workbookKey, {
    method, cache: 'no-store', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-ACA-Workbook': '1', ...(session ? { 'X-ACA-Access-Token': session.access_token } : {}) },
    body, keepalive: !!body && new TextEncoder().encode(body).length < 60000,
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error ?? 'Your workbook could not save. Please try again.'), { status: response.status, current: result.current })
  return result
}

type WorkbookKey = 'journey-one' | 'journey-two' | 'journey-three' | 'journey-four' | 'journey-five' | 'journey-six'
const lessonStartPages: Record<WorkbookKey, number[]> = {
  'journey-one': [5, 9, 13, 17, 21, 25],
  'journey-two': [1, 5, 9, 13, 17, 21],
  'journey-three': [1, 7, 11, 15, 19, 23],
  'journey-four': [1, 5, 9, 13, 17, 21],
  'journey-five': [1, 5, 9, 13, 17, 21],
  'journey-six': [1, 5, 9, 13, 17, 21],
}
const journeyNumbers: Record<WorkbookKey, number> = { 'journey-one': 1, 'journey-two': 2, 'journey-three': 3, 'journey-four': 4, 'journey-five': 5, 'journey-six': 6 }
export const workbookOpeningPage = (workbookKey: WorkbookKey, lessonId?: string | null) => {
  const journeyNumber = journeyNumbers[workbookKey]
  const match = lessonId?.match(/^(\d)\.([1-6])$/)
  if (!match || Number(match[1]) !== journeyNumber) return undefined
  return lessonStartPages[workbookKey][Number(match[2]) - 1]
}

export function Workbook({ lessonId, workbookKey = 'journey-one' }: { lessonId?: string | null; workbookKey?: WorkbookKey }) {
  const transport = useMemo(() => makeTransport(workbookKey), [workbookKey])
  const [store, setStore] = useState(() => new WorkbookStore(transport))
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const openingPage = workbookOpeningPage(workbookKey, lessonId)
  useEffect(() => {
    void store.load(openingPage)
    return () => store.dispose()
  }, [store, openingPage])
  useEffect(() => {
    let previous: string | null | undefined
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null
      if (previous !== undefined && previous !== id) setStore(new WorkbookStore(transport))
      previous = id
    })
    return () => subscription.subscription.unsubscribe()
  }, [transport])
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => { if (store.pending) { void store.save(); event.preventDefault(); event.returnValue = '' } }
    const hiding = () => { if (document.visibilityState === 'hidden') void store.save() }
    window.addEventListener('beforeunload', leaving); document.addEventListener('visibilitychange', hiding)
    return () => { window.removeEventListener('beforeunload', leaving); document.removeEventListener('visibilitychange', hiding) }
  }, [store])
  const data = state.workbook
  const page = data?.pages.find(p => p.number === state.last_page)
  const journeyNumber = journeyNumbers[workbookKey]
  const lessonStarts = lessonStartPages[workbookKey]
  const currentLessonStart = lessonStarts.find((start, index) => state.last_page >= start && state.last_page < (lessonStarts[index + 1] ?? Number.POSITIVE_INFINITY)) ?? lessonStarts[0]
  const lessonLinks = lessonStarts.map((start, index) => ({
    page: start,
    lesson: `${journeyNumber}.${index + 1}`,
    title: data?.pages.find(item => item.number === start)?.title ?? `Lesson ${journeyNumber}.${index + 1}`,
  }))
  const move = (number: number) => {
    store.page(number)
    window.scrollTo({ top: 0, behavior: 'instant' })
    requestAnimationFrame(() => titleRef.current?.focus())
  }
  const render = (block: Block, i: number): React.ReactNode => {
    if (block.type === 'field') return <div className={`wb-answer${block.compact || shortAnswerFields.has(block.id!) ? ' wb-answer-compact' : ''}${dateFields.has(block.id!) ? ' wb-answer-date' : ''}`} key={block.id}>
      <label htmlFor={block.id}>{block.label}</label>
      {block.hint && <p className="wb-hint" id={`${block.id}-hint`}>{block.hint}</p>}
      <textarea id={block.id} aria-describedby={block.hint ? `${block.id}-hint` : undefined} rows={block.compact || shortAnswerFields.has(block.id!) ? 1 : Math.max(3, block.lines ?? 3)} maxLength={4000} value={state.answers[block.id!] ?? ''} onChange={e => store.change(block.id!, e.target.value)} />
    </div>
    if (block.type === 'heading') return <h2 className="wb-section-title" key={i}>{block.text}</h2>
    if (block.type === 'text') return <p className="wb-copy" key={i}>{block.text}</p>
    if (block.type === 'link') return <button className="wb-contents-link" disabled={!state.allowedPages.includes(block.page!)} onClick={() => move(block.page!)} key={i}><span>{block.text}</span><span>Page {block.page}</span></button>
    if (block.type === 'note') return <aside className={`wb-note wb-note-${block.theme}`} key={i}><h2>{block.title}</h2><p>{block.text}</p></aside>
    if (block.type === 'grid') return <div className="wb-grid" key={i}>{block.items!.map(render)}</div>
    if (block.type === 'check') return <section className="wb-check" key={i}><h2>{block.title}</h2>{block.intro && <p>{block.intro}</p>}{block.items!.map(render)}</section>
    if (block.type === 'comparison') return <div className="wb-comparison" key={i}>{block.rows!.map(row => <section key={row.label}><h2>{row.label}</h2>{row.fields.map(render)}</section>)}</div>
    return null
  }
  if (state.status === 'loading') return <main className="wb-shell"><p role="status">Opening your workbook…</p></main>
  if (!state.scope) return <main className="wb-shell"><p role="alert">{state.message}</p><button onClick={() => void store.load()}>Try again</button></main>
  if (!data || !page) return <main className="wb-shell"><p role="alert">Your workbook could not be opened. Please reload this page.</p></main>
  return <main className="wb-shell">
    <div className="wb-toolbar">
      <a className="wb-back" href="/academy/phase-one/" onClick={async event => { event.preventDefault(); await store.save(); if (!store.pending) window.location.assign('/academy/phase-one/') }}>← Back to Phase One</a>
      <div className="wb-save"><span role="status" aria-live="polite">{state.status === 'saved' ? (state.updated_at ? 'Saved' : 'Ready for your answers') : state.status === 'saving' ? 'Saving…' : state.status === 'error' || state.status === 'conflict' ? 'Not saved yet' : 'Changes to save'}</span><button className="wb-print" type="button" onClick={() => window.print()}>Print / Save PDF</button><button disabled={state.status === 'saving'} onClick={() => void store.save()}>Save</button></div>
    </div>
    {state.message && <p className="wb-error" role="alert">{state.message}</p>}
    <div className="wb-layout">
      <nav className="wb-navigation" aria-label={`Journey ${journeyNumber} workbook lessons`}><p className="wb-eyebrow">{data.navigationLabel ?? 'Journey One workbook'}</p><label htmlFor="wb-page-select">Choose a lesson</label><select id="wb-page-select" value={currentLessonStart} onChange={e => move(Number(e.target.value))}>{lessonLinks.map(item => <option key={item.lesson} value={item.page} disabled={!state.allowedPages.includes(item.page)}>{item.lesson}. {item.title}</option>)}</select><p>Your answers save as you write. You can also select Save.</p><div className="wb-chapters">{lessonLinks.map(item => <button key={item.lesson} onClick={() => move(item.page)} disabled={!state.allowedPages.includes(item.page)} aria-current={currentLessonStart === item.page ? 'page' : undefined}><strong>Lesson {item.lesson}</strong><span>{item.title}</span></button>)}</div></nav>
      <article className="wb-paper" aria-label={`Workbook page ${page.number}`}>
        <header className="wb-page-hero"><p className="wb-eyebrow">{page.kicker.replaceAll('  /  ', ' · ')}</p><h1 ref={titleRef} tabIndex={-1}>{page.title}</h1>{page.number === 1 && <><img src={sealUrl} alt="AI Confidence Academy seal" /><p>{data.subtitle ?? 'Learner Workbook and Practice Log · Lessons 1.1–1.6'}</p></>}</header>
        <div className="wb-page-body">{page.blocks.map((block, i) => render(block as Block, i))}</div>
        <footer className="wb-page-footer"><span>AI Assists. Humans Verify.</span><span>Page {page.number} of {data.pageCount ?? 32}</span></footer>
        <div className="wb-page-actions"><button className="wb-secondary" disabled={!state.allowedPages.includes(page.number-1)} onClick={() => move(page.number-1)}>Previous page</button><button disabled={!state.allowedPages.includes(page.number+1)} onClick={() => move(page.number+1)}>Next page →</button></div>
      </article>
    </div>
  </main>
}

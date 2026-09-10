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

export function Workbook({ lessonId, workbookKey = 'journey-one' }: { lessonId?: string | null; workbookKey?: 'journey-one' | 'journey-three' }) {
  const transport = useMemo(() => makeTransport(workbookKey), [workbookKey])
  const [store, setStore] = useState(() => new WorkbookStore(transport))
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const openingPage = workbookKey === 'journey-three' ? (lessonId === '3.1' ? 1 : lessonId === '3.2' ? 7 : undefined) : /^1\.[1-6]$/.test(lessonId ?? '') ? 5 + (Number(lessonId!.split('.')[1]) - 1) * 4 : undefined
  useEffect(() => {
    let active = true
    void store.load().then(() => {
      if (active && openingPage !== undefined && store.state.last_page !== openingPage) store.page(openingPage)
    })
    return () => { active = false; store.dispose() }
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
      <div className="wb-save"><span role="status" aria-live="polite">{state.status === 'saved' ? (state.updated_at ? 'Saved' : 'Ready for your answers') : state.status === 'saving' ? 'Saving…' : state.status === 'error' || state.status === 'conflict' ? 'Not saved yet' : 'Changes to save'}</span><button disabled={state.status === 'saving'} onClick={() => void store.save()}>Save</button></div>
    </div>
    {state.message && <p className="wb-error" role="alert">{state.message}</p>}
    <div className="wb-layout">
      <nav className="wb-navigation" aria-label="Workbook pages"><p className="wb-eyebrow">{data.navigationLabel ?? 'Journey One workbook'}</p><label htmlFor="wb-page-select">Choose a page</label><select id="wb-page-select" value={state.last_page} onChange={e => move(Number(e.target.value))}>{data.pages.map(p => <option key={p.number} value={p.number} disabled={!state.allowedPages.includes(p.number)}>{p.number}. {p.title}</option>)}</select><p>Your answers save as you write. You can also select Save.</p><div className="wb-chapters">{(data.contents ?? [{ page:2, text:'Your workbook guide' }, ...[1,2,3,4,5,6].map(n => ({ page:5+(n-1)*4, text:`${n}. ${data.pages.find(p => p.number === 5+(n-1)*4)?.title ?? 'Lesson available later'}` })),{ page:29, text:'Self Check Guide' },{ page:31, text:'Practice Log' }]).map(item => <button key={item.page} onClick={() => move(item.page)} disabled={!state.allowedPages.includes(item.page)} aria-current={(workbookKey === 'journey-three' ? state.last_page === item.page : state.last_page >= item.page && state.last_page < (item.page <= 25 && item.page >= 5 ? item.page+4 : item.page+2)) ? 'page' : undefined}>{item.text}</button>)}</div></nav>
      <article className="wb-paper" aria-label={`Workbook page ${page.number}`}>
        <header className="wb-page-hero"><p className="wb-eyebrow">{page.kicker.replaceAll('  /  ', ' · ')}</p><h1 ref={titleRef} tabIndex={-1}>{page.title}</h1>{page.number === 1 && <><img src={sealUrl} alt="AI Confidence Academy seal" /><p>{data.subtitle ?? 'Learner Workbook and Practice Log · Lessons 1.1–1.6'}</p></>}</header>
        <div className="wb-page-body">{page.blocks.map((block, i) => render(block as Block, i))}</div>
        <footer className="wb-page-footer"><span>AI Assists. Humans Verify.</span><span>Page {page.number} of {data.pageCount ?? 32}</span></footer>
        <div className="wb-page-actions"><button className="wb-secondary" disabled={!state.allowedPages.includes(page.number-1)} onClick={() => move(page.number-1)}>Previous page</button><button disabled={!state.allowedPages.includes(page.number+1)} onClick={() => move(page.number+1)}>Next page →</button></div>
      </article>
    </div>
  </main>
}

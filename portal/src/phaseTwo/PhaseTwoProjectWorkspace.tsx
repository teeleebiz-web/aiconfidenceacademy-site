import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PHASE_TWO_EVIDENCE_SECTIONS,
  loadPhaseTwoProject,
  loadPhaseTwoRevisionHistory,
  savePhaseTwoProjectUpdate,
  type PhaseTwoProjectPath,
  type PhaseTwoProjectSection,
} from './phaseTwoProject'
import './phaseTwoProjectWorkspace.css'

type SaveState = 'loading' | 'ready' | 'dirty' | 'saving' | 'saved' | 'error'
type Revision = { version_number: number; decision_note: string | null; created_at: string }

function readText(section: unknown) {
  if (section && typeof section === 'object' && 'text' in section) {
    return typeof section.text === 'string' ? section.text : ''
  }
  return ''
}

/**
 * One continuing project record. This component is staged for later enrollment
 * integration. It does not award completion credit and cannot publish work.
 */
export function PhaseTwoProjectWorkspace({ enrollmentId }: { enrollmentId: string }) {
  const [path, setPath] = useState<PhaseTwoProjectPath | ''>('')
  const [title, setTitle] = useState('')
  const [activeSection, setActiveSection] = useState<PhaseTwoProjectSection>(
    PHASE_TWO_EVIDENCE_SECTIONS[0].key,
  )
  const [sections, setSections] = useState<Record<string, string>>({})
  const [dirtyFields, setDirtyFields] = useState<string[]>([])
  const [decisionNote, setDecisionNote] = useState('')
  const [status, setStatus] = useState<SaveState>('loading')
  const [savedVersion, setSavedVersion] = useState(0)
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [message, setMessage] = useState('')
  const editVersions = useRef<Record<string, number>>({})
  const confirmedVersions = useRef<Record<string, number>>({})
  const saving = useRef(false)

  useEffect(() => {
    let active = true
    setStatus('loading')
    void Promise.all([
      loadPhaseTwoProject(enrollmentId),
      loadPhaseTwoRevisionHistory(enrollmentId),
    ]).then(([record, previous]) => {
      if (!active) return
      setPath(record?.project_path ?? '')
      setTitle(record?.project_title ?? '')
      const nextSections: Record<string, string> = {}
      for (const definition of PHASE_TWO_EVIDENCE_SECTIONS) {
        nextSections[definition.key] = readText(record?.sections?.[definition.key])
      }
      setSections(nextSections)
      setSavedVersion(record?.version_number ?? 0)
      setRevisions(previous)
      editVersions.current = {}
      confirmedVersions.current = {}
      setDirtyFields([])
      setStatus('ready')
    }).catch(() => {
      if (active) {
        setStatus('error')
        setMessage('Your project record could not load. Please try again later.')
      }
    })
    return () => { active = false }
  }, [enrollmentId])

  const markDirty = (field: string) => {
    editVersions.current[field] = (editVersions.current[field] ?? 0) + 1
    setDirtyFields(current => current.includes(field) ? current : [...current, field])
    setStatus('dirty')
    setMessage('')
  }

  const persist = useCallback(async () => {
    if (saving.current || !dirtyFields.length || !path || !title.trim()) return
    saving.current = true
    setStatus('saving')
    const changed = [...dirtyFields]
    const generation = Object.fromEntries(changed.map(field => [field, editVersions.current[field] ?? 0]))
    const patch: Record<string, unknown> = {}
    for (const field of changed) {
      if (field !== '__project_title__' && field !== '__project_path__') {
        patch[field] = { text: sections[field] ?? '' }
      }
    }
    try {
      const result = await savePhaseTwoProjectUpdate({
        enrollmentId,
        path,
        title: title.trim(),
        patch,
        decisionNote: decisionNote.trim() || undefined,
      })
      const lastNote = decisionNote.trim() || null
      setSavedVersion(result.saved_version)
      setRevisions(current => [{ version_number: result.saved_version, decision_note: lastNote,
        created_at: result.saved_at }, ...current])
      setDirtyFields(current => current.filter(field => (editVersions.current[field] ?? 0) !== generation[field]))
      setDecisionNote(current => current === (lastNote ?? '') ? '' : current)
      for (const field of changed) confirmedVersions.current[field] = generation[field]
      const stillUnsaved = Object.entries(editVersions.current).some(([field, revision]) =>
        revision !== (confirmedVersions.current[field] ?? 0))
      setStatus(stillUnsaved ? 'dirty' : 'saved')
      setMessage(stillUnsaved
        ? 'Saved the previous edits. Newer changes are waiting to save.'
        : 'Project draft saved securely. Your prior versions remain available for review.')
    } catch {
      setStatus('error')
      setMessage('Autosave could not complete. Your text remains here. Choose Retry save.')
    } finally {
      saving.current = false
    }
  }, [dirtyFields, enrollmentId, path, sections, title, decisionNote])

  useEffect(() => {
    if (status !== 'dirty' || !dirtyFields.length || !path || !title.trim()) return
    const timeout = window.setTimeout(() => { void persist() }, 1500)
    return () => window.clearTimeout(timeout)
  }, [status, dirtyFields, path, title, sections, decisionNote, persist])

  const selected = PHASE_TWO_EVIDENCE_SECTIONS.find(item => item.key === activeSection)!
  const filledCount = PHASE_TWO_EVIDENCE_SECTIONS.filter(item => sections[item.key]?.trim()).length
  const unsaved = dirtyFields.length > 0

  return (
    <main className="p2-project-page">
      <header className="p2-project-intro">
        <p className="eyebrow">Phase Two · Continuing project</p>
        <h1>My Project Record</h1>
        <p>One project, developed across all six journeys. Keep decisions, tests, revisions and evidence together.</p>
        <p className="p2-record-guidance">Use fictional, public or properly authorized information. AI assists, humans verify.</p>
      </header>

      {status === 'loading' ? <p role="status">Loading your protected project record…</p> : (
        <>
          <section className="p2-project-charter" aria-label="Project details">
            <div className="p2-project-control">
              <label htmlFor="p2-project-path">Your project path</label>
              <select id="p2-project-path" disabled={savedVersion > 0} value={path} onChange={event => {
                setPath(event.target.value as PhaseTwoProjectPath)
                markDirty('__project_path__')
              }}>
                <option value="">Choose a path</option>
                <option value="A">Path A — Improve an existing business process</option>
                <option value="B">Path B — Develop an offer, product or service</option>
              </select>
              {savedVersion > 0 ? <small>The chosen project path is protected against accidental replacement.</small> : null}
            </div>
            <div className="p2-project-control">
              <label htmlFor="p2-project-name">Project name</label>
              <input id="p2-project-name" value={title} placeholder="Name the bounded project"
                onChange={event => { setTitle(event.target.value); markDirty('__project_title__') }} />
            </div>
          </section>

          <div className="p2-project-progress" aria-label="Evidence overview">
            <div><strong>{filledCount} / {PHASE_TWO_EVIDENCE_SECTIONS.length}</strong>
              <span>Evidence sections with notes</span></div>
            <p>These are working notes, not completed assessments. Your reviewed evidence determines completion.</p>
          </div>

          <div className="p2-project-columns">
            <nav className="p2-project-nav" aria-label="Project evidence sections">
              <h2>Project evidence</h2>
              {PHASE_TWO_EVIDENCE_SECTIONS.map(item => (
                <button key={item.key} type="button" aria-current={activeSection === item.key ? 'page' : undefined}
                  onClick={() => setActiveSection(item.key)}>
                  <span>{sections[item.key]?.trim() ? '●' : '○'}</span>
                  <strong>{item.label}</strong>
                  <small>Lessons {item.lessons}</small>
                </button>
              ))}
            </nav>

            <section className="p2-project-editor" aria-labelledby="p2-section-title">
              <div className="p2-project-editor-title">
                <p className="eyebrow">Your continuing evidence</p>
                <h2 id="p2-section-title">{selected.label}</h2>
                <p>Primary lesson destinations: {selected.lessons}</p>
              </div>
              <label htmlFor="p2-section-notes">Work, decisions and verified evidence</label>
              <textarea id="p2-section-notes" rows={13}
                value={sections[selected.key] ?? ''}
                placeholder="Record the relevant work, how you checked it, and what changed."
                onChange={event => {
                  setSections(current => ({ ...current, [selected.key]: event.target.value }))
                  markDirty(selected.key)
                }} />
              <label htmlFor="p2-decision-note">Decision note (optional)</label>
              <textarea id="p2-decision-note" rows={3} value={decisionNote}
                placeholder="What changed, why, and what evidence supported the decision?"
                onChange={event => {
                  setDecisionNote(event.target.value)
                  markDirty('__project_title__')
                }} />
              <div className="p2-project-save-row">
                <span role="status">{status === 'saving' ? 'Saving…' : message || (unsaved ? 'Changes waiting to save' : 'Saved evidence is versioned.')}</span>
                <button type="button" disabled={!unsaved || !path || !title.trim() || status === 'saving'}
                  onClick={() => { setStatus('dirty'); void persist() }}>
                  {status === 'error' ? 'Retry save' : 'Save project'}
                </button>
              </div>
              <p className="p2-project-caution">Saving a draft does not award lesson completion or an Academy credential.</p>
            </section>
          </div>

          <section className="p2-revision-history" aria-labelledby="p2-revisions-heading">
            <h2 id="p2-revisions-heading">Saved versions</h2>
            {revisions.length ? (
              <ol>{revisions.slice(0, 20).map(revision => (
                <li key={revision.version_number}>
                  <strong>Version {revision.version_number}</strong>
                  <time dateTime={revision.created_at}>{new Date(revision.created_at).toLocaleString()}</time>
                  {revision.decision_note ? <span>{revision.decision_note}</span> : null}
                </li>
              ))}</ol>
            ) : <p>Your saved versions will appear here as you work.</p>}
          </section>
        </>
      )}
    </main>
  )
}

import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  workflow: 'Existing workflow and the narrow step needing support',
  context: 'Reviewed communication and human approval points carried from Lesson 2.3',
  inputResult: 'Authorized input and the human-reviewed result',
  noAi: 'No AI — fit, limits, permissions and review effort',
  assistant: 'Assistant — fit, limits, permissions and review effort',
  automation: 'Rule-based automation — fit, limits, permissions and review effort',
  agent: 'Agent — fit, limits, permissions and review effort',
  aiComparison: 'AI comparison and the suggestion you accepted, revised or rejected',
  choice: 'Chosen support pattern',
  reason: 'Why this is sufficient and the other three are less suitable',
  allowed: 'Allowed actions and the authorized inputs they use',
  prohibited: 'Prohibited actions and access',
  checkpoints: 'Human checkpoints — owner, evidence checked and approval required',
  monitoring: 'Monitoring — named owner, review rhythm and signs of failure',
  stopFallback: 'Stop conditions and manual fallback for missing or contradictory data',
  documentation: 'Platform feature check — official page, URL, check date, supported claim and limits (or platform unselected; capabilities unverified)',
  concept: 'Updated solution concept with scope, input, result and human control',
  recommendOnly: 'One decision AI may recommend but may not approve, and its authorized approver',
  appliedCheck: 'Fictional invoice check — payment conflict, stopped action and human route',
  limits: 'Remaining uncertainty and what must be checked before any adoption',
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft
const groups: Array<{ heading: string; keys: Array<keyof Draft> }> = [
  { heading: '1. Compare support for the same narrow task', keys: ['workflow', 'context', 'inputResult', 'noAi', 'assistant', 'automation', 'agent'] },
  { heading: '2. Compare with AI and choose sufficient support', keys: ['aiComparison', 'choice', 'reason'] },
  { heading: '3. Define permissions, monitoring and fallback', keys: ['allowed', 'prohibited', 'checkpoints', 'monitoring', 'stopFallback', 'documentation'] },
  { heading: '4. Update the concept and demonstrate human control', keys: ['concept', 'recommendOnly', 'appliedCheck', 'limits'] },
]
export function PhaseTwoSupportPatternPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [project, setProject] = useState<{ path: PhaseTwoProjectPath; title: string } | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!enrollmentId) return
    let active = true
    void loadPhaseTwoProject(enrollmentId).then(record => {
      if (!active || !record) return
      setProject({ path: record.project_path, title: record.project_title })
      const section = record.sections.ai_solution_concept as { support_pattern_lesson_2_4?: { draft?: Partial<Draft> } } | undefined
      const prior = section?.support_pattern_lesson_2_4?.draft
      if (prior) setDraft(Object.fromEntries(Object.keys(fields).map(key => [key, typeof prior[key as keyof Draft] === 'string' ? prior[key as keyof Draft] : ''])) as Draft)
      else {
        const workflow = record.sections.professional_ai_operating_model as { workflow_view_lesson_2_1?: { workflow_view?: unknown } } | undefined
        const communication = record.sections.prompt_and_communication_evidence as { clear_lesson_2_3?: { draft?: { revised?: string; approval?: string; limits?: string } } } | undefined
        const reviewed = communication?.clear_lesson_2_3?.draft
        setDraft(old => ({ ...old,
          workflow: workflow?.workflow_view_lesson_2_1?.workflow_view ? JSON.stringify(workflow.workflow_view_lesson_2_1.workflow_view, null, 2) : old.workflow,
          context: reviewed ? [reviewed.revised, reviewed.approval, reviewed.limits].filter(Boolean).join('\n') : old.context,
        }))
      }
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => { active = false }
  }, [enrollmentId])
  const map = [draft.workflow, 'Reviewed communication and approval points: ' + draft.context, 'Input and result: ' + draft.inputResult].join('\n')
  const request = approvedAiRequest.replace('[map]', map || '[map]')
  const complete = Object.values(draft).every(text => text.trim().length > 0)
  const evidence = { lesson: '2.4', draft, comparison_request: request, practice_only_not_permission_to_deploy: true }
  const recordText = JSON.stringify(evidence, null, 2)
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message) }
    catch { setStatus('Clipboard is unavailable. Select the request or record text below to copy it.') }
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true)
    try {
      const result = await savePhaseTwoProjectUpdate({ enrollmentId, path: project.path, title: project.title,
        patch: { ai_solution_concept: { support_pattern_lesson_2_4: evidence } },
        decisionNote: 'Lesson 2.4 — four support patterns, bounded concept, permissions and human approval route' })
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-support-heading">
    <header><p className="eyebrow">Continue Your Project · Compare · Choose · Bound</p>
      <h2 id="p2-support-heading">Choose the least complex suitable support</h2>
      <p>Continue with your existing workflow and reviewed communication. Compare the same input and result under all four patterns. Use your own AI assistant with fictional or authorized material. This activity plans a concept; it does not connect accounts, send messages or deploy a system.</p>
    </header>
    {groups.map((group, i) => <div key={group.heading}>
      <h3>{group.heading}</h3>
      {i === 0 && <p>Explain each option's suitability. No AI can use a checklist, approved template or ordinary tool. Do not invent an observed improvement.</p>}
      {i === 2 && <p>Name specific actions, review owners and a manual route. Written instructions alone do not prove tool permissions. If no platform is selected, state that its capabilities remain unverified and must be checked before adoption.</p>}
      {i === 2 && <p>Optional official documentation examples: <a href="https://learn.microsoft.com/en-us/power-automate/triggers-introduction" target="_blank" rel="noreferrer">Power Automate triggers</a>, <a href="https://learn.microsoft.com/en-us/power-automate/use-expressions-in-conditions" target="_blank" rel="noreferrer">conditions</a> and <a href="https://learn.microsoft.com/en-us/power-automate/get-started-approvals" target="_blank" rel="noreferrer">approval flows</a>. These describe general features; verify your chosen platform and configuration separately.</p>}
      {i === 3 && <p>FICTIONAL APPLIED CHECK: The company permits a routine reminder only for a verified unpaid invoice seven days overdue, with a verified recipient and no dispute or payment arrangement. A customer reports payment, while the record still says unpaid. Explain what stops, what information is preserved, and how the accounts coordinator investigates. Show an adjustment AI may recommend but may not approve.</p>}
      {group.keys.map(key => <label key={key}>{fields[key]}<textarea rows={key === 'workflow' || key === 'concept' ? 5 : 3} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))} /></label>)}
      {i === 1 && <><label>Support-pattern comparison request<textarea readOnly rows={7} value={request} /></label>
        <button type="button" onClick={() => void copy(request, 'Comparison request copied. Use it with your chosen AI assistant.')}>Copy support-pattern request</button></>}
    </div>)}
    <p>Keep support, recommendation, decision and approval distinct. Any real adoption needs checked capabilities, appropriate permission and actual testing. Save unresolved limits honestly.</p>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save support comparison to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 2.4 comparison and concept copied.')}>Copy my Lesson 2.4 record</button>
      <details><summary>Read or copy my support comparison</summary><textarea aria-label="Lesson 2.4 support record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your comparison and concept are ready to save for review.' : 'Complete the four comparisons, chosen pattern, permissions, feature-check status and human route before saving.')}</p>
    </div>
  </section>
}

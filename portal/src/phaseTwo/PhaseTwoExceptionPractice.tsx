import { useEffect, useState } from 'react'
import { loadPhaseTwoProject, savePhaseTwoProjectUpdate, type PhaseTwoProjectPath } from './phaseTwoProject'
import './phaseTwoWorkflowPractice.css'

const fields = {
  "scope": "Continuing project scope, criteria and human review/approval owner",
  "artifact": "Saved working artifact and version used for these tests",
  "baseline": "Earlier baseline and normal-run evidence retained from Lesson 2.5",
  "aiReview": "AI test suggestions reviewed — accepted, revised or rejected with reasons",
  "normalInput": "Normal case — input and exact request used",
  "normalExpected": "Normal case — expected behavior defined before the run",
  "normalObserved": "Normal case — actual output, check result and supporting evidence",
  "missingInput": "Missing-information case — input and exact request used",
  "missingExpected": "Missing-information case — expected behavior defined before the run",
  "missingObserved": "Missing-information case — actual output, check result and supporting evidence",
  "conflictInput": "Conflicting-specification case — input and exact request used",
  "conflictExpected": "Conflicting-specification case — expected behavior defined before the run",
  "conflictObserved": "Conflicting-specification case — actual output, check result and supporting evidence",
  "outsideInput": "Outside-scope case — input and exact request used",
  "outsideExpected": "Outside-scope case — expected behavior defined before the run",
  "outsideObserved": "Outside-scope case — actual output, check result and supporting evidence",
  "failure": "Observed failure selected — case, failed criterion and original output evidence",
  "correction": "Material correction and why it addresses the failure",
  "revisedArtifact": "Revised working artifact — reusable text or accessible authorized reference",
  "retest": "Retest — same failing input, original expectation, exact revised request and actual output",
  "normalRetest": "Normal-path recheck after correction — actual input, request, output and finding",
  "demonstration": "Corrected-failure demonstration and retained human control point",
  "comparison": "Baseline versus revised work — clarity, usefulness, review effort and outcome quality",
  "updatedMap": "Revised future-state map — tested behavior, proposed steps and human routes",
  "updatedConcept": "Revised solution concept — tested scope, support, permissions and limits",
  "assembly": "Assembled evidence — communication, maps, concept, working artifact and test references",
  "decisionNote": "Most important correction and the actual evidence supporting it",
  "limits": "Unresolved defects/dependencies — consequence, named owner and next step"
} as const
type Draft = Record<keyof typeof fields, string>
const blank = () => Object.fromEntries(Object.keys(fields).map(k => [k, ''])) as Draft
const cases = [
  { title: 'Normal path', input: 'normalInput', expected: 'normalExpected', observed: 'normalObserved' },
  { title: 'Missing information', input: 'missingInput', expected: 'missingExpected', observed: 'missingObserved' },
  { title: 'Conflicting specifications', input: 'conflictInput', expected: 'conflictExpected', observed: 'conflictObserved' },
  { title: 'Outside the authorized scope', input: 'outsideInput', expected: 'outsideExpected', observed: 'outsideObserved' },
] as const
const closingGroups: Array<{ heading: string; keys: Array<keyof Draft> }> = [
  { heading: '3. Correct and retest an observed failure', keys: ['failure', 'correction', 'revisedArtifact', 'retest', 'normalRetest', 'demonstration'] },
  { heading: '4. Assemble and retain Journey Two evidence', keys: ['comparison', 'updatedMap', 'updatedConcept', 'assembly', 'decisionNote', 'limits'] },
]
export function PhaseTwoExceptionPractice({ enrollmentId, approvedAiRequest }: { enrollmentId?: string; approvedAiRequest: string }) {
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
      const section = record.sections.ai_solution_concept as {
        exception_tests_lesson_2_6?: { draft?: Partial<Draft> }
        prototype_lesson_2_5?: { draft?: { scope?: string; criteria?: string; owner?: string; baseline?: string; revisedOutput?: string; revisedArtifact?: string; artifact?: string; concept?: string; limits?: string } }
      } | undefined
      const prior = section?.exception_tests_lesson_2_6?.draft
      if (prior) setDraft(Object.fromEntries(Object.keys(fields).map(key => [key, typeof prior[key as keyof Draft] === 'string' ? prior[key as keyof Draft] : ''])) as Draft)
      else {
        const sample = section?.prototype_lesson_2_5?.draft
        const workflow = record.sections.professional_ai_operating_model as { workflow_view_lesson_2_1?: { workflow_view?: unknown } } | undefined
        const assembly = [
          record.sections.prompt_and_communication_evidence ? 'Communication evidence: retained in your continuing Project Record; review its completeness.' : 'Communication evidence: add or resolve missing evidence before final submission.',
          workflow?.workflow_view_lesson_2_1 ? 'Earlier workflow map: retained in your Project Record; add the tested future-state map below.' : 'Earlier workflow map: review and resolve missing evidence.',
          sample ? 'Concept and working sample: carried from Lesson 2.5; retain the earlier versions.' : 'Concept and working sample: complete the earlier evidence before final submission.',
          'Add the actual tests, revised artifact, retest and correction note from this lesson.',
        ].join('\n')
        setDraft(old => ({ ...old,
          scope: sample ? [sample.scope, sample.criteria && 'Criteria: ' + sample.criteria, sample.owner && 'Human review/approval owner: ' + sample.owner].filter(Boolean).join('\n') : old.scope,
          artifact: sample?.revisedArtifact || sample?.artifact || old.artifact,
          baseline: sample ? [sample.baseline, sample.revisedOutput && 'Earlier actual normal result: ' + sample.revisedOutput].filter(Boolean).join('\n') : old.baseline,
          updatedMap: workflow?.workflow_view_lesson_2_1?.workflow_view ? JSON.stringify(workflow.workflow_view_lesson_2_1.workflow_view, null, 2) : old.updatedMap,
          updatedConcept: sample?.concept || old.updatedConcept,
          limits: sample?.limits || old.limits,
          assembly,
        }))
      }
    }).catch(() => { if (active) setStatus('Your Project Record could not load. You can still copy your work.') })
    return () => { active = false }
  }, [enrollmentId])
  const brief = [draft.scope, 'Saved artifact: ' + draft.artifact, 'Baseline evidence: ' + draft.baseline].join('\n')
  const request = approvedAiRequest.replace('[brief]', brief || '[brief]')
  const complete = Object.values(draft).every(text => text.trim().length > 0)
  const evidence = { lesson: '2.6', draft, test_design_request: request,
    actual_run_reported_by_learner: true, expected_behavior_separate_from_observation: true,
    practice_only_not_permission_to_deploy: true }
  const recordText = JSON.stringify(evidence, null, 2)
  function field(key: keyof Draft, disabled = false) {
    return <label key={key}>{fields[key]}<textarea
      rows={['artifact', 'revisedArtifact', 'retest', 'demonstration', 'assembly'].includes(key) || key.endsWith('Observed') ? 5 : 3}
      disabled={disabled} value={draft[key]} onChange={e => setDraft(old => ({ ...old, [key]: e.target.value }))} /></label>
  }
  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); setStatus(message) }
    catch { setStatus('Clipboard is unavailable. Select the request or record text below to copy it.') }
  }
  async function save() {
    if (!enrollmentId || !project || !complete || saving) return
    setSaving(true)
    try {
      const result = await savePhaseTwoProjectUpdate({ enrollmentId, path: project.path, title: project.title,
        patch: {
          ai_solution_concept: { exception_tests_lesson_2_6: evidence },
          workflow_design_artifact: { tested_workflow_lesson_2_6: { text: draft.updatedMap, lesson: '2.6', observed_and_proposed_steps_distinguished: true } },
        },
        decisionNote: 'Lesson 2.6 — ' + draft.decisionNote })
      setStatus('Saved to your continuing Project Record. Version ' + result.saved_version + '.')
    } catch { setStatus('Save was unsuccessful. Your answers remain here; retry or copy your record.') }
    finally { setSaving(false) }
  }
  return <section className="p2-workflow-practice" aria-labelledby="p2-exception-heading">
    <header><p className="eyebrow">Complete Journey Two · Test · Correct · Retest</p>
      <h2 id="p2-exception-heading">Test your sample and demonstrate a corrected failure</h2>
      <p>Continue your saved Lesson 2.5 working artifact in the same authorized scope. Use your own AI assistant with fictional or approved material. Keep actual results separate from suggestions and preserve the human approval point.</p>
    </header>
    <div><h3>1. Review the scope and design the cases</h3>
      {(['scope', 'artifact', 'baseline'] as const).map(key => field(key))}
      <label>Test-design request<textarea readOnly rows={8} value={request} /></label>
      <button type="button" onClick={() => void copy(request, 'Test-design request copied. Review the suggested inputs and expectations yourself.')}>Copy test-design request</button>
      {field('aiReview')}
      <p>AI can suggest cases and expected safe behavior. Review those suggestions before testing. A predicted result is not an observed result. You may add the tool and run date to each case for context.</p>
    </div>
    <div><h3>2. Define expectations, then run four actual cases</h3>
      <p>Write each expected response before running the case. The actual-output field becomes available when that expectation is recorded. Keep the exact request used, actual output, met/not met/uncertain finding and supporting evidence. Inspect every important fact against the input.</p>
      {cases.map(item => <div key={item.input}><h4>{item.title}</h4>
        {field(item.input)}{field(item.expected)}{field(item.observed, !draft[item.expected].trim())}
      </div>)}
    </div>
    {closingGroups.map((group, i) => <div key={group.heading}>
      <h3>{group.heading}</h3>
      {i === 0 && <p>Preserve one real failed check from this or earlier project testing. Correct it and retest the same failing input against the original expectation. Recheck the normal path. If no actual failure has been corrected, keep that completion item unfinished and extend authorized testing; do not invent evidence.</p>}
      {i === 1 && <p>Compare clarity, usefulness, review effort and outcome quality using observed evidence. Update the map and concept to describe tested behavior, and mark proposed steps separately. Add accessible evidence references and one concise correction note. For unresolved consequential defects, name the owner and next step.</p>}
      {group.keys.map(key => field(key))}
    </div>)}
    <p>Demonstrate the original failure, material correction, actual retest and retained human control. Saving preserves reported evidence for human review; it does not mark the lesson complete or approve deployment. Carry the integrated record into Lesson 3.1.</p>
    <div className="p2-workflow-practice-save">
      {enrollmentId && project ? <button type="button" disabled={!complete || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Journey Two test evidence to My Project Record'}</button>
        : <p>Review preview: copy your work. Saving requires your existing active learner Project Record.</p>}
      <button type="button" onClick={() => void copy(recordText, 'Lesson 2.6 test evidence and Journey Two integration copied.')}>Copy my Lesson 2.6 record</button>
      <details><summary>Read or copy my test evidence</summary><textarea aria-label="Lesson 2.6 test record" readOnly rows={12} value={recordText} /></details>
      <p role="status">{status || (complete ? 'Your reported test evidence and integrated work are ready to save for review.' : 'Retain all four actual cases, correction, same-input retest, updated map/concept and demonstration before saving.')}</p>
    </div>
  </section>
}

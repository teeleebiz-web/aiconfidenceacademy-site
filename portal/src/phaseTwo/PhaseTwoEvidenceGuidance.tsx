export type PhaseTwoStrengthening = {
  version: string
  lesson_id: string
  heading: string
  criteria: string[]
  focus_evidence: string[]
  acceptable_example: string
  workload_guidance: string
  pacing_guidance: string
  framework_guidance: string
  revision_guidance: string
  credential_boundary: string
  independent_check?: { scenario: string; question: string; instruction: string }
  repair_case?: { label: string; setup: string; input: string; faulty_artifact: string; task: string }
}

export function PhaseTwoEvidenceGuidance({ guidance }: { guidance: PhaseTwoStrengthening }) {
  return <section className="p2-produced-criteria" aria-label="Lesson evidence guidance">
    <h5>{guidance.heading}</h5>
    <p>{guidance.workload_guidance}</p>
    <ul>{guidance.focus_evidence.map(item => <li key={item}>{item}</li>)}</ul>
    <p>{guidance.acceptable_example}</p>
    <details><summary>How the evidence is reviewed</summary>
      <ul>{guidance.criteria.map(item => <li key={item}>{item}</li>)}</ul>
      <p>{guidance.revision_guidance}</p><p>{guidance.credential_boundary}</p>
    </details>
    <p>{guidance.pacing_guidance}</p><p>{guidance.framework_guidance}</p>
    {guidance.independent_check && <div className="p2-produced-question">
      <h5>Explain the decision yourself</h5>
      <p>{guidance.independent_check.scenario}</p>
      <p>{guidance.independent_check.question}</p>
      <p>{guidance.independent_check.instruction}</p>
    </div>}
    {guidance.repair_case && <details>
      <summary>{guidance.repair_case.label}</summary>
      <p>{guidance.repair_case.setup}</p>
      <p><strong>Record:</strong> {guidance.repair_case.input}</p>
      <p><strong>Faulty version to repair:</strong> {guidance.repair_case.faulty_artifact}</p>
      <p>{guidance.repair_case.task}</p>
    </details>}
  </section>
}

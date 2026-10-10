import './phaseTwoOrientation.css'

/**
 * Read-only orientation copy grounded in the Phase Two Curriculum Master v2.0
 * (learner readiness, one project, weekly workload, and responsible boundaries).
 * Submission and readiness review are separate future gated workflows.
 */
export function PhaseTwoOrientation({ preview = false }: { preview?: boolean }) {
  return (
    <section className="p2-orientation" aria-labelledby="p2-orientation-heading">
      <header>
        <p className="eyebrow">Before you begin</p>
        <h2 id="p2-orientation-heading">Prepare one professional project.</h2>
        <p>You will build and test one bounded project across all six journeys. Bring a business setting, a real need to investigate, and the judgment to question AI-supported work.</p>
      </header>

      <div className="p2-orientation-sections">
        <article>
          <h3>Entry readiness</h3>
          <p>Be prepared to show a sanitized AI request, an output you evaluated, and a revision or decision you made. Explain one privacy boundary and one claim that requires verification.</p>
          <p>These are prerequisites to be reviewed, not evidence of automatic acceptance.</p>
        </article>
        <article>
          <h3>Your project path</h3>
          <p><strong>Path A:</strong> improve a process in an existing business or professional role.</p>
          <p><strong>Path B:</strong> develop a new offer, product or service.</p>
          <p>Both paths complete the same curriculum and maintain one evolving project record.</p>
        </article>
        <article>
          <h3>Workload and practice</h3>
          <p>Six guided lessons per week, Monday through Saturday, approximately 60 minutes each. Plan two independent hours weekly for testing, feedback, revision or rehearsal.</p>
          <p>The six-week course is designed around approximately 48 hours of learning and application, to be validated through a timed pilot.</p>
        </article>
        <article>
          <h3>Professional boundaries</h3>
          <p>Use fictional, public, or properly authorized materials. Keep the project small enough to test with the available tools and permissions. AI may assist; the person remains responsible for decisions, review and consequences.</p>
          <p>A draft, prototype or example does not itself authorize deployment or consequential transactions.</p>
        </article>
      </div>
      {preview ? (
        <p className="p2-orientation-preview">Founder preview: this section does not submit or approve readiness evidence.</p>
      ) : (
        <p className="p2-orientation-preview">Readiness is reviewed separately from lesson release and completion.</p>
      )}
    </section>
  )
}

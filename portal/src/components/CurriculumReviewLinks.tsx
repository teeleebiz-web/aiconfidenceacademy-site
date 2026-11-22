export function CurriculumReviewLinks() {
  return <section className="cc-panel" aria-label="Review the Academy curriculum">
    <div className="cc-panel-heading"><h2>Welcome, lessons, and workbooks</h2></div>
    <p className="cc-pad">Review the Academy from the beginning or open any lesson. Your owner access does not require a trial or start a learner schedule.</p>
    <div className="cc-course-cards">
      <article>
        <p className="cc-eyebrow">Phase One</p>
        <h3>Start with Welcome to the Academy</h3>
        <p>Watch the welcome film, continue through Getting Started with ChatGPT, and review all six journeys and their workbooks.</p>
        <div className="cc-review-actions">
          <a className="cc-button cc-primary" href="/learn/?review=phase-one&view=welcome">Start Phase One — Welcome to the Academy</a>
          <a className="cc-button" href="/learn/?review=phase-one&view=curriculum">Phase One lessons</a>
          <a className="cc-button" href="/learn/?review=phase-one&view=workbooks">Phase One workbooks</a>
        </div>
      </article>
      <article>
        <p className="cc-eyebrow">Phase Two</p>
        <h3>Continue through the final journey</h3>
        <p>Open Lesson 1.1 or choose any lesson and workbook across all six journeys.</p>
        <div className="cc-review-actions">
          <a className="cc-button cc-primary" href="/learn/?review=phase-two&lesson=1.1">Start Phase Two</a>
          <a className="cc-button" href="/learn/?review=phase-two&view=curriculum">Phase Two lessons and workbooks</a>
        </div>
      </article>
    </div>
  </section>
}

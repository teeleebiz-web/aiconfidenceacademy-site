import type { Enrollment, Journey, JourneyIntroduction, Lesson, LessonProgress } from '../types'

type DashboardProps = {
  enrollment: Enrollment
  journeys: Journey[]
  lessons: Lesson[]
  progress: LessonProgress[]
  introductions: JourneyIntroduction[]
  learnerName: string
  onOpenLesson: (lesson: Lesson) => void
  onOpenIntroduction: (introduction: JourneyIntroduction) => void
}

export function Dashboard({
  enrollment,
  journeys,
  lessons,
  progress,
  introductions,
  learnerName,
  onOpenLesson,
  onOpenIntroduction,
}: DashboardProps) {
  const completed = progress.filter((item) => item.status === 'completed').length
  const progressPercent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0

  return (
    <main className="portal-main">
      <section className="welcome-panel">
        <div>
          <p className="eyebrow">Your learning home</p>
          <h1>Welcome{learnerName ? `, ${learnerName}` : ''}.</h1>
          <p>{enrollment.course.summary}</p>
        </div>
        <div className="progress-card" aria-label={`${progressPercent}% complete`}>
          <strong>{progressPercent}%</strong>
          <span>Course progress</span>
          <div className="progress-track" aria-hidden="true">
            <i style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="course-panel" aria-labelledby="course-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Phase One</p>
            <h2 id="course-heading">{enrollment.course.title}</h2>
          </div>
          <span className="access-badge">Active enrollment</span>
        </div>

        {journeys.map((journey) => {
          const journeyLessons = lessons.filter((lesson) => lesson.journey_id === journey.id)
          const introduction = introductions.find((item) => item.journey_id === journey.id)

          return (
            <article className="journey-card" key={journey.id}>
              <div className="journey-number">Journey {journey.journey_number}</div>
              <div className="journey-copy">
                <small>Week {journey.week_number}</small>
                <h3>{journey.title}</h3>
                <p>{journey.promise}</p>
                {introduction ? (
                  <button
                    className="journey-welcome-button"
                    type="button"
                    onClick={() => onOpenIntroduction(introduction)}
                  >
                    <span>
                      <small>Journey welcome · {Math.ceil(introduction.duration_seconds / 60)} minutes</small>
                      <strong>{introduction.content.title}</strong>
                    </span>
                    <b>Begin Journey</b>
                  </button>
                ) : null}
                <div className="lesson-list">
                  {journeyLessons.map((lesson) => {
                    const lessonProgress = progress.find((item) => item.lesson_id === lesson.id)
                    const isComplete = lessonProgress?.status === 'completed'

                    return (
                      <button
                        className="lesson-row"
                        key={lesson.id}
                        type="button"
                        onClick={() => onOpenLesson(lesson)}
                      >
                        <span className={isComplete ? 'lesson-status complete' : 'lesson-status'}>
                          {isComplete ? '✓' : lesson.page_id}
                        </span>
                        <span>
                          <strong>{lesson.title}</strong>
                          <small>{lesson.estimated_minutes} minutes</small>
                        </span>
                        <b>Open lesson</b>
                      </button>
                    )
                  })}
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

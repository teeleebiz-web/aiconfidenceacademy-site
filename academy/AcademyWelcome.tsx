import './welcome-video.css'

export const academyWelcomeVideoPath = 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'

export function AcademyWelcome({ mediaUrl, onContinue }: { mediaUrl: string; onContinue: () => void }) {
  return <main className="academy-welcome-main">
    <section className="academy-welcome-panel" aria-labelledby="academy-welcome-title">
      <p className="eyebrow">AI Confidence Academy</p>
      <h1 id="academy-welcome-title">Welcome to the Academy</h1>
      <p className="academy-welcome-introduction">Before you begin Journey 1, hear from the founders and instructors.</p>
      <div className="academy-welcome-player">
        <video controls preload="metadata" playsInline src={mediaUrl}>Your browser does not support the Academy welcome film.</video>
      </div>
      <button className="academy-welcome-continue" onClick={onContinue}>Continue to ChatGPT</button>
    </section>
  </main>
}

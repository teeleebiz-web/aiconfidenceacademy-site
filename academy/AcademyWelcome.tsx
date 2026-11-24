import './welcome-video.css'

export const academyWelcomeVideoPath = 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'

export const academyWelcomeCaptionPath = 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.en.vtt'

export function AcademyWelcome({ mediaUrl, captionUrl, onContinue }: { mediaUrl: string; captionUrl?: string; onContinue: () => void }) {
  return <main className="academy-welcome-main">
    <section className="academy-welcome-panel" aria-labelledby="academy-welcome-title">
      <p className="eyebrow">AI Confidence Academy</p>
      <h1 id="academy-welcome-title">Welcome to the Academy</h1>
      <p className="academy-welcome-introduction">Before you begin Journey 1, hear from the founders and instructors.</p>
      <div className="academy-welcome-player">
        <video controls preload="metadata" playsInline crossOrigin="anonymous" src={mediaUrl}>{captionUrl ? <track kind="captions" src={captionUrl} srcLang="en" label="English" /> : null}Your browser does not support the Academy welcome film.</video>
      </div>
      <button className="academy-welcome-continue" onClick={onContinue}>Continue to ChatGPT</button>
    </section>
  </main>
}

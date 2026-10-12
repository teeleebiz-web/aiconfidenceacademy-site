import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PhaseTwoReview } from './components/PhaseTwoReview'
import { PhaseTwoLearnerEntry } from './phaseTwo/PhaseTwoLearnerEntry'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('ACA learner portal root element is missing.')
}

createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get('review') === 'phase-two'
      ? <PhaseTwoReview />
      : new URLSearchParams(window.location.search).get('course') === 'phase-two'
        ? <PhaseTwoLearnerEntry />
        : <App />}
  </StrictMode>,
)

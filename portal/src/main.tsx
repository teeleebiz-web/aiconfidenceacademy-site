import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PortalEntry } from './PortalEntry'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('ACA learner portal root element is missing.')
}

createRoot(root).render(
  <StrictMode>
    <PortalEntry />
  </StrictMode>,
)

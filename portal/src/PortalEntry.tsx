import { lazy, Suspense } from 'react'
import { controlCenterPath, isControlCenterEntry } from './controlCenterRoute'

const LearnerPortal = lazy(() => import('./App').then(module => ({ default: module.App })))
const ControlCenter = lazy(() => import('./ControlCenterEntry').then(module => ({ default: module.ControlCenterEntry })))
const TrialAccess = lazy(() => import('./TrialAccessEntry').then(module => ({ default: module.TrialAccessEntry })))

const incomingUrl = new URL(window.location.href)
const trialAccess = /^\/learn\/?$/.test(incomingUrl.pathname) && incomingUrl.searchParams.get('view')==='trial-access'
const controlCenter = isControlCenterEntry(incomingUrl, window.localStorage)
if (controlCenter && incomingUrl.pathname !== controlCenterPath) {
  incomingUrl.pathname = controlCenterPath
  incomingUrl.searchParams.delete('view')
  window.history.replaceState(null, '', incomingUrl)
}

export function PortalEntry() {
  return <Suspense fallback={<div className="loading-screen">{controlCenter ? 'Opening Academy control center…' : 'Preparing your ACA learning space…'}</div>}>
    {trialAccess ? <TrialAccess /> : controlCenter ? <ControlCenter /> : <LearnerPortal />}
  </Suspense>
}

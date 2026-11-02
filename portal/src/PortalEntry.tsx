import { lazy, Suspense, useEffect } from 'react'
import { controlCenterPath, isControlCenterEntry } from './controlCenterRoute'

const LearnerPortal = lazy(() => import('./App').then(module => ({ default: module.App })))
const ControlCenter = lazy(() => import('./ControlCenterEntry').then(module => ({ default: module.ControlCenterEntry })))
const TrialAccess = lazy(() => import('./TrialAccessEntry').then(module => ({ default: module.TrialAccessEntry })))
const LearnerEntry = lazy(() => import('./LearnerEntry').then(module => ({ default: module.LearnerEntry })))

export function PortalEntry() {
  const incomingUrl = new URL(window.location.href)
  const trialAccess = /^\/learn\/?$/.test(incomingUrl.pathname) && incomingUrl.searchParams.get('view')==='trial-access'
  const controlCenter = isControlCenterEntry(incomingUrl, window.localStorage)
  const entryAddress = incomingUrl.href
  useEffect(() => {
    if (!controlCenter) return
    const ownerAddress = new URL(entryAddress)
    if (ownerAddress.pathname === controlCenterPath) return
    ownerAddress.pathname = controlCenterPath
    ownerAddress.searchParams.delete('view')
    window.history.replaceState(null, '', ownerAddress)
  }, [controlCenter, entryAddress])
  // Keep existing phase, owner review, lesson, workbook and legacy trial links.
  // Only the shared homepage/sign-in entry needs enrollment-based selection.
  const specificLearnerEntry = ['phase-one', 'phase-two'].includes(incomingUrl.searchParams.get('course') || '')
    || ['phase-one', 'phase-two'].includes(incomingUrl.searchParams.get('review') || '')
    || incomingUrl.searchParams.has('lesson') || incomingUrl.searchParams.has('workbook')
    || incomingUrl.searchParams.get('view') === 'trial'
  return <Suspense fallback={<div className="loading-screen">{controlCenter ? 'Opening Academy control center…' : 'Preparing your ACA learning space…'}</div>}>
    {trialAccess ? <TrialAccess /> : controlCenter ? <ControlCenter /> : specificLearnerEntry ? <LearnerPortal /> : <LearnerEntry />}
  </Suspense>
}

import { useLayoutEffect } from 'react'

/** Reset only on navigation, after the destination DOM has been committed. */
export function usePageStart(destination: string | null) {
  useLayoutEffect(() => {
    if (destination === null) return
    const heading = document.querySelector<HTMLElement>('main h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [destination])
}

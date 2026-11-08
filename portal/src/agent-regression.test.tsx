import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { usePageStart } from './lib/usePageStart'

function PageStartProbe({ destination }: { destination: string | null }) {
  usePageStart(destination)
  return <main><h1>Destination</h1></main>
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('usePageStart', () => {
  it('scrolls to the top when navigating to a destination', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    render(<PageStartProbe destination="/academy/phase-one/" />)

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })
})

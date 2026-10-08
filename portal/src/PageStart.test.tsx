import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { usePageStart } from './lib/usePageStart'

function Page({ destination, text = '' }: { destination: string | null; text?: string }) {
  usePageStart(destination)
  return <main><h1>{destination ?? 'Loading'}</h1><textarea aria-label="Answer" defaultValue={text} /></main>
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('resets after the new heading renders for all 36 lessons and six journey welcomes', () => {
  const observed: string[] = []
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
    observed.push(document.querySelector('h1')!.textContent!)
    expect(document.activeElement).toBe(document.querySelector('h1'))
  })
  const view = render(<Page destination={null} />)
  expect(scroll).not.toHaveBeenCalled()
  for (let journey = 1; journey <= 6; journey++) {
    const destinations = [`journey:${journey}`, ...Array.from({ length: 6 }, (_, i) => `lesson:${journey}.${i + 1}`)]
    for (const destination of destinations) {
      view.rerender(<Page destination={destination} />)
      expect(observed.at(-1)).toBe(destination)
      expect(scroll).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
    }
  }
  expect(scroll).toHaveBeenCalledTimes(42)
})

it('does not interrupt writing, saving, or media updates on the same destination', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const view = render(<Page destination="workbook:journey-one:5" />)
  scroll.mockClear()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reflection' } })
  view.rerender(<Page destination="workbook:journey-one:5" text="Saved" />)
  expect(scroll).not.toHaveBeenCalled()
  expect(document.querySelector('textarea')!.value).toBe('My reflection')
  view.rerender(<Page destination="workbook:journey-one:6" />)
  expect(scroll).toHaveBeenCalledOnce()
})

import { controlCenterReturnKey, isControlCenterEntry } from './controlCenterRoute'

const now = 1000000
const storage = { getItem: vi.fn() }
beforeEach(() => storage.getItem.mockReturnValue(String(now + 300000)))

it('opens the separate control-center address and legacy owner links', () => {
  for (const path of ['/control-center/', '/control-center', '/learn/?view=enrollments', '/learn/?view=operations']) {
    expect(isControlCenterEntry(new URL(path, 'https://academy.example'), storage, now)).toBe(true)
  }
})
it('returns owner email callbacks to the control center in the same browser', () => {
  for (const callback of ['#access_token=synthetic', '?code=synthetic', '#error=access_denied']) {
    expect(isControlCenterEntry(new URL('/learn/' + callback, 'https://academy.example'), storage, now)).toBe(true)
  }
  expect(storage.getItem).toHaveBeenCalledWith(controlCenterReturnKey)
})
it('does not reroute ordinary learner visits, workbooks, trials, or other pages', () => {
  for (const path of ['/learn/', '/learn/?workbook=journey-one', '/learn/?view=trial#code=synthetic', '/learn/?view=trial-access#invite=ACA_synthetic', '/academy/phase-one/']) {
    expect(isControlCenterEntry(new URL(path, 'https://academy.example'), storage, now)).toBe(false)
  }
})
it('does not reroute learner authentication without a valid recent owner sign-in request', () => {
  for (const hint of [null, '', String(now - 1), 'invalid', String(now + 7200000)]) {
    storage.getItem.mockReturnValue(hint)
    expect(isControlCenterEntry(new URL('https://academy.example/learn/#access_token=synthetic'), storage, now)).toBe(false)
  }
})

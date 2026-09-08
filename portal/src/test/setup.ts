import '@testing-library/react'

// jsdom has no layout engine; provide the browser API used for player layout.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false },
  }),
})
// jsdom does not implement the TextTrack constructor used by browser players.
Object.defineProperty(globalThis, 'TextTrack', { configurable: true, value: class TextTrack {} })

afterEach(() => {
  document.body.innerHTML = ''
})

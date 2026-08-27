import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})

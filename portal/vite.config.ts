import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  base: '/learn/',
  build: {
    outDir: '../learn',
    // Preserve the existing published Phase Two entry and the assets it imports.
    emptyOutDir: false,
    sourcemap: false,
  },
})

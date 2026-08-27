import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  base: '/learn/',
  build: {
    outDir: '../learn',
    emptyOutDir: true,
    sourcemap: false,
  },
})

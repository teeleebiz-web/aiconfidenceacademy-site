import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  root: new URL('.', import.meta.url).pathname,
  base: '/learn/',
  define: {
    'import.meta.env.VITE_ACA_PRIVATE_PHASE_TWO_MEDIA': JSON.stringify(loadEnv(mode, '.', 'ACA_').ACA_PRIVATE_PHASE_TWO_MEDIA === 'true' ? 'true' : 'false'),
  },
  build: {
    outDir: '../learn',
    // Retain older entries for the staged hosting transition. Both phases now build from source.
    emptyOutDir: false,
    sourcemap: false,
    manifest: true,
  },
}))

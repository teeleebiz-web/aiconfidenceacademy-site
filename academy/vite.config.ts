import { defineConfig } from 'vite'
export default defineConfig({ define: { 'import.meta.env.ACA_PLAYBACK_DIAGNOSTICS': JSON.stringify(process.env.VERCEL_ENV === 'preview') }, root: new URL('.', import.meta.url).pathname, base: '/academy/phase-one/', build: { outDir: '../private-dist/academy/phase-one', emptyOutDir: true, sourcemap: false } })

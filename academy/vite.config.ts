import { defineConfig } from 'vite'
export default defineConfig({ root: new URL('.', import.meta.url).pathname, base: '/academy/phase-one/', build: { outDir: '../private-dist/academy/phase-one', emptyOutDir: true, sourcemap: false } })

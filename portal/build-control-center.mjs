import { mkdir, readFile, writeFile } from 'node:fs/promises'

const html = (await readFile(new URL('../learn/index.html', import.meta.url), 'utf8'))
  .replace('<title>ACA Learner Portal</title>', '<title>Academy Control Center | AI Confidence Academy</title>')
  .replace('The secure AI Confidence Academy learner portal.', 'The protected AI Confidence Academy owner control center.')
await mkdir(new URL('../control-center/', import.meta.url), { recursive: true })
await writeFile(new URL('../control-center/index.html', import.meta.url), html)

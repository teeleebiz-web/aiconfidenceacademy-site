import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { preparePublicSite, protectedLessonAsset, copyPublicPortal } from './public-site.mjs'

test('public production output excludes paid media, source, construction files and obsolete bundles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-public-artifact-')), output = join(root, 'output')
  const put = async (name, value = 'fixture') => { await mkdir(join(root, name, '..'), { recursive: true }); await writeFile(join(root, name), value) }
  try {
    for (const file of ['index.html', 'enroll/index.html', 'learn/index.html', 'learn/assets/current.js', 'learn/assets/current.css', 'learn/assets/obsolete.js', 'control-center/index.html', 'assets/public.mp4', 'assets/videos/phase-two-lesson-1-1/paid.mp4', 'assets/videos/phase-two-lesson-1-1/production-report.json', 'academy/private.html', 'AGENTS.md', 'site.js', 'support.js', 'support.css', 'support-knowledge.js', 'favicon.svg', 'aca-official-seal.png', 'hero.png']) await put(file)
    await put('learn/.vite/manifest.json', JSON.stringify({ entry: { file: 'assets/current.js', css: ['assets/current.css'] } }))
    await preparePublicSite({ root, output, pages: ['', 'enroll'], enabled: true, privateMedia: true })
    for (const file of ['index.html', 'enroll/index.html', 'learn/index.html', 'learn/assets/current.js', 'learn/assets/current.css', 'control-center/index.html', 'assets/public.mp4', 'hero.png']) await access(join(output, file))
    for (const file of ['assets/videos/phase-two-lesson-1-1/paid.mp4', 'assets/videos/phase-two-lesson-1-1/production-report.json', 'academy/private.html', 'AGENTS.md', 'learn/assets/obsolete.js', 'learn/.vite/manifest.json']) await assert.rejects(access(join(output, file)))
    assert.match(await readFile(join(output, 'robots.txt'), 'utf8'), /Disallow: \/control-center\//)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('public deployment cannot be prepared before private media is enabled', async () => {
  await assert.rejects(preparePublicSite({ enabled: true, privateMedia: false }), /requires protected/)
})
test('portal copy rejects an escaping build manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-portal-artifact-'))
  try {
    await mkdir(join(root, '.vite'))
    await writeFile(join(root, '.vite/manifest.json'), JSON.stringify({ entry: { file: '../secret' } }))
    await assert.rejects(copyPublicPortal(root, join(root, 'output')), /Unsafe/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('protection covers the entire paid-media folder without excluding public video', () => {
  assert.equal(protectedLessonAsset('assets/videos/phase-two-lesson-6-6/intro.mp4'), true)
  assert.equal(protectedLessonAsset('assets/videos/phase-two-lesson-1-1'), true)
  assert.equal(protectedLessonAsset('assets/videos/welcome/intro.mp4'), false)
})

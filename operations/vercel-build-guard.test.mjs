import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('only the known duplicate project skips; checkout and missing identity still build', () => {
  for (const [id, expected] of [
    ['prj_5yh03dxBKjVnAwihiKKoN8WSdmEW', 0],
    ['prj_bMtMImZai47HLEM7DqlhwOZI81NN', 1], ['unknown', 1], ['', 1],
  ]) {
    const r = spawnSync(process.execPath, [fileURLToPath(new URL('./vercel-build-guard.mjs', import.meta.url))], {
      env: { ...process.env, VERCEL_PROJECT_ID: id }, encoding: 'utf8',
    })
    assert.equal(r.status, expected, r.stderr)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backup, inspect, restoreLocal, inventory, loadKey, objectKey, sourceUrl, configurationInventory, projectRef } from './recovery.mjs'

const payloads = new Map([['nested/first.bin', Buffer.from([0, 255, 17, 128])], ['second.bin', randomBytes(8193)]])
function client({ fail = false, change = false, entries = payloads } = {}) {
  let reads = 0
  return { storage: {
    async listBuckets() { reads++; return { data: [{ id: 'private-files', public: false, file_size_limit: 200000, allowed_mime_types: null }, { id: 'empty', public: false }] } },
    from(bucket) { return {
      async list(prefix, { offset, limit }) {
        if (bucket === 'empty') return { data: [] }
        const items = new Map()
        for (const [key, data] of entries) {
          const start = prefix ? `${prefix}/` : ''
          if (!key.startsWith(start)) continue
          const name = key.slice(start.length).split('/')[0]
          const folder = key.slice(start.length).includes('/')
          items.set(name, folder ? { name, id: null } : { name, id: key, updated_at: change && reads > 1 ? 'changed' : 'stable', metadata: { size: data.length, mimetype: 'application/octet-stream' } })
        }
        return { data: [...items.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit) }
      },
      async download(key) { return fail ? { error: new Error('PRIVATE_PROVIDER_SECRET') } : { data: new Blob([entries.get(key)]) } },
    } },
  } }
}
async function workspace(fn) {
  const root = await mkdtemp(join(tmpdir(), 'aca-recovery-test-'))
  try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test('encrypted snapshot verifies and restores exact binary bytes and private bucket settings', () => workspace(async root => {
  const key = randomBytes(32), snapshot = join(root, 'snapshot'), out = join(root, 'restored')
  const summary = await backup({ client: client(), out: snapshot, key })
  assert.equal(summary.fileCount, 2)
  assert.equal(summary.totalBytes, 8197)
  assert.equal((await inspect({ snapshot, key })).verified, true)
  const names = await readdir(snapshot)
  assert.deepEqual(names.sort(), ['00000000.bin', '00000001.bin', 'manifest.bin', 'snapshot.json'])
  assert.ok(!(await readFile(join(snapshot, 'manifest.bin'))).includes(Buffer.from('nested/first.bin')))
  assert.ok(!JSON.stringify(summary).includes('first.bin'))
  assert.equal((await restoreLocal({ snapshot, out, key })).restoredLocally, true)
  for (const [name, bytes] of payloads) assert.deepEqual(await readFile(join(out, 'private-files', name)), bytes)
  const settings = JSON.parse(await readFile(join(out, 'bucket-settings.json')))
  assert.equal(settings.length, 2)
  assert.ok(settings.every(b => b.public === false))
}))

test('wrong key and corrupt ciphertext fail without leaving restored files', () => workspace(async root => {
  const key = randomBytes(32), snapshot = join(root, 'snapshot'), out = join(root, 'restored')
  await backup({ client: client(), out: snapshot, key })
  await assert.rejects(inspect({ snapshot, key: randomBytes(32) }))
  const path = join(snapshot, '00000000.bin'), bytes = await readFile(path)
  bytes[0] ^= 1; await writeFile(path, bytes)
  await assert.rejects(inspect({ snapshot, key }))
  await assert.rejects(restoreLocal({ snapshot, out, key }))
  assert.deepEqual((await readdir(root)).sort(), ['snapshot'])
}))

test('missing file and altered summary are rejected', () => workspace(async root => {
  const key = randomBytes(32), snapshot = join(root, 'snapshot')
  await backup({ client: client(), out: snapshot, key })
  await rm(join(snapshot, '00000001.bin'))
  await assert.rejects(inspect({ snapshot, key }))
  const p = join(snapshot, 'snapshot.json'), summary = JSON.parse(await readFile(p))
  summary.totalBytes++; await writeFile(p, JSON.stringify(summary))
  await assert.rejects(inspect({ snapshot, key }), /summary mismatch/)
}))

test('source changes reject the snapshot and remove partial output', () => workspace(async root => {
  await assert.rejects(backup({ client: client({ change: true }), out: join(root, 'snapshot'), key: randomBytes(32) }), /changed during backup/)
  assert.deepEqual(await readdir(root), [])
}))

test('failed download removes partial output and hides provider errors', () => workspace(async root => {
  await assert.rejects(backup({ client: client({ fail: true }), out: join(root, 'snapshot'), key: randomBytes(32) }), e => !e.message.includes('PRIVATE_PROVIDER_SECRET'))
  assert.deepEqual(await readdir(root), [])
}))

test('pagination and folder traversal retain every file including an empty bucket', async () => {
  const entries = new Map(Array.from({ length: 205 }, (_, i) => [`folder/file-${String(i).padStart(4, '0')}`, Buffer.from('data')]))
  const result = await inventory(client({ entries }))
  assert.equal(result.files.length, 205)
  assert.equal(result.buckets.length, 2)
  assert.equal(new Set(result.files.map(f => f.key)).size, 205)
})

test('existing destinations and website directories are never used for recovery output', () => workspace(async root => {
  const out = join(root, 'existing'); await mkdir(out); await writeFile(join(out, 'keep'), 'untouched')
  await assert.rejects(backup({ client: client(), out, key: randomBytes(32) }), /refusing to overwrite/)
  assert.equal(await readFile(join(out, 'keep'), 'utf8'), 'untouched')
  await assert.rejects(backup({ client: client(), out: new URL('../new-backup', import.meta.url).pathname, key: randomBytes(32) }), /outside the website/)
}))

test('restore into an existing directory preserves its contents', () => workspace(async root => {
  const key = randomBytes(32), snapshot = join(root, 'snapshot'), out = join(root, 'existing')
  await backup({ client: client(), out: snapshot, key }); await mkdir(out); await writeFile(join(out, 'keep'), 'untouched')
  await assert.rejects(restoreLocal({ snapshot, out, key }), /refusing to overwrite/)
  assert.deepEqual(await readdir(out), ['keep'])
}))

test('public buckets and malformed paths are refused', async () => {
  for (const value of ['../file', '/file', 'a/../b', 'a\\b', 'a//b', 'a:b', 'a/./b', 'a\u0000b']) assert.throws(() => objectKey(value))
  const c = client(); c.storage.listBuckets = async () => ({ data: [{ id: 'public', public: true }] })
  await assert.rejects(inventory(c), /private buckets only/)
  assert.equal(sourceUrl(`https://${projectRef}.supabase.co`), `https://${projectRef}.supabase.co`)
  for (const url of [`http://${projectRef}.supabase.co`, 'https://another.supabase.co', `https://${projectRef}.supabase.co/?key=private`]) assert.throws(() => sourceUrl(url))
})

test('configuration recovery distinguishes preview and missing values without exporting credentials', () => {
  const rows = configurationInventory([
    { key: 'SECRET', target: ['production'], type: 'sensitive', value: 'PRIVATE_PROVIDER_SECRET' },
    { key: 'PREVIEW', target: ['preview'], type: 'encrypted', value: 'PRIVATE_PROVIDER_SECRET' },
    { key: 'BRANCH', target: ['production'], gitBranch: 'test', type: 'encrypted' },
  ], ['SECRET', 'PREVIEW', 'BRANCH', 'MISSING'])
  assert.deepEqual(rows.map(r => r.configured), [true, false, false, false])
  assert.equal(rows[0].needsSecureReentry, true)
  assert.ok(!JSON.stringify(rows).includes('PRIVATE_PROVIDER_SECRET'))
})

test('encryption keys require owner-only regular files and the exact key length', () => workspace(async root => {
  const path = join(root, 'key'), link = join(root, 'key-link'), key = randomBytes(32)
  await writeFile(path, key, { mode: 0o600 })
  assert.deepEqual(await loadKey(path), key)
  await symlink(path, link)
  await assert.rejects(loadKey(link), /regular file/)
  await writeFile(path, Buffer.alloc(31))
  await assert.rejects(loadKey(path), /exactly 32/)
  await writeFile(path, key); await chmod(path, 0o644)
  if (process.platform !== 'win32') await assert.rejects(loadKey(path), /private to the owner/)
}))

test('symlinked output parents cannot route recovery files into the website', () => workspace(async root => {
  const link = join(root, 'linked-repo')
  await symlink(new URL('..', import.meta.url).pathname, link)
  await assert.rejects(backup({ client: client(), out: join(link, 'no-backup-here'), key: randomBytes(32) }), /outside the website/)
}))

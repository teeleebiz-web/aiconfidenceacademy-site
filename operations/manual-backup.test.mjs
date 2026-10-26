import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { backup } from './recovery.mjs'
import { manualBackup, manualConfiguration } from './manual-backup.mjs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const key = randomBytes(32)
const env = { ACA_BACKUP_OWNER_KEY_SAVED: 'true', ACA_BACKUP_SOURCE_ACCESS_CONFIRMED: 'true', ACA_BACKUP_KEY_BASE64: key.toString('base64'), ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY: 'PRIVATE_SOURCE_SECRET', ACA_R2_ACCESS_KEY_ID: 'PRIVATE_R2_ID', ACA_R2_SECRET_ACCESS_KEY: 'PRIVATE_R2_SECRET', ACA_R2_PRIVATE_CONFIRMED: `${'a'.repeat(32)}/aca-private-backups` }
const bytes = randomBytes(16391)
function source({ oversized = false, count = {} } = {}) { return { storage: {
  async listBuckets() { return { data: [{ id: 'private-fixture', public: false }] } },
  from() { return {
    async list() { return { data: [{ id: 'fixture', name: 'original.bin', updated_at: 'stable', metadata: { size: oversized ? 2 * 1024 ** 3 + 1 : bytes.length } }] } },
    async download() { count.downloads = (count.downloads ?? 0) + 1; return { data: new Blob([bytes]) } },
  } },
} } }
function memoryStore() {
  const objects = new Map()
  return { objects,
    async put(path, body) { assert.ok(!objects.has(path)); objects.set(path, Buffer.isBuffer(body) ? body : Buffer.concat(await Readable.from(body).toArray())) },
    async get(path) { return Readable.from([objects.get(path)]) },
  }
}
const freeDisk = async () => 10n * 1024n ** 3n

test('manual job verifies a saved encrypted copy against original hashes without source writes', async () => {
  const store = memoryStore()
  const result = await manualBackup({ env, availableBytes: freeDisk, createSource(url, credential, options) {
    assert.equal(url, 'https://ymmkodlifpxutynpjnxm.supabase.co')
    assert.equal(credential, env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY)
    assert.equal(options.auth.persistSession, false)
    return source()
  }, createStore(config) { assert.equal(config.bucket, 'aca-private-backups'); return store } })
  assert.equal(result.liveAcaBackup, true)
  assert.equal(result.savedCopyDecryptionVerified, true)
  assert.equal(result.restoredWithOriginalHashesVerified, true)
  assert.equal(result.fileCount, 1)
  assert.equal(result.totalBytes, bytes.length)
  assert.equal(store.objects.size, 4)
  for (const value of store.objects.values()) {
    assert.ok(!value.equals(bytes))
    assert.ok(!value.includes(key))
    assert.ok(!value.includes(Buffer.from('PRIVATE_SOURCE_SECRET')))
    assert.ok(!value.includes(Buffer.from('PRIVATE_R2_SECRET')))
  }
})

test('owner custody, source authorization, canonical key and private destination are required before network access', async () => {
  for (const patch of [{ ACA_BACKUP_OWNER_KEY_SAVED: 'false' }, { ACA_BACKUP_SOURCE_ACCESS_CONFIRMED: 'false' }, { ACA_BACKUP_KEY_BASE64: 'not-a-key' }, { ACA_BACKUP_KEY_BASE64: Buffer.alloc(31).toString('base64') }, { ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY: '' }, { ACA_R2_PRIVATE_CONFIRMED: `${'a'.repeat(32)}/other` }]) {
    assert.throws(() => manualConfiguration({ ...env, ...patch }))
    await assert.rejects(manualBackup({ env: { ...env, ...patch }, createSource() { assert.fail('No source access allowed') }, createStore() { assert.fail('No R2 access allowed') } }), error => error.stage === 'configuration')
  }
})

test('insufficient private disk stops before source access', async () => {
  await assert.rejects(manualBackup({ env, availableBytes: async () => 1n, createSource() { assert.fail('No source access allowed') } }), error => error.stage === 'private-disk-preflight')
})

test('configuration diagnostics identify the failed check without revealing credentials or opening a source', async () => {
  const cases = [
    [{ ACA_BACKUP_OWNER_KEY_SAVED: 'false' }, { code: 'owner-confirmation-missing' }],
    [{ ACA_BACKUP_KEY_BASE64: 'A'.repeat(43) }, { code: 'recovery-key-length', expectedCharacters: 44, actualCharacters: 43 }],
    [{ ACA_BACKUP_KEY_BASE64: 'A'.repeat(42) + '-=' }, { code: 'recovery-key-characters', checkPositions: [43] }],
    [{ ACA_BACKUP_KEY_BASE64: 'A'.repeat(42) + 'B=' }, { code: 'recovery-key-noncanonical', checkPositions: [43] }],
    [{ ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY: '' }, { code: 'source-credential-missing' }],
    [{ ACA_R2_PRIVATE_CONFIRMED: 'invalid' }, { code: 'private-destination-invalid' }],
    [{ ACA_R2_ACCESS_KEY_ID: '' }, { code: 'r2-credentials-missing' }],
    [{ ACA_R2_SECRET_ACCESS_KEY: '' }, { code: 'r2-credentials-missing' }],
  ]
  for (const [patch, issue] of cases) {
    await assert.rejects(manualBackup({ env: { ...env, ...patch }, createSource() { assert.fail('No source access allowed') }, createStore() { assert.fail('No R2 access allowed') } }), error => {
      assert.equal(error.stage, 'configuration')
      assert.deepEqual(error.configurationIssue, issue)
      const printed = JSON.stringify(error)
      assert.ok(!printed.includes('PRIVATE_'))
      assert.ok(!printed.includes(env.ACA_BACKUP_KEY_BASE64))
      if (patch.ACA_BACKUP_KEY_BASE64) assert.ok(!printed.includes(patch.ACA_BACKUP_KEY_BASE64))
      return true
    })
  }
  assert.deepEqual(manualConfiguration({ ...env, ACA_BACKUP_KEY_BASE64: `\n${env.ACA_BACKUP_KEY_BASE64}\r\n` }).key, key)
})

test('oversized source inventory stops before any file download or R2 call', async () => {
  const count = {}
  await assert.rejects(manualBackup({ env, availableBytes: freeDisk, createSource: () => source({ oversized: true, count }), createStore() { assert.fail('No R2 access allowed') } }), error => error.stage === 'source-snapshot')
  assert.equal(count.downloads, undefined)
})

test('an empty source cannot become a misleading successful ACA backup', async () => {
  await assert.rejects(manualBackup({ env, availableBytes: freeDisk, createSource: () => ({ storage: { async listBuckets() { return { data: [] } } } }), createStore() { assert.fail('No R2 access allowed') } }), error => error.stage === 'source-snapshot')
})

test('failure when retrieving the durable copy cannot be reported as a completed backup or leak secrets', async () => {
  const store = memoryStore(), get = store.get.bind(store)
  let reads = 0
  store.get = async path => { if (++reads > 4) throw new Error('PRIVATE_SOURCE_SECRET PRIVATE_R2_SECRET'); return get(path) }
  await assert.rejects(manualBackup({ env, availableBytes: freeDisk, createSource: () => source(), createStore: () => store }), error => {
    assert.equal(error.stage, 'saved-copy-download-and-decryption')
    assert.match(error.reference, /^aca-backups\//)
    assert.ok(!JSON.stringify(error).includes('PRIVATE_'))
    assert.ok(!error.message.includes('PRIVATE_'))
    return true
  })
  assert.equal(store.objects.size, 4)
})

test('base recovery size bound rejects an inventory before creating partial output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-limit-test-')), count = {}
  try {
    await assert.rejects(backup({ client: source({ count }), out: join(root, 'snapshot'), key, maxBytes: 1 }), /explicit limit/)
    assert.equal(count.downloads, undefined)
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})


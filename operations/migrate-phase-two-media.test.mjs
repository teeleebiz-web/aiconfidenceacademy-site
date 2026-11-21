import test from 'node:test'
import assert from 'node:assert/strict'
import { mediaMigrationPlan, migratePhaseTwoMedia } from './migrate-phase-two-media.mjs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

async function migrationFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'aca-media-migration-'))
  const bytes = [Buffer.from([0, 1, 23, 255]), Buffer.from('exact original captions')]
  const catalog = bytes.map((data, i) => ({ path: `${i}.vtt`, object: `phase-two/lessons/1-1/${i}.vtt`, bytes: data.length,
    gitBlob: createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') }))
  const stored = new Map(), uploads = []
  const storage = {
    async upload(key, data, options) {
      assert.equal(options.upsert, false)
      assert.ok(!stored.has(key), 'An existing object must never be overwritten')
      uploads.push(key); stored.set(key, Buffer.from(data)); return { error: null }
    },
    async download(key) { return { data: new Blob([stored.get(key)]) } },
  }
  const readInventory = async () => ({ buckets: [{ id: 'aca-learning-media', public: false, file_size_limit: 200 }],
    files: [...stored].map(([key, data]) => ({ bucket: 'aca-learning-media', key, size: data.length })) })
  try {
    for (const [i, data] of bytes.entries()) await writeFile(join(root, `${i}.vtt`), data)
    await run({ options: { client: { storage: { from: () => storage } }, root, catalog, readInventory }, stored, uploads, bytes })
  } finally { await rm(root, { recursive: true, force: true }) }
}

test('the actual combined collection fits the approved coordinated 4 GiB limits', () => {
  const plan = mediaMigrationPlan(1729388971)
  assert.equal(plan.files, 525)
  assert.equal(plan.additionalBytes, 1048800956)
  assert.equal(plan.projectedBytes, 2778189927)
  assert.equal(plan.backupLimitBytes, 4294967296)
  assert.equal(plan.capacityReady, true)
  assert.equal(mediaMigrationPlan(4294967296).capacityReady, false)
})
test('resuming a transfer does not double-count verified destination objects', () => {
  const original = mediaMigrationPlan(1729388971)
  const resumed = mediaMigrationPlan(1729388971 + 1000, 1000)
  assert.equal(resumed.projectedBytes, original.projectedBytes)
})
test('preview is read-only and an upload cannot bypass the deployed backup bound', async () => {
  const client = { storage: { from() { throw new Error('Mutation must not be reached') } } }
  const readInventory = async () => ({ buckets:[{id:'aca-learning-media',public:false}], files:[{bucket:'aca-learning-media',key:'existing',size:4294967296}] })
  const plan = await migratePhaseTwoMedia({ client, readInventory })
  assert.equal(plan.uploaded, 0); assert.equal(plan.activationReady, false)
  await assert.rejects(migratePhaseTwoMedia({ client, readInventory, approved:true }), /enforced backup/)
})
test('a public destination is refused even for a migration plan', async () => {
  await assert.rejects(migratePhaseTwoMedia({ client: {}, readInventory: async () => ({buckets:[{id:'aca-learning-media',public:true}],files:[]}) }), /private media bucket/)
})

test('exact original bytes are uploaded, read back and resumed without overwrite or activation', async () => {
  await migrationFixture(async ({ options, uploads, stored, bytes }) => {
    const plan = await migratePhaseTwoMedia(options)
    assert.equal(plan.uploaded, 0); assert.equal(stored.size, 0)
    const first = await migratePhaseTwoMedia({ ...options, approved: true })
    assert.equal(first.uploaded, 2); assert.equal(first.verified, 2); assert.equal(first.activationReady, false)
    assert.deepEqual([...stored.values()], bytes)
    const resumed = await migratePhaseTwoMedia({ ...options, approved: true })
    assert.equal(resumed.uploaded, 0); assert.equal(resumed.verified, 2); assert.equal(uploads.length, 2)
    assert.equal((await migratePhaseTwoMedia({ ...options, verifyOnly: true })).verified, 2)
  })
})
test('all source hashes are checked before the first destination write', async () => {
  await migrationFixture(async ({ options, uploads }) => {
    await writeFile(join(options.root, '1.vtt'), Buffer.alloc(options.catalog[1].bytes, 120))
    await assert.rejects(migratePhaseTwoMedia({ ...options, approved: true }), /Source does not match/)
    assert.equal(uploads.length, 0)
  })
})
test('same-size corrupted destination and incomplete verify-only runs fail closed', async () => {
  await migrationFixture(async ({ options, uploads, stored }) => {
    await assert.rejects(migratePhaseTwoMedia({ ...options, verifyOnly: true }), /incomplete/)
    assert.equal(uploads.length, 0)
    stored.set(options.catalog[0].object, Buffer.alloc(options.catalog[0].bytes, 99))
    await assert.rejects(migratePhaseTwoMedia({ ...options, approved: true }), /readback differs/)
    assert.equal(uploads.length, 0)
  })
})

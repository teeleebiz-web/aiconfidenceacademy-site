import test from 'node:test'
import assert from 'node:assert/strict'
import { mediaMigrationPlan, migratePhaseTwoMedia } from './migrate-phase-two-media.mjs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

async function migrationFixture(run, extensions = ['vtt', 'vtt']) {
  const root = await mkdtemp(join(tmpdir(), 'aca-media-migration-'))
  const bytes = [Buffer.from([0, 1, 23, 255]), Buffer.from('exact original captions')]
  const catalog = bytes.map((data, i) => ({ path: `${i}.${extensions[i]}`, object: `phase-two/lessons/1-1/${i}.${extensions[i]}`, bytes: data.length,
    gitBlob: createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') }))
  const stored = new Map(), uploads = [], bucketUpdates = []
  const bucket = { id: 'aca-learning-media', public: false, file_size_limit: 200, allowed_mime_types: null }
  const storage = {
    async upload(key, data, options) {
      assert.equal(options.upsert, false)
      assert.ok(!stored.has(key), 'An existing object must never be overwritten')
      uploads.push(key); stored.set(key, Buffer.from(data)); return { error: null }
    },
    async download(key) { return { data: new Blob([stored.get(key)]) } },
  }
  const readInventory = async () => ({ buckets: [structuredClone(bucket)],
    files: [...stored].map(([key, data]) => ({ bucket: 'aca-learning-media', key, size: data.length })) })
  try {
    for (const [i, data] of bytes.entries()) await writeFile(join(root, `${i}.${extensions[i]}`), data)
    await run({ options: { client: { storage: { from: () => storage,
      async getBucket() { return { data: structuredClone(bucket) } },
      async updateBucket(id, options) {
        assert.equal(id, 'aca-learning-media'); bucketUpdates.push(options)
        Object.assign(bucket, { public: options.public, file_size_limit: options.fileSizeLimit, allowed_mime_types: options.allowedMimeTypes })
        return { error: null }
      },
    } }, root, catalog, readInventory }, stored, uploads, bytes, bucket, bucketUpdates })
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


test('every catalog format is preflighted; approved updates preserve privacy, size and existing formats', async () => {
  for (const [extension, format] of [['m4a', 'audio/mp4'], ['webp', 'image/webp'], ['json', 'application/json']]) {
    await migrationFixture(async ({ options, bucket, bucketUpdates, uploads }) => {
      bucket.allowed_mime_types = ['video/mp4', 'text/vtt', 'audio/mpeg', 'audio/wav']
      const original = [...bucket.allowed_mime_types]
      assert.deepEqual((await migratePhaseTwoMedia(options)).missingFormats, [format])
      assert.equal(bucketUpdates.length, 0)
      await assert.rejects(migratePhaseTwoMedia({ ...options, verifyOnly: true }), /does not allow/)
      assert.equal(bucketUpdates.length, 0); assert.equal(uploads.length, 0)
      const result = await migratePhaseTwoMedia({ ...options, approved: true })
      assert.deepEqual(result.addedFormats, [format])
      assert.deepEqual(bucket.allowed_mime_types, [...original, format])
      assert.equal(bucket.public, false); assert.equal(bucket.file_size_limit, 200)
      assert.equal(result.verified, 2); assert.equal(bucketUpdates.length, 1)
      await migratePhaseTwoMedia({ ...options, approved: true })
      assert.equal(bucketUpdates.length, 1, 'An idempotent resume must not change settings again')
    }, [extension, 'vtt'])
  }
})
test('bad source hashes and unknown catalog formats fail before any bucket or object writes', async () => {
  await migrationFixture(async ({ options, bucket, bucketUpdates, uploads }) => {
    bucket.allowed_mime_types = ['video/mp4']
    await writeFile(join(options.root, '1.vtt'), Buffer.alloc(options.catalog[1].bytes, 120))
    await assert.rejects(migratePhaseTwoMedia({ ...options, approved: true }), /Source does not match/)
    assert.equal(bucketUpdates.length, 0); assert.equal(uploads.length, 0)
    const catalog = [{ ...options.catalog[0], path: 'unknown.exe' }]
    await assert.rejects(migratePhaseTwoMedia({ ...options, catalog, approved: true }), /Unrecognized media format/)
    assert.equal(bucketUpdates.length, 0); assert.equal(uploads.length, 0)
  })
})
test('bucket drift, provider update failure and failed settings readback prevent all uploads', async () => {
  for (const failure of ['drift', 'update', 'readback']) {
    await migrationFixture(async ({ options, bucket, bucketUpdates, uploads }) => {
      bucket.allowed_mime_types = ['video/mp4']
      if (failure === 'drift') options.client.storage.getBucket = async () => ({ data: { ...bucket, public: true } })
      if (failure === 'update') options.client.storage.updateBucket = async () => ({ error: { message: 'private provider detail' } })
      if (failure === 'readback') options.client.storage.updateBucket = async () => ({ error: null })
      await assert.rejects(migratePhaseTwoMedia({ ...options, approved: true }), /settings changed|format update/)
      assert.equal(uploads.length, 0)
      assert.equal(bucketUpdates.length, 0)
    })
  }
})

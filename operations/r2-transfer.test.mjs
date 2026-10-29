import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, readdir, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { backup, restoreLocal } from './recovery.mjs'
import { downloadSnapshot, r2Configuration, r2Store, uploadSnapshot } from './r2-transfer.mjs'

const data = randomBytes(128031)
function source() { return { storage: {
  async listBuckets() { return { data: [{ id: 'private-files', public: false }] } },
  from() { return {
    async list() { return { data: [{ id: 'id', name: 'private.bin', updated_at: 'unchanged', metadata: { size: data.length } }] } },
    async download() { return { data: new Blob([data]) } },
  } },
} } }
function fakeStore() {
  const objects = new Map(), calls = []
  return { objects, calls,
    async put(key, body, size) {
      calls.push(['put', key])
      if (objects.has(key)) throw new Error('Object already exists')
      const chunks = []
      for await (const chunk of Buffer.isBuffer(body) ? Readable.from([body]) : body) chunks.push(chunk)
      const bytes = Buffer.concat(chunks); assert.equal(bytes.length, size); objects.set(key, bytes)
    },
    async get(key) { calls.push(['get', key]); if (!objects.has(key)) throw new Error('PRIVATE_PROVIDER_CREDENTIAL'); return Readable.from([objects.get(key)]) },
  }
}
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'aca-r2-test-')), key = randomBytes(32), snapshot = join(root, 'snapshot')
  try { await backup({ client: source(), out: snapshot, key }); await fn({ root, snapshot, key, store: fakeStore() }) }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('encrypted upload, complete readback, download, decryption and local recovery preserve every byte', () => fixture(async ({ root, snapshot, key, store }) => {
  const uploaded = await uploadSnapshot({ snapshot, key, store })
  assert.equal(uploaded.uploadedAndReadbackVerified, true)
  assert.equal(uploaded.fileCount, 1)
  assert.equal(store.objects.size, 4)
  const puts = store.calls.filter(([action]) => action === 'put')
  assert.ok(puts.at(-1)[1].endsWith('/complete.json'))
  assert.ok(![...store.objects.values()].some(b => b.equals(data)))
  const downloaded = join(root, 'downloaded')
  assert.equal((await downloadSnapshot({ reference: uploaded.reference, out: downloaded, key, store })).downloadedAndDecryptionVerified, true)
  const restored = join(root, 'restored')
  await restoreLocal({ snapshot: downloaded, out: restored, key })
  assert.deepEqual(await readFile(join(restored, 'private-files/private.bin')), data)
}))

test('unrelated plaintext and key files are excluded from uploads', () => fixture(async ({ snapshot, key, store }) => {
  await writeFile(join(snapshot, 'private-key'), key)
  await writeFile(join(snapshot, 'notes.txt'), 'PRIVATE_NOTES')
  await uploadSnapshot({ snapshot, key, store })
  assert.ok(store.calls.every(([, name]) => !name.includes('private-key') && !name.includes('notes.txt')))
  assert.ok(![...store.objects.values()].some(b => b.includes(key)))
}))

test('corrupt readback cannot publish a completion record', () => fixture(async ({ snapshot, key, store }) => {
  const get = store.get.bind(store)
  store.get = async path => { await get(path); return Readable.from([Buffer.alloc(data.length)]) }
  await assert.rejects(uploadSnapshot({ snapshot, key, store }), /did not complete/)
  assert.ok(![...store.objects.keys()].some(k => k.endsWith('/complete.json')))
}))

test('a failed upload cannot become a success or leak provider credentials', () => fixture(async ({ snapshot, key, store }) => {
  store.put = async () => { throw new Error('PRIVATE_PROVIDER_CREDENTIAL') }
  await assert.rejects(uploadSnapshot({ snapshot, key, store }), e => !e.message.includes('PRIVATE_PROVIDER_CREDENTIAL') && e.reference.startsWith('aca-backups/'))
  assert.equal(store.objects.size, 0)
}))

test('upload size cap is checked before any object is transmitted', () => fixture(async ({ snapshot, key, store }) => {
  await assert.rejects(uploadSnapshot({ snapshot, key, store, maxBytes: 1 }))
  assert.equal(store.calls.length, 0)
}))

test('wrong decryption key rejects downloaded snapshots and cleans partial output', () => fixture(async ({ root, snapshot, key, store }) => {
  const { reference } = await uploadSnapshot({ snapshot, key, store })
  await assert.rejects(downloadSnapshot({ reference, out: join(root, 'downloaded'), key: randomBytes(32), store }))
  assert.deepEqual(await readdir(root), ['snapshot'])
}))

test('remote ciphertext corruption rejects download without leaving output', () => fixture(async ({ root, snapshot, key, store }) => {
  const { reference } = await uploadSnapshot({ snapshot, key, store })
  store.objects.get(`${reference}/00000000.bin`)[0] ^= 1
  await assert.rejects(downloadSnapshot({ reference, out: join(root, 'downloaded'), key, store }))
  assert.deepEqual(await readdir(root), ['snapshot'])
}))

test('completion records cannot introduce paths, duplicate names or oversized files', () => fixture(async ({ root, snapshot, key, store }) => {
  const { reference } = await uploadSnapshot({ snapshot, key, store }), path = `${reference}/complete.json`
  const original = JSON.parse(store.objects.get(path).toString('utf8'))
  for (const alter of [r => { r.files[0].name = '../outside' }, r => { r.files.push(r.files[0]) }, r => { r.files[0].size = Number.MAX_SAFE_INTEGER }]) {
    const changed = structuredClone(original); alter(changed); store.objects.set(path, Buffer.from(JSON.stringify(changed)))
    await assert.rejects(downloadSnapshot({ reference, out: join(root, 'downloaded'), key, store }))
    assert.deepEqual(await readdir(root), ['snapshot'])
  }
}))

test('invalid snapshot references are rejected before contacting storage', () => fixture(async ({ root, key, store }) => {
  await assert.rejects(downloadSnapshot({ reference: '../different-bucket', out: join(root, 'downloaded'), key, store }))
  assert.equal(store.calls.length, 0)
}))

test('existing local destination is preserved during a recovery attempt', () => fixture(async ({ root, key, store }) => {
  const out = join(root, 'existing'); await mkdir(out); await writeFile(join(out, 'keep'), 'unchanged')
  await assert.rejects(downloadSnapshot({ reference: 'not-used', out, key, store }))
  assert.equal(await readFile(join(out, 'keep'), 'utf8'), 'unchanged')
  assert.equal(store.calls.length, 0)
}))

test('a forged transport index cannot bypass authenticated snapshot validation', () => fixture(async ({ root, snapshot, key, store }) => {
  const { reference } = await uploadSnapshot({ snapshot, key, store }), summaryKey = `${reference}/snapshot.json`, completionKey = `${reference}/complete.json`
  const summary = JSON.parse(store.objects.get(summaryKey)); summary.fileCount++
  const bytes = Buffer.from(JSON.stringify(summary)); store.objects.set(summaryKey, bytes)
  const complete = JSON.parse(store.objects.get(completionKey)), entry = complete.files.find(f => f.name === 'snapshot.json')
  entry.size = bytes.length; entry.sha256 = createHash('sha256').update(bytes).digest('hex')
  store.objects.set(completionKey, Buffer.from(JSON.stringify(complete)))
  await assert.rejects(downloadSnapshot({ reference, out: join(root, 'downloaded'), key, store }))
  assert.deepEqual(await readdir(root), ['snapshot'])
}))

test('transport records cannot add files outside the authenticated encrypted manifest', () => fixture(async ({ root, snapshot, key, store }) => {
  const { reference } = await uploadSnapshot({ snapshot, key, store }), completionKey = `${reference}/complete.json`
  const extra = Buffer.from('untrusted extra bytes'), complete = JSON.parse(store.objects.get(completionKey))
  store.objects.set(`${reference}/99999999.bin`, extra)
  complete.files.push({ name: '99999999.bin', size: extra.length, sha256: createHash('sha256').update(extra).digest('hex') })
  store.objects.set(completionKey, Buffer.from(JSON.stringify(complete)))
  await assert.rejects(downloadSnapshot({ reference, out: join(root, 'downloaded'), key, store }))
  assert.deepEqual(await readdir(root), ['snapshot'])
}))

test('S3 adapter uses conditional Standard-class writes, explicit bucket, and no public ACL', async () => {
  const calls = [], body = Buffer.from('encrypted')
  const store = r2Store({ bucket: 'aca-private-backups' }, { async send(command) { calls.push(command.input); return { Body: Readable.from([body]) } } })
  await store.put('aca-backups/test/file', body, body.length)
  assert.equal(calls[0].Bucket, 'aca-private-backups')
  assert.equal(calls[0].IfNoneMatch, '*')
  assert.equal(calls[0].StorageClass, 'STANDARD')
  assert.equal(calls[0].ACL, undefined)
  assert.equal(calls[0].CacheControl, 'private, no-store')
  assert.deepEqual(await (await store.get('aca-backups/test/file')).toArray(), [body])
})

test('R2 credentials require the exact approved account and private-bucket confirmation', () => {
  const account = 'a'.repeat(32), bucket = 'aca-private-backups'
  const env = { ACA_R2_ACCOUNT_ID: account, ACA_R2_BUCKET: bucket, ACA_R2_PRIVATE_CONFIRMED: `${account}/${bucket}`, ACA_R2_ACCESS_KEY_ID: 'fixture', ACA_R2_SECRET_ACCESS_KEY: 'fixture' }
  assert.equal(r2Configuration(env).endpoint, `https://${account}.r2.cloudflarestorage.com`)
  assert.equal(r2Configuration({ ...env, ACA_R2_JURISDICTION: 'us' }).endpoint, `https://${account}.us.r2.cloudflarestorage.com`)
  for (const patch of [{ ACA_R2_PRIVATE_CONFIRMED: '' }, { ACA_R2_ACCOUNT_ID: 'attacker.test' }, { ACA_R2_BUCKET: '../other' }, { ACA_R2_JURISDICTION: 'other' }, { ACA_R2_MAX_SNAPSHOT_BYTES: 'Infinity' }, { ACA_R2_SECRET_ACCESS_KEY: '' }]) assert.throws(() => r2Configuration({ ...env, ...patch }))
})

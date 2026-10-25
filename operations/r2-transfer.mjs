import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { inspect, loadKey, privateDestination, projectRef, promote, snapshotArtifacts } from './recovery.mjs'

const transferFormat = 'aca-r2-transfer-v1'
const defaultLimit = 2 * 1024 ** 3
const validName = name => /^(?:\d{8}\.bin|manifest\.bin|snapshot\.json)$/.test(name)
const validPrefix = prefix => /^aca-backups\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(prefix)

export function r2Configuration(env) {
  const account = env.ACA_R2_ACCOUNT_ID, bucket = env.ACA_R2_BUCKET
  if (!/^[0-9a-f]{32}$/.test(account ?? '') || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new Error('R2 account and private bucket configuration are required')
  if (env.ACA_R2_PRIVATE_CONFIRMED !== `${account}/${bucket}`) throw new Error('The exact account and bucket must have their private settings verified before transfer')
  if (!env.ACA_R2_ACCESS_KEY_ID || !env.ACA_R2_SECRET_ACCESS_KEY) throw new Error('R2 bucket-scoped credentials are required')
  const jurisdiction = env.ACA_R2_JURISDICTION ?? 'default'
  if (!['default', 'us', 'eu', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction')
  const maxBytes = env.ACA_R2_MAX_SNAPSHOT_BYTES === undefined ? defaultLimit : Number(env.ACA_R2_MAX_SNAPSHOT_BYTES)
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 ** 4) throw new Error('Invalid snapshot transfer limit')
  return { bucket, maxBytes, endpoint: `https://${account}${jurisdiction === 'default' ? '' : `.${jurisdiction}`}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.ACA_R2_ACCESS_KEY_ID, secretAccessKey: env.ACA_R2_SECRET_ACCESS_KEY } }
}

export function r2Store(config, client = new S3Client({ region: 'auto', endpoint: config.endpoint, credentials: config.credentials, maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' })) {
  return {
    async put(key, body, size) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentLength: size, ContentType: 'application/octet-stream', CacheControl: 'private, no-store', StorageClass: 'STANDARD', IfNoneMatch: '*' }))
    },
    async get(key) {
      const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
      if (!response.Body) throw new Error('No R2 object body returned')
      return response.Body
    },
  }
}

async function digest(input, expectedSize, sink) {
  const hash = createHash('sha256'); let size = 0
  const meter = new Transform({ transform(chunk, _, done) {
    size += chunk.length
    if (size > expectedSize) { done(new Error('Transferred object exceeded its declared size')); return }
    hash.update(chunk); done(null, chunk)
  } })
  await pipeline(input, meter, sink ?? new Writable({ write(_, __, done) { done() } }))
  if (size !== expectedSize) throw new Error('Transferred object size did not match')
  return hash.digest('hex')
}

function failed(reference) {
  const error = new Error('R2 recovery operation did not complete; no success is claimed')
  error.reference = reference
  return error
}

export async function uploadSnapshot({ snapshot, key, store, maxBytes = defaultLimit }) {
  const reference = `aca-backups/${randomUUID()}`
  try {
    const artifacts = await snapshotArtifacts({ snapshot, key })
    const sizes = await Promise.all(artifacts.files.map(async f => ({ ...f, size: (await lstat(f.path)).size })))
    const totalBytes = sizes.reduce((sum, file) => sum + file.size, 0)
    if (totalBytes > maxBytes) throw new Error('Snapshot exceeds its explicit transfer limit')
    const files = []
    for (const file of sizes) {
      const sha256 = await digest(createReadStream(file.path), file.size)
      const body = createReadStream(file.path)
      try { await store.put(`${reference}/${file.name}`, body, file.size) }
      finally { body.destroy() }
      if (await digest(await store.get(`${reference}/${file.name}`), file.size) !== sha256) throw new Error('R2 readback did not match the encrypted file')
      files.push({ name: file.name, size: file.size, sha256 })
    }
    const completion = Buffer.from(JSON.stringify({ format: transferFormat, projectRef, reference, files, completedAt: new Date().toISOString() }))
    if (completion.length > 2 * 1024 ** 2) throw new Error('Completion record exceeds its limit')
    await store.put(`${reference}/complete.json`, completion, completion.length)
    const sha256 = createHash('sha256').update(completion).digest('hex')
    if (await digest(await store.get(`${reference}/complete.json`), completion.length) !== sha256) throw new Error('Completion record could not be verified')
    return { uploadedAndReadbackVerified: true, reference, fileCount: artifacts.summary.fileCount, encryptedBytes: totalBytes }
  } catch { throw failed(reference) }
}

async function completionRecord(store, reference, maxBytes) {
  if (!validPrefix(reference)) throw new Error('Invalid recovery snapshot reference')
  const chunks = []; let size = 0
  await pipeline(await store.get(`${reference}/complete.json`), new Writable({ write(chunk, _, done) {
    size += chunk.length
    if (size > 2 * 1024 ** 2) { done(new Error('Completion record is too large')); return }
    chunks.push(chunk); done()
  } }))
  const record = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (record.format !== transferFormat || record.projectRef !== projectRef || record.reference !== reference || !Array.isArray(record.files) || record.files.length > 100002) throw new Error('Invalid R2 completion record')
  const names = new Set(); let total = 0
  for (const f of record.files) {
    if (typeof f.name !== 'string' || !validName(f.name) || names.has(f.name) || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[0-9a-f]{64}$/.test(f.sha256)) throw new Error('Invalid R2 recovery object')
    names.add(f.name); total += f.size
  }
  if (!names.has('manifest.bin') || !names.has('snapshot.json') || total > maxBytes) throw new Error('Incomplete or oversized R2 recovery snapshot')
  return record
}

export async function downloadSnapshot({ reference, out, key, store, maxBytes = defaultLimit }) {
  const destination = await privateDestination(out), staging = `${destination}.partial-${randomUUID()}`
  try {
    const record = await completionRecord(store, reference, maxBytes)
    await mkdir(staging, { mode: 0o700 })
    for (const f of record.files) {
      const hash = await digest(await store.get(`${reference}/${f.name}`), f.size, createWriteStream(join(staging, f.name), { flags: 'wx', mode: 0o600 }))
      if (hash !== f.sha256) throw new Error('R2 recovery object failed integrity validation')
    }
    const verified = await inspect({ snapshot: staging, key })
    const expected = (await snapshotArtifacts({ snapshot: staging, key })).files.map(f => f.name).sort()
    if (JSON.stringify(expected) !== JSON.stringify(record.files.map(f => f.name).sort())) throw new Error('Transport includes files outside the authenticated snapshot')
    await privateDestination(destination)
    await promote(staging, destination)
    return { downloadedAndDecryptionVerified: true, reference, fileCount: verified.fileCount, totalBytes: verified.totalBytes }
  } catch { await rm(staging, { recursive: true, force: true }); throw failed(validPrefix(reference) ? reference : null) }
}

async function cli() {
  const [command, first, out, ...extra] = process.argv.slice(2)
  if (command === '--help') { console.log('Usage: upload <encrypted-snapshot-directory> | download <snapshot-reference> <new-private-directory>'); return }
  if (!['upload', 'download'].includes(command) || !first || extra.length || (command === 'upload' ? out : !out)) throw failed(null)
  const config = r2Configuration(process.env), key = await loadKey(process.env.ACA_BACKUP_KEY_FILE), store = r2Store(config)
  const result = command === 'upload' ? await uploadSnapshot({ snapshot: first, key, store, maxBytes: config.maxBytes }) : await downloadSnapshot({ reference: first, out, key, store, maxBytes: config.maxBytes })
  console.log(JSON.stringify(result))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => { console.error(JSON.stringify({ completed: false, reference: error.reference ?? null, error: 'R2 recovery operation did not complete. Check the private configuration and snapshot integrity.' })); process.exitCode = 1 })
}

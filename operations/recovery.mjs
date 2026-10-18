import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdir, readFile, realpath, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

export const projectRef = 'ymmkodlifpxutynpjnxm'
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const format = 'aca-private-storage-v1'
const sha = () => createHash('sha256')
const within = (root, path) => path === root || path.startsWith(root + sep)

export function objectKey(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value)
      || isAbsolute(value) || value.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':'))) {
    throw new Error('Unsafe storage path')
  }
  return value
}

async function privateDestination(value) {
  if (!value) throw new Error('An explicit private destination is required')
  const parent = await realpath(dirname(resolve(value)))
  const path = join(parent, resolve(value).split(sep).at(-1))
  if (within(await realpath(repository), path)) throw new Error('Recovery files must stay outside the website repository')
  try { await lstat(path) } catch (error) { if (error.code === 'ENOENT') return path; throw error }
  throw new Error('Recovery destination already exists; refusing to overwrite it')
}

export function sourceUrl(value) {
  const url = new URL(value)
  if (url.href !== `https://${projectRef}.supabase.co/`) throw new Error('Source must be the existing ACA project')
  return url.origin
}

async function regularFile(path) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Recovery input must be a regular file')
  return path
}

async function promote(staging, destination) {
  // mkdir is exclusive: a racing writer cannot make us replace its directory.
  await mkdir(destination, { mode: 0o700 })
  try { await rename(staging, destination) }
  catch (error) { await rmdir(destination).catch(() => {}); throw error }
}

export async function loadKey(path) {
  if (!path) throw new Error('ACA_BACKUP_KEY_FILE must name a private 32-byte key file')
  const keyPath = await realpath(await regularFile(resolve(path)))
  if (within(await realpath(repository), keyPath)) throw new Error('Keep recovery keys outside the website repository')
  if (process.platform !== 'win32' && ((await lstat(keyPath)).mode & 0o077)) throw new Error('Recovery key permissions must be private to the owner')
  const key = await readFile(keyPath)
  if (key.length !== 32) throw new Error('Recovery key must contain exactly 32 random bytes')
  return key
}

async function encrypt(input, path, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv), hash = sha()
  let size = 0
  const meter = new Transform({ transform(chunk, _, done) { size += chunk.length; hash.update(chunk); done(null, chunk) } })
  await pipeline(input, meter, cipher, createWriteStream(path, { flags: 'wx', mode: 0o600 }))
  return { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), size, sha256: hash.digest('hex') }
}

async function decrypt(path, descriptor, key, sink) {
  if (!/^[0-9a-f]{24}$/.test(descriptor.iv) || !/^[0-9a-f]{32}$/.test(descriptor.tag)) throw new Error('Invalid encryption metadata')
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(descriptor.iv, 'hex'))
  cipher.setAuthTag(Buffer.from(descriptor.tag, 'hex'))
  const hash = sha(); let size = 0
  const meter = new Transform({ transform(chunk, _, done) { size += chunk.length; hash.update(chunk); done(null, chunk) } })
  await pipeline(createReadStream(await regularFile(path)), cipher, meter, sink)
  if (size !== descriptor.size || hash.digest('hex') !== descriptor.sha256) throw new Error('Recovery integrity check failed')
}

// Only bucket configuration and file metadata are read. No course tables are queried.
export async function inventory(client) {
  const { data, error } = await client.storage.listBuckets()
  if (error || !Array.isArray(data)) throw new Error('Could not list storage buckets')
  const buckets = data.map(b => ({ id: objectKey(b.id), public: b.public, file_size_limit: b.file_size_limit ?? null, allowed_mime_types: b.allowed_mime_types ?? null })).sort((a, b) => a.id.localeCompare(b.id))
  if (buckets.some(b => b.public || b.id.includes('/'))) throw new Error('This recovery tool accepts private buckets only')
  const files = [], seen = new Set()
  for (const bucket of buckets) {
    const pending = ['']
    while (pending.length) {
      const prefix = pending.pop()
      for (let offset = 0; ; offset += 100) {
        const page = await client.storage.from(bucket.id).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
        if (page.error || !Array.isArray(page.data)) throw new Error('Could not enumerate private storage')
        for (const item of page.data) {
          if (!item.name || item.name.includes('/')) throw new Error('Unexpected storage listing entry')
          const key = objectKey(prefix ? `${prefix}/${item.name}` : item.name), identity = `${bucket.id}/${key}`
          if (seen.has(identity)) throw new Error('Duplicate storage listing entry')
          seen.add(identity)
          if (seen.size > 100000) throw new Error('Storage inventory exceeded its safety limit')
          if (!item.id) { pending.push(key); continue }
          const size = Number(item.metadata?.size)
          if (!Number.isSafeInteger(size) || size < 0) throw new Error('Storage file size is unavailable')
          files.push({ bucket: bucket.id, key, id: item.id, updatedAt: item.updated_at, size, contentType: item.metadata?.mimetype ?? 'application/octet-stream' })
        }
        if (page.data.length < 100) break
      }
    }
  }
  files.sort((a, b) => `${a.bucket}/${a.key}`.localeCompare(`${b.bucket}/${b.key}`))
  return { buckets, files }
}

export async function backup({ client, out, key }) {
  const destination = await privateDestination(out), staging = `${destination}.partial-${randomBytes(8).toString('hex')}`
  const before = await inventory(client)
  await mkdir(staging, { mode: 0o700 })
  try {
    const files = []
    for (const [i, file] of before.files.entries()) {
      const { data, error } = await client.storage.from(file.bucket).download(file.key)
      if (error || !data?.stream) throw new Error('Could not copy a storage file')
      const encryptedFile = `${String(i).padStart(8, '0')}.bin`
      const encryption = await encrypt(Readable.fromWeb(data.stream()), join(staging, encryptedFile), key)
      if (encryption.size !== file.size) throw new Error('Storage file changed during backup')
      files.push({ ...file, encryptedFile, encryption })
    }
    if (JSON.stringify(before) !== JSON.stringify(await inventory(client))) throw new Error('Storage inventory changed during backup; snapshot rejected')
    const createdAt = new Date().toISOString()
    const manifest = { format, projectRef, createdAt, buckets: before.buckets, files }
    const encryption = await encrypt(Readable.from([JSON.stringify(manifest)]), join(staging, 'manifest.bin'), key)
    const summary = { format, projectRef, createdAt, fileCount: files.length, totalBytes: files.reduce((n, f) => n + f.size, 0), manifest: encryption }
    await writeFile(join(staging, 'snapshot.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    await inspect({ snapshot: staging, key })
    // Recheck immediately before promotion; never replace an existing snapshot.
    await privateDestination(destination)
    await promote(staging, destination)
    return summary
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error }
}

async function manifestFor(snapshot, key) {
  const directory = await realpath(snapshot)
  const summary = JSON.parse(await readFile(await regularFile(join(directory, 'snapshot.json')), 'utf8'))
  if (summary.format !== format || summary.projectRef !== projectRef) throw new Error('Unrecognized recovery snapshot')
  const chunks = []
  await decrypt(join(directory, 'manifest.bin'), summary.manifest, key, new Writable({ write(chunk, _, done) { chunks.push(chunk); done() } }))
  const manifest = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (manifest.format !== format || manifest.projectRef !== projectRef || !Array.isArray(manifest.files) || !Array.isArray(manifest.buckets)) throw new Error('Invalid recovery manifest')
  if (manifest.files.length !== summary.fileCount || manifest.files.reduce((n, f) => n + f.size, 0) !== summary.totalBytes) throw new Error('Recovery summary mismatch')
  const identities = new Set(), encryptedFiles = new Set(), buckets = new Set()
  for (const b of manifest.buckets) {
    objectKey(b.id)
    if (b.id.includes('/') || b.public !== false || buckets.has(b.id)) throw new Error('Invalid private bucket configuration')
    buckets.add(b.id)
  }
  for (const file of manifest.files) {
    objectKey(file.bucket); objectKey(file.key)
    if (!buckets.has(file.bucket) || !/^\d{8}\.bin$/.test(file.encryptedFile)) throw new Error('Invalid recovery file')
    const identity = `${file.bucket}/${file.key}`
    if (identities.has(identity) || encryptedFiles.has(file.encryptedFile)) throw new Error('Duplicate recovery file')
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size !== file.encryption.size) throw new Error('Invalid recovery size')
    identities.add(identity); encryptedFiles.add(file.encryptedFile)
  }
  return { directory, summary, manifest }
}

export async function inspect({ snapshot, key }) {
  const { directory, summary, manifest } = await manifestFor(snapshot, key)
  for (const file of manifest.files) await decrypt(join(directory, file.encryptedFile), file.encryption, key, new Writable({ write(_, __, done) { done() } }))
  return { verified: true, fileCount: summary.fileCount, totalBytes: summary.totalBytes, createdAt: summary.createdAt }
}

// Local proof only. There is deliberately no network upload or production restore command.
export async function restoreLocal({ snapshot, out, key }) {
  const destination = await privateDestination(out)
  const { directory, summary, manifest } = await manifestFor(snapshot, key)
  const staging = `${destination}.partial-${randomBytes(8).toString('hex')}`
  await mkdir(staging, { mode: 0o700 })
  try {
    for (const file of manifest.files) {
      const target = join(staging, file.bucket, ...file.key.split('/'))
      await mkdir(dirname(target), { recursive: true, mode: 0o700 })
      await decrypt(join(directory, file.encryptedFile), file.encryption, key, createWriteStream(target, { flags: 'wx', mode: 0o600 }))
    }
    await writeFile(join(staging, 'bucket-settings.json'), JSON.stringify(manifest.buckets, null, 2), { flag: 'wx', mode: 0o600 })
    await privateDestination(destination)
    await promote(staging, destination)
    return { restoredLocally: true, fileCount: summary.fileCount, totalBytes: summary.totalBytes }
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error }
}

export function configurationInventory(envs, required) {
  if (!Array.isArray(envs) || !Array.isArray(required)) throw new Error('Environment metadata is required')
  return required.map(key => {
    const matches = envs.filter(e => e.key === key && e.target?.includes('production') && !e.gitBranch)
    return { key, configured: matches.length === 1, needsSecureReentry: matches.some(e => e.type === 'sensitive' || e.visibility === 'secret') }
  })
}

async function cli() {
  const [command, ...args] = process.argv.slice(2)
  const allowed = new Set(['backup', 'verify', 'restore-local'])
  const usage = 'Usage: backup aca <new-private-directory> | verify <snapshot-directory> | restore-local <snapshot-directory> <new-private-directory>'
  if (command === '--help' || command === 'help') { console.log(usage); return }
  if (!allowed.has(command) || args.length !== (command === 'verify' ? 1 : 2)) throw new Error(usage)
  const key = await loadKey(process.env.ACA_BACKUP_KEY_FILE)
  let result
  if (command === 'backup') {
    if (args[0] !== 'aca') throw new Error('Backup source must be aca')
    const url = sourceUrl(process.env.SUPABASE_URL)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Authorized server-side storage credentials are required')
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    result = await backup({ client, out: args[1], key })
  } else result = await (command === 'verify' ? inspect : restoreLocal)({ snapshot: args[0], out: args[1], key })
  console.log(JSON.stringify(result))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(() => { console.error('Recovery operation did not complete. Check authorization, private paths, key, and snapshot integrity. No completion is claimed.'); process.exitCode = 1 })
}

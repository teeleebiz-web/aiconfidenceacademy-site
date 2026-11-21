import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { phaseTwoMediaFiles } from '../academy/phase-two-media.mjs'
import { inventory, projectRef } from './recovery.mjs'
import { sourceSnapshotLimit, manualConfiguration, verifyBackupDisk } from './manual-backup.mjs'
import { proposedRetryLimits } from './backup-retry-preview.mjs'

class MediaMigrationError extends Error {}

const files = Array.from({length: 6}, (_, j) => Array.from({length: 6}, (_, l) => phaseTwoMediaFiles(`${j+1}.${l+1}`))).flat(2)
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const mime = { '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.vtt': 'text/vtt', '.webp': 'image/webp', '.json': 'application/json' }

function requiredFormats(catalog) {
  const formats = catalog.map(file => mime[extname(file.path)])
  if (formats.some(format => !format)) throw new MediaMigrationError('Unrecognized media format in the approved catalog')
  return [...new Set(formats)]
}

const supportsFormat = (allowed, format) => allowed == null || allowed.includes(format) || allowed.includes(format.split('/')[0] + '/*')
const sameFormats = (left, right) => JSON.stringify(left == null ? null : [...left].sort()) === JSON.stringify(right == null ? null : [...right].sort())

// The approved copy may add only its exact catalog formats to this private bucket.
// Preserve the existing size limit and formats; never enable public access.
async function prepareBucketFormats(client, bucket, formats, approved) {
  const missing = formats.filter(format => !supportsFormat(bucket.allowed_mime_types, format))
  if (!missing.length) return []
  if (!approved) throw new MediaMigrationError('Private media bucket does not allow every required format')
  const current = await client.storage.getBucket(bucket.id)
  if (current.error || current.data?.id !== bucket.id || current.data.public !== false ||
      (current.data.file_size_limit ?? null) !== (bucket.file_size_limit ?? null) ||
      !sameFormats(current.data.allowed_mime_types, bucket.allowed_mime_types)) throw new MediaMigrationError('Private bucket settings changed during preflight')
  const allowedMimeTypes = [...new Set([...bucket.allowed_mime_types, ...missing])]
  const result = await client.storage.updateBucket(bucket.id, {
    public: false, fileSizeLimit: bucket.file_size_limit ?? null, allowedMimeTypes,
  })
  if (result.error) throw new MediaMigrationError('Private bucket format update failed')
  const verified = await client.storage.getBucket(bucket.id)
  if (verified.error || verified.data?.id !== bucket.id || verified.data.public !== false ||
      (verified.data.file_size_limit ?? null) !== (bucket.file_size_limit ?? null) ||
      !sameFormats(verified.data.allowed_mime_types, allowedMimeTypes)) throw new MediaMigrationError('Private bucket format update could not be verified')
  return missing
}

export function mediaMigrationPlan(existingBytes, alreadyPresentBytes = 0, catalog = files) {
  if (![existingBytes, alreadyPresentBytes].every(n => Number.isSafeInteger(n) && n >= 0) || alreadyPresentBytes > existingBytes) throw new MediaMigrationError('Invalid storage totals')
  const additionalBytes = catalog.reduce((n, f) => n + f.bytes, 0) - alreadyPresentBytes
  if (additionalBytes < 0) throw new MediaMigrationError('Invalid migrated total')
  const projectedBytes = existingBytes + additionalBytes
  const effectiveLimit = Math.min(sourceSnapshotLimit, proposedRetryLimits.maxSourceBytes, proposedRetryLimits.maxEncryptedBytes)
  return { files: catalog.length, additionalBytes, projectedBytes, backupLimitBytes: effectiveLimit,
    // Reserve space for encrypted manifests and metadata instead of filling the limit.
    capacityReady: projectedBytes + 64 * 1024 ** 2 <= effectiveLimit }
}

// No database rows, public files, existing objects, or learner timers are changed.
// A run may be resumed: existing objects must match the exact Git blob or it stops.
export async function migratePhaseTwoMedia({ client, root = '.', approved = false, verifyOnly = false, readInventory = inventory, catalog = files } = {}) {
  const files = catalog
  const snapshot = await readInventory(client)
  const bucket = snapshot.buckets.find(b => b.id === 'aca-learning-media')
  if (!bucket || bucket.public !== false) throw new MediaMigrationError('Existing private media bucket is required')
  const formats = requiredFormats(files)
  const present = new Map(snapshot.files.filter(f => f.bucket === bucket.id).map(f => [f.key, f]))
  for (const file of files) if (present.has(file.object) && present.get(file.object).size !== file.bytes) throw new MediaMigrationError('Existing destination size does not match; refusing to overwrite')
  const plan = mediaMigrationPlan(snapshot.files.reduce((n,f) => n+f.size,0), files.filter(f => present.has(f.object)).reduce((n,f) => n+f.bytes,0), files)
  if (!approved && !verifyOnly) return { ...plan, missingFormats: formats.filter(format => !supportsFormat(bucket.allowed_mime_types, format)), uploaded: 0, activationReady: false }
  if (!plan.capacityReady) throw new MediaMigrationError('The enforced backup and retry limits must cover the complete enlarged collection before migration')
  // Verify every local source before the first write. Do not accept symlink inputs.
  for (const file of files) {
    const path = resolve(root, file.path), stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes || gitHash(await readFile(path)) !== file.gitBlob) throw new MediaMigrationError('Source does not match the recorded Academy media')
    if (bucket.file_size_limit && file.bytes > bucket.file_size_limit) throw new MediaMigrationError('Bucket file limit is insufficient')
  }
  const addedFormats = await prepareBucketFormats(client, bucket, formats, approved && !verifyOnly)
  const storage = client.storage.from(bucket.id)
  let uploaded = 0, verified = 0
  for (const file of files) {
    if (!present.has(file.object)) {
      if (verifyOnly) throw new MediaMigrationError('Private media migration is incomplete')
      const result = await storage.upload(file.object, await readFile(resolve(root,file.path)), { upsert: false, contentType: mime[extname(file.path)], cacheControl: '0' })
      if (result.error) throw new MediaMigrationError('Private media upload failed; existing objects were not overwritten')
      uploaded++
    }
    const result = await storage.download(file.object)
    if (result.error || !result.data) throw new MediaMigrationError('Private media readback failed')
    const data = Buffer.from(await result.data.arrayBuffer())
    if (data.length !== file.bytes || gitHash(data) !== file.gitBlob) throw new MediaMigrationError('Private media readback differs from the approved source')
    verified++
  }
  return { ...plan, addedFormats, uploaded, verified, activationReady: false, next: 'Run the existing encrypted backup and full restore verification before enabling delivery or removing public copies.' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const command = process.argv[2] || 'plan'
  if (!['plan','upload','verify'].includes(command)) throw new MediaMigrationError('Use plan, upload, or verify')
  if (!process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY) throw new MediaMigrationError('Existing private source credential is required')
  if (command === 'upload' && process.env.ACA_PHASE_TWO_MEDIA_MIGRATION_APPROVED !== 'true') throw new MediaMigrationError('Migration activation approval is required')
  const client = createClient(`https://${projectRef}.supabase.co`, process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
  try {
    if (command === 'upload') {
      // Confirm recovery configuration and disk before expanding protected storage.
      const config = manualConfiguration(process.env)
      config.key.fill(0)
      console.log(JSON.stringify({ migrationDiskPreflight: await verifyBackupDisk() }))
    }
    console.log(JSON.stringify(await migratePhaseTwoMedia({client,approved:command==='upload',verifyOnly:command==='verify'})))
  }
  catch (error) {
    // Only our own fixed messages may enter logs; provider bodies can contain secrets.
    console.error(error instanceof MediaMigrationError ? error.message : 'Unexpected private media migration error')
    console.error('Media migration did not complete. No activation, public removal, or source overwrite was performed.')
    process.exitCode = 1
  }
}

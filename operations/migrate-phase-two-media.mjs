import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { phaseTwoMediaFiles } from '../academy/phase-two-media.mjs'
import { inventory, projectRef } from './recovery.mjs'
import { sourceSnapshotLimit } from './manual-backup.mjs'
import { proposedRetryLimits } from './backup-retry-preview.mjs'

const files = Array.from({length: 6}, (_, j) => Array.from({length: 6}, (_, l) => phaseTwoMediaFiles(`${j+1}.${l+1}`))).flat(2)
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const mime = { '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.vtt': 'text/vtt', '.webp': 'image/webp', '.json': 'application/json' }

export function mediaMigrationPlan(existingBytes, alreadyPresentBytes = 0) {
  if (![existingBytes, alreadyPresentBytes].every(n => Number.isSafeInteger(n) && n >= 0) || alreadyPresentBytes > existingBytes) throw new Error('Invalid storage totals')
  const additionalBytes = files.reduce((n, f) => n + f.bytes, 0) - alreadyPresentBytes
  if (additionalBytes < 0) throw new Error('Invalid migrated total')
  const projectedBytes = existingBytes + additionalBytes
  const effectiveLimit = Math.min(sourceSnapshotLimit, proposedRetryLimits.maxSourceBytes, proposedRetryLimits.maxEncryptedBytes)
  return { files: files.length, additionalBytes, projectedBytes, backupLimitBytes: effectiveLimit,
    // Reserve space for encrypted manifests and metadata instead of filling the limit.
    capacityReady: projectedBytes + 64 * 1024 ** 2 <= effectiveLimit }
}

// No database rows, public files, existing objects, or learner timers are changed.
// A run may be resumed: existing objects must match the exact Git blob or it stops.
export async function migratePhaseTwoMedia({ client, root = '.', approved = false, verifyOnly = false, readInventory = inventory } = {}) {
  const snapshot = await readInventory(client)
  const bucket = snapshot.buckets.find(b => b.id === 'aca-learning-media')
  if (!bucket || bucket.public !== false) throw new Error('Existing private media bucket is required')
  const present = new Map(snapshot.files.filter(f => f.bucket === bucket.id).map(f => [f.key, f]))
  for (const file of files) if (present.has(file.object) && present.get(file.object).size !== file.bytes) throw new Error('Existing destination size does not match; refusing to overwrite')
  const plan = mediaMigrationPlan(snapshot.files.reduce((n,f) => n+f.size,0), files.filter(f => present.has(f.object)).reduce((n,f) => n+f.bytes,0))
  if (!approved && !verifyOnly) return { ...plan, uploaded: 0, activationReady: false }
  if (!plan.capacityReady) throw new Error('The enforced backup and retry limits must cover the complete enlarged collection before migration')
  // Verify every local source before the first write. Do not accept symlink inputs.
  for (const file of files) {
    const path = resolve(root, file.path), stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes || gitHash(await readFile(path)) !== file.gitBlob) throw new Error('Source does not match the recorded Academy media')
    if (bucket.file_size_limit && file.bytes > bucket.file_size_limit) throw new Error('Bucket file limit is insufficient')
  }
  const storage = client.storage.from(bucket.id)
  let uploaded = 0, verified = 0
  for (const file of files) {
    if (!present.has(file.object)) {
      if (verifyOnly) throw new Error('Private media migration is incomplete')
      const result = await storage.upload(file.object, await readFile(resolve(root,file.path)), { upsert: false, contentType: mime[extname(file.path)], cacheControl: '0' })
      if (result.error) throw new Error('Private media upload failed; existing objects were not overwritten')
      uploaded++
    }
    const result = await storage.download(file.object)
    if (result.error || !result.data) throw new Error('Private media readback failed')
    const data = Buffer.from(await result.data.arrayBuffer())
    if (data.length !== file.bytes || gitHash(data) !== file.gitBlob) throw new Error('Private media readback differs from the approved source')
    verified++
  }
  return { ...plan, uploaded, verified, activationReady: false, next: 'Run the existing encrypted backup and full restore verification before enabling delivery or removing public copies.' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const command = process.argv[2] || 'plan'
  if (!['plan','upload','verify'].includes(command)) throw new Error('Use plan, upload, or verify')
  if (!process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY) throw new Error('Existing private source credential is required')
  if (command === 'upload' && process.env.ACA_PHASE_TWO_MEDIA_MIGRATION_APPROVED !== 'true') throw new Error('Migration activation approval is required')
  const client = createClient(`https://${projectRef}.supabase.co`, process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})
  try { console.log(JSON.stringify(await migratePhaseTwoMedia({client,approved:command==='upload',verifyOnly:command==='verify'}))) }
  catch { console.error('Media migration did not complete. No activation, public removal, or source overwrite was performed.'); process.exitCode=1 }
}

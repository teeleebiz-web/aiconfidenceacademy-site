import { mkdtemp, rm, statfs } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { backup, projectRef, restoreLocal } from './recovery.mjs'
import { downloadSnapshot, r2Configuration, r2Store, uploadSnapshot } from './r2-transfer.mjs'

const limit = 2 * 1024 ** 3
const safeReference = value => /^aca-backups\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value ?? '') ? value : null

export function manualConfiguration(env) {
  if (env.ACA_BACKUP_OWNER_KEY_SAVED !== 'true' || env.ACA_BACKUP_SOURCE_ACCESS_CONFIRMED !== 'true') throw new Error('Owner confirmation is required')
  const encoded = env.ACA_BACKUP_KEY_BASE64?.trim() ?? ''
  const key = Buffer.from(encoded, 'base64')
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded) || key.length !== 32 || key.toString('base64') !== encoded) throw new Error('A canonical 32-byte recovery key is required')
  if (!env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY) throw new Error('Authorized private source access is required')
  const destination = env.ACA_R2_PRIVATE_CONFIRMED ?? ''
  const match = /^([0-9a-f]{32})\/aca-private-backups$/.exec(destination)
  if (!match) throw new Error('The verified private destination is required')
  const r2 = r2Configuration({
    ACA_R2_ACCOUNT_ID: match[1], ACA_R2_BUCKET: 'aca-private-backups',
    ACA_R2_PRIVATE_CONFIRMED: destination,
    ACA_R2_ACCESS_KEY_ID: env.ACA_R2_ACCESS_KEY_ID,
    ACA_R2_SECRET_ACCESS_KEY: env.ACA_R2_SECRET_ACCESS_KEY,
    ACA_R2_MAX_SNAPSHOT_BYTES: String(limit),
  })
  return { key, r2, sourceUrl: `https://${projectRef}.supabase.co`, sourceKey: env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY }
}

async function diskBytes() {
  const disk = await statfs(tmpdir(), { bigint: true })
  return disk.bavail * disk.bsize
}

export async function manualBackup({ env = process.env, createSource = createClient, createStore = r2Store, availableBytes = diskBytes } = {}) {
  let stage = 'configuration', root, key, reference = null
  try {
    const config = manualConfiguration(env)
    key = config.key
    stage = 'private-disk-preflight'
    // Two encrypted snapshots, one plaintext restore and overhead stay private.
    if (BigInt(await availableBytes()) < BigInt(limit) * 3n + 512n * 1024n ** 2n) throw new Error('Insufficient private temporary disk')
    root = await mkdtemp(join(tmpdir(), 'aca-manual-backup-'))
    const snapshot = join(root, 'snapshot'), downloaded = join(root, 'downloaded'), restored = join(root, 'restored')
    const client = createSource(config.sourceUrl, config.sourceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    stage = 'source-snapshot'
    const original = await backup({ client, out: snapshot, key, maxBytes: limit })
    if (original.fileCount < 1 || original.totalBytes < 1) throw new Error('No ACA file bytes were protected')
    stage = 'upload-and-readback'
    const store = createStore(config.r2)
    const uploaded = await uploadSnapshot({ snapshot, key, store, maxBytes: limit })
    reference = uploaded.reference
    stage = 'saved-copy-download-and-decryption'
    const saved = await downloadSnapshot({ reference, out: downloaded, key, store, maxBytes: limit })
    stage = 'saved-copy-local-recovery'
    // restoreLocal authenticates every original SHA-256 and size from the
    // encrypted source manifest while writing to this fresh private directory.
    const recovered = await restoreLocal({ snapshot: downloaded, out: restored, key })
    if (saved.fileCount !== original.fileCount || saved.totalBytes !== original.totalBytes || recovered.fileCount !== original.fileCount || recovered.totalBytes !== original.totalBytes) throw new Error('Saved-copy recovery summary differs')
    return { liveAcaBackup: true, uploadedAndReadbackVerified: true, savedCopyDecryptionVerified: true, restoredWithOriginalHashesVerified: true, reference, fileCount: original.fileCount, totalBytes: original.totalBytes, encryptedBytes: uploaded.encryptedBytes }
  } catch (cause) {
    const error = new Error('Manual ACA file backup did not complete')
    error.stage = stage
    error.reference = safeReference(reference ?? cause?.reference)
    throw error
  } finally {
    key?.fill(0)
    if (root) await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  manualBackup().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(JSON.stringify({ liveAcaBackup: false, stage: error.stage ?? 'initialization', reference: error.reference ?? null }))
    process.exitCode = 1
  })
}

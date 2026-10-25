import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { backup, restoreLocal } from './recovery.mjs'
import { downloadSnapshot, r2Configuration, r2Store, uploadSnapshot } from './r2-transfer.mjs'

const connectionReference = reference => reference.replace(/^aca-backups\//, 'aca-connection-checks/')

// This source is synthetic and has no Supabase client or production credentials.
function fixtureSource(bytes) {
  return { storage: {
    async listBuckets() { return { data: [{ id: 'connection-check', public: false }] } },
    from() { return {
      async list() { return { data: [{ id: 'synthetic', name: 'synthetic.bin', updated_at: 'fixed', metadata: { size: bytes.length } }] } },
      async download() { return { data: new Blob([bytes]) } },
    } },
  } }
}

export async function checkConnection({ env = process.env, createStore = r2Store } = {}) {
  let stage = 'configuration', reference = null, root
  try {
    const destination = env.ACA_R2_PRIVATE_CONFIRMED ?? ''
    const match = /^([0-9a-f]{32})\/aca-private-backups$/.exec(destination)
    if (!match) throw new Error('Confirm the verified private destination')
    const config = r2Configuration({
      ACA_R2_ACCOUNT_ID: match[1], ACA_R2_BUCKET: 'aca-private-backups',
      ACA_R2_PRIVATE_CONFIRMED: destination,
      ACA_R2_ACCESS_KEY_ID: env.ACA_R2_ACCESS_KEY_ID,
      ACA_R2_SECRET_ACCESS_KEY: env.ACA_R2_SECRET_ACCESS_KEY,
      ACA_R2_MAX_SNAPSHOT_BYTES: '65536',
    })
    const remote = createStore(config)
    const store = {
      put: (path, ...args) => remote.put(connectionReference(path), ...args),
      get: path => remote.get(connectionReference(path)),
    }
    const bytes = randomBytes(4096), key = randomBytes(32)
    root = await mkdtemp(join(tmpdir(), 'aca-r2-connection-'))
    const snapshot = join(root, 'snapshot'), downloaded = join(root, 'downloaded')
    stage = 'synthetic-encryption'
    await backup({ client: fixtureSource(bytes), out: snapshot, key })
    stage = 'upload-and-readback'
    const upload = await uploadSnapshot({ snapshot, key, store, maxBytes: config.maxBytes })
    reference = upload.reference
    stage = 'download-and-decryption'
    await downloadSnapshot({ reference, out: downloaded, key, store, maxBytes: config.maxBytes })
    stage = 'recovered-byte-comparison'
    const restored = join(root, 'restored')
    await restoreLocal({ snapshot: downloaded, out: restored, key })
    if (!(await readFile(join(restored, 'connection-check', 'synthetic.bin'))).equals(bytes)) throw new Error('Recovered fixture differs')
    return { connectionVerified: true, syntheticOnly: true, liveAcaBackup: false, reference: connectionReference(reference), originalBytes: bytes.length, encryptedBytes: upload.encryptedBytes }
  } catch (cause) {
    const error = new Error('R2 connection check did not complete')
    error.stage = stage
    const candidate = reference ?? cause.reference
    error.reference = /^aca-backups\/[0-9a-f-]{36}$/.test(candidate ?? '') ? connectionReference(candidate) : null
    throw error
  } finally {
    if (root) await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkConnection().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(JSON.stringify({ connectionVerified: false, syntheticOnly: true, liveAcaBackup: false, stage: error.stage ?? 'initialization', reference: error.reference ?? null }))
    process.exitCode = 1
  })
}

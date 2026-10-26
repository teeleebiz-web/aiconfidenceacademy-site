import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { automaticBackup, backupFormat, backupJob, pinnedBackup, retentionPlan } from './automatic-backup.mjs'
import { pruneSnapshot } from './r2-transfer.mjs'
import { projectRef } from './recovery.mjs'

const saved = () => ({ format: backupFormat, reference: `aca-backups/${randomUUID()}`, liveAcaBackup: true, uploadedAndReadbackVerified: true, savedCopyDecryptionVerified: true, restoredWithOriginalHashesVerified: true, fileCount: 1, totalBytes: 1, encryptedBytes: 9 })
const history = (n = 10) => Array.from({ length: n }, (_, i) => ({ id: randomUUID(), job: backupJob, status: 'completed', finished_at: new Date(Date.UTC(2026, 9, 26 - i, 19)).toISOString(), result: saved() }))
function fixture() {
  const policy = { id: true, enabled: true, activated_at: '2026-10-26T00:00:00Z', keep_daily: 7, prune_enabled: false, credential_expires_at: '2026-11-01T00:00:00Z' }
  const rows = [], deletions = []
  let backups = 0, failStart = false, failFinish = false
  const db = { from(table) {
    if (table === 'aca_backup_automation') return { select() { return this }, eq() { return this }, async single() { return { data: policy } } }
    assert.equal(table, 'aca_automation_runs')
    let insert, update, id
    const q = {
      select() { return q }, eq(k, v) { if (k === 'id') id = v; return q }, order() { return q }, limit() { return q },
      insert(v) { insert = v; return q }, update(v) { update = v; return q },
      async single() { if (failStart) return { error: Error('secret failure') }; const r = { id: randomUUID(), ...insert }; rows.unshift(r); return { data: r } },
      then(ok, bad) { return Promise.resolve().then(() => {
        if (update) { if (failFinish) return { error: Error('private database failure') }; Object.assign(rows.find(r => r.id === id), update); return { data: null } }
        return { data: rows }
      }).then(ok, bad) },
    }
    return q
  } }
  const env = { GITHUB_REPOSITORY: 'teeleebiz-web/aiconfidenceacademy-site', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'schedule', GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '1', ACA_R2_PRIVATE_CONFIRMED: `${'a'.repeat(32)}/aca-private-backups`, ACA_BACKUP_OWNER_KEY_SAVED: 'true', ACA_BACKUP_SOURCE_ACCESS_CONFIRMED: 'true', ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY: 'test-only-source', ACA_BACKUP_KEY_BASE64: Buffer.alloc(32, 7).toString('base64'), ACA_R2_ACCESS_KEY_ID: 'test-only-access', ACA_R2_SECRET_ACCESS_KEY: 'test-only-secret' }
  const options = { env, db, now: () => new Date('2026-10-26T19:00:00Z'), async runBackup() { backups++; return saved() }, makeStore: () => ({}), async prune({ reference }) { deletions.push(reference) } }
  return { policy, rows, deletions, options, get backups() { return backups }, set failStart(v) { failStart = v }, set failFinish(v) { failFinish = v } }
}

test('disabled automation does not read source files, record a run, or delete copies', async () => {
  const c = fixture(); c.policy.enabled = false
  assert.deepEqual(await automaticBackup(c.options), { automatedBackup: false, held: 'not-activated' })
  assert.equal(c.backups, 0); assert.equal(c.rows.length, 0); assert.equal(c.deletions.length, 0)
})
test('forks, non-main branches, untrusted events and absent workflow identity fail before live work', async () => {
  for (const [k, v] of [['GITHUB_REPOSITORY', 'attacker/repo'], ['GITHUB_REF', 'refs/heads/other'], ['GITHUB_EVENT_NAME', 'pull_request'], ['GITHUB_RUN_ID', ''], ['GITHUB_RUN_ATTEMPT', 'no']]) {
    const c = fixture(); c.options.env[k] = v
    await assert.rejects(automaticBackup(c.options), /needs review/)
    assert.equal(c.backups, 0); assert.equal(c.rows.length, 0)
  }
})
test('start-history failure prevents an untracked live copy; expiry also stops before source work', async () => {
  const c = fixture(); c.failStart = true
  await assert.rejects(automaticBackup(c.options), /needs review/); assert.equal(c.backups, 0)
  c.failStart = false; c.policy.credential_expires_at = '2026-10-26T19:59:00Z'
  await assert.rejects(automaticBackup(c.options), /needs review/)
  assert.equal(c.backups, 0); assert.equal(c.rows[0].status, 'failed')
  assert.equal(c.rows[0].result.stage, 'credential-preflight')
})
test('verified recovery is recorded before retention; deletion stays off until separately activated', async () => {
  const c = fixture()
  const result = await automaticBackup(c.options)
  assert.equal(result.automatedBackup, true)
  assert.equal(c.rows[0].status, 'completed'); assert.equal(c.backups, 1)
  assert.deepEqual(result.retention, { held: 'deletion-not-activated' }); assert.equal(c.deletions.length, 0)
})
test('partial recovery, source failure and lost history responses never trigger retention', async () => {
  for (const mode of ['partial', 'throw', 'history']) {
    const c = fixture(); c.policy.prune_enabled = true
    if (mode === 'partial') c.options.runBackup = async () => ({ ...saved(), restoredWithOriginalHashesVerified: false })
    if (mode === 'throw') c.options.runBackup = async () => { throw Error('source path and secret provider response') }
    if (mode === 'history') c.failFinish = true
    await assert.rejects(automaticBackup(c.options), e => e.message === 'Automatic ACA backup needs review')
    assert.equal(c.deletions.length, 0)
    assert.doesNotMatch(JSON.stringify(c.rows), /source path|secret provider response/)
  }
})
test('retention keeps seven verified automatic copies, the replacement, and the manual baseline', () => {
  const rows = history()
  rows.push({ ...rows[0], id: randomUUID(), result: { ...saved(), reference: pinnedBackup } })
  rows.push({ ...rows[9], id: randomUUID(), job: 'manual-backup', result: saved() })
  rows.push({ ...rows[9], id: randomUUID(), result: { ...saved(), restoredWithOriginalHashesVerified: false } })
  rows.push({ ...rows[9], id: randomUUID(), result: { ...saved(), prunedAt: '2026-10-26T18:00:00Z' } })
  rows.push({ ...rows[0], id: randomUUID() })
  const plan = retentionPlan(rows, 7, rows[0].result)
  assert.equal(plan.retained.length, 7); assert.equal(plan.prune.length, 3)
  assert.ok(plan.prune.every(row => row.result.reference !== pinnedBackup))
  assert.throws(() => retentionPlan(rows, 6, rows[0].result))
  assert.throws(() => retentionPlan(rows, 7, saved()))
  assert.throws(() => retentionPlan(Array(1000).fill(rows[0]), 7, rows[0].result))
})
test('authorized retention follows a durable replacement; pruning failure preserves it with a warning', async () => {
  const c = fixture(); c.policy.prune_enabled = true; c.rows.push(...history())
  c.options.prune = async () => { assert.equal(c.rows[0].status, 'completed'); assert.equal(c.rows[0].result.restoredWithOriginalHashesVerified, true); throw Error('private R2 failure') }
  await assert.rejects(automaticBackup(c.options), /needs review/)
  assert.equal(c.rows[0].status, 'warning'); assert.equal(c.rows[0].result.restoredWithOriginalHashesVerified, true)
  assert.equal(c.rows[0].result.stage, 'retention')
})
test('successful retention records deletion only after each exact old copy is removed', async () => {
  const c = fixture(); c.policy.prune_enabled = true; c.rows.push(...history())
  const result = await automaticBackup(c.options)
  assert.deepEqual(result.retention, { kept: 7, pruned: 4, manualBaselinePreserved: true })
  assert.equal(c.deletions.length, 4)
  assert.ok(c.rows.filter(r => r.result.prunedAt).every(r => c.deletions.includes(r.result.reference)))
  assert.ok(!c.deletions.includes(result.reference))
})
test('retention deletes only recorded encrypted artifacts; private completion tombstone supports retry', async () => {
  const ref = `aca-backups/${randomUUID()}`, removed = []
  const files = ['00000000.bin', 'manifest.bin', 'snapshot.json'].map(name => ({ name, size: 3, sha256: 'a'.repeat(64) }))
  let completion = { format: 'aca-r2-transfer-v1', projectRef, reference: ref, files }
  const store = { async get(key) { assert.equal(key, `${ref}/complete.json`); return Readable.from([Buffer.from(JSON.stringify(completion))]) }, async remove(key) { removed.push(key) } }
  await pruneSnapshot({ reference: ref, store, fileCount: 1, encryptedBytes: 9 })
  await pruneSnapshot({ reference: ref, store, fileCount: 1, encryptedBytes: 9 })
  assert.deepEqual(removed, [...files, ...files].map(f => `${ref}/${f.name}`))
  assert.ok(!removed.some(key => key.endsWith('complete.json')))
  await assert.rejects(pruneSnapshot({ reference: pinnedBackup, store, fileCount: 1, encryptedBytes: 9 }))
  await assert.rejects(pruneSnapshot({ reference: ref, store, fileCount: 1, encryptedBytes: 10 }))
  completion.reference = `aca-backups/${randomUUID()}`
  await assert.rejects(pruneSnapshot({ reference: ref, store, fileCount: 1, encryptedBytes: 9 }))
  completion.reference = ref
  completion.files[0].name = '../other-copy'
  await assert.rejects(pruneSnapshot({ reference: ref, store, fileCount: 1, encryptedBytes: 9 }))
  assert.equal(removed.length, 6)
})

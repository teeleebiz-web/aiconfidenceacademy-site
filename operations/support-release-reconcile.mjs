import { createHash } from 'node:crypto'
import { makeClients, permittedOutput } from './support-release.mjs'
import { validSha } from '../academy/support/code-policy.mjs'
const digest = data => createHash('sha256').update(data).digest('hex')
const checked = result => { if (result.error) throw new Error('Release reconciliation ledger unavailable'); return result.data }

export async function servedRevision(output, fetcher = fetch) {
  if (!Array.isArray(output) || output.length < 3 || output.length > 100) return false
  for (const file of output) {
    if (!permittedOutput(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) return false
    const response = await fetcher(`https://aiconfidenceacademy.org/${file.path}?aca-revision=${file.sha256.slice(0,16)}`, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } })
    if (!response.ok || Number(response.headers.get('content-length')) > 2 * 1024 * 1024) return false
    const reader = response.body.getReader(), chunks = []; let length = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 2 * 1024 * 1024) { await reader.cancel(); return false }
      chunks.push(value)
    }
    if (digest(Buffer.concat(chunks)) !== file.sha256) return false
  }
  const health = await fetcher('https://checkout.aiconfidenceacademy.org/api/health', { redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (!health.ok) return false
  const body = await health.json()
  return body.service === 'aca-backend' && body.status === 'ok'
}
export async function rollbackRelease({ github, releaseSha, baseSha }) {
  if (!validSha(releaseSha) || !validSha(baseSha)) throw new Error('Invalid rollback revision')
  if ((await github('/git/ref/heads/main')).object.sha !== releaseSha) return false
  const base = await github(`/git/commits/${baseSha}`)
  const commit = await github('/git/commits', 'POST', { message: 'Restore previous Academy revision after automatic repair deployment failure', tree: base.tree.sha, parents: [releaseSha] })
  await github('/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false })
  await github('/pages/builds', 'POST', {})
  return true
}
export async function reconcileReleases({ db, github, fetcher = fetch, now = Date.now() }) {
  const rows = checked(await db.from('aca_support_releases').select('*').in('status', ['published','needs_attention']).not('release_sha','is',null).order('created_at').limit(3))
  for (const release of rows) {
    try {
      const job = checked(await db.from('aca_support_code_jobs').select('base_sha,case_id,generation').eq('id',release.job_id).single())
      if (!validSha(release.release_sha) || !validSha(job.base_sha)) throw new Error('Invalid release revision')
      // Both sites must actually serve the checked release. A successful CI alone
      // is never treated as a successful publication or requester recovery.
      const states = await github(`/commits/${release.release_sha}/status`)
      const backend = states.statuses.find(item => item.context?.startsWith('Vercel') && item.target_url?.includes('aiconfidenceacademy-site-mkvf'))
      const pages = await github('/pages/builds/latest')
      const pagesReady = pages.commit === release.release_sha && pages.status === 'built'
      const backendReady = backend?.state === 'success'
      if (pagesReady && backendReady && await servedRevision(release.verification?.output,fetcher)) {
        checked(await db.from('aca_support_releases').update({ status:'verified', updated_at:new Date(now).toISOString() }).eq('job_id',release.job_id))
        // Publication evidence is separate from a learner's private symptom.
        // Preserve the open case for its existing recovery/response process.
        continue
      }
      const failed = backend?.state === 'failure' || backend?.state === 'error' || (pages.commit === release.release_sha && pages.status === 'errored')
      if (failed) {
        const restored = await rollbackRelease({ github, releaseSha:release.release_sha, baseSha:job.base_sha })
        checked(await db.from('aca_support_releases').update({ status:restored?'rolled_back':'needs_attention',updated_at:new Date(now).toISOString() }).eq('job_id',release.job_id))
      } else if (now - Date.parse(release.created_at) > 30 * 60 * 1000) {
        checked(await db.from('aca_support_releases').update({ status:'needs_attention',updated_at:new Date(now).toISOString() }).eq('job_id',release.job_id))
      }
    } catch {
      // Keep an uncertain publication open for the next existing diagnostic run.
      await db.from('aca_support_releases').update({ status:'needs_attention',updated_at:new Date(now).toISOString() }).eq('job_id',release.job_id)
    }
  }
  return rows.length
}
if (process.argv[1]?.endsWith('/support-release-reconcile.mjs')) {
  const { db, github } = makeClients(process.env,true)
  reconcileReleases({db,github}).then(count => console.log(`Reconciled ${count} automatic repair publications; requester cases preserved.`)).catch(() => { console.error('Release reconciliation unavailable; no case was closed.'); process.exitCode=1 })
}

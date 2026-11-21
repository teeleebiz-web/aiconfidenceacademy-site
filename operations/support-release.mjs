import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { codeSources, validId, validSha } from '../academy/support/code-policy.mjs'

const repository = 'teeleebiz-web/aiconfidenceacademy-site'
const planFile = '/tmp/aca-support-release.json'
const outputRoot = '/tmp/aca-support-output/learn'
const digest = data => createHash('sha256').update(data).digest('hex')
const checked = result => {
  if (result.error) throw new Error('Support release ledger unavailable')
  return result.data
}
export function permittedRepairFiles(files) {
  if (!Array.isArray(files) || files.length > 4) return false
  const source = files.filter(file => !/^portal\/src\/agent-regression-[a-f0-9]{64}(?:-\d+)?\.test\.tsx$/.test(file.filename))
  const regression = files.filter(file => /^portal\/src\/agent-regression-[a-f0-9]{64}(?:-\d+)?\.test\.tsx$/.test(file.filename))
  return source.length > 0 && source.length <= 3 && regression.length === 1 && regression[0].status === 'added'
    && source.every(file => file.status === 'modified')
    && Object.values(codeSources).some(allowed => source.every(file => allowed.includes(file.filename)))
}
export function permittedOutput(path) {
  return path === 'learn/index.html' || path === 'control-center/index.html'
    || /^learn\/assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(path)
}
export function makeClients(env, reconcile = false) {
  if (env.GITHUB_REPOSITORY !== repository || env.GITHUB_REF !== 'refs/heads/main'
    || !['workflow_run', ...(reconcile ? ['workflow_dispatch'] : [])].includes(env.GITHUB_EVENT_NAME)
    || (!reconcile && !/^\d+$/.test(env.ACA_RELEASE_RUN_ID || ''))) {
    throw new Error('Untrusted support release event')
  }
  if (!env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY || !env.GITHUB_TOKEN) throw new Error('Release credentials unavailable')
  const db = createClient('https://ymmkodlifpxutynpjnxm.supabase.co', env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const github = async (path, method = 'GET', body) => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new Error(`Support release GitHub operation failed (${response.status})`)
    return response.status === 204 ? null : response.json()
  }
  return { db, github }
}
export async function releaseContext(db, github, runId) {
  const settings = checked(await db.from('aca_support_code_settings').select('enabled,auto_release_enabled').eq('id', true).single())
  if (!settings.enabled || !settings.auto_release_enabled) return null
  const run = await github(`/actions/runs/${runId}`)
  if (run.name !== 'ACA learner portal checks' || run.conclusion !== 'success'
    || run.event !== 'workflow_dispatch' || run.repository?.full_name !== repository
    || !run.head_branch?.startsWith('aca-agent/') || !validSha(run.head_sha)) return null
  const jobId = run.head_branch.slice('aca-agent/'.length)
  if (!validId(jobId)) return null
  const job = checked(await db.from('aca_support_code_jobs').select('*').eq('id', jobId).single())
  if (!['draft_ready', 'branch_ready'].includes(job.status) || !job.regression_failed_before || !job.checks_passed_after || job.reserved_cents !== 25) return null
  const request = checked(await db.from('aca_support_cases').select('status').eq('id', job.case_id).single())
  const investigation = checked(await db.from('aca_support_investigations').select('generation').eq('case_id', job.case_id).single())
  if (request.status === 'resolved' || investigation.generation !== job.generation) return null
  const jobs = await github(`/actions/runs/${runId}/jobs?per_page=100`)
  if (!['verify', 'retry-database', 'code-isolation'].every(name => jobs.jobs.some(item => item.name === name && item.conclusion === 'success'))) {
    throw new Error('Required isolated checks are incomplete')
  }
  const main = await github('/git/ref/heads/main')
  if (main.object.sha !== job.base_sha) return null
  const branch = await github(`/git/ref/heads/${run.head_branch}`)
  if (branch.object.sha !== run.head_sha) return null
  const comparison = await github(`/compare/${job.base_sha}...${run.head_sha}`)
  if (comparison.status !== 'ahead' || comparison.files?.length > 4 || !permittedRepairFiles(comparison.files || [])) {
    throw new Error('Candidate exceeds the supported repair scope')
  }
  return { jobId, caseId: job.case_id, generation: job.generation, baseSha: job.base_sha, sourceSha: run.head_sha, runId }
}
export async function planRelease({ db, github, runId }) {
  const context = await releaseContext(db, github, runId)
  if (!context) return null
  const previous = checked(await db.from('aca_support_releases').select('status').eq('job_id', context.jobId).maybeSingle())
  if (previous) return null // An uncertain publication is reconciled, never published twice.
  checked(await db.from('aca_support_releases').insert({ job_id: context.jobId, source_sha: context.sourceSha, status: 'preparing' }))
  return context
}
async function outputFiles() {
  const entries = []
  const html = await readFile(join(outputRoot, 'index.html'), 'utf8')
  entries.push({ path: 'learn/index.html', content: html })
  entries.push({ path: 'control-center/index.html', content: html.replace('<title>ACA Learner Portal</title>', '<title>Academy Control Center | AI Confidence Academy</title>').replace('The secure AI Confidence Academy learner portal.', 'The protected AI Confidence Academy owner control center.') })
  for (const name of await readdir(join(outputRoot, 'assets'))) {
    const path = `learn/assets/${name}`
    if (!permittedOutput(path)) continue
    const full = join(outputRoot, 'assets', name)
    const stat = await lstat(full)
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('Unexpected compiled support repair output')
    entries.push({ path, content: await readFile(full, 'utf8') })
  }
  if (entries.length < 3 || entries.length > 100) throw new Error('Unexpected compiled support repair output count')
  return entries
}
export async function publishRelease({ db, github, plan, files, publicSite = false }) {
  const current = await releaseContext(db, github, plan.runId)
  if (!current || JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('Support release changed during the build')
  if (files.length < 3 || files.length > 100 || !files.every(file => permittedOutput(file.path) && typeof file.content === 'string' && Buffer.byteLength(file.content) <= 2 * 1024 * 1024)) throw new Error('Unapproved compiled output path')
  const base = await github(`/git/commits/${plan.sourceSha}`)
  const tree = await github('/git/trees', 'POST', { base_tree: base.tree.sha, tree: files.map(file => ({ ...file, mode: '100644', type: 'blob' })) })
  const commit = await github('/git/commits', 'POST', { message: 'Apply verified automatic Academy technical repair', tree: tree.sha, parents: [plan.baseSha] })
  checked(await db.from('aca_support_releases').update({ release_sha: commit.sha, verification: { checks_run_id: plan.runId, output: files.map(file => ({ path: file.path, sha256: digest(file.content) })) }, updated_at: new Date().toISOString() }).eq('job_id', plan.jobId).eq('status', 'preparing'))
  // force:false preserves simultaneous work. A changed main makes this fail.
  await github('/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false })
  checked(await db.from('aca_support_releases').update({ status: 'published', updated_at: new Date().toISOString() }).eq('job_id', plan.jobId))
  // GITHUB_TOKEN commits need an explicit Pages build. Backend publication is
  // the existing Vercel Git integration. Neither change introduces a new host.
  if (!publicSite) await github('/pages/builds', 'POST', {})
  await github('/actions/workflows/portal-ci.yml/dispatches', 'POST', { ref: 'main' })
  return commit.sha
}
async function main() {
  const { db, github } = makeClients(process.env)
  if (process.argv[2] === 'failed') {
    const plan = JSON.parse(await readFile(planFile, 'utf8').catch(() => 'null'))
    if (plan) checked(await db.from('aca_support_releases').update({ status: 'needs_attention', updated_at: new Date().toISOString() }).eq('job_id',plan.jobId).eq('status','preparing'))
    return
  }
  if (process.argv[2] === 'plan') {
    const plan = await planRelease({ db, github, runId: process.env.ACA_RELEASE_RUN_ID })
    await writeFile(planFile, JSON.stringify(plan), { mode: 0o600 })
    if (plan) await writeFile(process.env.GITHUB_OUTPUT, `source_sha=${plan.sourceSha}\n`, { flag: 'a' })
    console.log(plan ? 'Supported repair approved for isolated production build.' : 'No new eligible repair to release.')
    return
  }
  const plan = JSON.parse(await readFile(planFile, 'utf8'))
  if (!plan) return
  try {
    await publishRelease({ db, github, plan, files: await outputFiles(), publicSite: process.env.ACA_PUBLIC_SITE === 'true' })
    console.log('Supported technical repair published. Deployment reconciliation will verify the served revision.')
  } catch {
    await db.from('aca_support_releases').update({ status: 'needs_attention', updated_at: new Date().toISOString() }).eq('job_id', plan.jobId)
    throw new Error('Automatic release requires reconciliation. The existing case remains open.')
  }
}
if (process.argv[1]?.endsWith('/support-release.mjs')) main().catch(error => { console.error(error.message); process.exitCode = 1 })

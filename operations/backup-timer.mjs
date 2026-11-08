// Only the established automatic backup workflow on main. This Worker has no
// database, backup encryption, source Storage, R2 or email credential.
const workflow = 'https://api.github.com/repos/teeleebiz-web/aiconfidenceacademy-site/actions/workflows/automatic-storage-backup.yml'
export const backupCron = '17 18 * * *'
const busy = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending'])
const failure = () => new Error('Backup timer needs review; dispatch outcome may be uncertain')

export async function backupTick(controller, env, { request = fetch, now = Date.now, log = console.log } = {}) {
  if (env.ACA_BACKUP_TIMER_ENABLED !== 'true') return { status: 'held' }
  const time = controller?.scheduledTime
  if (controller?.cron !== backupCron || !Number.isSafeInteger(time)
      || now() - time < 0 || now() - time > 600000) throw failure()
  if (typeof env.ACA_TIMER_GITHUB_TOKEN !== 'string' || !env.ACA_TIMER_GITHUB_TOKEN.trim()
      || /[\r\n]/.test(env.ACA_TIMER_GITHUB_TOKEN)) throw failure()
  const slot = new Date(time); slot.setUTCHours(18, 17, 0, 0)
  if (time < +slot || time - +slot >= 60000) throw failure()
  const headers = {
    Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.ACA_TIMER_GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'ACA-private-backup-timer',
  }
  const call = async (url, options) => {
    try { return await request(url, { ...options, headers: { ...headers, ...options.headers },
      redirect: 'manual', signal: AbortSignal.timeout(10000) }) } catch { throw failure() }
  }
  const emit = value => {
    const record = { task: 'daily-backup', scheduled_at: new Date(time).toISOString(), ...value }
    log(JSON.stringify(record)); return record
  }
  const active = await call(`${workflow}/runs?branch=main&per_page=20`, { method: 'GET' })
  if (active.status !== 200) throw failure()
  let runs
  try { runs = await active.json() } catch { throw failure() }
  if (!Array.isArray(runs.workflow_runs) || runs.workflow_runs.length > 20) throw failure()
  for (const run of runs.workflow_runs) {
    if (run.head_branch !== 'main' || !Number.isSafeInteger(run.id) || run.id <= 0
        || typeof run.status !== 'string' || !Number.isFinite(Date.parse(run.created_at))) throw failure()
    if (busy.has(run.status) || Date.parse(run.created_at) >= +slot) return emit({ status: 'already-started', workflow_run_id: String(run.id) })
  }
  // The database claim in the workflow is authoritative if two triggers race.
  // Never retry an uncertain dispatch, and never use HTTP requests as triggers.
  const response = await call(`${workflow}/dispatches`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }),
  })
  if (response.status === 204) return emit({ status: 'accepted', workflow_run_id: null })
  if (response.status !== 200) throw failure()
  let result
  try { result = await response.json() } catch { throw failure() }
  if (!Number.isSafeInteger(result.workflow_run_id) || result.workflow_run_id <= 0) throw failure()
  return emit({ status: 'accepted', workflow_run_id: String(result.workflow_run_id) })
}

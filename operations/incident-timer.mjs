// This Worker holds only the dedicated repository Actions credential. It cannot
// select another repository, workflow, ref, mode, or public request destination.
const workflow = 'https://api.github.com/repos/teeleebiz-web/aiconfidenceacademy-site/actions/workflows/incident-diagnostics.yml'
export const timerCron = '*/15 * * * *'
const busy = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending'])
const failure = () => new Error('Incident timer needs review; dispatch outcome may be uncertain')

export async function tick(controller, env, { request = fetch, now = Date.now, log = console.log } = {}) {
  if (env.ACA_TIMER_ENABLED !== 'true') return { status: 'held' }
  const time = controller?.scheduledTime
  if (controller?.cron !== timerCron || !Number.isSafeInteger(time) || time % 900000 !== 0
      || now() - time < 0 || now() - time > 600000) throw failure()
  if (typeof env.ACA_TIMER_GITHUB_TOKEN !== 'string' || !env.ACA_TIMER_GITHUB_TOKEN.trim()
      || /[\r\n]/.test(env.ACA_TIMER_GITHUB_TOKEN)) throw failure()
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.ACA_TIMER_GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'ACA-private-incident-timer',
  }
  // No retry: a lost response must not produce a second dispatch in this tick.
  // The existing workflow concurrency group serializes any racing native tick.
  const call = async (url, options) => {
    try {
      return await request(url, { ...options, headers: { ...headers, ...options.headers },
        redirect: 'error', signal: AbortSignal.timeout(10000) })
    } catch { throw failure() }
  }
  const emit = value => {
    const record = { scheduled_at: new Date(time).toISOString(), ...value }
    log(JSON.stringify(record))
    return record
  }
  const active = await call(`${workflow}/runs?branch=main&per_page=20`, { method: 'GET' })
  if (active.status !== 200) throw failure()
  let runs
  try { runs = await active.json() } catch { throw failure() }
  if (!Array.isArray(runs.workflow_runs) || runs.workflow_runs.length > 20) throw failure()
  for (const run of runs.workflow_runs) {
    if (run.head_branch !== 'main' || !Number.isSafeInteger(run.id) || run.id <= 0
        || typeof run.status !== 'string' || !Number.isFinite(Date.parse(run.created_at))) throw failure()
    if (busy.has(run.status)) return emit({ status: 'busy', workflow_run_id: String(run.id) })
  }
  const response = await call(`${workflow}/dispatches`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { mode: 'collect' } }),
  })
  // Current GitHub API returns the accepted run ID. The older empty 204 response
  // is also acceptance, never proof that the collector finished successfully.
  if (response.status === 204) return emit({ status: 'accepted', workflow_run_id: null })
  if (response.status !== 200) throw failure()
  let result
  try { result = await response.json() } catch { throw failure() }
  if (!Number.isSafeInteger(result.workflow_run_id) || result.workflow_run_id <= 0) throw failure()
  return emit({ status: 'accepted', workflow_run_id: String(result.workflow_run_id) })
}

export default {
  async scheduled(controller, env) { await tick(controller, env) },
  // Defense in depth if someone accidentally adds an HTTP route in the account.
  async fetch() { return new Response('Not found', { status: 404 }) },
}

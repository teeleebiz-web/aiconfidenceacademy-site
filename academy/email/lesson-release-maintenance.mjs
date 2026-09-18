import { dispatchLessonReleaseNotifications } from './lesson-release-dispatch.mjs'

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

export async function handleLessonReleaseMaintenance(req, res, config) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!config?.cronSecret || !config?.lessonReleaseMessage || !config?.resend || !config?.emailFrom) {
    return json(res, 503, { error: 'Lesson release maintenance is not configured' })
  }
  if (req.headers.authorization !== `Bearer ${config.cronSecret}`) {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000)
  try {
    const result = await dispatchLessonReleaseNotifications(config, {
      windowStart: windowStart.toISOString(), now: now.toISOString(),
    })
    return json(res, 200, result)
  } catch {
    return json(res, 500, { error: 'Lesson release processing failed' })
  }
}

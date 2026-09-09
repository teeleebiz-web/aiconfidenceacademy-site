const names = new Set(['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled', 'error', 'ended', 'volumechange', 'emptied', 'focus', 'blur', 'visibility', 'sample'])
export function cleanPlaybackEvents(body) {
  if (!body || !Array.isArray(body.events) || body.events.length > 12) return null
  const events = []
  for (const item of body.events) {
    if (!item || !names.has(item.event) || !['video', 'audio'].includes(item.kind)
      || typeof item.run !== 'string' || !/^[a-z0-9]{1,10}$/.test(item.run)) return null
    const record = { run: item.run, kind: item.kind, event: item.event }
    for (const [key, max] of Object.entries({ media: 1000, time: 86400, duration: 86400, ready: 4, network: 3, error: 4, volume: 1, width: 16384, height: 16384 })) {
      const value = item[key]
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)) return null
      record[key] = value
    }
    for (const key of ['paused', 'muted', 'visible', 'focused']) {
      if (typeof item[key] !== 'boolean') return null
      record[key] = item[key]
    }
    events.push(record)
  }
  return events
}

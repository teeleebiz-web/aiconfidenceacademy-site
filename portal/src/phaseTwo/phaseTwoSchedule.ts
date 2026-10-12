/**
 * Phase Two: six journeys, six releases per journey, Monday–Saturday.
 *
 * Source authority: Phase Two Six Week Curriculum Master v2.0, Oct 4, 2026.
 * Pure, side-effect-free schedule model; DOES NOT activate enrollment or mutate any records.
 *
 * A specific cohort timezone and release clock are administrative settings still
 * awaiting approval. Do not substitute a default release hour.
 */

export type PhaseTwoLessonId = `${1 | 2 | 3 | 4 | 5 | 6}.${1 | 2 | 3 | 4 | 5 | 6}`
export type PhaseTwoCohortClock = {
  /** Calendar date of the first Monday, YYYY-MM-DD, in this cohort's timezone. */
  firstMonday: string
  /** Explicit IANA timezone; e.g. America/Los_Angeles. */
  timezone: string
  /** Explicit cohort-local release time, HH:mm. NEVER infer one. */
  releaseTime: string
}
export type AuthorizedAccessExtension = {
  /** Admin-authorized extension only; NOT inferred from a learner's request. */
  startsAt: Date
  endsAt: Date
}
export type PhaseTwoAccessState = 'scheduled' | 'available' | 'active' | 'closed' | 'inactive'

const DAY_MS = 86_400_000
const WINDOW_MS = 7_200_000

function numbersInZone(instant: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(instant)
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]))
  return {
    year: parts.year, month: parts.month, day: parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second,
  }
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Provide an ISO first-Monday date.')
  const [year, month, day] = value.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() + 1 !== month || utc.getUTCDate() !== day)
    throw new Error('Invalid first-Monday date.')
  if (utc.getUTCDay() !== 1) throw new Error('The cohort must begin on Monday.')
  return utc
}

function parseClock(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error('An explicitly approved local release time (HH:mm) is required.')
  const [hour, minute] = value.split(':').map(Number)
  return { hour, minute }
}

function convertLocalToInstant(
  year: number, month: number, day: number,
  hour: number, minute: number, timezone: string,
): Date {
  // Consider offsets around both sides of a possible daylight-saving change.
  // Refuse skipped and ambiguous wall-clock times instead of inventing an
  // unwritten DST release policy.
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const offsets = new Set<number>()
  for (const delta of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = naive + delta * 3_600_000
    const local = numbersInZone(new Date(sample), timezone)
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
    offsets.add(localAsUtc - sample)
  }
  const matches: number[] = []
  for (const offset of offsets) {
    const candidate = naive - offset
    const local = numbersInZone(new Date(candidate), timezone)
    if (local.year === year && local.month === month && local.day === day &&
        local.hour === hour && local.minute === minute && local.second === 0)
      matches.push(candidate)
  }
  const unique = [...new Set(matches)]
  if (unique.length !== 1)
    throw new Error('The cohort release clock is skipped or ambiguous on this timezone date. Obtain an explicit schedule decision.')
  return new Date(unique[0])
}

function lessonCoordinates(lessonId: string) {
  if (!/^[1-6]\.[1-6]$/.test(lessonId)) throw new Error('Phase Two requires a lesson ID from 1.1 through 6.6.')
  const [journey, lesson] = lessonId.split('.').map(Number)
  return { journey, lesson }
}

export function phaseTwoReleaseAt(config: PhaseTwoCohortClock, lessonId: string): Date {
  const { journey, lesson } = lessonCoordinates(lessonId)
  const monday = parseDate(config.firstMonday)
  const { hour, minute } = parseClock(config.releaseTime)
  const calendar = new Date(monday.getTime() + ((journey - 1) * 7 + lesson - 1) * DAY_MS)
  return convertLocalToInstant(
    calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(),
    hour, minute, config.timezone,
  )
}

export function phaseTwoWeekendEndsAt(config: PhaseTwoCohortClock, lessonId: string): Date {
  const { journey, lesson } = lessonCoordinates(lessonId)
  if (lesson !== 6) throw new Error('Only the Saturday lesson has weekend access.')
  const monday = parseDate(config.firstMonday)
  const followingMonday = new Date(monday.getTime() + journey * 7 * DAY_MS)
  // Exclusive close at the following Monday 00:00 cohort time:
  // Sunday remains accessible through 11:59:59.999 pm.
  return convertLocalToInstant(
    followingMonday.getUTCFullYear(), followingMonday.getUTCMonth() + 1, followingMonday.getUTCDate(),
    0, 0, config.timezone,
  )
}

export function phaseTwoLessonAccess(input: {
  config: PhaseTwoCohortClock
  lessonId: string
  now: Date
  enrollmentActive: boolean
  firstOpenedAt?: Date | null
  authorizedExtension?: AuthorizedAccessExtension | null
}): { status: PhaseTwoAccessState; releaseAt: Date; closesAt: Date | null } {
  const { config, lessonId, now, enrollmentActive, firstOpenedAt, authorizedExtension } = input
  const releaseAt = phaseTwoReleaseAt(config, lessonId)
  const lessonNumber = lessonCoordinates(lessonId).lesson
  if (!enrollmentActive) return { status: 'inactive', releaseAt, closesAt: null }
  if (now.getTime() < releaseAt.getTime()) return { status: 'scheduled', releaseAt, closesAt: null }

  const weekendDeadline = lessonNumber === 6 ? phaseTwoWeekendEndsAt(config, lessonId) : null
  const normalDeadline = weekendDeadline ??
    (firstOpenedAt ? new Date(firstOpenedAt.getTime() + WINDOW_MS) : null)
  const validExtension = authorizedExtension &&
    Number.isFinite(authorizedExtension.startsAt.getTime()) &&
    Number.isFinite(authorizedExtension.endsAt.getTime()) &&
    authorizedExtension.endsAt.getTime() > authorizedExtension.startsAt.getTime() &&
    authorizedExtension.startsAt.getTime() >= releaseAt.getTime() &&
    now.getTime() >= authorizedExtension.startsAt.getTime() &&
    now.getTime() < authorizedExtension.endsAt.getTime()
  if (validExtension) {
    return { status: 'active', releaseAt, closesAt: authorizedExtension!.endsAt }
  }
  if (weekendDeadline) return {
    status: now.getTime() < weekendDeadline.getTime() ? 'active' : 'closed',
    releaseAt, closesAt: weekendDeadline,
  }
  if (!firstOpenedAt) return { status: 'available', releaseAt, closesAt: null }
  if (!Number.isFinite(firstOpenedAt.getTime()) || firstOpenedAt.getTime() < releaseAt.getTime())
    throw new Error('The first lesson opening must follow its release.')
  return {
    status: now.getTime() < normalDeadline!.getTime() ? 'active' : 'closed',
    releaseAt, closesAt: normalDeadline,
  }
}

export function phaseTwoWeekday(lessonId: string) {
  return ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][lessonCoordinates(lessonId).lesson - 1]
}

export function phaseTwoCohortOutline(config: PhaseTwoCohortClock) {
  return Array.from({ length: 6 }, (_, j) => Array.from({ length: 6 }, (_, l) => {
    const pageId = `${j + 1}.${l + 1}` as PhaseTwoLessonId
    return {
      pageId,
      journey: j + 1,
      weekday: phaseTwoWeekday(pageId),
      releaseAt: phaseTwoReleaseAt(config, pageId),
      weekendEndsAt: l === 5 ? phaseTwoWeekendEndsAt(config, pageId) : null,
    }
  })).flat()
}

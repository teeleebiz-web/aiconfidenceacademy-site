import {
  phaseTwoCohortOutline,
  phaseTwoLessonAccess,
  phaseTwoReleaseAt,
  phaseTwoWeekendEndsAt,
} from './phaseTwoSchedule'

const cohort = {
  firstMonday: '2026-10-05',
  timezone: 'America/Los_Angeles',
  releaseTime: '09:00',
}

describe('Phase Two six-week cohort calendar', () => {
  it('releases exactly six lessons in each of six weeks, Monday through Saturday', () => {
    const result = phaseTwoCohortOutline(cohort)
    expect(result).toHaveLength(36)
    expect(result[0].pageId).toBe('1.1')
    expect(result[35].pageId).toBe('6.6')
    for (let journey = 1; journey <= 6; journey++) {
      const group = result.filter(x => x.journey === journey)
      expect(group.map(x => x.weekday)).toEqual([
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
      ])
      expect(group.map(x => x.pageId)).toEqual(
        Array.from({ length: 6 }, (_, n) => journey + '.' + (n + 1)),
      )
    }
    expect(result.some(x => x.weekday === 'Sunday')).toBe(false)
    expect(result[0].releaseAt.toISOString()).toBe('2026-10-05T16:00:00.000Z')
    expect(result[6].releaseAt.toISOString()).toBe('2026-10-12T16:00:00.000Z')
  })

  it('requires an explicit timezone, Monday start, and release hour', () => {
    expect(() => phaseTwoCohortOutline({ ...cohort, releaseTime: '' })).toThrow(/approved local release time/)
    expect(() => phaseTwoCohortOutline({ ...cohort, firstMonday: '2026-10-06' })).toThrow(/Monday/)
    expect(() => phaseTwoCohortOutline({ ...cohort, timezone: 'Unspecified' })).toThrow()
    expect(() => phaseTwoReleaseAt(cohort, '7.1')).toThrow(/1.1 through 6.6/)
  })

  it('starts weekday two-hour elapsed access only when first opened', () => {
    const release = phaseTwoReleaseAt(cohort, '1.1')
    const before = phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now: new Date(release.getTime() - 1), enrollmentActive: true })
    expect(before.status).toBe('scheduled')
    const ready = phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now: new Date(release.getTime() + 1), enrollmentActive: true })
    expect(ready.status).toBe('available')
    expect(ready.closesAt).toBeNull()
    const firstOpenedAt = new Date('2026-10-06T22:00:00.000Z')
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now: new Date('2026-10-06T23:59:59.999Z'), firstOpenedAt,
      enrollmentActive: true }).status).toBe('active')
    const closed = phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now: new Date('2026-10-07T00:00:00.000Z'), firstOpenedAt,
      enrollmentActive: true })
    expect(closed.status).toBe('closed')
    expect(closed.closesAt?.toISOString()).toBe('2026-10-07T00:00:00.000Z')
  })

  it('permits a weekday catch-up start after later lessons release without resetting the clock', () => {
    const now = new Date('2026-10-22T18:00:00.000Z')
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.1', now, enrollmentActive: true }).status).toBe('available')
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '3.4', now, enrollmentActive: true }).status).toBe('available')
    // The schedule reads the lesson release date, NOT any earlier progress status.
    expect(phaseTwoReleaseAt(cohort, '3.4').getTime()).toBeLessThan(now.getTime())
  })

  it('keeps a Saturday lesson available until Sunday 11:59:59.999 local', () => {
    const endsAt = phaseTwoWeekendEndsAt(cohort, '1.6')
    expect(endsAt.toISOString()).toBe('2026-10-12T07:00:00.000Z')
    const justBefore = new Date(endsAt.getTime() - 1)
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.6',
      now: justBefore, enrollmentActive: true }).status).toBe('active')
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.6',
      now: endsAt, enrollmentActive: true }).status).toBe('closed')
    expect(() => phaseTwoWeekendEndsAt(cohort, '1.5')).toThrow(/Saturday/)
  })

  it('honors approved, bounded access extensions but never manufactures them', () => {
    const now = new Date('2026-10-09T20:00:00.000Z')
    const firstOpenedAt = new Date('2026-10-05T17:00:00.000Z')
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now, firstOpenedAt, enrollmentActive: true }).status).toBe('closed')
    const authorizedExtension = {
      startsAt: new Date('2026-10-09T18:00:00.000Z'),
      endsAt: new Date('2026-10-10T03:00:00.000Z'),
    }
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now, firstOpenedAt, enrollmentActive: true, authorizedExtension }).status).toBe('active')
    expect(phaseTwoLessonAccess({ config: cohort, lessonId: '1.1',
      now, firstOpenedAt, enrollmentActive: false, authorizedExtension }).status).toBe('inactive')
  })

  it('converts weekend deadlines correctly across daylight-saving changes', () => {
    const spring = { ...cohort, firstMonday: '2026-03-02' }
    expect(phaseTwoReleaseAt(spring, '1.6').toISOString()).toBe('2026-03-07T17:00:00.000Z')
    expect(phaseTwoWeekendEndsAt(spring, '1.6').toISOString()).toBe('2026-03-09T07:00:00.000Z')
    // A skipped wall-clock release time is not silently shifted.
    const datelineChange = { firstMonday: '2011-12-26', timezone: 'Pacific/Apia', releaseTime: '09:00' }
    expect(() => phaseTwoReleaseAt(datelineChange, '1.5')).toThrow(/skipped or ambiguous/)
  })
})

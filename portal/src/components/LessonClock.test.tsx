import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LessonClock } from './LessonClock'

describe('LessonClock', () => {
  it('shows the saved time remaining and explains that leaving does not erase work', () => {
    render(<LessonClock access={{
      access_status: 'active',
      active_seconds: 2100,
      remaining_seconds: 3300,
      hard_expires_at: '2026-09-19T00:00:00Z',
      recovery_used: false,
      recovery_expires_at: null,
    }} onHeartbeat={vi.fn()} />)

    expect(screen.getByText('55:00')).toBeTruthy()
    expect(screen.getByText('Your time and workbook work are saved if you leave.')).toBeTruthy()
  })

  it('clearly reports an ended lesson window', () => {
    render(<LessonClock access={{
      access_status: 'expired',
      active_seconds: 5400,
      remaining_seconds: 0,
      hard_expires_at: '2026-09-19T00:00:00Z',
      recovery_used: true,
      recovery_expires_at: '2026-09-19T02:00:00Z',
    }} onHeartbeat={vi.fn()} />)

    expect(screen.getByText('0:00')).toBeTruthy()
    expect(screen.getByText(/contact ACA support/i)).toBeTruthy()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LessonClock } from './LessonClock'

describe('LessonClock', () => {
  it('shows the saved time remaining and explains that leaving pauses the timer', () => {
    render(<LessonClock access={{
      access_status: 'active',
      active_seconds: 2100,
      remaining_seconds: 3300,
    }} onHeartbeat={vi.fn()} onResume={vi.fn()} />)

    expect(screen.getByText('55:00')).toBeTruthy()
    expect(screen.getByText('Your remaining lesson time is saved if you leave or pause.')).toBeTruthy()
  })

  it('clearly reports an ended lesson window', () => {
    render(<LessonClock access={{
      access_status: 'expired',
      active_seconds: 7200,
      remaining_seconds: 0,
    }} onHeartbeat={vi.fn()} onResume={vi.fn()} />)

    expect(screen.getByText('0:00')).toBeTruthy()
    expect(screen.getByText(/two active lesson hours have been used/i)).toBeTruthy()
  })
})

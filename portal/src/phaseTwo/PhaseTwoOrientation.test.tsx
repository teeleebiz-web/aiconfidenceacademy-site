import { render, screen } from '@testing-library/react'
import { PhaseTwoOrientation } from './PhaseTwoOrientation'

describe('Phase Two curriculum orientation', () => {
  it('preserves the five entry-evidence requirements from the approved master', () => {
    render(<PhaseTwoOrientation preview />)
    expect(screen.getByRole('heading', { name: 'Prepare one professional project.' })).toBeTruthy()
    expect(screen.getByText(/sanitized AI request, an output you evaluated/i)).toBeTruthy()
    expect(screen.getByText(/a revision or decision you made/i)).toBeTruthy()
    expect(screen.getByText(/one privacy boundary and one claim that requires verification/i)).toBeTruthy()
    expect(screen.getByText(/does not submit or approve readiness evidence/i)).toBeTruthy()
  })

  it('keeps the two paths within the same six-week curriculum', () => {
    render(<PhaseTwoOrientation />)
    expect(screen.getByText(/improve a process in an existing business/i)).toBeTruthy()
    expect(screen.getByText(/develop a new offer, product or service/i)).toBeTruthy()
    expect(screen.getByText(/Both paths complete the same curriculum/i)).toBeTruthy()
    expect(screen.getByText(/Plan two independent hours weekly/i)).toBeTruthy()
    expect(screen.getByText(/48 hours of learning and application/i)).toBeTruthy()
  })
})

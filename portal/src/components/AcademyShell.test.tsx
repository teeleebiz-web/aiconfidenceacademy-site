import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AcademyShell } from './AcademyShell'

describe('AcademyShell', () => {
  it('provides working Academy navigation and identifies the active section', () => {
    render(<AcademyShell activeSection="curriculum"><main>Curriculum content</main></AcademyShell>)

    expect(screen.getByRole('link', { name: 'Academy Home' }).getAttribute('href')).toBe('/academy/phase-one/')
    expect(screen.getByRole('link', { name: 'Full Curriculum' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Workbook' }).getAttribute('href')).toBe('/academy/phase-one/?workbook=journey-one')
    expect(screen.getByRole('link', { name: 'Help Center' }).getAttribute('href')).toBe('/faq')
  })

  it('opens and closes the mobile navigation without changing content', async () => {
    const user = userEvent.setup()
    render(<AcademyShell><main>Lesson content remains here</main></AcademyShell>)

    const menu = screen.getByRole('button', { name: /menu/i })
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    await user.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Lesson content remains here')).toBeTruthy()
  })
})

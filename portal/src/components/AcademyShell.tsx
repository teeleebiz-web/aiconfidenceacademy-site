import { useState, type ReactNode } from 'react'
import sealUrl from '../../../aca-official-seal.png'

type AcademyShellProps = {
  children: ReactNode
  activeSection?: 'home' | 'curriculum' | 'workbook'
  workbookHref?: string
}

export function AcademyShell({
  children,
  activeSection = 'home',
  workbookHref = '/academy/phase-one/?workbook=journey-one',
}: AcademyShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="portal-shell academy-shell">
      <a className="skip-link" href="#academy-content">Skip to Academy content</a>
      <header className="academy-shell-header">
        <a className="academy-shell-brand" href="/" aria-label="AI Confidence Academy website">
          <img src={sealUrl} alt="" width="54" height="54" aria-hidden="true" />
          <span>
            <strong>AI Confidence Academy</strong>
            <small>Phase One</small>
          </span>
        </a>

        <button
          className="academy-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="academy-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span aria-hidden="true">☰</span>
          Menu
        </button>

        <nav
          id="academy-navigation"
          className={menuOpen ? 'academy-navigation open' : 'academy-navigation'}
          aria-label="Academy navigation"
        >
          <a
            href="/academy/phase-one/"
            aria-current={activeSection === 'home' ? 'page' : undefined}
            onClick={closeMenu}
          >
            Academy Home
          </a>
          <a
            href="/academy/phase-one/?view=curriculum"
            aria-current={activeSection === 'curriculum' ? 'page' : undefined}
            onClick={closeMenu}
          >
            Full Curriculum
          </a>
          <a
            href={workbookHref}
            aria-current={activeSection === 'workbook' ? 'page' : undefined}
            onClick={closeMenu}
          >
            Workbook
          </a>
          <a href="/faq" onClick={closeMenu}>Help Center</a>
          <a href="/" onClick={closeMenu}>ACA Website</a>
        </nav>

        <span className="academy-review-badge">Owner review</span>
      </header>

      <div id="academy-content" tabIndex={-1}>{children}</div>

      <footer className="academy-shell-footer">
        <div>
          <img src={sealUrl} alt="" width="42" height="42" loading="lazy" aria-hidden="true" />
          <span>
            <strong>AI Confidence Academy</strong>
            <small>Human-guided. AI-assisted. People-first.</small>
          </span>
        </div>
        <nav aria-label="Academy footer navigation">
          <a href="/contact">Contact</a>
          <a href="/accessibility">Accessibility</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  )
}

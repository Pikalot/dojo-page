import { useEffect, useRef, useState } from 'react';
import { useHideOnScroll } from '../hooks/useHideOnScroll.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { SECTIONS } from '../sections.js';
import { LanguageToggle } from './LanguageToggle.jsx';
import { SectionLink } from './SectionLink.jsx';
import { SectionSearch } from './SectionSearch.jsx';
import './Navbar.css';

// Must match the breakpoint in Navbar.css where links move out of the menu.
const DESKTOP_QUERY = '(min-width: 70rem)';

export function Navbar() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const scrolledAway = useHideOnScroll();
  const menuButtonRef = useRef(null);
  const headerRef = useRef(null);

  // Never hide the header while it is in use: an open menu or keyboard focus inside.
  const hidden = scrolledAway && !menuOpen && !hasFocus;

  const closeMenu = () => setMenuOpen(false);

  // Close the mobile menu if the window grows to desktop width.
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return undefined;
    const onChange = (e) => e.matches && setMenuOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Escape closes the menu and returns focus to the button that opened it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const onPointerDown = (e) => {
      if (!headerRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className="site-header"
      data-hidden={hidden}
      onFocus={() => setHasFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHasFocus(false);
      }}
    >
      <div className="site-header__inner container">
        <a className="brand" href="#top" aria-label={t.nav.home} onClick={closeMenu}>
          {/* PLACEHOLDER logo until the real Tenshinkai logo is supplied. */}
          <span className="brand__logo" aria-hidden="true">
            T
          </span>
        </a>

        <SectionSearch onNavigate={closeMenu} />

        <button
          ref={menuButtonRef}
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="menu-button__bar" aria-hidden="true" />
          <span className="menu-button__bar" aria-hidden="true" />
          <span className="menu-button__bar" aria-hidden="true" />
        </button>

        <nav id="site-menu" className="site-nav" data-open={menuOpen} aria-label={t.nav.label}>
          <ul className="site-nav__list">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <SectionLink to={section.id} className="site-nav__link" onNavigate={closeMenu}>
                  {t.nav[section.navKey]}
                </SectionLink>
              </li>
            ))}
          </ul>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}

import { useRef } from 'react';
import { About } from './components/About.jsx';
import { Announcements } from './components/Announcements.jsx';
import { Contact } from './components/Contact.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Faq } from './components/Faq.jsx';
import { Footer } from './components/Footer.jsx';
import { Hero } from './components/Hero.jsx';
import { Instructors } from './components/Instructors.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Schedule } from './components/Schedule.jsx';
import { useScrollToHash } from './hooks/useScrollToHash.js';
import { useTilt } from './hooks/useTilt.js';
import { useLanguage } from './i18n/LanguageContext.jsx';

// Page layout only. Each section loads its own content from api/content.js.
export function App() {
  const { t } = useLanguage();
  const billboardRef = useRef(null);
  useTilt(billboardRef); // remove for a flat lift without tilt
  const mainRef = useRef(null);
  useScrollToHash(mainRef);

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skipToContent}
      </a>
      <Navbar />
      <main ref={mainRef} id="main" tabIndex={-1}>
        <Hero />
        <ErrorBoundary>
          <About />
        </ErrorBoundary>
        <div ref={billboardRef} className="split billboard">
          <ErrorBoundary>
            <Announcements />
          </ErrorBoundary>
          <ErrorBoundary>
            <Schedule />
          </ErrorBoundary>
        </div>
        <ErrorBoundary>
          <Instructors />
        </ErrorBoundary>
        <div className="split">
          <ErrorBoundary>
            <Contact />
          </ErrorBoundary>
          <ErrorBoundary>
            <Faq />
          </ErrorBoundary>
        </div>
      </main>
      <Footer />
    </>
  );
}

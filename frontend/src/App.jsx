import { About } from './components/About.jsx';
import { Announcements } from './components/Announcements.jsx';
import { Contact } from './components/Contact.jsx';
import { Fees } from './components/Fees.jsx';
import { Footer } from './components/Footer.jsx';
import { Hero } from './components/Hero.jsx';
import { Instructors } from './components/Instructors.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Schedule } from './components/Schedule.jsx';
import { useLanguage } from './i18n/LanguageContext.jsx';

// Page layout only. Each section loads its own content from api/content.js.
export function App() {
  const { t } = useLanguage();

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skipToContent}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Hero />
        <About />
        <div className="split">
          <Announcements />
          <Schedule />
        </div>
        <Instructors />
        <div className="split">
          <Contact />
          <Fees />
        </div>
      </main>
      <Footer />
    </>
  );
}

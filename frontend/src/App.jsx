import { useMemo } from 'react';
import { About } from './components/About.jsx';
import { Announcements } from './components/Announcements.jsx';
import { Contact } from './components/Contact.jsx';
import { Fees } from './components/Fees.jsx';
import { Footer } from './components/Footer.jsx';
import { Hero } from './components/Hero.jsx';
import { Instructors } from './components/Instructors.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Schedule } from './components/Schedule.jsx';
import { getSiteContent } from './data/siteContent.js';
import { useLanguage } from './i18n/LanguageContext.jsx';

export function App() {
  const { language, t } = useLanguage();
  const content = useMemo(() => getSiteContent(language), [language]);

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skipToContent}
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Hero />
        <About about={content.about} location={content.location} />
        <div className="split">
          <Announcements items={content.announcements} />
          <Schedule classes={content.schedule} />
        </div>
        <Instructors instructors={content.instructors} />
        <div className="split">
          <Contact contact={content.contact} location={content.location} />
          <Fees fees={content.fees} note={content.feesNote} />
        </div>
      </main>
      <Footer dojoName={content.dojo.name} />
    </>
  );
}

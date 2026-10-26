import { useRef } from 'react';
import { getSchedule } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useInView } from '../hooks/useInView.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatTime } from '../lib/format.js';
import { ContentStatus } from './ContentStatus.jsx';

export function Schedule() {
  const { language, t } = useLanguage();
  const { status, data: classes } = useContent(getSchedule);
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, 0.1);

  return (
    <section
      ref={sectionRef}
      id="schedule"
      className="section surface-dark panel reveal"
      aria-labelledby="schedule-title"
      data-visible={inView}
      style={{ '--reveal-index': 1 }}
    >
      <h2 id="schedule-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.schedule}
      </h2>
      <ContentStatus status={status} />
      {classes && (
        <div className="table-scroll">
          <table className="data-table" aria-labelledby="schedule-title">
            <thead>
              <tr>
                <th scope="col">{t.schedule.day}</th>
                <th scope="col">{t.schedule.time}</th>
                <th scope="col">{t.schedule.class}</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.day}</th>
                  <td>
                    {/* Each time stays on one line; the range may wrap after the dash on phones. */}
                    <time className="data-table__nowrap" dateTime={row.start}>
                      {formatTime(row.start, language)}
                    </time>
                    {' – '}
                    <time className="data-table__nowrap" dateTime={row.end}>
                      {formatTime(row.end, language)}
                    </time>
                  </td>
                  <td>{row.className}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

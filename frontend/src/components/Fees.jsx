import { getFees } from '../api/content.js';
import { useContent } from '../hooks/useContent.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { ContentStatus } from './ContentStatus.jsx';

export function Fees() {
  const { t } = useLanguage();
  const { status, data } = useContent(getFees);

  return (
    <section id="fees" className="section surface-blue panel" aria-labelledby="fees-title">
      <h2 id="fees-title" className="section__title panel__title" tabIndex={-1}>
        {t.sections.fees}
      </h2>
      <ContentStatus status={status} />
      {data && (
        <>
          <div className="table-scroll">
            <table className="data-table" aria-labelledby="fees-title">
              <thead>
                <tr>
                  <th scope="col">{t.fees.plan}</th>
                  <th scope="col">{t.fees.price}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((fee) => (
                  <tr key={fee.id}>
                    <th scope="row">{fee.plan}</th>
                    <td>
                      <strong>{fee.price}</strong> <span className="data-table__muted">{fee.period}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel__note">{data.note}</p>
        </>
      )}
    </section>
  );
}

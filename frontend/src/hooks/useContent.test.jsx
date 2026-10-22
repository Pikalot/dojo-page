import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { renderWithLanguage } from '../test/renderWithLanguage.jsx';
import { useContent } from './useContent.js';

function Probe({ load }) {
  const { status, data } = useContent(load);
  const { setLanguage } = useLanguage();
  return (
    <>
      <p data-testid="status">{status}</p>
      <p data-testid="data">{data?.title ?? ''}</p>
      <button type="button" onClick={() => setLanguage('vi')}>vi</button>
    </>
  );
}

const ok = () => Promise.resolve({ title: { en: 'Hello', vi: 'Xin chào' } });
const fail = () => Promise.reject(new Error('network'));

describe('useContent', () => {
  it('starts loading, then returns data in the current language', async () => {
    renderWithLanguage(<Probe load={ok} />);
    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
  });

  it('re-localizes loaded data when the language changes', async () => {
    const user = userEvent.setup();
    renderWithLanguage(<Probe load={ok} />);
    await screen.findByText('Hello');

    await user.click(screen.getByRole('button', { name: 'vi' }));

    expect(screen.getByTestId('data')).toHaveTextContent('Xin chào');
  });

  it('reports an error when loading fails', async () => {
    renderWithLanguage(<Probe load={fail} />);
    expect(await screen.findByText('error')).toBeInTheDocument();
    expect(screen.getByTestId('data')).toHaveTextContent('');
  });

  it('ignores a response that arrives after unmounting', async () => {
    let resolve;
    const slow = () => new Promise((r) => (resolve = r));
    const { unmount } = renderWithLanguage(<Probe load={slow} />);
    unmount();
    // Would warn about updating an unmounted component if not guarded.
    await act(async () => resolve({ title: { en: 'Late', vi: 'Muộn' } }));
  });
});

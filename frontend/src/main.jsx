import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global styles must load before App, which pulls in component CSS, so that
// component rules override the shared ones and not the other way round.
import './styles/tokens.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/reveal.css';
import { App } from './App.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);

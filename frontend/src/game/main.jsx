import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first, so component CSS overrides them.
import '../styles/tokens.css';
import '../styles/base.css';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { gameStrings } from '../i18n/game.js';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { GameApp } from './GameApp.jsx';
import { GameError } from './GameError.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider titleKey="game.meta.title" extraStrings={gameStrings}>
      <ErrorBoundary fallback={<GameError />}>
        <GameApp />
      </ErrorBoundary>
    </LanguageProvider>
  </StrictMode>,
);

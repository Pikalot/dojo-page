import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { createSounds } from './audio/sounds.js';
import { createClock } from './engine/clock.js';
import { createSession, pushInput, result, start } from './engine/session.js';
import { TUNING } from './engine/tuning.js';
import { GameError } from './GameError.jsx';
import { useGameLoop } from './hooks/useGameLoop.js';
import { attachKeyboard } from './input/keyboard.js';
import { TouchControls } from './input/TouchControls.jsx';
import { Hud } from './screens/Hud.jsx';
import { Results } from './screens/Results.jsx';
import './GameApp.css';

const FEEDBACK_MS = 900;
const CHARACTER_KEY = 'dojo.game.character';
const CHARACTERS = ['male', 'female'];

// The chosen aikidoka is remembered on this device (FR-019a). Storage can be unavailable,
// so every access is guarded, like the site's language setting.
function readCharacter() {
  try {
    const value = window.localStorage.getItem(CHARACTER_KEY);
    return CHARACTERS.includes(value) ? value : 'male';
  } catch {
    return 'male';
  }
}

function saveCharacter(value) {
  try {
    window.localStorage.setItem(CHARACTER_KEY, value);
  } catch {
    // Remembering the choice is a convenience; ignore storage failures.
  }
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const onChange = (event) => setMatches(event.matches);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export function GameApp() {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const clockRef = useRef(null);
  const soundsRef = useRef(null);
  const [screen, setScreen] = useState('start');
  const [hud, setHud] = useState({ health: TUNING.player.health, score: 0, hits: 0 });
  const [ready, setReady] = useState({ parry: true, strike: true });
  const [feedback, setFeedback] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [character, setCharacter] = useState(readCharacter);

  function chooseCharacter(value) {
    setCharacter(value);
    saveCharacter(value);
  }
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  // On-screen buttons: on by default for touch devices, and can be switched on for
  // mouse or keyboard players too (null = follow the device).
  const [controlsChoice, setControlsChoice] = useState(null);
  const showControls = controlsChoice ?? coarsePointer;

  function sounds() {
    soundsRef.current ??= createSounds();
    return soundsRef.current;
  }

  // Called from the sound button's click: the only way sound turns on (FR-024).
  function toggleSound() {
    const next = !soundOn;
    sounds().setSoundOn(next);
    setSoundOn(sounds().on);
  }

  function startGame() {
    // The seed comes from the UI; the engine never reads the clock.
    sessionRef.current = createSession({ seed: Date.now(), easyMode: false });
    start(sessionRef.current);
    clockRef.current = createClock();
    clockRef.current.start(performance.now());
    setHud({ health: TUNING.player.health, score: 0, hits: 0 });
    setFeedback(null);
    setGameResult(null);
    setScreen('playing');
  }

  const onInput = useCallback((input) => pushInput(sessionRef.current, input), []);
  const toSimTime = useCallback((timeStamp) => clockRef.current.toSimTime(timeStamp), []);

  useEffect(() => {
    if (screen !== 'playing') return undefined;
    return attachKeyboard(window, onInput, clockRef.current);
  }, [screen, onInput]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  function onFrame(events, session) {
    const play = (name) => soundsRef.current?.play(name);
    let message = null;
    let hits = 0;
    for (const event of events) {
      switch (event.type) {
        case 'warning':
          play('warning');
          break;
        case 'dashStarted':
          play('dash');
          break;
        case 'parried':
          play(event.perfect ? 'critical' : 'parry');
          if (event.combo) message = { key: 'combo', tone: 'perfect' };
          break;
        case 'missedParry':
          play('miss');
          break;
        case 'blocked':
          play('block');
          break;
        case 'struck':
          play('strike');
          break;
        case 'playerHit':
          if (event.special) play('land');
          play('hit');
          hits += 1;
          break;
        case 'dodged':
          play('dodge');
          message = { key: 'dodged', tone: 'good' };
          break;
        case 'overshoot':
          play('skid');
          break;
        case 'enemyDefeated':
          play('defeat');
          break;
        case 'gameLost':
          // Game over: the loop stops and the results screen replaces the HUD.
          setGameResult(result(session));
          setScreen('results');
          break;
        default:
      }
    }
    if (message) setFeedback({ ...message, id: session.time });

    const { player, stats, time } = session;
    setHud((previous) =>
      previous.health === player.health && previous.score === stats.score && !hits
        ? previous
        : { health: player.health, score: stats.score, hits: previous.hits + hits },
    );
    const parry = time >= player.parryReadyAt && time >= player.stumbleUntil;
    const strike = time >= player.strikeReadyAt;
    setReady((previous) =>
      previous.parry === parry && previous.strike === strike ? previous : { parry, strike },
    );
  }

  useGameLoop({
    canvasRef,
    sessionRef,
    clockRef,
    running: screen === 'playing',
    reducedMotion,
    character,
    onFrame,
    onNoCanvas: () => setScreen('error'),
  });

  if (screen === 'error') return <GameError />;

  return (
    <main className="game surface-dark">
      <canvas ref={canvasRef} className="game__canvas" role="img" aria-label={t.game.canvasLabel} />
      {screen === 'playing' && (
        <>
          <Hud
            health={hud.health}
            maxHealth={TUNING.player.health}
            score={hud.score}
            soundOn={soundOn}
            onToggleSound={toggleSound}
            controlsOn={showControls}
            onToggleControls={() => setControlsChoice(!showControls)}
            hitCount={hud.hits}
            reducedMotion={reducedMotion}
          />
          {feedback && (
            <p key={feedback.id} className={`game__feedback game__feedback--${feedback.tone}`} aria-hidden="true">
              {t.game.feedback[feedback.key]}
            </p>
          )}
          {showControls && (
            <TouchControls
              onInput={onInput}
              toSimTime={toSimTime}
              parryReady={ready.parry}
              strikeReady={ready.strike}
            />
          )}
        </>
      )}
      {screen === 'results' && gameResult && <Results result={gameResult} onPlayAgain={startGame} />}
      {screen === 'start' && (
        <div className="game__overlay">
          <h1 className="game__title">{t.game.title}</h1>
          <p>{t.game.intro}</p>
          <p>{t.game.quickControls}</p>
          <fieldset className="game__character">
            <legend>{t.game.character.legend}</legend>
            {CHARACTERS.map((value) => (
              <label key={value} className="game__character-option">
                <input
                  type="radio"
                  name="character"
                  value={value}
                  checked={character === value}
                  onChange={() => chooseCharacter(value)}
                />
                {t.game.character[value]}
              </label>
            ))}
          </fieldset>
          <button type="button" className="button button--primary" onClick={startGame}>
            {t.game.start}
          </button>
          <p className="game__note">{t.game.placeholderArt}</p>
        </div>
      )}
    </main>
  );
}

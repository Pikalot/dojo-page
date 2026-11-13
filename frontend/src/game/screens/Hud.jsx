import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import './Hud.css';

function Toggle({ label, pressed, onToggle, onText, offText }) {
  return (
    <button type="button" className="hud__toggle" aria-pressed={pressed} onClick={onToggle}>
      {label}
      <span className="hud__toggle-state" aria-hidden="true">
        {pressed ? onText : offText}
      </span>
    </button>
  );
}

/**
 * Health bar, score, and the Sound and On-screen buttons toggles, as HTML over the canvas.
 * `hitCount` goes up on every hit; the bar shakes unless reduced motion is on.
 */
export function Hud({
  health,
  maxHealth,
  score,
  soundOn,
  onToggleSound,
  controlsOn = false,
  onToggleControls,
  hitCount = 0,
  reducedMotion = false,
}) {
  const { t } = useLanguage();
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!hitCount || reducedMotion) return undefined;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 300);
    return () => clearTimeout(timer);
  }, [hitCount, reducedMotion]);

  const percent = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <div className="hud">
      <div className={`hud__health${shaking ? ' hud__health--shake' : ''}`}>
        <span className="hud__label" id="hud-health-label">
          {t.game.hud.health}
        </span>
        <div
          className="hud__bar"
          role="meter"
          aria-labelledby="hud-health-label"
          aria-valuemin={0}
          aria-valuemax={maxHealth}
          aria-valuenow={health}
        >
          <div className="hud__bar-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <p className="hud__score">
        <span className="hud__label">{t.game.hud.score}</span> <strong>{score}</strong>
      </p>
      <Toggle
        label={t.game.hud.sound}
        pressed={soundOn}
        onToggle={onToggleSound}
        onText={t.game.hud.on}
        offText={t.game.hud.off}
      />
      {onToggleControls && (
        <Toggle
          label={t.game.hud.controls}
          pressed={controlsOn}
          onToggle={onToggleControls}
          onText={t.game.hud.on}
          offText={t.game.hud.off}
        />
      )}
    </div>
  );
}

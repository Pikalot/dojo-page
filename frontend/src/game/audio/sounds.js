/**
 * Short sounds made with the Web Audio API (research R6): no files to download or license.
 * PLACEHOLDER SOUNDS: the `play` names stay the same if recorded sounds replace them.
 *
 * Sound starts off. The AudioContext is created or resumed only from `setSoundOn(true)`,
 * which the UI calls from the sound button's click handler (a user gesture). Game keys
 * never turn sound on (FR-024).
 */
export function createSounds() {
  let context = null;
  let on = false;

  function ensureContext() {
    if (context) return context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    return context;
  }

  function envelope(gainNode, at, peak, duration) {
    gainNode.gain.setValueAtTime(0.0001, at);
    gainNode.gain.exponentialRampToValueAtTime(peak, at + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  }

  function tone({ freq, to = freq, duration = 0.15, type = 'sine', peak = 0.2, delay = 0 }) {
    const at = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    envelope(gain, at, peak, duration);
    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  function noise({ duration = 0.15, filter = 'lowpass', freq = 800, to = freq, peak = 0.2 }) {
    const at = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const biquad = context.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, at);
    biquad.frequency.exponentialRampToValueAtTime(to, at + duration);
    const gain = context.createGain();
    envelope(gain, at, peak, duration);
    source.connect(biquad).connect(gain).connect(context.destination);
    source.start(at);
  }

  const SOUNDS = {
    warning: () => tone({ freq: 600, to: 950, duration: 0.14, type: 'square', peak: 0.08 }),
    dash: () => noise({ duration: 0.3, filter: 'lowpass', freq: 500, to: 150, peak: 0.25 }),
    parry: () => {
      tone({ freq: 1320, duration: 0.25, peak: 0.15 });
      tone({ freq: 1980, duration: 0.2, peak: 0.08 });
    },
    critical: () => {
      tone({ freq: 220, duration: 0.7, type: 'triangle', peak: 0.3 });
      tone({ freq: 165, duration: 0.9, type: 'triangle', peak: 0.3, delay: 0.18 });
    },
    strike: () => noise({ duration: 0.06, filter: 'highpass', freq: 1500, peak: 0.2 }),
    miss: () => tone({ freq: 110, to: 70, duration: 0.15, peak: 0.25 }),
    dodge: () => noise({ duration: 0.18, filter: 'bandpass', freq: 600, to: 2400, peak: 0.15 }),
    skid: () => noise({ duration: 0.3, filter: 'bandpass', freq: 1400, to: 700, peak: 0.15 }),
    hit: () => tone({ freq: 160, to: 80, duration: 0.15, peak: 0.25 }),
    defeat: () => tone({ freq: 500, to: 950, duration: 0.09, peak: 0.15 }),
    // Hold-to-block: a short wooden clack.
    block: () => {
      noise({ duration: 0.05, filter: 'bandpass', freq: 1800, peak: 0.25 });
      tone({ freq: 900, to: 700, duration: 0.06, type: 'square', peak: 0.06 });
    },
    // The whirlwind kick lands: a heavy thump.
    land: () => tone({ freq: 120, to: 50, duration: 0.25, peak: 0.35 }),
  };

  return {
    get on() {
      return on;
    },
    /** Call only from a click on the sound button or switch. */
    setSoundOn(value) {
      on = Boolean(value);
      if (!on) {
        context?.suspend?.();
        return;
      }
      const ctx = ensureContext();
      if (!ctx) {
        on = false;
        return;
      }
      ctx.resume?.();
    },
    play(name) {
      if (!on || !context || context.state === 'suspended') return;
      try {
        SOUNDS[name]?.();
      } catch {
        // A sound that fails to play must never stop the game.
      }
    },
  };
}

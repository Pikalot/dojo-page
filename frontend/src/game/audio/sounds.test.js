import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSounds } from './sounds.js';

afterEach(() => {
  delete window.AudioContext;
});

describe('createSounds', () => {
  it('starts with sound off and plays nothing', () => {
    const AudioContext = vi.fn();
    window.AudioContext = AudioContext;
    const sounds = createSounds();
    expect(sounds.on).toBe(false);
    sounds.play('parry');
    expect(AudioContext).not.toHaveBeenCalled();
  });

  it('creates the audio context only when sound is switched on', () => {
    const resume = vi.fn();
    const AudioContext = vi.fn(function FakeContext() {
      this.resume = resume;
      this.state = 'running';
    });
    window.AudioContext = AudioContext;
    const sounds = createSounds();
    sounds.setSoundOn(true);
    expect(AudioContext).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalled();
    expect(sounds.on).toBe(true);
  });

  it('stays off when the browser has no Web Audio', () => {
    const sounds = createSounds();
    sounds.setSoundOn(true);
    expect(sounds.on).toBe(false);
  });
});

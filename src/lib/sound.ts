// Procedural Web Audio API synthesizer for responsive gaming feedback.
// Respects user sound settings cleanly without external audio file dependencies.

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let soundVolume = 0.45;

export function configureSound(enabled: boolean, volume: number): void {
  soundEnabled = enabled;
  soundVolume = Math.max(0, Math.min(1, volume));
}

function getContext(): AudioContext | null {
  if (!soundEnabled || typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  gainScale = 0.25,
  delaySec = 0,
): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);

  const peak = Math.max(0.001, soundVolume * gainScale);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export const arenaSound = {
  click(): void {
    playTone(540, 0.055, 'triangle', 0.16);
  },
  move(): void {
    playTone(440, 0.08, 'sine', 0.22);
    playTone(620, 0.07, 'triangle', 0.16, 0.045);
  },
  correct(): void {
    playTone(523.25, 0.11, 'triangle', 0.24, 0);
    playTone(659.25, 0.13, 'triangle', 0.26, 0.08);
    playTone(783.99, 0.18, 'sine', 0.26, 0.16);
  },
  wrong(): void {
    playTone(230, 0.14, 'sawtooth', 0.16, 0);
    playTone(185, 0.18, 'sawtooth', 0.16, 0.1);
  },
  victory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => playTone(n, 0.22, 'triangle', 0.24, idx * 0.09));
  },
  defeat(): void {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((n, idx) => playTone(n, 0.2, 'sine', 0.2, idx * 0.1));
  },
  notification(): void {
    playTone(698.46, 0.09, 'sine', 0.18, 0);
    playTone(880, 0.12, 'sine', 0.18, 0.07);
  },
};

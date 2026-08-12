/**
 * Web Audio API sound engine — all sounds synthesized, no external files.
 */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Helper: play a short oscillator burst */
function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  volume: number,
  freqEnd?: number,
) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, c.currentTime + duration);
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

/** Helper: noise burst */
function playNoise(duration: number, volume: number, filterFreq?: number) {
  const c = ctx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const source = c.createBufferSource();
  source.buffer = buffer;

  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

  if (filterFreq) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, c.currentTime);
    source.connect(filter);
    filter.connect(gain);
  } else {
    source.connect(gain);
  }

  gain.connect(c.destination);
  source.start(c.currentTime);
  source.stop(c.currentTime + duration);
}

// ── Public API ───────────────────────────────────────────────

/** Headshot — heavy bass thud + click */
export function playHeadshotSound() {
  playTone(80, 'sine', 0.15, 0.5, 30);
  playNoise(0.08, 0.25, 3000);
  // Sub-bass
  playTone(50, 'sine', 0.2, 0.3, 25);
}

/** Body hit — crisp mid-frequency click */
export function playBodyHitSound() {
  playTone(800, 'square', 0.06, 0.15, 400);
  playNoise(0.04, 0.12, 6000);
}

/** Miss — dull low thud */
export function playMissSound() {
  playTone(100, 'triangle', 0.12, 0.2, 50);
  playNoise(0.06, 0.1, 800);
}

/** Phase transition — rising sweep */
export function playPhaseSound() {
  playTone(200, 'sawtooth', 0.4, 0.12, 800);
}

/** Test complete — ascending arpeggio */
export function playCompleteSound() {
  const notes = [261, 329, 392, 523]; // C E G C5
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 'sine', 0.3, 0.18), i * 80);
  });
  // Final chord
  setTimeout(() => {
    notes.forEach((freq) => playTone(freq, 'triangle', 0.5, 0.08));
  }, notes.length * 80);
}

/** Countdown tick */
export function playCountdownTick() {
  playTone(600, 'sine', 0.1, 0.15);
}

/** Countdown go */
export function playCountdownGo() {
  playTone(880, 'square', 0.2, 0.2, 1200);
}

/** Combo perfect sound */
export function playComboSound() {
  playTone(1200, 'sine', 0.08, 0.15, 1800);
}

/** Initialize audio context on first user interaction */
export function initAudio() {
  const c = ctx();
  if (c.state === 'suspended') c.resume();
}

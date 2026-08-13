/**
 * Web Audio API sound engine — all sounds synthesized, no external files.
 * 爆头音效参考 CS2 "dink" 风格；固定靶命中音支持五阶音调循环（由低到高）。
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

/** Helper: noise burst with optional filter */
function playNoise(
  duration: number,
  volume: number,
  filterFreq?: number,
  filterType: BiquadFilterType = 'lowpass',
) {
  const c = ctx();
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
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

  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq ?? c.sampleRate / 2, c.currentTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  source.start(c.currentTime);
  source.stop(c.currentTime + duration);
}

/** 金属 "dink" 音色：非谐波泛音堆叠 + 快速衰减 + 随机失谐 */
function playDink(base: number, volume: number) {
  const c = ctx();
  const t0 = c.currentTime;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(volume, t0 + 0.004);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  master.connect(c.destination);
  const partials = [1, 1.42, 2.03, 2.87];
  partials.forEach((ratio, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.detune.value = (Math.random() * 2 - 1) * 14;
    osc.frequency.setValueAtTime(base * ratio * (1 + (Math.random() * 2 - 1) * 0.012), t0);
    const g = c.createGain();
    g.gain.value = 1 / (i + 1.2);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  });
}

/** 固定靶命中音五阶音调倍率（由低到高） */
const HIT_TONE_RATIOS = [1, 1.26, 1.587, 2, 2.52];

/** 身体命中 — 支持五阶音调循环 */
export function playBodyHitSoundPitched(step: number) {
  const ratio = HIT_TONE_RATIOS[Math.abs(step) % HIT_TONE_RATIOS.length];
  playTone(300 * ratio, 'triangle', 0.09, 0.3, 130 * ratio);
  playNoise(0.05, 0.14, 1600 * Math.min(2, ratio), 'lowpass');
  playNoise(0.025, 0.08, 3400 * Math.min(1.5, ratio), 'bandpass');
}

/** 爆头 — 支持五阶音调循环 */
export function playHeadshotSoundPitched(step: number) {
  const ratio = HIT_TONE_RATIOS[Math.abs(step) % HIT_TONE_RATIOS.length];
  const pitch = (1700 + Math.random() * 240) * ratio;
  playDink(pitch, 0.55);
  playNoise(0.03, 0.18, 4600, 'highpass');
  playTone(92 * Math.max(1, ratio * 0.75), 'sine', 0.17, 0.38, 40);
}

// ── Public API ───────────────────────────────────────────────

/** 爆头（CS2 风格 dink）：清脆金属高音 + 低频身体撞击 */
export function playHeadshotSound() {
  playHeadshotSoundPitched(0);
}

/** 身体命中 — 闷实的撞击感 + 轻微护甲摩擦 */
export function playBodyHitSound() {
  playBodyHitSoundPitched(0);
}

/** 脱靶 — 轻微的空气声 */
export function playMissSound() {
  playTone(110, 'triangle', 0.11, 0.14, 55);
  playNoise(0.06, 0.08, 750, 'lowpass');
}

/** 微调击杀确认 — 更亮的高频双响 */
export function playMicroKillSound() {
  playDink(2500 + Math.random() * 240, 0.5);
  playTone(1150, 'sine', 0.12, 0.2, 850);
  playNoise(0.03, 0.15, 5400, 'highpass');
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

let ctx: AudioContext | null = null;
let muted = false;
const muteListeners: ((muted: boolean) => void)[] = [];

export function onMuteChange(fn: (muted: boolean) => void) {
  muteListeners.push(fn);
}

export function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.04, slideTo?: number, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.08, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  gain.gain.value = vol;
  src.connect(gain).connect(c.destination);
  src.start(t);
}

export const sfx = {
  hover: () => tone(880, 0.03, 'square', 0.015),
  click: () => tone(520, 0.06, 'square', 0.04, 780),
  select: () => { tone(440, 0.07, 'square', 0.04); tone(660, 0.09, 'square', 0.04, undefined, 0.06); },
  scribble: () => tone(180 + Math.random() * 120, 0.04, 'sawtooth', 0.012),
  stamp: () => { noise(0.25, 0.25); tone(90, 0.25, 'square', 0.08, 40); },
  ring: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 1180 : 980, 0.08, 'square', 0.03, undefined, i * 0.09); },
  tick: () => tone(1400, 0.02, 'square', 0.012),
  alarm: () => { tone(660, 0.15, 'square', 0.05); tone(440, 0.2, 'square', 0.05, undefined, 0.16); },
  up: () => { tone(523, 0.08, 'square', 0.035); tone(784, 0.12, 'square', 0.035, undefined, 0.08); },
  down: () => { tone(392, 0.08, 'square', 0.035); tone(262, 0.16, 'square', 0.035, undefined, 0.08); },
  gavel: () => { noise(0.12, 0.3); noise(0.12, 0.3, 0.22); tone(70, 0.3, 'triangle', 0.1, 50, 0.22); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.35 : 0.12, 'square', 0.035, undefined, i * 0.11)),
  type: () => tone(1200 + Math.random() * 400, 0.015, 'square', 0.008),
  toggleMute(): boolean {
    muted = !muted;
    muteListeners.forEach((fn) => fn(muted));
    return muted;
  },
  isMuted: () => muted,
};

import { ac, onMuteChange, sfx } from './sfx';

/*
 * Trilha chiptune gerada em tempo real (WebAudio), sem arquivos de áudio.
 * Cada clima é uma progressão de acordes, andamento e padrão de bateria; a troca entra no próximo compasso.
 */

export type Mood = 'title' | 'calm' | 'tense' | 'press' | 'epic' | 'sad';

interface Style {
  bpm: number;
  /** Nota MIDI da tônica. */
  root: number;
  /** Acordes do ciclo, em semitons a partir da tônica (um por compasso). */
  chords: number[][];
  bass: 'quarter' | 'eighth' | 'pulse';
  arp: 'up' | 'updown' | 'sparse' | 'none';
  lead: boolean;
  drums: 'none' | 'soft' | 'march' | 'drive';
  wave: OscillatorType;
}

const STYLES: Record<Mood, Style> = {
  title: { bpm: 104, root: 60, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: 'eighth', arp: 'updown', lead: true, drums: 'march', wave: 'square' },
  calm: { bpm: 92, root: 60, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], bass: 'quarter', arp: 'up', lead: false, drums: 'soft', wave: 'triangle' },
  tense: { bpm: 124, root: 57, chords: [[0, 3, 7], [8, 12, 15], [10, 14, 17], [0, 3, 7]], bass: 'pulse', arp: 'up', lead: false, drums: 'drive', wave: 'square' },
  press: { bpm: 112, root: 62, chords: [[0, 3, 7], [5, 8, 12], [7, 10, 14], [3, 7, 10]], bass: 'eighth', arp: 'sparse', lead: false, drums: 'soft', wave: 'square' },
  epic: { bpm: 112, root: 55, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bass: 'eighth', arp: 'updown', lead: true, drums: 'march', wave: 'square' },
  sad: { bpm: 66, root: 50, chords: [[0, 3, 7], [5, 8, 12], [0, 3, 7], [7, 10, 14]], bass: 'quarter', arp: 'sparse', lead: false, drums: 'none', wave: 'triangle' },
};

const VOLUME = 0.05;
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

class Music {
  private mood: Mood | null = null;
  private pending: Mood | null = null;
  private master: GainNode | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private started = false;

  constructor() {
    onMuteChange((m) => this.master?.gain.setTargetAtTime(m ? 0 : VOLUME, ac()?.currentTime ?? 0, 0.1));
  }

  get current(): Mood {
    return this.pending ?? this.mood ?? 'calm';
  }

  /** Troca o clima no próximo compasso. Antes do primeiro gesto do jogador, só guarda o pedido. */
  play(mood: Mood) {
    if (mood === this.mood && !this.pending) return;
    this.pending = mood;
    if (this.started) return;
    const unlock = () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      this.start();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  private start() {
    const c = ac();
    if (!c || this.started) return;
    this.started = true;
    this.master = c.createGain();
    this.master.gain.value = sfx.isMuted() ? 0 : VOLUME;
    this.master.connect(c.destination);
    this.nextTime = c.currentTime + 0.1;
    window.setInterval(() => this.schedule(), 25);
  }

  private schedule() {
    const c = ac();
    if (!c || !this.master) return;
    while (this.nextTime < c.currentTime + 0.12) {
      if (this.step === 0 && this.pending) {
        this.mood = this.pending;
        this.pending = null;
        this.bar = 0;
      }
      if (this.mood) this.playStep(c, STYLES[this.mood], this.nextTime);
      const sixteenth = 60 / STYLES[this.mood ?? 'calm'].bpm / 4;
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  private note(c: AudioContext, midi: number, t: number, dur: number, wave: OscillatorType, vol: number) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.value = freq(midi);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hit(c: AudioContext, t: number, kind: 'kick' | 'snare' | 'hat') {
    if (kind === 'kick') {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    const len = kind === 'snare' ? 0.12 : 0.03;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    g.gain.value = kind === 'snare' ? 0.35 : 0.12;
    src.connect(g).connect(this.master!);
    src.start(t);
  }

  private playStep(c: AudioContext, s: Style, t: number) {
    const chord = s.chords[this.bar % s.chords.length];
    const sixteenth = 60 / s.bpm / 4;
    const i = this.step;

    // baixo
    const bassOn = s.bass === 'quarter' ? i % 4 === 0 : s.bass === 'eighth' ? i % 2 === 0 : true;
    if (bassOn) this.note(c, s.root - 24 + chord[0] + (s.bass === 'eighth' && i % 8 === 6 ? 7 : 0), t, sixteenth * (s.bass === 'pulse' ? 0.8 : 1.8), 'triangle', 0.5);

    // arpejo
    if (s.arp !== 'none') {
      const play = s.arp === 'sparse' ? i % 4 === 2 : i % 2 === 0;
      if (play) {
        const seq = s.arp === 'updown' ? [0, 1, 2, 1] : [0, 1, 2, 0 + 12];
        const idx = Math.floor(i / 2) % seq.length;
        const n = seq[idx] >= 12 ? chord[0] + 12 : chord[seq[idx]];
        this.note(c, s.root + n, t, sixteenth * 1.6, s.wave, 0.12);
      }
    }

    // melodia simples nas notas do acorde
    if (s.lead && (i === 0 || i === 6 || i === 10)) {
      const pick = [2, 1, 0][[0, 6, 10].indexOf(i)];
      this.note(c, s.root + 12 + chord[(pick + this.bar) % 3], t, sixteenth * (i === 10 ? 5 : 3.5), 'square', 0.1);
    }

    // bateria
    switch (s.drums) {
      case 'soft':
        if (i === 0 || i === 8) this.hit(c, t, 'kick');
        if (i % 4 === 2) this.hit(c, t, 'hat');
        break;
      case 'march':
        if (i % 4 === 0) this.hit(c, t, 'kick');
        if (i === 4 || i === 12 || i === 14) this.hit(c, t, 'snare');
        if (i % 2 === 1) this.hit(c, t, 'hat');
        break;
      case 'drive':
        if (i % 4 === 0 || i === 10) this.hit(c, t, 'kick');
        if (i === 4 || i === 12) this.hit(c, t, 'snare');
        this.hit(c, t, 'hat');
        break;
    }
  }
}

export const music = new Music();

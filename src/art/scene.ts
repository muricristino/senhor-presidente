import type { SceneAnim } from '../engine/types';
import { makeCanvas, px, rect, seeded, type Ctx } from './pixel';

import { SCENE_H, SCENE_W } from '../engine/catalog';
import { slow } from '../speed';

type Sky = 'day' | 'bright' | 'dusk' | 'grey' | 'fire' | 'night';
type Crowd = 'walk' | 'protest' | 'celebrate' | 'few' | 'phones' | 'audience';

const SKIES: Record<Sky, string[]> = {
  day: ['#6fb6e8', '#86c4ec', '#a2d3f0', '#c0e2f3'],
  bright: ['#58a8e8', '#78bdf0', '#9fd2f4', '#cfe9f6'],
  dusk: ['#5a4a6a', '#8a5a6a', '#c6785a', '#e8a86a'],
  grey: ['#5a6070', '#6e7482', '#858a94', '#9ea2a8'],
  fire: ['#3a2a2a', '#6a3a2a', '#a8542a', '#d8843a'],
  night: ['#0e1024', '#161a38', '#20264a', '#2c335a'],
};

/** Céu e multidão de cada animação. Tudo que não está aqui é desenhado na função da animação. */
const LOOK: Record<SceneAnim, { sky: Sky; crowd: Crowd }> = {
  calm: { sky: 'day', crowd: 'walk' },
  protest: { sky: 'dusk', crowd: 'protest' },
  celebrate: { sky: 'bright', crowd: 'celebrate' },
  military: { sky: 'grey', crowd: 'few' },
  fire: { sky: 'fire', crowd: 'few' },
  firefight: { sky: 'fire', crowd: 'few' },
  trucks_block: { sky: 'dusk', crowd: 'protest' },
  trucks_leave: { sky: 'bright', crowd: 'celebrate' },
  money_rain: { sky: 'bright', crowd: 'celebrate' },
  phones_live: { sky: 'night', crowd: 'phones' },
  blackout: { sky: 'grey', crowd: 'protest' },
  gavel: { sky: 'grey', crowd: 'audience' },
  vote_yes: { sky: 'day', crowd: 'celebrate' },
  vote_no: { sky: 'grey', crowd: 'protest' },
  market_crash: { sky: 'dusk', crowd: 'protest' },
  market_boom: { sky: 'bright', crowd: 'celebrate' },
  prices_up: { sky: 'dusk', crowd: 'protest' },
  prices_down: { sky: 'bright', crowd: 'celebrate' },
  speech: { sky: 'day', crowd: 'audience' },
};


// Fonte 3x5 para letreiros dentro da cena.
const GLYPHS: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  I: '111010010010111', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', X: '101101010101101', $: '011110010011110', '%': '101001010100101', '!': '010010010000010',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', J: '001001001101010', K: '101101110101101',
  Q: '010101101110011', W: '101101111111101', Y: '101101010010010', Z: '111001010100111',
  '-': '000000111000000', '+': '000010111010000', ' ': '000000000000000', ',': '000000000010100',
};

export function text(ctx: Ctx, s: string, x: number, y: number, color: string) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') px(ctx, cx + (i % 3), y + Math.floor(i / 3), color);
    cx += 4;
  }
}

/** Janela do Planalto: Congresso ao fundo, Esplanada e o que o governo acabou de fazer. */
export class PlanaltoScene {
  readonly canvas = makeCanvas(SCENE_W, SCENE_H, 'scene');
  private ctx: Ctx = this.canvas.getContext('2d')!;
  private anim: SceneAnim = 'calm';
  private approval = 50;
  private frame = 0;
  /** Quadros desde a última troca de animação: é o relógio da coreografia. */
  private t = 0;
  private raf = 0;
  private last = 0;
  private flash = 0;

  set(anim: SceneAnim, approval = this.approval) {
    this.anim = LOOK[anim] ? anim : 'calm';
    this.approval = approval;
    this.t = 0;
    this.flash = 6;
  }

  start() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < slow(80)) return; // ~12 fps na velocidade original, estética retrô
      this.last = now;
      this.frame++;
      this.t++;
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** Avança um quadro sem loop próprio (usado como cenário das cinemáticas). */
  step() {
    this.frame++;
    this.t++;
    this.draw();
  }

  private draw() {
    const { ctx } = this;
    const look = LOOK[this.anim];
    ctx.save();
    const slam = this.anim === 'gavel' && this.t % 60 >= 15 && this.t % 60 < 19;
    if (slam) ctx.translate(this.t % 2 ? 2 : -2, this.t % 2 ? -1 : 1);

    this.drawSky(look.sky);
    if (this.anim === 'gavel') this.drawStf();
    this.drawCongress();
    this.drawGround();

    switch (this.anim) {
      case 'fire': this.drawFire(1); break;
      case 'firefight': this.drawFirefight(); break;
      case 'trucks_block': this.drawTrucks(0, false); break;
      case 'trucks_leave': this.drawTrucks(this.t * 2.5, true); break;
      case 'military': this.drawMilitary(); break;
      case 'money_rain': this.drawMoney(); break;
      case 'phones_live': this.drawLive(); break;
      case 'blackout': this.drawBlackout(); break;
      case 'gavel': this.drawGavel(); break;
      case 'vote_yes': this.drawVote(true); break;
      case 'vote_no': this.drawVote(false); break;
      case 'market_crash': this.drawMarket(false); break;
      case 'market_boom': this.drawMarket(true); break;
      case 'prices_up': this.drawPrice(true); break;
      case 'prices_down': this.drawPrice(false); break;
      case 'speech': this.drawSpeech(); break;
      case 'celebrate': this.drawFireworks(); break;
    }
    this.drawCrowd(look.crowd);
    if (this.anim === 'trucks_leave' || this.anim === 'market_boom' || this.anim === 'prices_down') this.drawConfetti();
    ctx.restore();

    if (slam && this.t % 60 === 15) this.flash = 4;
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash / 8})`;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      this.flash--;
    }
  }

  // ---------- cenário base ----------

  private drawSky(sky: Sky) {
    const { ctx, frame } = this;
    const c = SKIES[sky];
    const band = 64 / c.length;
    c.forEach((col, i) => rect(ctx, 0, i * band, SCENE_W, band + 1, col));
    for (let i = 1; i < c.length; i++) for (let x = i % 2; x < SCENE_W; x += 2) px(ctx, x, i * band - 1, c[i]);

    if (sky === 'night') {
      const r = seeded(3);
      for (let i = 0; i < 30; i++) px(ctx, r() * SCENE_W, r() * 50, (frame + i) % 20 < 17 ? '#f4f1ea' : '#6a6a8a');
      rect(ctx, 150, 10, 8, 8, '#f4f1ea');
      rect(ctx, 153, 10, 5, 6, SKIES.night[0]);
      return;
    }
    const low = sky === 'dusk' || sky === 'fire';
    const sunY = low ? 44 : 12;
    const sun = sky === 'fire' ? '#e8542a' : low ? '#f4a04a' : sky === 'grey' ? '#d8d8d0' : '#fbe38a';
    rect(ctx, 150, sunY, 10, 10, sun);
    rect(ctx, 149, sunY + 2, 12, 6, sun);
    rect(ctx, 152, sunY - 1, 6, 12, sun);
    const cloud = sky === 'grey' ? '#b8bcc2' : sky === 'dusk' ? '#d8a0a0' : sky === 'fire' ? '#5a4a48' : '#f4f8fb';
    [[10, 10, 0.25], [80, 20, 0.15], [140, 6, 0.2]].forEach(([x0, y, speed]) => {
      const x = ((x0 + frame * speed) % (SCENE_W + 40)) - 30;
      rect(ctx, x, y, 22, 4, cloud);
      rect(ctx, x + 4, y - 3, 12, 3, cloud);
    });
  }

  private drawCongress() {
    const { ctx } = this;
    const concrete = '#e8e4da';
    const shade = '#b8b2a6';
    rect(ctx, 28, 62, 136, 6, concrete);
    rect(ctx, 28, 67, 136, 2, shade);
    rect(ctx, 20, 69, 152, 3, '#cfc9bc');
    rect(ctx, 90, 22, 5, 40, concrete);
    rect(ctx, 98, 22, 5, 40, concrete);
    rect(ctx, 94, 22, 1, 40, shade);
    rect(ctx, 102, 22, 1, 40, shade);
    rect(ctx, 95, 38, 3, 3, concrete);
    for (let y = 24; y < 62; y += 3) {
      rect(ctx, 91, y, 3, 1, '#7a9ab0');
      rect(ctx, 99, y, 3, 1, '#7a9ab0');
    }
    for (let i = 0; i < 30; i++) {
      const u = (i - 14.5) / 14.5;
      const top = 52 + Math.round((1 - u * u) * 6);
      rect(ctx, 44 + i, top, 1, 62 - top, concrete);
    }
    rect(ctx, 44, 60, 30, 2, shade);
    for (let i = 0; i < 20; i++) {
      const u = (i - 9.5) / 9.5;
      const h = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 8);
      rect(ctx, 124 + i, 62 - h, 1, h, i > 12 ? shade : concrete);
    }
    rect(ctx, 176, 30, 1, 42, '#8a8a8a');
    const wave = this.frame % 8 < 4 ? 0 : 1;
    rect(ctx, 177, 30 + wave, 10, 7, '#2e8b57');
    rect(ctx, 179, 32 + wave, 6, 3, '#f4c542');
    rect(ctx, 181, 33 + wave, 2, 1, '#1f4fa0');
  }

  private drawGround() {
    const { ctx } = this;
    const scorched = this.anim === 'fire';
    rect(ctx, 0, 72, SCENE_W, 40, scorched ? '#7a7a3a' : this.anim === 'military' ? '#5f7a44' : '#6f9a48');
    const r = seeded(7);
    for (let i = 0; i < 90; i++) px(ctx, r() * SCENE_W, 72 + r() * 40, scorched ? '#6a5a2a' : '#5c8a3a');
    rect(ctx, 40, 73, 112, 3, '#7ab8d8');
    rect(ctx, 40, 73, 112, 1, '#a8d8f0');
    rect(ctx, 0, 84, SCENE_W, 10, '#5a5a62');
    rect(ctx, 0, 84, SCENE_W, 1, '#7a7a82');
    const moving = this.anim !== 'trucks_block';
    for (let x = (this.frame * (moving ? 2 : 0)) % 12; x < SCENE_W; x += 12) rect(ctx, x, 89, 6, 1, '#e8e2c8');
  }

  private drawStf() {
    const { ctx } = this;
    // Supremo: caixa baixa com colunas, à esquerda
    rect(ctx, 4, 50, 34, 3, '#f0ece0');
    rect(ctx, 6, 53, 30, 10, '#d8d4c8');
    for (let x = 8; x < 36; x += 4) rect(ctx, x, 53, 1, 10, '#f0ece0');
    rect(ctx, 4, 63, 34, 2, '#b8b2a6');
    text(ctx, 'STF', 15, 44, '#f0ece0');
  }

  // ---------- animações ----------

  private drawTrucks(offset: number, honk: boolean) {
    const { ctx } = this;
    const colors = ['#c63d3d', '#1f4fa0', '#e8b030', '#e8e2d0', '#3a8a5a'];
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 32 + offset * (1 + i * 0.15);
      if (x > SCENE_W + 30) continue;
      const bounce = honk && this.frame % 4 < 2 ? -1 : 0;
      rect(ctx, x, 80 + bounce, 20, 9, '#d8d4c8');
      rect(ctx, x, 80 + bounce, 20, 1, '#f0ece0');
      rect(ctx, x + 20, 83 + bounce, 7, 6, colors[i % colors.length]);
      rect(ctx, x + 22, 84 + bounce, 4, 2, '#9ad0f0');
      rect(ctx, x + 3, 89, 3, 3, '#1a1a1a');
      rect(ctx, x + 14, 89, 3, 3, '#1a1a1a');
      rect(ctx, x + 22, 89, 3, 3, '#1a1a1a');
      const puff = (this.frame + i * 3) % 12;
      rect(ctx, x - 2 - puff, 86 - (puff >> 1), 2 + (puff >> 2), 2, `rgba(60,60,60,${0.6 - puff / 20})`);
      if (honk && (this.frame + i * 5) % 16 < 4) text(ctx, 'BI BI', x + 2, 72, '#fbe38a');
    }
  }

  private drawMilitary() {
    const { ctx } = this;
    for (let i = 0; i < 3; i++) {
      const target = 20 + i * 60;
      const x = Math.min(target, -60 + this.t * 3 - i * 20);
      rect(ctx, x, 81, 24, 8, '#4a5a32');
      rect(ctx, x + 2, 78, 14, 3, '#3e4c2a');
      rect(ctx, x + 18, 83, 6, 3, '#9ab0a0');
      rect(ctx, x + 3, 89, 3, 3, '#1a1a1a');
      rect(ctx, x + 18, 89, 3, 3, '#1a1a1a');
    }
    const marching = Math.min(14, Math.max(0, Math.floor((this.t - 10) / 2)));
    for (let i = 0; i < marching; i++) {
      const x = 8 + i * 13;
      const step = (this.frame + i) % 4 < 2 ? 0 : 1;
      rect(ctx, x, 95 + step, 3, 2, '#3e4c2a');
      rect(ctx, x, 97 + step, 3, 5, '#5a6a3a');
      rect(ctx, x, 102 + step, 1, 2, '#2a2a2a');
      rect(ctx, x + 2, 102 + step, 1, 2, '#2a2a2a');
    }
  }

  private drawFire(intensity: number) {
    const { ctx } = this;
    if (intensity <= 0) return;
    for (let i = 0; i < 5; i++) {
      const x = 10 + i * 40;
      for (let j = 0; j < 6; j++) {
        const y = 60 - j * 9 - ((this.frame * 0.6 + i * 7) % 9);
        rect(ctx, x + Math.sin((this.frame + j * 5) / 6) * 3 - j, y, 8 + j * 2, 6, `rgba(40,30,30,${(0.55 - j * 0.07) * intensity})`);
      }
    }
    // chamas no horizonte
    for (let x = 0; x < SCENE_W; x += 6) {
      if (x > 20 && x < 172 && intensity < 1 && x % 12 === 0) continue;
      const h = (3 + ((this.frame + x) % 5)) * intensity;
      rect(ctx, x, 72 - h, 4, h, '#e8542a');
      rect(ctx, x + 1, 72 - h * 0.6, 2, h * 0.6, '#f4c542');
    }
    const r = seeded(this.frame);
    for (let i = 0; i < 14 * intensity; i++) px(ctx, r() * SCENE_W, r() * 70, r() > 0.5 ? '#f4a04a' : '#e8542a');
  }

  private drawFirefight() {
    const { ctx, t } = this;
    this.drawFire(Math.max(0, 1 - t / 60));
    for (let k = 0; k < 2; k++) {
      const x = ((t * 3 + k * 110) % (SCENE_W + 60)) - 30;
      const y = 18 + k * 10;
      rect(ctx, x, y, 14, 5, '#c63d3d');
      rect(ctx, x + 10, y + 1, 3, 2, '#9ad0f0');
      rect(ctx, x - 8, y + 1, 8, 2, '#8a2a2a');
      rect(ctx, x - 4 + (this.frame % 2) * 8, y - 2, 14, 1, '#2a2a2a');
      rect(ctx, x + 2, y + 5, 1, 2, '#2a2a2a');
      rect(ctx, x + 10, y + 5, 1, 2, '#2a2a2a');
      for (let d = 0; d < 6; d++) px(ctx, x + 4 + (d % 3), y + 8 + d * 6 + (this.frame % 6), '#7ab8f8');
    }
  }

  private drawMoney() {
    const { ctx, t } = this;
    const px0 = (t * 3) % (SCENE_W + 80) - 40;
    rect(ctx, px0, 10, 20, 4, '#e8e4da');
    rect(ctx, px0 + 6, 6, 5, 12, '#c8c4ba');
    rect(ctx, px0 + 18, 11, 3, 2, '#9ad0f0');
    for (let i = 0; i < 26; i++) {
      const born = i * 3;
      if (t < born) continue;
      const age = (t - born) % 70;
      const x = ((born * 3) % (SCENE_W + 80)) - 40 + Math.sin((age + i) / 3) * 4;
      const y = 14 + age * 1.3;
      if (y > 110) continue;
      rect(ctx, x, y, 4, 2, '#4fc27f');
      px(ctx, x + 1, y, '#2e8b57');
    }
  }

  private drawLive() {
    const { ctx, frame } = this;
    rect(ctx, 6, 6, 24, 11, '#e0574f');
    if (frame % 12 < 8) rect(ctx, 9, 10, 3, 3, '#f4f1ea');
    text(ctx, 'LIVE', 13, 9, '#f4f1ea');
    text(ctx, `${Math.min(12, Math.floor(this.t / 4))}M`, 36, 9, '#f4f1ea');
    for (let i = 0; i < 12; i++) {
      const y = 110 - ((frame * 2 + i * 13) % 80);
      const x = 150 + Math.sin((frame + i * 7) / 5) * 10 + (i % 4) * 8;
      rect(ctx, x, y, 2, 1, '#ff6fa8');
      rect(ctx, x + 3, y, 2, 1, '#ff6fa8');
      rect(ctx, x, y + 1, 5, 1, '#ff6fa8');
      rect(ctx, x + 1, y + 2, 3, 1, '#ff6fa8');
      px(ctx, x + 2, y + 3, '#ff6fa8');
    }
  }

  private drawBlackout() {
    const { ctx, frame } = this;
    ctx.fillStyle = 'rgba(10,10,20,0.35)';
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    const cx = 60;
    const cy = 30;
    for (let r = 0; r < 3; r++) {
      const w = 8 + r * 8;
      rect(ctx, cx - w / 2, cy - r * 5, w, 2, '#9aa0b4');
    }
    rect(ctx, cx - 1, cy + 4, 3, 3, '#9aa0b4');
    if (frame % 10 < 7) {
      for (let i = 0; i < 20; i++) {
        rect(ctx, cx - 12 + i * 1.2, cy - 12 + i * 1.2, 2, 2, '#e0574f');
        rect(ctx, cx + 12 - i * 1.2, cy - 12 + i * 1.2, 2, 2, '#e0574f');
      }
    }
    text(ctx, 'SEM REDE', 36, 44, '#e0574f');
  }

  private drawGavel() {
    const { ctx } = this;
    const cycle = this.t % 60;
    const y = cycle < 15 ? -20 + cycle * 4 : cycle < 30 ? 40 : 40 - (cycle - 30) * 3;
    const x = 18;
    rect(ctx, x, y, 22, 10, '#7a4a2a');
    rect(ctx, x, y, 22, 2, '#9a6a3a');
    rect(ctx, x - 2, y + 2, 2, 6, '#5a3a1a');
    rect(ctx, x + 22, y + 2, 2, 6, '#5a3a1a');
    rect(ctx, x + 9, y - 16, 4, 16, '#9a6a3a');
    if (cycle >= 15 && cycle < 22) {
      for (let i = 0; i < 8; i++) rect(ctx, x + 11 + Math.cos(i) * (cycle - 12) * 3, y + 10 + Math.sin(i) * (cycle - 12) * 1.5, 2, 2, '#f4f1ea');
      text(ctx, 'LIMINAR', 56, 36, '#e0574f');
    }
  }

  private drawVote(passes: boolean) {
    const { ctx, t } = this;
    rect(ctx, 56, 4, 80, 30, '#0c0e17');
    rect(ctx, 56, 4, 80, 1, '#3a4163');
    const finalYes = passes ? 341 : 198;
    const finalNo = 513 - finalYes - 14;
    const p = Math.min(1, t / 36);
    const yes = Math.floor(finalYes * p);
    const no = Math.floor(finalNo * p);
    text(ctx, 'SIM', 60, 9, '#4fc27f');
    rect(ctx, 76, 9, (yes / 513) * 44, 5, '#4fc27f');
    text(ctx, String(yes), 122, 9, '#4fc27f');
    text(ctx, 'NAO', 60, 20, '#e0574f');
    rect(ctx, 76, 20, (no / 513) * 44, 5, '#e0574f');
    text(ctx, String(no), 122, 20, '#e0574f');
    if (p >= 1 && this.frame % 10 < 7) text(ctx, yes >= 257 ? 'APROVADO' : 'REJEITADO', 80, 28, yes >= 257 ? '#4fc27f' : '#e0574f');
  }

  private drawMarket(up: boolean) {
    const { ctx, t } = this;
    rect(ctx, 110, 6, 72, 40, '#0c0e17');
    rect(ctx, 110, 6, 72, 1, '#3a4163');
    text(ctx, 'IBOV', 114, 9, '#9aa0b4');
    const color = up ? '#4fc27f' : '#e0574f';
    const r = seeded(up ? 5 : 9);
    let y = up ? 38 : 20;
    const n = Math.min(60, t);
    for (let i = 0; i < n; i++) {
      y += (up ? -0.35 : 0.35) + (r() - 0.5) * 2;
      y = Math.max(16, Math.min(42, y));
      rect(ctx, 116 + i, y, 1, 2, color);
    }
    text(ctx, up ? '+4%' : '-6%', 160, 9, color);
    if (!up) {
      for (let i = 0; i < 10; i++) {
        const age = (this.frame * 2 + i * 11) % 90;
        rect(ctx, 20 + i * 15 + Math.sin(age / 4) * 5, age, 4, 3, '#f0ece0');
      }
    }
  }

  private drawPrice(up: boolean) {
    const { ctx, t } = this;
    const x = 120;
    const y = 8;
    rect(ctx, x, y, 50, 22, '#f4d67a');
    rect(ctx, x - 6, y + 6, 6, 10, '#f4d67a');
    rect(ctx, x - 3, y + 10, 2, 2, '#8a6a2a');
    const value = up ? 25 + Math.min(19, Math.floor(t / 3)) : 44 - Math.min(15, Math.floor(t / 3));
    text(ctx, `R$${value}`, x + 6, y + 8, '#2a2230');
    const ay = y + 26 + (this.frame % 6 < 3 ? 0 : 1);
    const c = up ? '#e0574f' : '#4fc27f';
    if (up) {
      rect(ctx, x + 22, ay + 2, 4, 8, c);
      rect(ctx, x + 19, ay + 2, 10, 2, c);
      rect(ctx, x + 21, ay, 6, 2, c);
    } else {
      rect(ctx, x + 22, ay, 4, 8, c);
      rect(ctx, x + 19, ay + 6, 10, 2, c);
      rect(ctx, x + 21, ay + 8, 6, 2, c);
    }
    // carrinhos passando
    for (let i = 0; i < 3; i++) {
      const cx = ((this.frame * 1.5 + i * 70) % (SCENE_W + 20)) - 10;
      rect(ctx, cx, 86, 8, 4, '#c8c8d0');
      rect(ctx, cx + 1, 90, 2, 2, '#2a2a2a');
      rect(ctx, cx + 5, 90, 2, 2, '#2a2a2a');
      if (!up) rect(ctx, cx + 1, 83, 6, 3, '#4fc27f');
    }
  }

  private drawSpeech() {
    const { ctx, frame } = this;
    rect(ctx, 88, 88, 16, 12, '#7a4a2a');
    rect(ctx, 88, 88, 16, 2, '#9a6a3a');
    rect(ctx, 94, 92, 4, 3, '#f4c542');
    rect(ctx, 93, 80, 6, 4, '#e8b48f');
    rect(ctx, 92, 84, 8, 4, '#1f2a44');
    rect(ctx, 95, 84, 2, 4, '#2e8b57');
    rect(ctx, 90, 85, 1, 4, '#2a2a2a');
    rect(ctx, 101, 85, 1, 4, '#2a2a2a');
    const r = seeded(frame);
    for (let i = 0; i < 4; i++) if (r() > 0.6) rect(ctx, 10 + r() * 170, 96 + r() * 10, 3, 3, '#ffffff');
  }

  private drawFireworks() {
    const { ctx, frame } = this;
    for (let k = 0; k < 3; k++) {
      const age = (frame + k * 9) % 24;
      const r = seeded(Math.floor((frame + k * 9) / 24) * 7 + k);
      const cx = 20 + r() * 150;
      const cy = 8 + r() * 30;
      const col = ['#f4c542', '#4fc27f', '#6fb6ff', '#ff6fa8'][k % 4];
      if (age < 6) {
        px(ctx, cx, cy + (6 - age) * 5, col);
        continue;
      }
      const rad = (age - 6) * 1.2;
      for (let i = 0; i < 10; i++) px(ctx, cx + Math.cos(i * 0.63) * rad, cy + Math.sin(i * 0.63) * rad, col);
    }
  }

  private drawConfetti() {
    const { ctx, frame } = this;
    const cols = ['#f4c542', '#4fc27f', '#6fb6ff', '#ff6fa8', '#f4f1ea'];
    for (let i = 0; i < 30; i++) {
      const y = (frame * 1.5 + i * 17) % 112;
      const x = (i * 37 + Math.sin((frame + i) / 4) * 4) % SCENE_W;
      rect(ctx, x, y, 2, 1, cols[i % cols.length]);
    }
  }

  private drawCrowd(kind: Crowd) {
    const { ctx } = this;
    const angry = this.approval < 40;
    const count = { walk: 12, protest: Math.min(56, 16 + this.t), celebrate: 40, few: 8, phones: 38, audience: 34 }[kind];
    const r = seeded(42);
    const shirts = kind === 'celebrate' ? ['#f4c542', '#2e8b57', '#f4c542', '#1f4fa0'] : ['#c63d3d', '#e8e2d0', '#3a6fd8', '#8a5a3a', '#e8b030', '#5a3a6a'];
    const skins = ['#e8b48f', '#8d5a3b', '#c68e62', '#5e3a24', '#f1c9a5'];
    for (let i = 0; i < count; i++) {
      const baseX = r() * (SCENE_W - 6);
      const y = 99 + r() * 9;
      const shirt = shirts[Math.floor(r() * shirts.length)];
      const skin = skins[Math.floor(r() * skins.length)];
      let x = baseX;
      let jump = 0;
      if (kind === 'walk' || kind === 'few') x = (baseX + this.frame * (0.3 + r() * 0.5)) % SCENE_W;
      if (kind === 'celebrate') jump = (this.frame + i) % 6 < 3 ? -2 : 0;
      if (kind === 'protest') jump = (this.frame + i * 2) % 8 < 2 ? -1 : 0;
      const yy = y + jump;
      rect(ctx, x + 1, yy, 2, 2, skin);
      rect(ctx, x, yy + 2, 4, 4, shirt);
      rect(ctx, x, yy + 6, 1, 2, '#2a2a3a');
      rect(ctx, x + 3, yy + 6, 1, 2, '#2a2a3a');
      const sign = (kind === 'protest' && i % 3 === 0) || (kind === 'walk' && angry && i % 3 === 0);
      if (sign) {
        rect(ctx, x + 4, yy - 5, 1, 7, '#7a5a3a');
        rect(ctx, x + 2, yy - 9, 7, 4, i % 2 ? '#f0ece0' : '#c63d3d');
      }
      if (kind === 'celebrate' && i % 4 === 0) {
        rect(ctx, x + 4, yy - 6, 1, 8, '#7a5a3a');
        rect(ctx, x + 5, yy - 6, 5, 4, '#2e8b57');
        rect(ctx, x + 6, yy - 5, 3, 2, '#f4c542');
      }
      if (kind === 'phones' || (this.anim === 'blackout' && i % 2 === 0)) {
        const lit = this.anim === 'blackout' ? '#e0574f' : this.frame % 8 < 6 ? '#dff4ff' : '#9ad0f0';
        rect(ctx, x + 1, yy - 3, 2, 2, lit);
      }
    }
  }
}

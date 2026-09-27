import { drawSprite, spriteSize } from '../art/sprites';
import type { PixelSprite } from '../engine/types';
import { el, esc } from '../ui/dom';

/*
 * Palco v2: motor de cenas interativas.
 * - resolução lógica 320x180, 60 quadros por segundo, desenho sempre na grade de pixels;
 * - atores com caminhada, esticar/amassar e emotes; partículas; câmera com seguir, zoom e tremor;
 * - roteiro com async/await: `await ator.andar(x)`, `await palco.falar(ator, '...')`, `await palco.escolher([...])`.
 */

export const LW = 320;
export const LH = 180;

export type Ease = (t: number) => number;
export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
  back: (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
  elastic: (t: number) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

/** Dois quadros de caminhada a partir de um sprite de pessoa: pernas abertas e fechadas. */
export function walkFrames(s: PixelSprite): PixelSprite[] {
  const { w, h } = spriteSize(s);
  const legTop = Math.floor(h * 0.72);
  const open = s.rows.map((row, y) => {
    if (y < legTop) return row;
    const chars = Array(w).fill('.');
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      const nx = x < w / 2 ? x - 1 : x + 1;
      if (nx >= 0 && nx < w) chars[nx] = row[x];
    }
    return chars.join('');
  });
  return [{ ...s, id: `${s.id}_a`, rows: open }, s];
}

export class Actor {
  x: number;
  y: number;
  facing: 1 | -1 = 1;
  speed = 55;
  visible = true;
  /** Esticar/amassar: >0 estica, <0 amassa; volta sozinho com mola. */
  squash = 0;
  private squashV = 0;
  private walkT = 0;
  private target: { x: number; y: number; done: () => void } | null = null;
  private frames: PixelSprite[];
  emote: { text: string; until: number } | null = null;
  jumpT = -1;
  label?: string;

  constructor(
    public sprite: PixelSprite,
    x: number,
    y: number,
    public name = '',
  ) {
    this.x = x;
    this.y = y;
    this.frames = walkFrames(sprite);
  }

  get walking() {
    return !!this.target;
  }

  /** Anda até (x, y) e resolve ao chegar. */
  walkTo(x: number, y = this.y): Promise<void> {
    this.target?.done();
    return new Promise((done) => {
      this.facing = x < this.x ? -1 : 1;
      this.target = { x, y, done };
    });
  }

  stop() {
    this.target?.done();
    this.target = null;
  }

  punch(amount = -0.35) {
    this.squash = amount;
    this.squashV = 0;
  }

  jump() {
    this.jumpT = 0;
  }

  update(dt: number, t: number) {
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (d <= step) {
        this.x = this.target.x;
        this.y = this.target.y;
        const done = this.target.done;
        this.target = null;
        this.punch(-0.12);
        done();
      } else {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
        this.walkT += dt;
      }
    }
    // mola do esticar/amassar
    this.squashV += (-this.squash * 180 - this.squashV * 14) * dt;
    this.squash += this.squashV * dt;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      if (this.jumpT > 0.45) {
        this.jumpT = -1;
        this.punch(-0.25);
      }
    }
    if (this.emote && t > this.emote.until) this.emote = null;
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    if (!this.visible) return;
    const frame = this.walking ? this.frames[Math.floor(this.walkT * 8) % 2] : this.sprite;
    const { w, h } = spriteSize(frame);
    const bob = this.walking ? (Math.floor(this.walkT * 8) % 2 ? -1 : 0) : Math.sin(t * 2.2) > 0.96 ? -1 : 0;
    const hop = this.jumpT >= 0 ? -Math.sin((this.jumpT / 0.45) * Math.PI) * 10 : 0;
    const sy = 1 + this.squash;
    const sx = 1 - this.squash * 0.6;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(Math.round(this.x - w * 0.4), Math.round(this.y - 1), Math.round(w * 0.8), 2);
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y + bob + hop));
    ctx.scale(sx * this.facing, sy);
    drawSprite(ctx, frame, 0, 0);
    ctx.restore();
    void h;
  }

  /** Topo da cabeça, para balões e emotes. */
  head(): { x: number; y: number } {
    const { h } = spriteSize(this.sprite);
    return { x: this.x, y: this.y - h * (1 + this.squash) - 3 };
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

export class Particles {
  list: Particle[] = [];

  emit(x: number, y: number, o: { count?: number; colors: string[]; speed?: number; gravity?: number; life?: number; size?: number; spread?: number; up?: number }) {
    const n = o.count ?? 12;
    for (let i = 0; i < n; i++) {
      const a = (o.spread ?? Math.PI * 2) * (Math.random() - 0.5) - Math.PI / 2;
      const s = (o.speed ?? 60) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.6);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (o.up ?? 0),
        life,
        max: life,
        color: o.colors[i % o.colors.length],
        size: o.size ?? 2,
        gravity: o.gravity ?? 160,
      });
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  follow: Actor | null = null;
  bounds = { minX: 0, maxX: 0 };
  private shakeT = 0;
  private shakeI = 0;

  shake(intensity = 3, dur = 0.3) {
    this.shakeI = intensity;
    this.shakeT = dur;
  }

  update(dt: number) {
    if (this.follow) {
      const target = this.follow.x - LW / 2 / this.zoom;
      this.x += (target - this.x) * Math.min(1, dt * 5);
    }
    this.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.x));
    if (this.shakeT > 0) this.shakeT -= dt;
  }

  apply(ctx: CanvasRenderingContext2D) {
    const sx = this.shakeT > 0 ? (Math.random() - 0.5) * 2 * this.shakeI : 0;
    const sy = this.shakeT > 0 ? (Math.random() - 0.5) * 2 * this.shakeI : 0;
    // zoom centrado na tela
    ctx.translate(LW / 2, LH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-LW / 2, -LH / 2);
    ctx.translate(Math.round(-this.x + sx), Math.round(-this.y + sy));
  }
}

export interface Choice {
  label: string;
  hint?: string;
}

/** O palco: laço de 60fps, mundo, câmera, partículas, entrada e a camada de interface (balões, escolhas, HUD). */
export class Stage {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  readonly ui = el('div', 'lab-ui');
  readonly root = el('div', 'lab-stage');
  readonly camera = new Camera();
  readonly particles = new Particles();
  actors: Actor[] = [];
  /** Camadas de fundo (paralaxe): recebem a câmera e o tempo. */
  background: ((ctx: CanvasRenderingContext2D, cam: Camera, t: number) => void)[] = [];
  /** Desenho do mundo por cima dos atores (projéteis, objetos). */
  foreground: ((ctx: CanvasRenderingContext2D, t: number) => void)[] = [];
  /** Desenho fixo na tela, fora da câmera (HUD em pixel, vinheta). */
  overlay: ((ctx: CanvasRenderingContext2D, t: number) => void)[] = [];
  onUpdate: ((dt: number, t: number) => void) | null = null;
  onPointer: ((p: { x: number; y: number; screenX: number; screenY: number }) => void) | null = null;
  /** Arrastar (dedo ou mouse pressionado). */
  onPointerMove: ((p: { x: number; y: number; screenX: number; screenY: number }) => void) | null = null;
  keys = new Set<string>();
  t = 0;
  timeScale = 1;
  private raf = 0;
  private last = 0;
  private flashA = 0;
  private flashColor = '#fff';
  private fps = { frames: 0, acc: 0, value: 60 };
  private cleanups: (() => void)[] = [];

  constructor() {
    this.canvas.width = LW;
    this.canvas.height = LH;
    this.canvas.className = 'lab-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.root.append(this.canvas, this.ui);
    const toWorld = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * LW;
      const sy = ((e.clientY - r.top) / r.height) * LH;
      const z = this.camera.zoom;
      const x = (sx - LW / 2) / z + LW / 2 + this.camera.x;
      const y = (sy - LH / 2) / z + LH / 2 + this.camera.y;
      return { x, y, screenX: sx, screenY: sy };
    };
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer?.(toWorld(e)));
    this.canvas.addEventListener('pointermove', (e) => e.buttons && this.onPointerMove?.(toWorld(e)));
    const down = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    this.cleanups.push(() => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    });
  }

  /** Registra algo para desfazer quando o palco for encerrado (ex.: ouvintes de teclado da demo). */
  own(cleanup: () => void) {
    this.cleanups.push(cleanup);
  }

  get fpsValue() {
    return this.fps.value;
  }

  add(a: Actor): Actor {
    this.actors.push(a);
    return a;
  }

  start() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const real = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;
      const dt = real * this.timeScale;
      this.t += dt;
      this.fps.frames++;
      this.fps.acc += real;
      if (this.fps.acc >= 0.5) {
        this.fps.value = Math.round(this.fps.frames / this.fps.acc);
        this.fps.frames = 0;
        this.fps.acc = 0;
      }
      this.update(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.root.remove();
  }

  private update(dt: number) {
    for (const a of this.actors) a.update(dt, this.t);
    this.particles.update(dt);
    this.camera.update(dt);
    this.onUpdate?.(dt, this.t);
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 3);
    this.positionBubbles();
  }

  private draw() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, LW, LH);
    ctx.save();
    // o fundo recebe só o zoom; a paralaxe é calculada por camada
    ctx.translate(LW / 2, LH / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-LW / 2, -LH / 2);
    for (const layer of this.background) layer(ctx, this.camera, this.t);
    ctx.restore();
    ctx.save();
    this.camera.apply(ctx);
    for (const a of [...this.actors].sort((p, q) => p.y - q.y)) a.draw(ctx, this.t);
    for (const f of this.foreground) f(ctx, this.t);
    this.particles.draw(ctx);
    for (const a of this.actors) {
      if (!a.emote) continue;
      const h = a.head();
      ctx.font = '10px sans-serif';
      ctx.fillText(a.emote.text, Math.round(h.x - 5), Math.round(h.y - 2 + Math.sin(this.t * 8) * 1.5));
    }
    ctx.restore();
    for (const o of this.overlay) o(ctx, this.t);
    if (this.flashA > 0) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, LW, LH);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- roteiro ----------

  wait(s: number): Promise<void> {
    return new Promise((r) => {
      const until = this.t + s;
      const check = () => (this.t >= until || !this.root.isConnected ? r() : requestAnimationFrame(check));
      check();
    });
  }

  tween<T extends object>(obj: T, props: Partial<Record<keyof T, number>>, dur: number, e: Ease = ease.inOut): Promise<void> {
    const from = Object.fromEntries(Object.keys(props).map((k) => [k, obj[k as keyof T] as unknown as number]));
    const start = this.t;
    return new Promise((r) => {
      const step = () => {
        const p = Math.min(1, (this.t - start) / dur);
        for (const [k, to] of Object.entries(props)) (obj as Record<string, number>)[k] = from[k] + ((to as number) - from[k]) * e(p);
        if (p < 1 && this.root.isConnected) requestAnimationFrame(step);
        else r();
      };
      step();
    });
  }

  flash(color = '#fff', strength = 0.8) {
    this.flashColor = color;
    this.flashA = strength;
  }

  async slowmo(factor: number, dur: number) {
    this.timeScale = factor;
    await new Promise((r) => setTimeout(r, dur * 1000));
    this.timeScale = 1;
  }

  emote(a: Actor, text: string, dur = 1.4) {
    a.emote = { text, until: this.t + dur };
  }

  private bubbles: { node: HTMLElement; actor: Actor }[] = [];

  private positionBubbles() {
    for (const b of this.bubbles) {
      const h = b.actor.head();
      const z = this.camera.zoom;
      const sx = (h.x - this.camera.x - LW / 2) * z + LW / 2;
      const sy = (h.y - this.camera.y - LH / 2) * z + LH / 2;
      b.node.style.left = `${(sx / LW) * 100}%`;
      b.node.style.top = `${(sy / LH) * 100}%`;
    }
  }

  /** Balão de fala sobre o ator, com texto letra a letra. Resolve quando o jogador toca (ou o tempo passa). */
  say(actor: Actor, text: string, opts: { hold?: number; tone?: 'normal' | 'shout' | 'think' } = {}): Promise<void> {
    const node = el('div', `lab-bubble ${opts.tone ?? 'normal'}`);
    this.ui.append(node);
    const entry = { node, actor };
    this.bubbles.push(entry);
    this.positionBubbles();
    return new Promise((resolve) => {
      let i = 0;
      let typing = true;
      const timer = setInterval(() => {
        i += 1;
        node.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(timer);
          typing = false;
        }
      }, 22);
      const finish = () => {
        if (typing) {
          clearInterval(timer);
          node.textContent = text;
          typing = false;
          return;
        }
        this.root.removeEventListener('pointerdown', finish);
        document.removeEventListener('keydown', onKey);
        node.classList.add('out');
        setTimeout(() => node.remove(), 200);
        this.bubbles = this.bubbles.filter((b) => b !== entry);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => (e.key === 'Enter' || e.code === 'Space') && finish();
      setTimeout(() => {
        this.root.addEventListener('pointerdown', finish);
        document.addEventListener('keydown', onKey);
      }, 150);
      if (opts.hold) setTimeout(() => (typing ? null : finish()), opts.hold * 1000);
    });
  }

  /** Caixa de diálogo com escolhas dentro da cena (teclas 1-4 ou toque). */
  choose(prompt: string, choices: Choice[], speaker?: string): Promise<number> {
    const box = el(
      'div',
      'lab-choice',
      `${speaker ? `<b class="lab-speaker">${esc(speaker)}</b>` : ''}<p>${esc(prompt)}</p>
       <div class="lab-options">${choices
         .map((c, i) => `<button data-i="${i}"><span>${i + 1}</span>${esc(c.label)}${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</button>`)
         .join('')}</div>`,
    );
    this.ui.append(box);
    return new Promise((resolve) => {
      const pick = (i: number) => {
        document.removeEventListener('keydown', onKey);
        box.querySelectorAll('button')[i]?.classList.add('picked');
        setTimeout(() => {
          box.classList.add('out');
          setTimeout(() => box.remove(), 200);
          resolve(i);
        }, 220);
      };
      const onKey = (e: KeyboardEvent) => {
        const n = Number(e.key);
        if (n >= 1 && n <= choices.length) pick(n - 1);
      };
      document.addEventListener('keydown', onKey);
      box.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          pick(Number(b.dataset.i));
        }),
      );
    });
  }

  /** Letreiro grande no meio da tela (título de cena, resultado). */
  async banner(text: string, sub = '', dur = 1.6) {
    const b = el('div', 'lab-banner', `<b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`);
    this.ui.append(b);
    await this.wait(dur);
    b.classList.add('out');
    await this.wait(0.3);
    b.remove();
  }
}

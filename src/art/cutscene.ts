import { SCENE_H, SCENE_W } from '../engine/catalog';
import { slow } from '../speed';
import type { CutActor, CutStep, Cutscene, PixelSprite } from '../engine/types';
import { makeBackdrop, type Backdrop } from './backdrops';
import { makeCanvas, type Ctx } from './pixel';
import { drawSprite, spriteSize } from './sprites';

const FPS = 12;

interface Motion {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  dur: number;
  hideAtEnd?: boolean;
}

interface Live {
  def: CutActor;
  sprite: PixelSprite | undefined;
  x: number;
  y: number;
  visible: boolean;
  scale: number;
  motion?: Motion;
  jumpStart?: number;
  shakeUntil?: number;
  slamStart?: number;
}

interface Rain {
  sprite: PixelSprite;
  start: number;
  until: number;
}

export interface CutsceneHooks {
  /** Balão de fala em coordenadas da cena (pixels 192x112). */
  onSay?: (text: string, x: number, y: number, dur: number) => void;
  onSound?: (kind: 'slam' | 'step' | 'flash' | 'shake' | 'jump') => void;
}

/** Duração total do roteiro, em segundos. */
export function cutsceneDuration(script: Cutscene): number {
  const end = Math.max(0, ...script.timeline.map((s) => s.t + (s.dur ?? 1)));
  return Math.min(9, Math.max(3.5, end + 1.2));
}

/** Encena um roteiro: cenário, atores e linha do tempo, a 12 quadros por segundo. */
export class CutscenePlayer {
  readonly canvas = makeCanvas(SCENE_W, SCENE_H, 'scene cut-canvas');
  private ctx: Ctx = this.canvas.getContext('2d')!;
  private backdrop: Backdrop;
  private actors: Live[] = [];
  private steps: CutStep[];
  private next = 0;
  private frame = 0;
  private raf = 0;
  private last = 0;
  private flash = 0;
  private shakeUntil = 0;
  private rains: Rain[] = [];
  private sprites: Map<string, PixelSprite>;

  constructor(script: Cutscene, library: Map<string, PixelSprite>, private hooks: CutsceneHooks = {}) {
    this.sprites = new Map(library);
    for (const s of script.sprites ?? []) this.sprites.set(s.id, s);
    this.backdrop = makeBackdrop(script);
    for (const def of script.actors) {
      const n = Math.max(1, Math.min(24, def.count ?? 1));
      const spacing = def.spacing ?? 14;
      for (let i = 0; i < n; i++) {
        this.actors.push({
          def: { ...def, id: def.id },
          sprite: this.sprites.get(def.sprite),
          x: def.x + i * spacing,
          y: def.y,
          visible: !def.hidden,
          scale: 1,
        });
      }
    }
    this.steps = [...script.timeline].sort((a, b) => a.t - b.t);
  }

  start() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < slow(1000 / FPS)) return;
      this.last = now;
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private get time() {
    return this.frame / FPS;
  }

  private targets(id?: string): Live[] {
    return id ? this.actors.filter((a) => a.def.id === id) : [];
  }

  private run(step: CutStep) {
    const now = this.frame;
    const dur = Math.max(0.1, step.dur ?? 1) * FPS;
    const group = this.targets(step.actor);
    switch (step.do) {
      case 'enter_left':
      case 'enter_right':
        group.forEach((a, i) => {
          const from = step.do === 'enter_left' ? -20 - i * 10 : SCENE_W + 20 + i * 10;
          a.visible = true;
          a.motion = { fromX: from, fromY: a.y, toX: a.x, toY: a.y, start: now, dur };
          a.x = from;
        });
        this.hooks.onSound?.('step');
        break;
      case 'move':
        group.forEach((a, i) => {
          const spacing = a.def.spacing ?? 14;
          const toX = step.x !== undefined ? step.x + i * spacing : a.x;
          a.motion = { fromX: a.x, fromY: a.y, toX, toY: step.y ?? a.y, start: now, dur };
        });
        break;
      case 'exit':
        group.forEach((a) => (a.motion = { fromX: a.x, fromY: a.y, toX: SCENE_W + 30, toY: a.y, start: now, dur, hideAtEnd: true }));
        break;
      case 'jump':
        group.forEach((a) => (a.jumpStart = now));
        this.hooks.onSound?.('jump');
        break;
      case 'shake':
        group.forEach((a) => (a.shakeUntil = now + dur));
        break;
      case 'slam':
        group.forEach((a) => (a.slamStart = now));
        break;
      case 'say': {
        const a = group[0];
        if (a && step.text) {
          const h = a.sprite ? spriteSize(a.sprite).h : 20;
          this.hooks.onSay?.(step.text.slice(0, 60), a.x, a.y - h * a.scale - 2, step.dur ?? 1.8);
        }
        break;
      }
      case 'hide':
        group.forEach((a) => (a.visible = false));
        break;
      case 'show':
        group.forEach((a) => (a.visible = true));
        break;
      case 'grow':
        group.forEach((a) => (a.scale = 2));
        break;
      case 'flash':
        this.flash = 5;
        this.hooks.onSound?.('flash');
        break;
      case 'screenshake':
        this.shakeUntil = now + dur;
        this.hooks.onSound?.('shake');
        break;
      case 'rain': {
        const sprite = step.sprite ? this.sprites.get(step.sprite) : undefined;
        if (sprite) this.rains.push({ sprite, start: now, until: now + dur });
        break;
      }
    }
  }

  private tick() {
    this.frame++;
    while (this.next < this.steps.length && this.steps[this.next].t <= this.time) this.run(this.steps[this.next++]);

    const { ctx } = this;
    ctx.save();
    if (this.frame < this.shakeUntil) ctx.translate(this.frame % 2 ? 2 : -2, this.frame % 3 ? 1 : -1);
    this.backdrop.back(ctx, this.frame);
    this.drawActors('back');
    this.backdrop.front?.(ctx, this.frame);
    this.drawActors('front');
    this.drawRain();
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash / 6})`;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      this.flash--;
    }
  }

  private drawActors(layer: 'back' | 'front') {
    const { ctx, frame } = this;
    const list = this.actors.filter((a) => (a.def.layer ?? 'front') === layer).sort((a, b) => a.y - b.y);
    for (const a of list) {
      if (a.motion) {
        const p = Math.min(1, (frame - a.motion.start) / a.motion.dur);
        a.x = a.motion.fromX + (a.motion.toX - a.motion.fromX) * p;
        a.y = a.motion.fromY + (a.motion.toY - a.motion.fromY) * p;
        if (p >= 1) {
          if (a.motion.hideAtEnd) a.visible = false;
          a.motion = undefined;
        }
      }
      if (!a.visible || !a.sprite) continue;
      let dx = 0;
      let dy = 0;
      if (a.motion && frame % 4 < 2) dy -= 1;
      if (a.jumpStart !== undefined) {
        const k = (frame - a.jumpStart) / 6;
        if (k <= 1) dy -= Math.round(Math.sin(k * Math.PI) * 8);
      }
      if (a.shakeUntil && frame < a.shakeUntil) dx += frame % 2 ? 1 : -1;
      drawSprite(ctx, a.sprite, a.x + dx, a.y + dy, { flip: a.def.flip, scale: a.scale });

      if (a.def.holding) {
        const prop = this.sprites.get(a.def.holding);
        if (!prop) continue;
        const { w, h } = spriteSize(a.sprite);
        const handX = a.x + dx + (a.def.flip ? -w / 2 - 2 : w / 2 + 2) * a.scale;
        let lift = 0;
        if (a.slamStart !== undefined) {
          const k = frame - a.slamStart;
          if (k < 3) lift = k * 4;
          else if (k < 5) lift = 12 - (k - 3) * 8;
          if (k === 4) {
            this.shakeUntil = frame + 5;
            this.flash = 4;
            this.hooks.onSound?.('slam');
          }
        }
        drawSprite(ctx, prop, handX, a.y + dy - h * a.scale * 0.35 - lift, { flip: a.def.flip });
      }
    }
  }

  private drawRain() {
    for (const r of this.rains) {
      if (this.frame > r.until + 40) continue;
      for (let i = 0; i < 22; i++) {
        const born = r.start + i * 2;
        if (this.frame < born || born > r.until) continue;
        const age = this.frame - born;
        const x = ((i * 53) % SCENE_W) + Math.sin((age + i) / 3) * 3;
        const y = age * 3;
        if (y < SCENE_H + 10) drawSprite(this.ctx, r.sprite, x, y);
      }
    }
  }
}

/** Cena do Supremo barrando o presidente: relator careca bate o martelo e os colegas concordam. */
export function stfCutscene(title: string, bubble: string): Cutscene {
  const seats = [18, 42, 66, 126, 150, 174];
  return {
    backdrop: 'stf',
    actors: [
      ...seats.map((x, i) => ({ id: `m${i}`, sprite: i % 3 === 1 ? 'ministra' : 'ministro', x, y: 86, layer: 'back' as const })),
      { id: 'relator', sprite: 'ministro_careca', x: 96, y: 86, layer: 'back' as const, holding: 'martelo' },
    ],
    timeline: [
      { t: 0.6, do: 'jump', actor: 'relator' },
      { t: 1.1, do: 'slam', actor: 'relator' },
      { t: 1.4, do: 'say', actor: 'relator', text: bubble, dur: 2.4 },
      { t: 2.2, do: 'slam', actor: 'relator' },
      ...seats.map((_, i) => ({ t: 2.6 + i * 0.12, do: 'jump' as const, actor: `m${i}` })),
      { t: 3.6, do: 'slam', actor: 'relator' },
    ],
    caption: title,
  };
}

import { CUSTOM_BACKDROP, SCENE_H, SCENE_W } from '../engine/catalog';
import type { BackdropId, Cutscene } from '../engine/types';
import { px, rect, seeded, type Ctx } from './pixel';
import { PlanaltoScene, text } from './scene';

/** Um cenário desenha o fundo e, opcionalmente, um primeiro plano por cima dos atores com layer 'back'. */
export interface Backdrop {
  back(ctx: Ctx, frame: number): void;
  front?(ctx: Ctx, frame: number): void;
}

function wall(ctx: Ctx, color: string, line: string, step = 12) {
  rect(ctx, 0, 0, SCENE_W, SCENE_H, color);
  for (let x = 0; x < SCENE_W; x += step) rect(ctx, x, 0, 1, SCENE_H, line);
}

function flag(ctx: Ctx, x: number, y: number) {
  rect(ctx, x, y, 1, 40, '#8a8a8a');
  rect(ctx, x + 1, y, 12, 8, '#2e8b57');
  rect(ctx, x + 4, y + 2, 6, 4, '#f4c542');
  rect(ctx, x + 6, y + 3, 2, 2, '#1f4fa0');
}

const LIBRARY: Record<Exclude<BackdropId, 'esplanada'>, Backdrop> = {
  stf: {
    back(ctx) {
      wall(ctx, '#4a2e1f', '#3a2418', 16);
      rect(ctx, 0, 0, SCENE_W, 6, '#2a1a10');
      // brasão
      rect(ctx, 86, 10, 20, 20, '#1f4fa0');
      rect(ctx, 84, 14, 24, 12, '#1f4fa0');
      rect(ctx, 90, 14, 12, 12, '#2e8b57');
      rect(ctx, 93, 17, 6, 6, '#f4c542');
      for (let i = 0; i < 5; i++) px(ctx, 88 + i * 4, 12, '#f4f1ea');
      flag(ctx, 20, 18);
      flag(ctx, 160, 18);
      rect(ctx, 0, 92, SCENE_W, 20, '#6a4a2a');
    },
    front(ctx) {
      // bancada curva
      for (let x = 4; x < 188; x++) {
        const u = (x - 96) / 92;
        const top = 78 + Math.round(u * u * 8);
        rect(ctx, x, top, 1, 100 - top, '#5a3a22');
        px(ctx, x, top, '#8a5a32');
      }
      for (let x = 20; x < 180; x += 16) rect(ctx, x, 88, 8, 3, '#d8c070');
    },
  },
  camara: {
    back(ctx) {
      wall(ctx, '#2e4a3a', '#274032', 10);
      rect(ctx, 56, 6, 80, 26, '#0c0e17');
      text(ctx, 'VOTACAO', 82, 10, '#f4c542');
      for (let row = 0; row < 4; row++) {
        const y = 50 + row * 12;
        rect(ctx, 0, y + 6, SCENE_W, 6, '#1e3a2a');
        for (let x = (row % 2) * 6; x < SCENE_W; x += 12) rect(ctx, x, y, 8, 7, '#3a8a5a');
      }
    },
    front(ctx) {
      rect(ctx, 72, 90, 48, 22, '#6a4a2a');
      rect(ctx, 72, 90, 48, 2, '#9a6a3a');
    },
  },
  gabinete: {
    back(ctx) {
      rect(ctx, 0, 0, SCENE_W, SCENE_H, '#d8ccb0');
      rect(ctx, 0, 0, SCENE_W, 4, '#b8a888');
      rect(ctx, 50, 10, 92, 50, '#86c4ec');
      rect(ctx, 50, 44, 92, 16, '#6f9a48');
      rect(ctx, 88, 24, 3, 22, '#e8e4da');
      rect(ctx, 94, 24, 3, 22, '#e8e4da');
      rect(ctx, 70, 44, 50, 3, '#e8e4da');
      rect(ctx, 48, 8, 96, 2, '#8a7a5a');
      rect(ctx, 48, 60, 96, 2, '#8a7a5a');
      rect(ctx, 95, 10, 2, 50, '#8a7a5a');
      flag(ctx, 16, 20);
      rect(ctx, 0, 88, SCENE_W, 24, '#8a3a2a');
    },
    front(ctx) {
      rect(ctx, 30, 84, 132, 28, '#5a3a22');
      rect(ctx, 30, 84, 132, 3, '#8a5a32');
      rect(ctx, 84, 88, 24, 5, '#d8c070');
    },
  },
  tv: {
    back(ctx, frame) {
      rect(ctx, 0, 0, SCENE_W, SCENE_H, '#101a3a');
      for (let x = 0; x < SCENE_W; x += 8) rect(ctx, x, 0, 1, 70, '#182450');
      rect(ctx, 100, 10, 80, 50, '#0c0e17');
      rect(ctx, 102, 12, 76, 46, frame % 16 < 8 ? '#1f4fa0' : '#2a5ab8');
      text(ctx, 'PLANTAO', 122, 30, '#f4f1ea');
      rect(ctx, 0, 70, SCENE_W, 42, '#0a1024');
    },
    front(ctx, frame) {
      rect(ctx, 20, 84, 90, 28, '#2a3a6a');
      rect(ctx, 20, 84, 90, 2, '#4a6ae0');
      rect(ctx, 0, 102, SCENE_W, 10, '#c63d3d');
      text(ctx, 'URGENTE - URGENTE - URGENTE - URGENTE - URGENTE', 192 - (frame * 2) % 240, 105, '#f4f1ea');
    },
  },
  rua: {
    back(ctx, frame) {
      rect(ctx, 0, 0, SCENE_W, 70, '#86c4ec');
      const r = seeded(21);
      for (let x = 0; x < SCENE_W; ) {
        const w = 18 + Math.floor(r() * 16);
        const h = 30 + Math.floor(r() * 40);
        const c = ['#8a8a92', '#a89a8a', '#6a7282', '#b8a890'][Math.floor(r() * 4)];
        rect(ctx, x, 80 - h, w, h, c);
        for (let wy = 84 - h; wy < 76; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) rect(ctx, wx, wy, 2, 3, (wx + wy + frame) % 23 === 0 ? '#fbe38a' : '#4a5a6a');
        x += w + 2;
      }
      rect(ctx, 0, 80, SCENE_W, 8, '#b8b2a6');
      rect(ctx, 0, 88, SCENE_W, 24, '#5a5a62');
      for (let x = (frame * 2) % 16; x < SCENE_W; x += 16) rect(ctx, x, 99, 8, 1, '#e8e2c8');
    },
  },
  floresta: {
    back(ctx, frame) {
      rect(ctx, 0, 0, SCENE_W, 50, '#9fd2f4');
      const layers = ['#2e6a3a', '#3a8a4a', '#4aa05a'];
      layers.forEach((c, i) => {
        const r = seeded(30 + i);
        for (let x = -6; x < SCENE_W; x += 8 + Math.floor(r() * 6)) {
          const h = 18 + Math.floor(r() * 16);
          const y = 40 + i * 12;
          rect(ctx, x, y - h / 2, 12, h, c);
          rect(ctx, x + 2, y - h / 2 - 3, 8, 3, c);
        }
      });
      rect(ctx, 0, 80, SCENE_W, 32, '#3a6a3a');
      rect(ctx, 0, 92, SCENE_W, 8, '#4a8ab8');
      for (let x = (frame * 2) % 10; x < SCENE_W; x += 10) px(ctx, x, 95, '#a8d8f0');
    },
  },
  mercado: {
    back(ctx) {
      rect(ctx, 0, 0, SCENE_W, SCENE_H, '#e8e4da');
      const r = seeded(40);
      for (let s = 0; s < 3; s++) {
        const y = 14 + s * 22;
        rect(ctx, 0, y + 14, SCENE_W, 3, '#8a8a92');
        for (let x = 2; x < SCENE_W; x += 7) {
          rect(ctx, x, y + 4, 5, 10, ['#c63d3d', '#f4c542', '#3a6fd8', '#4fc27f', '#e8b030'][Math.floor(r() * 5)]);
        }
        for (let x = 10; x < SCENE_W; x += 36) rect(ctx, x, y + 17, 10, 4, '#f4d67a');
      }
      for (let x = 0; x < SCENE_W; x += 8) rect(ctx, x, 84 + ((x / 8) % 2) * 0, 8, 28, (x / 8) % 2 ? '#c8c4ba' : '#d8d4ca');
    },
  },
  bolsa: {
    back(ctx, frame) {
      rect(ctx, 0, 0, SCENE_W, SCENE_H, '#0c0e17');
      for (let i = 0; i < 4; i++) {
        const x = 6 + i * 47;
        rect(ctx, x, 8, 42, 30, '#161a2a');
        const r = seeded(50 + i);
        let y = 24;
        for (let k = 0; k < 38; k++) {
          y = Math.max(10, Math.min(36, y + (r() - 0.5) * 4));
          rect(ctx, x + 2 + k, y, 1, 1, i % 2 ? '#4fc27f' : '#e0574f');
        }
      }
      rect(ctx, 0, 44, SCENE_W, 8, '#1a1a2a');
      text(ctx, 'IBOV PETR4 VALE3 ITUB4 BBDC4 ABEV3', 192 - (frame * 2) % 260, 46, '#f4c542');
      rect(ctx, 0, 84, SCENE_W, 28, '#2a2a3a');
    },
  },
  quartel: {
    back(ctx, frame) {
      rect(ctx, 0, 0, SCENE_W, 60, '#858a94');
      rect(ctx, 20, 26, 150, 36, '#c8c0a8');
      rect(ctx, 20, 22, 150, 4, '#8a7a5a');
      for (let x = 28; x < 166; x += 12) rect(ctx, x, 34, 6, 8, '#4a5a6a');
      rect(ctx, 86, 44, 18, 18, '#5a4a3a');
      flag(ctx, 178, 12 + (frame % 8 < 4 ? 0 : 1));
      rect(ctx, 0, 62, SCENE_W, 50, '#a89a7a');
      for (let x = 0; x < SCENE_W; x += 24) rect(ctx, x, 80, 12, 1, '#f4f1ea');
    },
  },
};

/** Cenário desenhado pelo Claude: grade 48x28, cada célula vira 4x4 pixels. */
function customBackdrop(spec: NonNullable<Cutscene['customBackdrop']>): Backdrop {
  const { cell } = CUSTOM_BACKDROP;
  return {
    back(ctx) {
      rect(ctx, 0, 0, SCENE_W, SCENE_H, '#0c0e17');
      spec.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const c = spec.palette[row[x]];
          if (c) rect(ctx, x * cell, y * cell, cell, cell, c);
        }
      });
    },
  };
}

export function makeBackdrop(script: Cutscene): Backdrop {
  if (script.backdrop === 'custom' && script.customBackdrop) return customBackdrop(script.customBackdrop);
  if (script.backdrop === 'esplanada' || script.backdrop === 'custom') {
    const plan = new PlanaltoScene();
    plan.set(script.anim ?? 'calm');
    return {
      back(ctx) {
        plan.step();
        ctx.drawImage(plan.canvas, 0, 0);
      },
    };
  }
  return LIBRARY[script.backdrop] ?? LIBRARY.gabinete;
}

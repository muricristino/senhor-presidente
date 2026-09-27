import { text } from '../art/scene';
import type { Camera } from './engine';
import { LH, LW } from './engine';

/* Cenários do laboratório, desenhados em 320x180 com camadas de paralaxe. */

type Ctx = CanvasRenderingContext2D;
const r = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function flag(ctx: Ctx, x: number, y: number, t: number) {
  r(ctx, x, y, 1, 46, '#8a8a8a');
  const wave = Math.sin(t * 3 + x) > 0 ? 0 : 1;
  r(ctx, x + 1, y + wave, 16, 11, '#2e8b57');
  r(ctx, x + 5, y + 2 + wave, 8, 7, '#f4c542');
  r(ctx, x + 7, y + 4 + wave, 4, 3, '#1f4fa0');
}

/** Corredor do Palácio do Planalto: parede com janelas (paralaxe 0,6) e piso de mármore (1,0). */
export function corridor(worldW: number) {
  const wall = (ctx: Ctx, cam: Camera, t: number) => {
    const off = -cam.x * 0.6;
    r(ctx, 0, 0, LW, LH, '#cfc2a4');
    for (let x = Math.floor(-off / 80) * 80 - 80; x < -off + LW + 80; x += 80) {
      const sx = x + off;
      // janela para o céu de Brasília
      r(ctx, sx + 14, 22, 52, 70, '#8a7a5a');
      r(ctx, sx + 16, 24, 48, 66, '#86c4ec');
      r(ctx, sx + 16, 70, 48, 20, '#6f9a48');
      r(ctx, sx + 30, 52, 3, 18, '#e8e4da');
      r(ctx, sx + 36, 52, 3, 18, '#e8e4da');
      r(ctx, sx + 22, 66, 36, 4, '#e8e4da');
      r(ctx, sx + 39, 24, 2, 66, '#8a7a5a');
      const cloud = ((t * 4 + x) % 60) - 10;
      r(ctx, sx + 16 + Math.max(0, cloud), 32, Math.min(14, 48 - Math.max(0, cloud)), 3, '#f4f8fb');
      r(ctx, sx + 6, 96, 68, 3, '#b8a888');
    }
    r(ctx, 0, 0, LW, 8, '#a8987a');
  };
  const floor = (ctx: Ctx, cam: Camera) => {
    const off = -cam.x;
    r(ctx, 0, 118, LW, LH - 118, '#e8e2d6');
    for (let x = Math.floor(-off / 24) * 24 - 24; x < -off + LW + 24; x += 24) {
      r(ctx, x + off, 118, 1, LH - 118, '#d0c8b8');
    }
    for (let y = 118; y < LH; y += 14) r(ctx, 0, y, LW, 1, '#d0c8b8');
    // tapete vermelho
    r(ctx, 0, 146, LW, 22, '#9a2a2a');
    r(ctx, 0, 146, LW, 2, '#c8a040');
    r(ctx, 0, 166, LW, 2, '#c8a040');
    // porta da sala de imprensa no fim do corredor
    const door = worldW - 60 + off;
    r(ctx, door, 60, 44, 86, '#5a3a22');
    r(ctx, door + 3, 63, 38, 83, '#7a4a2a');
    r(ctx, door + 20, 63, 2, 83, '#5a3a22');
    r(ctx, door + 32, 104, 3, 3, '#f4c542');
    r(ctx, door - 2, 50, 48, 10, '#0c0e17');
    text(ctx, 'IMPRENSA', door + 6, 53, '#f4c542');
  };
  return [wall, floor];
}

export function coffeeMachine(ctx: Ctx, x: number, t: number) {
  r(ctx, x - 8, 112, 16, 34, '#4a4a52');
  r(ctx, x - 6, 116, 12, 8, '#1a1a22');
  r(ctx, x - 4, 118, 3, 2, t % 1 > 0.5 ? '#4fc27f' : '#1a5a3a');
  r(ctx, x - 3, 132, 6, 5, '#f0ece0');
  r(ctx, x - 10, 146, 20, 2, '#2a2a32');
}

/** Esplanada ao ar livre: céu, nuvens em paralaxe, Congresso ao fundo e gramado. */
export function esplanada() {
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      const g = ctx.createLinearGradient(0, 0, 0, 110);
      g.addColorStop(0, '#4a9ae0');
      g.addColorStop(1, '#bfe2f4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LW, 110);
      for (const [y, speed, w] of [[18, 6, 40], [34, 3, 28], [10, 9, 22]]) {
        const x = ((t * speed + y * 7) % (LW + 60)) - 50;
        r(ctx, x, y, w, 5, '#f4f8fb');
        r(ctx, x + 6, y - 4, w - 14, 4, '#f4f8fb');
      }
      r(ctx, 262, 16, 14, 14, '#fbe38a');
      // Congresso
      const c = '#e8e4da';
      r(ctx, 40, 92, 240, 8, c);
      r(ctx, 40, 100, 240, 3, '#b8b2a6');
      r(ctx, 150, 38, 7, 54, c);
      r(ctx, 162, 38, 7, 54, c);
      r(ctx, 157, 60, 5, 4, c);
      for (let i = 0; i < 44; i++) {
        const u = (i - 21.5) / 21.5;
        const top = 78 + Math.round((1 - u * u) * 9);
        r(ctx, 70 + i, top, 1, 92 - top, c);
      }
      for (let i = 0; i < 30; i++) {
        const u = (i - 14.5) / 14.5;
        const h = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 12);
        r(ctx, 208 + i, 92 - h, 1, h, c);
      }
      flag(ctx, 296, 50, t);
      r(ctx, 0, 103, LW, LH - 103, '#6f9a48');
      r(ctx, 60, 106, 200, 4, '#7ab8d8');
    },
  ];
}

/** Sala de reuniões da Câmara: painéis de madeira e janela. */
export function officeRoom() {
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      r(ctx, 0, 0, LW, LH, '#5a3a24');
      for (let x = 0; x < LW; x += 32) r(ctx, x, 0, 2, 120, '#4a2e1c');
      r(ctx, 110, 18, 100, 60, '#8a6a4a');
      r(ctx, 113, 21, 94, 54, '#86c4ec');
      r(ctx, 113, 60, 94, 15, '#6f9a48');
      r(ctx, 150, 36, 4, 24, '#e8e4da');
      r(ctx, 158, 36, 4, 24, '#e8e4da');
      r(ctx, 159, 21, 2, 54, '#8a6a4a');
      flag(ctx, 26, 30, t);
      text(ctx, 'CAMARA DOS DEPUTADOS', 116, 8, '#d8c070');
      r(ctx, 0, 120, LW, LH - 120, '#3a2a1e');
      for (let x = 0; x < LW; x += 16) r(ctx, x, 120, 1, LH - 120, '#2e2016');
    },
  ];
}

export function meetingTable(ctx: Ctx) {
  r(ctx, 70, 138, 180, 10, '#7a4a2a');
  r(ctx, 70, 136, 180, 3, '#9a6a3a');
  r(ctx, 80, 148, 6, 28, '#5a3a22');
  r(ctx, 234, 148, 6, 28, '#5a3a22');
  r(ctx, 150, 130, 8, 6, '#f0ece0');
  r(ctx, 152, 128, 4, 2, '#c8a040');
}

/** Plenário do STF em 320x180. */
export function stfRoom() {
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      r(ctx, 0, 0, LW, LH, '#4a2e1f');
      for (let x = 0; x < LW; x += 26) r(ctx, x, 0, 2, 130, '#3a2418');
      r(ctx, 142, 14, 36, 36, '#1f4fa0');
      r(ctx, 138, 20, 44, 24, '#1f4fa0');
      r(ctx, 150, 22, 20, 20, '#2e8b57');
      r(ctx, 156, 27, 8, 8, '#f4c542');
      flag(ctx, 30, 30, t);
      flag(ctx, 272, 30, t);
      text(ctx, 'SUPREMO TRIBUNAL FEDERAL', 112, 56, '#d8c070');
      r(ctx, 0, 150, LW, 30, '#6a4a2a');
    },
  ];
}

export function stfBench(ctx: Ctx) {
  for (let x = 10; x < 310; x++) {
    const u = (x - 160) / 150;
    const top = 124 + Math.round(u * u * 12);
    r(ctx, x, top, 1, 160 - top, '#5a3a22');
    r(ctx, x, top, 1, 1, '#8a5a32');
  }
  for (let x = 30; x < 300; x += 26) r(ctx, x, 136, 12, 4, '#d8c070');
}

/** Plenário da Câmara visto de cima, para a votação. */
export function plenary() {
  return [
    (ctx: Ctx) => {
      r(ctx, 0, 0, LW, LH, '#2e4a3a');
      r(ctx, 110, 8, 100, 30, '#0c0e17');
      text(ctx, 'VOTACAO', 146, 12, '#f4c542');
      for (let row = 0; row < 6; row++) r(ctx, 0, 60 + row * 19, LW, 8, '#274032');
    },
  ];
}

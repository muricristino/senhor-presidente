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

/** Plenário da Câmara em corte lateral, mais largo que a tela: o presidente circula entre os grupos. */
export function chamberFloor(worldW: number) {
  return [
    (ctx: Ctx, cam: Camera) => {
      const off = -cam.x * 0.5;
      r(ctx, 0, 0, LW, LH, '#2e4a3a');
      for (let x = Math.floor(-off / 40) * 40 - 40; x < -off + LW + 40; x += 40) r(ctx, x + off, 0, 2, 70, '#274032');
      r(ctx, 0, 0, LW, 10, '#1e3a2a');
      text(ctx, 'CAMARA DOS DEPUTADOS - PLENARIO ULYSSES GUIMARAES', 8 + off * 0.2, 2, '#d8c070');
    },
    (ctx: Ctx, cam: Camera) => {
      const off = -cam.x;
      // tribuna ao fundo e piso
      r(ctx, 0, 118, LW, LH - 118, '#3a5a46');
      for (let x = Math.floor(-off / 20) * 20 - 20; x < -off + LW + 20; x += 20) r(ctx, x + off, 118, 1, LH - 118, '#335040');
      r(ctx, worldW / 2 - 30 + off, 100, 60, 18, '#6a4a2a');
      r(ctx, worldW / 2 - 30 + off, 100, 60, 2, '#9a6a3a');
    },
  ];
}

/** Estúdio de debate: telão, dois púlpitos e a plateia em três setores. */
export function tvStudio() {
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      r(ctx, 0, 0, LW, LH, '#0e1a3a');
      for (let x = 0; x < LW; x += 12) r(ctx, x, 0, 1, 110, '#152450');
      r(ctx, 110, 10, 100, 50, '#0c0e17');
      r(ctx, 112, 12, 96, 46, Math.sin(t * 2) > 0 ? '#1f4fa0' : '#2a5ab8');
      text(ctx, 'DEBATE', 146, 22, '#f4f1ea');
      text(ctx, 'PRESIDENCIAL', 136, 32, '#f4c542');
      for (let i = 0; i < 6; i++) {
        const x = 20 + i * 56;
        ctx.fillStyle = `rgba(255,240,180,${0.05 + 0.04 * Math.sin(t * 3 + i)})`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 18, 110);
        ctx.lineTo(x + 18, 110);
        ctx.fill();
      }
      r(ctx, 0, 110, LW, 70, '#0a1024');
    },
  ];
}

export function podium(ctx: Ctx, x: number, color: string) {
  r(ctx, x - 14, 96, 28, 24, color);
  r(ctx, x - 14, 96, 28, 3, '#f4f1ea');
  r(ctx, x - 1, 88, 2, 8, '#2a2a2a');
  r(ctx, x - 2, 86, 4, 3, '#4a4a52');
}

const PARTNER_LOOK: Record<string, { wall: string; accent: string; flag: string[] }> = {
  eua: { wall: '#2a3a6a', accent: '#b22234', flag: ['#b22234', '#f4f1ea', '#3c3b6e'] },
  china: { wall: '#6a1a1a', accent: '#f4c542', flag: ['#de2910', '#de2910', '#ffde00'] },
  ue: { wall: '#1f3a8a', accent: '#f4c542', flag: ['#003399', '#003399', '#ffcc00'] },
  mercosul: { wall: '#3a6a9a', accent: '#f4f1ea', flag: ['#74acdf', '#f4f1ea', '#f6b40e'] },
  russia: { wall: '#4a4a5a', accent: '#d8c070', flag: ['#f4f1ea', '#0039a6', '#d52b1e'] },
};

/** Tela dividida do telefonema: Planalto à esquerda, o gabinete estrangeiro à direita. */
export function splitCall(partner: string) {
  const p = PARTNER_LOOK[partner] ?? PARTNER_LOOK.eua;
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      // Planalto
      r(ctx, 0, 0, LW / 2, LH, '#d8ccb0');
      r(ctx, 26, 20, 90, 60, '#86c4ec');
      r(ctx, 26, 64, 90, 16, '#6f9a48');
      r(ctx, 64, 44, 3, 20, '#e8e4da');
      r(ctx, 70, 44, 3, 20, '#e8e4da');
      flag(ctx, 132, 30, t);
      r(ctx, 0, 140, LW / 2, 40, '#8a3a2a');
      // exterior
      r(ctx, LW / 2, 0, LW / 2, LH, p.wall);
      for (let i = 0; i < 3; i++) r(ctx, LW / 2 + 110, 24 + i * 8, 24, 8, p.flag[i]);
      r(ctx, LW / 2 + 109, 24, 1, 50, '#8a8a8a');
      r(ctx, LW / 2 + 20, 20, 70, 50, p.accent);
      r(ctx, LW / 2 + 23, 23, 64, 44, p.wall);
      r(ctx, LW / 2, 140, LW / 2, 40, '#3a2a2a');
      // divisória com sinal de linha
      r(ctx, LW / 2 - 2, 0, 4, LH, '#07080d');
      for (let i = 0; i < 4; i++) if (Math.floor(t * 4) % 4 >= i) r(ctx, LW / 2 - 1, 80 - i * 6, 2, 3, '#4fc27f');
    },
  ];
}

export function desk(ctx: Ctx, x: number, w: number, color = '#5a3a22') {
  r(ctx, x, 128, w, 12, color);
  r(ctx, x, 126, w, 3, '#8a5a32');
  r(ctx, x + 4, 140, 4, 30, '#3a2412');
  r(ctx, x + w - 8, 140, 4, 30, '#3a2412');
}

/** Sala de reuniões ministerial: mesa comprida, bandeira e porta de saída à direita. */
export function cabinetRoom() {
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      r(ctx, 0, 0, LW, LH, '#cfc2a4');
      for (let x = 0; x < LW; x += 40) r(ctx, x, 0, 1, 118, '#bfb294');
      flag(ctx, 16, 26, t);
      r(ctx, 60, 14, 120, 40, '#8a7a5a');
      r(ctx, 63, 17, 114, 34, '#86c4ec');
      text(ctx, 'REUNIAO MINISTERIAL', 80, 60, '#6a5a3a');
      r(ctx, 286, 52, 30, 70, '#5a3a22');
      r(ctx, 288, 54, 26, 68, '#7a4a2a');
      r(ctx, 308, 88, 3, 3, '#f4c542');
      r(ctx, 0, 118, LW, LH - 118, '#8a3a2a');
    },
  ];
}

/** Sala de imprensa do Planalto: parede azul com brasão, bandeiras, púlpito e fileiras de cadeiras. */
export function pressRoom() {
  return [
    (ctx: Ctx, _cam: Camera, t: number) => {
      const g = ctx.createLinearGradient(0, 0, 0, 120);
      g.addColorStop(0, '#1f3a6b');
      g.addColorStop(1, '#2a4a80');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LW, 120);
      for (let x = 0; x < LW; x += 20) r(ctx, x, 0, 1, 120, '#1a3360');
      // brasão da República
      r(ctx, 148, 16, 24, 24, '#f4c542');
      r(ctx, 151, 19, 18, 18, '#1f4fa0');
      r(ctx, 156, 24, 8, 8, '#2e8b57');
      for (let i = 0; i < 5; i++) r(ctx, 152 + i * 4, 20, 1, 1, '#f4f1ea');
      text(ctx, 'PRESIDENCIA DA REPUBLICA', 114, 46, '#d8c070');
      flag(ctx, 110, 30, t);
      flag(ctx, 196, 30, t);
      r(ctx, 0, 120, LW, 60, '#2a2a3a');
      for (let x = 0; x < LW; x += 16) r(ctx, x, 120, 1, 60, '#24243a');
    },
  ];
}

export function pressPodium(ctx: Ctx) {
  r(ctx, 146, 96, 28, 30, '#6a4a2a');
  r(ctx, 146, 96, 28, 3, '#9a6a3a');
  r(ctx, 154, 104, 12, 12, '#f4c542');
  r(ctx, 157, 107, 6, 6, '#1f4fa0');
  // microfones
  for (const dx of [-6, 0, 6]) {
    r(ctx, 160 + dx, 88, 1, 9, '#2a2a2a');
    r(ctx, 159 + dx, 86, 3, 3, '#4a4a52');
  }
}

export function pressChairs(ctx: Ctx) {
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 12; i++) {
      const x = 12 + i * 26 + (row ? 13 : 0);
      if (x > 120 && x < 200) continue;
      r(ctx, x, 152 + row * 16, 12, 3, '#8a2a2a');
      r(ctx, x + 1, 155 + row * 16, 1, 6, '#3a1a1a');
      r(ctx, x + 10, 155 + row * 16, 1, 6, '#3a1a1a');
    }
  }
}

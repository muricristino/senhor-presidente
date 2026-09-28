import { text } from '../art/scene';
import type { Camera } from './engine';
import { LH, LW } from './engine';

/* Salas dos regimes não democráticos e a noite do golpe, em 320x180 como os cenários de backdrops.ts. */

type Ctx = CanvasRenderingContext2D;
export type Layer = (ctx: Ctx, cam: Camera, t: number) => void;

const r = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Pseudoaleatório estável por índice, para posições que não piscam entre frames. */
const hash = (i: number) => {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Texto centralizado em x (a fonte 3x5 avança 4px por letra). */
const label = (ctx: Ctx, s: string, cx: number, y: number, c: string) => text(ctx, s, Math.round(cx - (s.length * 4 - 1) / 2), y, c);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, k: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, k)));
  return `rgb(${f(ar, br)},${f(ag, bg)},${f(ab, bb)})`;
}

function star(ctx: Ctx, cx: number, cy: number, rad: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? rad : rad * 0.42;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Bandeira num mastro, com ondulação de 1px. `colors`: campo, detalhe, centro. */
function banner(ctx: Ctx, x: number, y: number, t: number, colors: [string, string, string]) {
  r(ctx, x, y, 1, 50, '#8a8a8a');
  r(ctx, x - 1, y - 2, 3, 2, '#c8a040');
  const wave = Math.sin(t * 2.5 + x) > 0 ? 0 : 1;
  r(ctx, x + 1, y + wave, 18, 12, colors[0]);
  r(ctx, x + 1, y + wave + 11, 18, 1, colors[1]);
  r(ctx, x + 6, y + 3 + wave, 8, 6, colors[1]);
  r(ctx, x + 8, y + 5 + wave, 4, 2, colors[2]);
}

/** Contorno aproximado do Brasil, 42x34, linhas de 2px. */
const BRAZIL: [number, number, number][] = [
  [0, 14, 10], [2, 8, 22], [4, 4, 30], [6, 2, 36], [8, 0, 40], [10, 2, 40], [12, 4, 38], [14, 6, 36],
  [16, 10, 32], [18, 14, 26], [20, 16, 22], [22, 18, 18], [24, 18, 14], [26, 18, 10], [28, 18, 8], [30, 19, 5], [32, 20, 3],
];

function brazil(ctx: Ctx, x: number, y: number, fill: string, edge: string) {
  for (const [dy, dx, w] of BRAZIL) {
    r(ctx, x + dx - 1, y + dy, w + 2, 2, edge);
    r(ctx, x + dx, y + dy, w, 2, fill);
  }
}

function floorBoards(ctx: Ctx, y: number, base: string, line: string, step = 16) {
  r(ctx, 0, y, LW, LH - y, base);
  for (let x = 0; x < LW; x += step) r(ctx, x, y, 1, LH - y, line);
  for (let yy = y + 12; yy < LH; yy += 14) r(ctx, 0, yy, LW, 1, line);
}

function candle(ctx: Ctx, x: number, y: number, t: number, seed: number) {
  r(ctx, x, y, 2, 6, '#f0e6c8');
  r(ctx, x, y + 6, 2, 1, '#c8b890');
  const f = Math.sin(t * 11 + seed * 3.1) + Math.sin(t * 7.3 + seed);
  r(ctx, x, y - 3 - (f > 0.8 ? 1 : 0), 2, 3, f > 0 ? '#f4c542' : '#f0a030');
  r(ctx, x, y - 1, 2, 1, '#fff2b0');
  ctx.fillStyle = `rgba(255,200,90,${0.1 + 0.05 * f})`;
  ctx.fillRect(x - 4, y - 7, 10, 10);
}

// ======================================================================
// Junta militar: sala de guerra
// ======================================================================

export function warRoom(): Layer[] {
  return [
    (ctx, _cam, t) => {
      r(ctx, 0, 0, LW, LH, '#5a5a3a');
      for (let x = 0; x < LW; x += 40) {
        r(ctx, x + 2, 12, 36, 104, '#646440');
        r(ctx, x, 0, 2, 120, '#4a4a2e');
      }
      r(ctx, 0, 0, LW, 10, '#3e3e26');
      r(ctx, 0, 112, LW, 6, '#8a7a52');
      label(ctx, 'ALTO COMANDO', 160, 3, '#d8c070');

      // quadro do mapa
      r(ctx, 96, 16, 128, 84, '#2a2a1a');
      r(ctx, 99, 19, 122, 78, '#1a3a5a');
      for (let x = 99; x < 221; x += 12) r(ctx, x, 19, 1, 78, '#224a6a');
      for (let y = 19; y < 97; y += 12) r(ctx, 99, y, 122, 1, '#224a6a');
      brazil(ctx, 138, 36, '#7a8a4a', '#4a5a2a');
      // alfinetes vermelhos, alguns piscando
      const pins: [number, number][] = [[152, 42], [170, 46], [160, 54], [176, 52], [158, 62], [166, 66], [148, 50]];
      pins.forEach(([x, y], i) => {
        const on = i % 3 !== 0 || Math.floor(t * 2 + i) % 2 === 0;
        r(ctx, x, y + 2, 1, 2, '#2a2a2a');
        r(ctx, x - 1, y, 3, 2, on ? '#e0302a' : '#7a1a1a');
      });
      // setas de avanço
      r(ctx, 120, 72, 18, 1, '#e0302a');
      r(ctx, 136, 70, 2, 5, '#e0302a');
      text(ctx, 'OP', 104, 88, '#f4c542');

      // radar
      r(ctx, 244, 26, 56, 56, '#2a2a1a');
      r(ctx, 247, 29, 50, 50, '#0a1a10');
      const cx = 272;
      const cy = 54;
      ctx.strokeStyle = '#1e5a2e';
      ctx.lineWidth = 1;
      for (const rad of [8, 16, 23]) {
        ctx.beginPath();
        ctx.arc(cx + 0.5, cy + 0.5, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      r(ctx, cx - 23, cy, 47, 1, '#1e5a2e');
      r(ctx, cx, cy - 23, 1, 47, '#1e5a2e');
      const ang = t * 2;
      ctx.strokeStyle = '#4fe07f';
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, cy + 0.5);
      ctx.lineTo(cx + 0.5 + Math.cos(ang) * 23, cy + 0.5 + Math.sin(ang) * 23);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const ba = hash(i) * Math.PI * 2;
        const br = 6 + hash(i + 9) * 15;
        const since = (((ang - ba) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (since < 2.5) {
          ctx.globalAlpha = 1 - since / 2.5;
          r(ctx, cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, 2, 2, '#9af0b0');
          ctx.globalAlpha = 1;
        }
      }
      r(ctx, 262, 84, 20, 4, '#3a3a26');
      r(ctx, 264, 85, 2, 2, Math.floor(t * 3) % 2 ? '#e0302a' : '#4a1a1a');

      // bandeiras militares
      banner(ctx, 20, 40, t, ['#2e8b57', '#f4c542', '#1f4fa0']);
      banner(ctx, 50, 44, t + 1, ['#4a5a32', '#f4c542', '#c63d3d']);

      // arquivo e luminária
      r(ctx, 8, 98, 22, 20, '#3e4c2a');
      r(ctx, 10, 102, 18, 1, '#2a3a1a');
      r(ctx, 10, 110, 18, 1, '#2a3a1a');
      r(ctx, 160, 10, 1, 4, '#2a2a1a');
      r(ctx, 154, 12, 13, 3, '#3e3e26');

      floorBoards(ctx, 118, '#3a3a28', '#32321f', 20);
    },
  ];
}

// ======================================================================
// Politburo: salão do Comitê Central
// ======================================================================

export function politburo(): Layer[] {
  return [
    (ctx, _cam, t) => {
      r(ctx, 0, 0, LW, LH, '#5a1010');
      for (let x = 0; x < LW; x += 24) r(ctx, x, 0, 2, 118, '#4a0c0c');
      r(ctx, 0, 0, LW, 6, '#3a0808');
      r(ctx, 0, 110, LW, 8, '#3a0808');
      r(ctx, 0, 110, LW, 1, '#c8a040');

      // estandartes grandes nas laterais e no centro
      const bannerAt = (x: number, w: number, h: number, i: number) => {
        const sway = Math.sin(t * 0.8 + i) * 0.8;
        r(ctx, x - 2, 4, w + 4, 3, '#c8a040');
        r(ctx, x, 7, w, h, '#b01818');
        r(ctx, x + 2, 7, 1, h, '#c82a2a');
        r(ctx, x + w - 3, 7, 1, h, '#8a1010');
        // ponta em "V"
        for (let k = 0; k < w / 2; k++) {
          r(ctx, x + k, 7 + h, 1, Math.round(w / 2 - k + sway), '#b01818');
          r(ctx, x + w - 1 - k, 7 + h, 1, Math.round(w / 2 - k - sway), '#b01818');
        }
        star(ctx, x + w / 2, 7 + w * 0.55, w * 0.32, '#f4d020');
        r(ctx, x + 3, 7 + w + 4, w - 6, 1, '#f4d020');
      };
      bannerAt(14, 30, 80, 0);
      bannerAt(276, 30, 80, 2);
      bannerAt(138, 44, 52, 1);
      label(ctx, 'COMITE CENTRAL', 160, 90, '#f4d020');

      // retratos em moldura dourada
      const portrait = (x: number, i: number) => {
        r(ctx, x, 22, 34, 42, '#c8a040');
        r(ctx, x + 2, 24, 30, 38, '#2a1a14');
        r(ctx, x + 3, 25, 28, 36, i % 2 ? '#4a3a2a' : '#3a3a42');
        r(ctx, x + 11, 32, 12, 13, '#8a6a4a');
        r(ctx, x + 10, 30, 14, 4, i % 2 ? '#2a2a2a' : '#d0d0d0');
        if (i === 0) r(ctx, x + 11, 40, 12, 5, '#d0d0d0');
        if (i === 3) r(ctx, x + 12, 39, 10, 2, '#2a1a12');
        r(ctx, x + 7, 47, 20, 14, '#1a1a22');
        r(ctx, x + 15, 47, 4, 6, '#b01818');
        r(ctx, x + 13, 64, 8, 3, '#8a7030');
      };
      portrait(58, 0);
      portrait(96, 1);
      portrait(190, 2);
      portrait(228, 3);

      // piso de madeira escura com passadeira vermelha
      floorBoards(ctx, 118, '#3a1a14', '#2e140e', 18);
      r(ctx, 0, 150, LW, 20, '#8a1414');
      r(ctx, 0, 150, LW, 1, '#c8a040');
      r(ctx, 0, 169, LW, 1, '#c8a040');
    },
  ];
}

// ======================================================================
// Teocracia: conselho religioso
// ======================================================================

export function temple(): Layer[] {
  return [
    (ctx, _cam, t) => {
      r(ctx, 0, 0, LW, LH, '#5a5a50');
      // blocos de pedra
      for (let y = 0; y < 118; y += 10) {
        r(ctx, 0, y, LW, 1, '#4a4a42');
        for (let x = (y / 10) % 2 ? 0 : 12; x < LW; x += 24) r(ctx, x, y, 1, 10, '#4a4a42');
      }

      // três arcos com vitrais
      const arch = (cx: number, w: number, top: number, i: number) => {
        const h = 96 - top;
        const x0 = cx - w / 2;
        // moldura de pedra
        for (let x = -3; x < w + 3; x++) {
          const u = (x - w / 2 + 0.5) / (w / 2 + 3);
          const cap = Math.round((1 - Math.sqrt(Math.max(0, 1 - u * u))) * (w / 2 + 3));
          r(ctx, x0 + x, top - 3 + cap, 1, h + 3 - cap, '#3a3a34');
        }
        // vitral
        const glow = 0.75 + 0.25 * Math.sin(t * 1.2 + i * 1.7);
        const panes = ['#2e8b57', '#d8b040', '#1f6a4a', '#e8d070', '#3a6fb8', '#2e8b57'];
        for (let x = 0; x < w; x++) {
          const u = (x - w / 2 + 0.5) / (w / 2);
          const cap = Math.round((1 - Math.sqrt(Math.max(0, 1 - u * u))) * (w / 2));
          for (let y = top + cap; y < top + h; y += 6) {
            const pane = panes[(Math.floor(x / 5) + Math.floor((y - top) / 6) + i) % panes.length];
            r(ctx, x0 + x, y, 1, Math.min(6, top + h - y), pane);
          }
        }
        ctx.globalAlpha = glow * 0.35;
        r(ctx, x0, top + w / 4, w, h - w / 4, '#fff6c0');
        ctx.globalAlpha = 1;
        // chumbo do vitral
        for (let x = 0; x < w; x += 5) r(ctx, x0 + x, top + 4, 1, h - 4, '#1a1a14');
        for (let y = top + 6; y < top + h; y += 6) r(ctx, x0, y, w, 1, '#1a1a14');
        // rosácea no alto
        r(ctx, cx - 2, top + 3, 4, 4, '#f4c542');
        r(ctx, x0 - 3, top + h, w + 6, 3, '#6a6a60');
        // feixe de luz descendo ao chão
        ctx.fillStyle = `rgba(255,236,160,${0.06 + 0.04 * Math.sin(t * 1.2 + i * 1.7)})`;
        ctx.beginPath();
        ctx.moveTo(x0, top + h);
        ctx.lineTo(x0 + w, top + h);
        ctx.lineTo(x0 + w + 20, 180);
        ctx.lineTo(x0 + 10, 180);
        ctx.fill();
      };
      arch(60, 30, 26, 0);
      arch(160, 40, 16, 1);
      arch(260, 30, 26, 2);

      // tapeçarias verdes com barra dourada
      for (const x of [100, 206]) {
        r(ctx, x, 12, 14, 64, '#1f5a3a');
        r(ctx, x, 12, 14, 2, '#d8b040');
        r(ctx, x, 74, 14, 2, '#d8b040');
        r(ctx, x + 6, 30, 2, 14, '#d8b040');
        r(ctx, x + 3, 34, 8, 2, '#d8b040');
      }
      label(ctx, 'CONSELHO', 160, 4, '#e8d070');

      // velas sobre as bases de pedra
      for (const [bx, n] of [[20, 3], [96, 2], [208, 2], [284, 3]] as [number, number][]) {
        r(ctx, bx - 2, 108, n * 6 + 2, 4, '#6a6a60');
        r(ctx, bx, 112, n * 6 - 2, 6, '#4a4a42');
        for (let k = 0; k < n; k++) candle(ctx, bx + k * 6, 101 + (k % 2) * 2, t, bx + k);
      }

      // piso de pedra com faixa verde e dourada
      r(ctx, 0, 118, LW, LH - 118, '#6a6a5e');
      for (let x = 0; x < LW; x += 20) r(ctx, x, 118, 1, LH - 118, '#5a5a50');
      for (let y = 130; y < LH; y += 14) r(ctx, 0, y, LW, 1, '#5a5a50');
      r(ctx, 0, 150, LW, 18, '#1f5a3a');
      r(ctx, 0, 150, LW, 1, '#d8b040');
      r(ctx, 0, 167, LW, 1, '#d8b040');
    },
  ];
}

// ======================================================================
// Tecnocracia: sala de controle
// ======================================================================

export function controlRoom(): Layer[] {
  return [
    (ctx, _cam, t) => {
      r(ctx, 0, 0, LW, LH, '#0a0e16');
      for (let x = 0; x < LW; x += 20) r(ctx, x, 0, 1, 118, '#0e1420');
      label(ctx, 'PAINEL DE METAS', 160, 4, '#4ff0f0');

      const screen = (x: number, y: number, w: number, h: number) => {
        r(ctx, x - 2, y - 2, w + 4, h + 4, '#1a2230');
        r(ctx, x, y, w, h, '#06222a');
        ctx.globalAlpha = 0.25;
        for (let yy = y; yy < y + h; yy += 2) r(ctx, x, yy, w, 1, '#000000');
        ctx.globalAlpha = 1;
      };

      // telão central: linha de tendência correndo
      screen(96, 14, 128, 58);
      for (let gx = 96; gx < 224; gx += 16) r(ctx, gx, 14, 1, 58, '#0c3a44');
      for (let gy = 14; gy < 72; gy += 12) r(ctx, 96, gy, 128, 1, '#0c3a44');
      let prev = 0;
      for (let i = 0; i < 126; i++) {
        const k = i + t * 14;
        const v = 40 + Math.sin(k * 0.08) * 10 + Math.sin(k * 0.23) * 5 - i * 0.12;
        const y = Math.round(14 + v);
        if (i > 0) r(ctx, 97 + i, Math.min(y, prev), 1, Math.abs(y - prev) + 1, '#4ff0f0');
        prev = y;
      }
      r(ctx, 97, 20, 28, 1, '#f4c542');
      text(ctx, 'META', 100, 22, '#f4c542');
      const pct = 90 + Math.floor((Math.sin(t * 0.7) + 1) * 4.5);
      text(ctx, `${pct}%`, 200, 18, '#9afafa');

      // telas menores com barras
      const bars = (x: number, y: number, w: number, h: number, seed: number) => {
        screen(x, y, w, h);
        const n = Math.floor(w / 5);
        for (let i = 0; i < n; i++) {
          const v = (0.35 + 0.5 * hash(seed * 31 + i)) * (0.8 + 0.2 * Math.sin(t * 2 + i + seed));
          const bh = Math.round((h - 4) * v);
          r(ctx, x + 2 + i * 5, y + h - 2 - bh, 3, bh, i === n - 1 ? '#f4c542' : '#2ac8d8');
        }
      };
      bars(50, 16, 36, 24, 1);
      bars(234, 16, 36, 24, 2);
      bars(50, 48, 36, 24, 3);
      // medidor circular
      screen(234, 48, 36, 24);
      ctx.strokeStyle = '#1a5a64';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(252, 64, 7, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = '#4ff0f0';
      ctx.beginPath();
      ctx.arc(252, 64, 7, Math.PI, Math.PI + Math.PI * (0.6 + 0.3 * Math.sin(t)));
      ctx.stroke();
      ctx.lineWidth = 1;
      // faixa de números rolando
      screen(96, 80, 128, 12);
      const ticker = 'PIB 2,1 INFLACAO 3,4 EMPREGO 91 META 100 ';
      ctx.save();
      ctx.beginPath();
      ctx.rect(96, 80, 128, 12);
      ctx.clip();
      const off = (t * 18) % (ticker.length * 4);
      text(ctx, ticker + ticker, 98 - off, 84, '#4ff0f0');
      ctx.restore();

      // racks de servidores com LEDs
      const rack = (x: number, seed: number) => {
        r(ctx, x, 28, 34, 90, '#141a24');
        r(ctx, x + 1, 29, 32, 88, '#1c2430');
        for (let u = 0; u < 10; u++) {
          const y = 32 + u * 8;
          r(ctx, x + 3, y, 28, 6, '#10161e');
          r(ctx, x + 3, y, 28, 1, '#2a3444');
          for (let l = 0; l < 4; l++) {
            const on = hash(seed * 97 + u * 7 + l + Math.floor(t * (2 + l))) > 0.4;
            const c = l === 3 ? (on ? '#f4a030' : '#3a2410') : on ? '#4ff07f' : '#10301a';
            r(ctx, x + 5 + l * 3, y + 3, 1, 1, c);
          }
          r(ctx, x + 20, y + 2, 9, 2, '#0a0e14');
        }
      };
      rack(6, 1);
      rack(280, 2);

      // piso escuro com linhas ciano
      r(ctx, 0, 118, LW, LH - 118, '#10151e');
      for (let x = 0; x < LW; x += 20) r(ctx, x, 118, 1, LH - 118, '#162030');
      r(ctx, 0, 118, LW, 1, '#1a6a74');
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.5);
      r(ctx, 0, 158, LW, 1, '#2ac8d8');
      ctx.globalAlpha = 1;
      // reflexo do telão no chão
      ctx.fillStyle = 'rgba(79,240,240,0.05)';
      ctx.fillRect(90, 118, 140, 40);
    },
  ];
}

// ======================================================================
// Monarquia: paço real
// ======================================================================

export function throneRoom(): Layer[] {
  return [
    (ctx, _cam, t) => {
      r(ctx, 0, 0, LW, LH, '#3a1a4a');
      // pilastras douradas e painéis
      for (let x = 10; x < LW; x += 60) {
        r(ctx, x, 8, 8, 110, '#8a6a2a');
        r(ctx, x + 1, 8, 2, 110, '#c8a040');
        r(ctx, x - 2, 8, 12, 4, '#c8a040');
        r(ctx, x - 2, 112, 12, 6, '#c8a040');
      }
      for (let x = 22; x < LW; x += 60) {
        if (x > 110 && x < 200) continue;
        r(ctx, x, 30, 36, 60, '#4a2460');
        r(ctx, x + 2, 32, 32, 56, '#3a1a4a');
        r(ctx, x + 16, 52, 4, 4, '#c8a040');
      }
      r(ctx, 0, 0, LW, 8, '#2a1036');
      r(ctx, 0, 7, LW, 1, '#c8a040');
      label(ctx, 'PACO REAL', 160, 12, '#f4c542');

      // dossel atrás do trono
      r(ctx, 128, 20, 64, 6, '#c8a040');
      r(ctx, 130, 26, 60, 76, '#6a1a3a');
      r(ctx, 130, 26, 4, 76, '#8a2a4a');
      r(ctx, 186, 26, 4, 76, '#8a2a4a');
      for (let x = 130; x < 190; x += 6) r(ctx, x, 26, 3, 3, '#c8a040');

      // estrado com degraus
      r(ctx, 112, 110, 96, 8, '#8a6a2a');
      r(ctx, 112, 110, 96, 1, '#e8c060');
      r(ctx, 122, 102, 76, 8, '#9a7a32');
      r(ctx, 122, 102, 76, 1, '#e8c060');
      // trono
      r(ctx, 146, 44, 28, 58, '#c8a040');
      r(ctx, 149, 48, 22, 38, '#8a1a2a');
      r(ctx, 150, 50, 20, 34, '#a82a3a');
      r(ctx, 142, 78, 36, 8, '#c8a040');
      r(ctx, 144, 86, 32, 16, '#b8902a');
      r(ctx, 148, 88, 24, 6, '#8a1a2a');
      // coroa no alto do espaldar
      r(ctx, 152, 36, 16, 8, '#f4c542');
      r(ctx, 152, 32, 2, 4, '#f4c542');
      r(ctx, 159, 30, 2, 6, '#f4c542');
      r(ctx, 166, 32, 2, 4, '#f4c542');
      r(ctx, 159, 38, 2, 2, Math.sin(t * 2) > 0.6 ? '#ffffff' : '#c63d3d');

      // lustres com velas tremulando
      const chandelier = (cx: number, seed: number) => {
        const sway = Math.round(Math.sin(t * 0.9 + seed) * 1);
        r(ctx, cx, 8, 1, 18, '#c8a040');
        r(ctx, cx - 16 + sway, 26, 33, 3, '#c8a040');
        r(ctx, cx - 10 + sway, 29, 21, 2, '#8a6a2a');
        r(ctx, cx - 2 + sway, 31, 5, 4, '#c8a040');
        for (let k = 0; k < 5; k++) {
          const x = cx - 15 + k * 7 + sway;
          const f = Math.sin(t * 10 + k * 2 + seed) > 0;
          r(ctx, x, 22, 2, 4, '#f0e6c8');
          r(ctx, x, f ? 19 : 20, 2, f ? 3 : 2, f ? '#f4c542' : '#f0a030');
        }
        ctx.fillStyle = `rgba(255,220,130,${0.07 + 0.02 * Math.sin(t * 6 + seed)})`;
        ctx.beginPath();
        ctx.arc(cx + sway, 26, 26, 0, Math.PI * 2);
        ctx.fill();
      };
      chandelier(70, 0);
      chandelier(250, 2);

      // piso em xadrez e tapete vermelho saindo do estrado
      r(ctx, 0, 118, LW, LH - 118, '#2a1a30');
      for (let y = 118; y < LH; y += 10) {
        for (let x = ((y - 118) / 10) % 2 ? 0 : 16; x < LW; x += 32) r(ctx, x, y, 16, 10, '#3a2a44');
      }
      for (let y = 118; y < LH; y++) {
        const k = (y - 118) / (LH - 118);
        const half = 15 + k * 30;
        r(ctx, 160 - half, y, half * 2, 1, '#9a1a2a');
        r(ctx, 160 - half, y, 2, 1, '#c8a040');
        r(ctx, 160 + half - 2, y, 2, 1, '#c8a040');
      }
    },
  ];
}

// ======================================================================
// Ditadura personalista: gabinete do líder
// ======================================================================

export function leaderOffice(): Layer[] {
  return [
    (ctx, _cam, t) => {
      r(ctx, 0, 0, LW, LH, '#2a1a10');
      for (let x = 0; x < LW; x += 28) {
        r(ctx, x + 3, 16, 22, 40, '#32200f');
        r(ctx, x + 3, 62, 22, 50, '#32200f');
        r(ctx, x, 0, 2, 118, '#1e120a');
      }
      r(ctx, 0, 0, LW, 8, '#1a0e08');

      // cortinas vermelhas e pretas nas laterais e atrás do quadro
      const drape = (x: number, w: number, dark: boolean, seed: number) => {
        for (let i = 0; i < w; i += 4) {
          const sway = Math.round(Math.sin(t * 0.6 + seed + i * 0.3) * 0.8);
          r(ctx, x + i, 8, 4, 108 + sway, (i / 4) % 2 ? (dark ? '#141010' : '#7a1010') : dark ? '#201818' : '#9a1818');
        }
      };
      drape(0, 36, false, 0);
      drape(36, 12, true, 1);
      drape(272, 12, true, 2);
      drape(284, 36, false, 3);
      r(ctx, 0, 8, LW, 4, '#1a0e08');
      r(ctx, 0, 12, LW, 1, '#c8a040');

      // retrato gigante do líder
      r(ctx, 98, 6, 124, 94, '#c8a040');
      r(ctx, 100, 8, 120, 90, '#8a6a2a');
      const g = ctx.createLinearGradient(0, 10, 0, 96);
      g.addColorStop(0, '#6a1010');
      g.addColorStop(1, '#2a0808');
      ctx.fillStyle = g;
      ctx.fillRect(102, 10, 116, 86);
      // raios atrás da silhueta
      ctx.fillStyle = `rgba(244,197,66,${0.1 + 0.04 * Math.sin(t)})`;
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI + (i + 0.5) * (Math.PI / 8);
        ctx.beginPath();
        ctx.moveTo(160, 50);
        ctx.lineTo(160 + Math.cos(a - 0.1) * 90, 50 + Math.sin(a - 0.1) * 90);
        ctx.lineTo(160 + Math.cos(a + 0.1) * 90, 50 + Math.sin(a + 0.1) * 90);
        ctx.fill();
      }
      // silhueta: quepe, cabeça, ombros com dragonas
      const S = '#120808';
      r(ctx, 146, 24, 28, 6, S);
      r(ctx, 142, 29, 36, 3, S);
      r(ctx, 149, 32, 22, 22, S);
      r(ctx, 147, 38, 2, 8, S);
      r(ctx, 171, 38, 2, 8, S);
      r(ctx, 154, 54, 12, 6, S);
      r(ctx, 124, 60, 72, 36, S);
      r(ctx, 120, 66, 80, 30, S);
      r(ctx, 126, 60, 14, 3, '#c8a040');
      r(ctx, 180, 60, 14, 3, '#c8a040');
      r(ctx, 157, 26, 6, 3, '#c8a040');
      for (let i = 0; i < 3; i++) r(ctx, 136 + i * 4, 72, 2, 3, i === 1 ? '#c63d3d' : '#f4c542');
      // placa
      r(ctx, 118, 101, 84, 11, '#1a0e08');
      r(ctx, 119, 102, 82, 9, '#c8a040');
      label(ctx, 'GABINETE DO LIDER', 160, 104, '#1a0e08');

      // abajures de parede
      for (const x of [70, 250]) {
        r(ctx, x - 1, 40, 3, 8, '#8a6a2a');
        r(ctx, x - 4, 34, 9, 6, '#d8b060');
        ctx.fillStyle = `rgba(255,200,110,${0.08 + 0.02 * Math.sin(t * 3 + x)})`;
        ctx.beginPath();
        ctx.arc(x + 0.5, 38, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      floorBoards(ctx, 118, '#1e120a', '#160c06', 14);
      r(ctx, 40, 140, 240, 34, '#5a0e0e');
      r(ctx, 42, 142, 236, 30, '#6a1414');
      r(ctx, 40, 140, 240, 1, '#c8a040');
      r(ctx, 40, 173, 240, 1, '#c8a040');
    },
  ];
}

// ======================================================================
// Noite do golpe: gabinete do palácio de madrugada
// ======================================================================

const WIN = { x: 10, y: 14, w: 160, h: 86 };
const STREET_Y = 92;

function tankSprite(ctx: Ctx, x: number, y: number, dir: number) {
  const g = '#2e3a22';
  const d = '#1e2616';
  r(ctx, x, y + 3, 12, 3, g);
  r(ctx, x + 1, y + 6, 10, 2, d);
  r(ctx, x + 3, y, 6, 3, g);
  if (dir > 0) r(ctx, x + 9, y + 1, 6, 1, d);
  else r(ctx, x - 3, y + 1, 6, 1, d);
  r(ctx, x + 5, y + 1, 1, 1, '#e8d070');
}

/**
 * Gabinete do palácio na noite do golpe (ou da revolução).
 * `getHour`: 0 = 23h ... 6 = amanhecer. `getTanks`: 0..8 blindados na rua. `getCrowd`: 0..40 pessoas.
 */
export function nightPalace(getHour: () => number, getTanks: () => number, getCrowd: () => number): Layer[] {
  return [
    (ctx, _cam, t) => {
      const hour = Math.max(0, Math.min(6, getHour()));
      const k = hour / 6;
      const dawn = Math.max(0, (hour - 3.5) / 2.5);

      // parede do gabinete, iluminada só pelo abajur
      r(ctx, 0, 0, LW, LH, '#1e1a26');
      for (let x = 180; x < LW; x += 26) r(ctx, x, 0, 1, 118, '#18141f');
      r(ctx, 0, 0, LW, 6, '#141018');

      // ---------- janela ----------
      ctx.save();
      ctx.beginPath();
      ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
      ctx.clip();

      const sky = ctx.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
      sky.addColorStop(0, mix('#0a1030', '#6a5aa0', k));
      sky.addColorStop(0.6, mix('#141a44', '#d87a8a', k * k));
      sky.addColorStop(1, mix('#1a2050', '#f4a060', k * k));
      ctx.fillStyle = sky;
      ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);

      // estrelas somem com a hora
      const starA = Math.max(0, 1 - k * 1.2);
      if (starA > 0) {
        for (let i = 0; i < 40; i++) {
          const tw = 0.6 + 0.4 * Math.sin(t * (1.5 + hash(i + 50) * 2) + i);
          ctx.globalAlpha = starA * tw;
          r(ctx, WIN.x + hash(i) * WIN.w, WIN.y + hash(i + 100) * 50, 1, 1, '#f4f1ea');
        }
        ctx.globalAlpha = 1;
      }

      // lua atravessa a janela e se põe
      const mx = WIN.x + 20 + k * 150;
      const my = WIN.y + 18 + Math.pow((k - 0.35) * 2, 2) * 18;
      ctx.globalAlpha = Math.max(0.15, 1 - dawn);
      ctx.fillStyle = '#f0ecd0';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix('#0a1030', '#6a5aa0', k);
      ctx.beginPath();
      ctx.arc(mx + 3, my - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // sol nascendo
      if (dawn > 0) {
        const sy = WIN.y + WIN.h - 12 - dawn * 14;
        ctx.fillStyle = 'rgba(255,200,120,0.25)';
        ctx.beginPath();
        ctx.arc(40, sy, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd070';
        ctx.beginPath();
        ctx.arc(40, sy, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // silhuetas da Esplanada
      const sil = mix('#05081a', '#3a2a40', k);
      const lit = hour < 5 ? '#f4d070' : '#8a6a5a';
      for (let i = 0; i < 6; i++) {
        const bx = WIN.x + 4 + i * 14;
        r(ctx, bx, 64, 10, 28, sil);
        for (let wy = 0; wy < 5; wy++) {
          if (hash(i * 13 + wy) > 0.55) r(ctx, bx + 2 + (wy % 2) * 4, 67 + wy * 5, 2, 2, lit);
        }
      }
      // Congresso: torres e cúpulas
      r(ctx, 118, 46, 5, 46, sil);
      r(ctx, 126, 46, 5, 46, sil);
      r(ctx, 123, 62, 3, 3, sil);
      r(ctx, 100, 82, 60, 10, sil);
      for (let i = 0; i < 18; i++) {
        const u = (i - 8.5) / 8.5;
        const top = 74 + Math.round((1 - u * u) * 5);
        r(ctx, 102 + i, top, 1, 82 - top, sil);
      }
      for (let i = 0; i < 12; i++) {
        const u = (i - 5.5) / 5.5;
        const h = Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 5);
        r(ctx, 142 + i, 82 - h, 1, h, sil);
      }
      if (Math.floor(t * 1.5) % 2 === 0) r(ctx, 120, 44, 1, 1, '#e0302a');

      // rua
      r(ctx, WIN.x, STREET_Y, WIN.w, WIN.h - (STREET_Y - WIN.y), mix('#0e1020', '#4a4048', k));
      r(ctx, WIN.x, STREET_Y, WIN.w, 1, mix('#2a2a3a', '#7a6a6a', k));
      for (let x = WIN.x; x < WIN.x + WIN.w; x += 10) r(ctx, x, 96, 5, 1, '#5a5a4a');

      // multidão: pontinhos com bandeiras e tochas
      const crowd = Math.max(0, Math.min(40, Math.round(getCrowd())));
      for (let i = 0; i < crowd; i++) {
        const cx = WIN.x + 4 + hash(i + 300) * (WIN.w - 8);
        const bob = Math.sin(t * 5 + i * 1.3) > 0.3 ? -1 : 0;
        const cy = STREET_Y + 1 + Math.floor(hash(i + 400) * 5) + bob;
        const body = hash(i + 500) > 0.5 ? '#2a2430' : '#3a2a2a';
        r(ctx, cx, cy, 1, 1, '#c89070');
        r(ctx, cx, cy + 1, 1, 2, body);
        const kind = i % 5;
        if (kind === 0) {
          r(ctx, cx + 1, cy - 4, 1, 5, '#8a8a8a');
          const w = Math.sin(t * 4 + i) > 0 ? 0 : 1;
          r(ctx, cx + 2, cy - 4 + w, 3, 2, '#2e8b57');
          r(ctx, cx + 3, cy - 4 + w, 1, 1, '#f4c542');
        } else if (kind === 2) {
          r(ctx, cx + 1, cy - 2, 1, 3, '#5a3a1a');
          const f = Math.sin(t * 12 + i * 2) > 0;
          r(ctx, cx + 1, cy - 3 - (f ? 1 : 0), 1, f ? 2 : 1, f ? '#f4a030' : '#f4d050');
          ctx.fillStyle = 'rgba(255,160,60,0.18)';
          ctx.fillRect(cx - 2, cy - 5, 6, 5);
        }
      }

      // blindados rodando devagar
      const tanks = Math.max(0, Math.min(8, Math.round(getTanks())));
      for (let i = 0; i < tanks; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const span = WIN.w + 30;
        const base = hash(i + 700) * span + t * (3 + (i % 3));
        const pos = ((base % span) + span) % span;
        const x = dir > 0 ? WIN.x - 15 + pos : WIN.x + WIN.w + 15 - pos;
        tankSprite(ctx, x, STREET_Y + 1 + (i % 2) * 4, dir);
      }
      ctx.restore();

      // moldura e caixilhos
      r(ctx, WIN.x - 4, WIN.y - 4, WIN.w + 8, 4, '#3a2a1e');
      r(ctx, WIN.x - 4, WIN.y + WIN.h, WIN.w + 8, 5, '#4a3626');
      r(ctx, WIN.x - 4, WIN.y, 4, WIN.h, '#3a2a1e');
      r(ctx, WIN.x + WIN.w, WIN.y, 4, WIN.h, '#3a2a1e');
      for (const x of [50, 90, 130]) r(ctx, x, WIN.y, 2, WIN.h, '#3a2a1e');
      r(ctx, WIN.x, WIN.y + 40, WIN.w, 2, '#3a2a1e');
      // reflexo da madrugada no chão
      ctx.fillStyle = `rgba(${Math.round(80 + 170 * k)},${Math.round(90 + 60 * k)},${Math.round(160 - 60 * k)},0.08)`;
      ctx.fillRect(10, 118, 170, 40);

      // ---------- parede direita: relógio, bandeira, estante ----------
      const hh = Math.floor(23 + (hour * 7) / 6) % 24;
      r(ctx, 226, 18, 56, 30, '#2a2020');
      r(ctx, 228, 20, 52, 26, '#0a0808');
      r(ctx, 228, 20, 52, 1, '#3a3030');
      const blink = Math.floor(t * 2) % 2 === 0;
      text(ctx, `${String(hh).padStart(2, '0')}H`, 244, 28, hour >= 6 ? '#f4c542' : '#e0302a');
      r(ctx, 268, 29, 1, 1, blink ? '#e0302a' : '#3a1010');
      r(ctx, 268, 31, 1, 1, blink ? '#e0302a' : '#3a1010');
      // ponteiro de progresso da noite
      r(ctx, 232, 40, 44, 2, '#2a1a1a');
      r(ctx, 232, 40, Math.round(44 * k), 2, '#c8a040');

      // bandeira do Brasil em mastro
      r(ctx, 196, 30, 1, 88, '#8a8a8a');
      r(ctx, 195, 28, 3, 2, '#c8a040');
      const w = Math.sin(t * 1.2) > 0 ? 0 : 1;
      r(ctx, 197, 32 + w, 16, 11, '#2e8b57');
      r(ctx, 201, 34 + w, 8, 7, '#f4c542');
      r(ctx, 203, 36 + w, 4, 3, '#1f4fa0');

      // estante
      r(ctx, 238, 56, 64, 58, '#2e1e14');
      for (let s = 0; s < 3; s++) {
        const y = 60 + s * 18;
        r(ctx, 240, y + 14, 60, 2, '#1e120a');
        for (let b = 0; b < 12; b++) {
          const bw = 3 + Math.floor(hash(s * 20 + b) * 2);
          const bh = 9 + Math.floor(hash(s * 20 + b + 5) * 5);
          const colors = ['#5a1a1a', '#1a3a5a', '#3a4a2a', '#6a5a3a', '#2a2a3a'];
          r(ctx, 242 + b * 5, y + 14 - bh, bw, bh, colors[(b + s) % colors.length]);
        }
      }

      // abajur de pé com halo tremulante
      r(ctx, 300, 70, 1, 48, '#6a5a3a');
      r(ctx, 294, 62, 13, 8, '#c8a070');
      ctx.fillStyle = `rgba(255,210,130,${0.1 + 0.02 * Math.sin(t * 4)})`;
      ctx.beginPath();
      ctx.arc(300, 70, 30, 0, Math.PI * 2);
      ctx.fill();

      // piso: carpete escuro
      r(ctx, 0, 118, LW, LH - 118, '#241a1e');
      for (let x = 0; x < LW; x += 18) r(ctx, x, 118, 1, LH - 118, '#1e1618');
      r(ctx, 0, 118, LW, 1, '#3a2a2a');
      r(ctx, 190, 150, 120, 24, '#3a1414');
      r(ctx, 190, 150, 120, 1, '#6a4a2a');
    },
  ];
}

/** Mesa do gabinete na noite do golpe, com o telefone vermelho. Primeiro plano. */
export function nightDesk(ctx: Ctx) {
  r(ctx, 120, 130, 80, 12, '#4a2e18');
  r(ctx, 120, 128, 80, 3, '#7a4e2a');
  r(ctx, 124, 142, 4, 28, '#2e1c0e');
  r(ctx, 192, 142, 4, 28, '#2e1c0e');
  r(ctx, 128, 142, 20, 14, '#3a2412');
  r(ctx, 136, 148, 4, 1, '#c8a040');
  // telefone vermelho
  r(ctx, 172, 122, 16, 6, '#b01818');
  r(ctx, 170, 118, 20, 3, '#d02828');
  r(ctx, 170, 121, 3, 2, '#d02828');
  r(ctx, 187, 121, 3, 2, '#d02828');
  r(ctx, 177, 124, 6, 2, '#f4f1ea');
  // papéis e abajur de mesa
  r(ctx, 136, 124, 14, 4, '#f0ece0');
  r(ctx, 138, 123, 12, 1, '#d8d2c4');
  r(ctx, 128, 112, 1, 16, '#6a5a3a');
  r(ctx, 123, 108, 11, 5, '#2e6a3a');
  r(ctx, 125, 126, 7, 2, '#6a5a3a');
}

/** Mesa longa do conselho, como a da reunião ministerial. Primeiro plano. */
export function councilTable(ctx: Ctx) {
  r(ctx, 60, 132, 230, 10, '#5a3a22');
  r(ctx, 60, 130, 230, 3, '#8a5a32');
  r(ctx, 60, 142, 230, 1, '#3a2412');
  for (const x of [66, 170, 280]) r(ctx, x, 143, 4, 30, '#3a2412');
  // pastas e copos
  for (let x = 84; x < 280; x += 40) {
    r(ctx, x, 128, 10, 2, '#f0ece0');
    r(ctx, x + 14, 126, 2, 4, '#bcd8e8');
  }
}

/** Sala do conselho de cada regime. */
export function councilRoom(id: string): Layer[] {
  switch (id) {
    case 'quartel': return warRoom();
    case 'politburo': return politburo();
    case 'templo': return temple();
    case 'controle': return controlRoom();
    case 'trono': return throneRoom();
    case 'gabinete': return leaderOffice();
    default: return leaderOffice();
  }
}

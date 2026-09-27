import type { Place, RegionId } from '../engine/types';
import { makeCanvas, rect, type Ctx } from './pixel';

/*
 * Mapa do Brasil em células: N = Norte, E = Nordeste, C = Centro-Oeste, S = Sudeste, L = Sul.
 * Aproximado de propósito: é pixel art, não cartografia.
 */
const GRID = [
  '......NNNN..NNN.................',
  '....NNNNNNNNNNNNN...............',
  '...NNNNNNNNNNNNNNN.EE...........',
  '..NNNNNNNNNNNNNNNNNEEEEE........',
  '.NNNNNNNNNNNNNNNNNNEEEEEEEE.....',
  'NNNNNNNNNNNNNNNNNNNEEEEEEEEEE...',
  'NNNNNNNNNNNNNNNNNNNEEEEEEEEEEE..',
  '.NNNNNNNNNNNNNNNNNNEEEEEEEEEEE..',
  '..NNNNNNNNNNNNNNNNEEEEEEEEEEEE..',
  '...NNNNNNNNNNNNNNNEEEEEEEEEEE...',
  '....NNNNNNNNCCCCCCEEEEEEEEEEE...',
  '.....NNNNNNCCCCCCCCEEEEEEEEEE...',
  '......NNNNCCCCCCCCCEEEEEEEEE....',
  '.......NNCCCCCCCCCCEEEEEEEE.....',
  '.........CCCCCCCCCCSEEEEEE......',
  '.........CCCCCCCCCSSSSEEEE......',
  '.........CCCCCCCCCSSSSSSEE......',
  '..........CCCCCCCSSSSSSSSS......',
  '..........CCCCCCCSSSSSSSSS......',
  '...........CCCCCSSSSSSSSSS......',
  '...........CCCCSSSSSSSSSS.......',
  '.............LLLLSSSSSSS........',
  '............LLLLLLLSSSS.........',
  '............LLLLLLLL............',
  '...........LLLLLLLLL............',
  '...........LLLLLLLL.............',
  '..........LLLLLLL...............',
  '...........LLLL.................',
  '............LL..................',
];

const CODE: Record<string, RegionId> = { N: 'norte', E: 'nordeste', C: 'centro_oeste', S: 'sudeste', L: 'sul' };
export const CELL = 8;
export const MAP_W = GRID[0].length * CELL;
export const MAP_H = GRID.length * CELL;

/** Centro de cada região, em pixels, para os marcadores. */
const CENTERS = (() => {
  const acc: Record<string, { x: number; y: number; n: number }> = {};
  GRID.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const id = CODE[ch];
      if (!id) return;
      acc[id] ??= { x: 0, y: 0, n: 0 };
      acc[id].x += x;
      acc[id].y += y;
      acc[id].n++;
    }),
  );
  return Object.fromEntries(Object.entries(acc).map(([id, v]) => [id, { x: (v.x / v.n + 0.5) * CELL, y: (v.y / v.n + 0.5) * CELL }])) as Record<RegionId, { x: number; y: number }>;
})();

/** Vermelho (≤25%) → amarelo (50%) → verde (≥75%): a faixa que importa numa eleição. */
function heat(v: number): string {
  const t = Math.max(0, Math.min(1, (v - 25) / 50));
  const r = t < 0.5 ? 224 : Math.round(224 - (t - 0.5) * 2 * 150);
  const g = t < 0.5 ? Math.round(87 + t * 2 * 110) : 197;
  const b = t < 0.5 ? 79 : Math.round(79 - (t - 0.5) * 2 * 20);
  return `rgb(${r},${g},${b})`;
}

export function regionAt(x: number, y: number): RegionId | null {
  const row = GRID[Math.floor(y / CELL)];
  return row ? CODE[row[Math.floor(x / CELL)]] ?? null : null;
}

export class BrazilMap {
  readonly canvas = makeCanvas(MAP_W, MAP_H, 'brazil-map');
  private ctx: Ctx = this.canvas.getContext('2d')!;
  private approval: Partial<Record<RegionId, number>> = {};
  private place: Place | null = null;
  private icon = '';
  private hover: RegionId | null = null;
  private frame = 0;

  set(approval: Partial<Record<RegionId, number>>) {
    this.approval = approval;
  }

  mark(place: Place | undefined, icon: string) {
    this.place = place ?? null;
    this.icon = icon;
  }

  setHover(region: RegionId | null) {
    this.hover = region;
  }

  draw() {
    const { ctx } = this;
    this.frame++;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    const everywhere = this.place === 'nacional';
    const pulse = this.frame % 16 < 8;
    GRID.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const id = CODE[ch];
        if (!id) return;
        const lit = (everywhere && pulse) || (this.place === id && pulse) || this.hover === id;
        rect(ctx, x * CELL, y * CELL, CELL, CELL, heat(this.approval[id] ?? 50));
        if (lit) rect(ctx, x * CELL, y * CELL, CELL, CELL, 'rgba(255,255,255,0.25)');
        // contorno entre regiões
        const right = CODE[row[x + 1]];
        const below = CODE[GRID[y + 1]?.[x]];
        if (right && right !== id) rect(ctx, x * CELL + CELL - 1, y * CELL, 1, CELL, '#1a1420');
        if (below && below !== id) rect(ctx, x * CELL, y * CELL + CELL - 1, CELL, 1, '#1a1420');
        if (!right) rect(ctx, x * CELL + CELL - 1, y * CELL, 1, CELL, '#1a142088');
      }),
    );
    // Brasília
    rect(ctx, 17 * CELL + 2, 15 * CELL + 2, 4, 4, '#f4f1ea');
    rect(ctx, 17 * CELL + 3, 15 * CELL + 3, 2, 2, '#c63d3d');
  }

  /** Posição do marcador do acontecimento atual, em pixels do mapa. */
  markerPos(): { x: number; y: number } | null {
    if (!this.place || this.place === 'nacional') return null;
    if (this.place === 'exterior') return { x: MAP_W - 24, y: 30 };
    return CENTERS[this.place];
  }

  get markerIcon() {
    return this.icon;
  }
}

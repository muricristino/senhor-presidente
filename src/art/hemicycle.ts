import type { Country, GameState } from '../engine/types';
import { makeCanvas, rect } from './pixel';

const W = 300;
const H = 158;
const ROWS = 9;
const OPPOSITION = '#8a2a2a';

export interface ChamberCount {
  base: number;
  opposition: number;
  seats: number;
}

/** Quantos deputados de cada bancada apoiam o governo, a partir do humor dela e da coalizão. */
export function chamberCount(state: GameState, country: Country): { byFaction: { id: string; color: string; seats: number; support: number }[]; total: ChamberCount } {
  const seats = country.chamber.seats;
  const influence = country.factions.reduce((n, f) => n + f.influence, 0);
  let assigned = 0;
  const byFaction = country.factions.map((f, i) => {
    const n = i === country.factions.length - 1 ? seats - assigned : Math.round((f.influence / influence) * seats);
    assigned += n;
    const mood = state.factions[f.id] ?? 0;
    const share = Math.min(0.95, Math.max(0.05, 0.5 + mood / 150 + (state.kpis.coalizao - 50) / 200));
    return { id: f.id, color: f.color, seats: n, support: Math.round(n * share) };
  });
  const base = byFaction.reduce((n, f) => n + f.support, 0);
  return { byFaction, total: { base, opposition: seats - base, seats } };
}

/** Plenário da Câmara em semicírculo: cor da bancada = apoia o governo; vermelho escuro = oposição. */
export function drawHemicycle(state: GameState, country: Country): HTMLCanvasElement {
  const c = makeCanvas(W, H, 'hemicycle');
  const ctx = c.getContext('2d')!;
  const { byFaction } = chamberCount(state, country);
  const total = country.chamber.seats;

  // posições: fileiras concêntricas, assentos proporcionais ao raio
  const radii = Array.from({ length: ROWS }, (_, i) => 52 + i * 11.5);
  const sum = radii.reduce((a, b) => a + b, 0);
  const pos: { x: number; y: number; a: number }[] = [];
  let left = total;
  radii.forEach((r, i) => {
    const n = i === ROWS - 1 ? left : Math.round((r / sum) * total);
    left -= n;
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (k + 0.5) * (Math.PI / n);
      pos.push({ x: W / 2 + Math.cos(a) * r, y: H - 6 - Math.sin(a) * r, a });
    }
  });
  pos.sort((p, q) => q.a - p.a);

  // cada bancada ocupa uma fatia; dentro dela, oposição primeiro, base depois
  const colors: string[] = [];
  for (const f of byFaction) {
    for (let k = 0; k < f.seats; k++) colors.push(k < f.seats - f.support ? OPPOSITION : f.color);
  }
  pos.forEach((p, i) => rect(ctx, p.x - 2, p.y - 2, 4, 4, colors[i] ?? OPPOSITION));
  // mesa diretora
  rect(ctx, W / 2 - 16, H - 14, 32, 10, '#6a4a2a');
  rect(ctx, W / 2 - 16, H - 14, 32, 2, '#9a6a3a');
  return c;
}

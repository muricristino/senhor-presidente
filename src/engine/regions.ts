import type { Country, GameState, RegionId } from './types';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Aprovação em cada região: a nacional mais o gosto regional por certos eixos e bancadas. */
export function regionalApproval(state: GameState, country: Country): Record<RegionId, number> {
  const out = {} as Record<RegionId, number>;
  for (const r of country.regions ?? []) {
    let v = state.kpis.aprovacao;
    for (const [axis, w] of Object.entries(r.lean.axes ?? {})) v += (state.axes[axis as keyof GameState['axes']] ?? 0) * (w ?? 0);
    for (const [f, w] of Object.entries(r.lean.factions ?? {})) v += (state.factions[f] ?? 0) * w;
    out[r.id] = Math.round(clamp(v, 0, 100));
  }
  return out;
}

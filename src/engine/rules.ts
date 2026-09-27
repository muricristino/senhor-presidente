import { AXES } from './data';
import { KPIS } from './kpis';
import type { AxisId, Country, Deltas, Effects, GameState, KpiId, Player } from './types';

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Quanto a mudança de humor das bancadas mexe na coalizão, ponderado pela influência de cada uma. */
export const COALITION_WEIGHT = 0.3;

export function createState(country: Country, player: Player): GameState {
  const axes = Object.fromEntries(AXES.map((a) => [a.id, 0])) as Record<AxisId, number>;
  const factions = Object.fromEntries(country.factions.map((f) => [f.id, 0]));
  const state: GameState = {
    player,
    countryId: country.country_id,
    month: 1,
    totalMonths: country.calendar.term_months * country.calendar.max_terms,
    termMonths: country.calendar.term_months,
    startYear: country.calendar.start_year,
    startAge: country.calendar.min_age,
    term: 1,
    impeachmentShieldUntil: 0,
    electionsHeld: [],
    kpis: { ...country.kpis_iniciais },
    axes,
    factions,
    relations: Object.fromEntries((country.partners ?? []).map((p) => [p.id, p.start])),
    stf: 'OK',
    decisions: [],
    history: [],
  };
  const bio = country.bios.find((b) => b.id === player.bioId);
  return bio ? applyEffects(state, bio.effects, country, false).state : state;
}

export function applyEffects(
  state: GameState,
  effects: Effects,
  country: Country,
  deriveCoalition = true,
): { state: GameState; deltas: Deltas } {
  const next: GameState = {
    ...state,
    kpis: { ...state.kpis },
    axes: { ...state.axes },
    factions: { ...state.factions },
    relations: { ...(state.relations ?? {}) },
  };
  const deltas: Deltas = { kpis: {}, axes: {}, factions: {}, relations: {} };

  for (const [id, d] of Object.entries(effects.relations ?? {})) {
    if (!(id in next.relations)) continue;
    const before = next.relations[id];
    next.relations[id] = clamp(before + d, -100, 100);
    deltas.relations[id] = next.relations[id] - before;
  }

  for (const [id, d] of Object.entries(effects.axes ?? {}) as [AxisId, number][]) {
    const before = next.axes[id];
    next.axes[id] = clamp(before + d, -100, 100);
    deltas.axes[id] = next.axes[id] - before;
  }

  let weighted = 0;
  let totalInfluence = 0;
  for (const f of country.factions) totalInfluence += f.influence;
  for (const [id, d] of Object.entries(effects.factions ?? {})) {
    if (!(id in next.factions)) continue;
    const before = next.factions[id];
    next.factions[id] = clamp(before + d, -100, 100);
    const applied = next.factions[id] - before;
    deltas.factions[id] = applied;
    const influence = country.factions.find((f) => f.id === id)?.influence ?? 0;
    weighted += applied * influence;
  }

  const kpiChanges: Partial<Record<KpiId, number>> = { ...(effects.kpis ?? {}) };
  if (deriveCoalition && totalInfluence > 0 && weighted !== 0) {
    kpiChanges.coalizao = (kpiChanges.coalizao ?? 0) + (weighted / totalInfluence) * COALITION_WEIGHT;
  }
  for (const def of KPIS) {
    let d = kpiChanges[def.id];
    if (d === undefined) continue;
    const before = next.kpis[def.id];
    if (deriveCoalition && (def.id === 'aprovacao' || def.id === 'coalizao')) d *= resistance(before, d);
    next.kpis[def.id] = round(clamp(before + d, def.min, def.max));
    deltas.kpis[def.id] = round(next.kpis[def.id] - before);
  }

  return { state: next, deltas };
}

/**
 * Perto dos extremos a opinião resiste: cair de 20% para 10% é bem mais difícil que de 60% para 50%.
 * Fator 1 no meio da escala, até 0,35 colado no limite.
 */
export function resistance(value: number, delta: number): number {
  const room = delta < 0 ? value : 100 - value;
  return clamp(0.35 + room / 60, 0.35, 1);
}

/**
 * Um mês passa: a aprovação volta devagar para perto de 45% e a coalizão para o que as bancadas
 * sentem pelo governo. É o que impede o jogo de despencar a zero sem volta.
 */
export function advanceMonth(state: GameState, country: Country, months = 1): GameState {
  let next = { ...state, kpis: { ...state.kpis }, month: Math.min(state.totalMonths, state.month + months) };
  const total = country.factions.reduce((n, f) => n + f.influence, 0) || 1;
  const mood = country.factions.reduce((n, f) => n + (state.factions[f.id] ?? 0) * f.influence, 0) / total;
  const coalitionBase = clamp(45 + mood * 0.4, 10, 90);
  // Comércio exterior: boas relações com os grandes parceiros seguram emprego e preços.
  const trade = (country.partners ?? []).reduce((n, p) => n + ((state.relations?.[p.id] ?? 0) / 100) * p.trade, 0);
  const relations = { ...(state.relations ?? {}) };
  for (let i = 0; i < months; i++) {
    next.kpis.aprovacao = round(next.kpis.aprovacao + (45 - next.kpis.aprovacao) * 0.05, 1);
    next.kpis.coalizao = round(next.kpis.coalizao + (coalitionBase - next.kpis.coalizao) * 0.07, 1);
    next.kpis.desemprego = round(clamp(next.kpis.desemprego - trade * 0.06, 2, 30), 2);
    next.kpis.inflacao = round(clamp(next.kpis.inflacao - trade * 0.04, -2, 40), 2);
    // Cada parceiro caminha devagar para um ponto de equilíbrio que depende da ideologia do governo:
    // o efeito de uma decisão vai se diluindo e o que fica é a postura de fundo.
    for (const p of country.partners ?? []) {
      const taste = Object.entries(p.likes).reduce((n, [axis, w]) => n + (state.axes[axis as AxisId] ?? 0) * (w ?? 0), 0);
      const target = clamp(p.start + taste, -80, 80);
      const now = relations[p.id] ?? p.start;
      relations[p.id] = round(now + (target - now) * 0.04, 1);
    }
  }
  next.relations = relations;
  next.series = [...(state.series ?? [{ month: state.month, kpis: { ...state.kpis } }]), { month: next.month, kpis: { ...next.kpis } }].slice(-120);
  next = { ...next };
  return next;
}

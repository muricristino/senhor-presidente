import { AXES } from './data';
import { KPIS } from './kpis';
import { capInstitutions, horizon, institutionsOf, isDemocracy, regimeOf, START_INSTITUTIONS } from './regime';
import type { AxisId, Bill, BillProposal, Country, Deltas, Effects, GameState, InstitutionId, Instrument, KpiId, Law, Player } from './types';

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
    regime: 'presidencialismo',
    institutions: { ...START_INSTITUTIONS },
    regimeHistory: [],
    extraTerms: 0,
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

  if (effects.institutions && Object.keys(effects.institutions).length) {
    const before = institutionsOf(state);
    const inst = { ...before };
    for (const [id, d] of Object.entries(effects.institutions) as [InstitutionId, number][]) if (id in inst && d) inst[id] = inst[id] + d;
    next.institutions = capInstitutions(inst, regimeOf(state));
    deltas.institutions = Object.fromEntries(
      (Object.keys(inst) as InstitutionId[]).map((id) => [id, next.institutions![id] - before[id]]).filter(([, d]) => d !== 0),
    );
  }

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
  // O regime mexe nos indicadores todo mês (economia planejada, propaganda, censura...).
  const regime = regimeOf(state);
  for (const [k, v] of Object.entries(regime.drift ?? {}) as [KpiId, number][]) {
    const def = KPIS.find((d) => d.id === k);
    if (def) next.kpis[k] = round(clamp(next.kpis[k] + v * months, def.min, def.max), 2);
  }
  // Instituições: na democracia, freios feridos se recuperam devagar se o governo não insiste;
  // num governo que concentra poder, eles vão sendo corroídos.
  const inst = { ...institutionsOf(state) };
  for (const id of Object.keys(inst) as InstitutionId[]) {
    if (isDemocracy(state) && state.axes.poder < 30 && inst[id] < START_INSTITUTIONS[id]) inst[id] = Math.min(START_INSTITUTIONS[id], inst[id] + 0.3 * months);
    else if (state.axes.poder >= 50) inst[id] = inst[id] - 0.15 * months * (state.axes.poder / 100);
  }
  next.institutions = capInstitutions(inst, regime);
  // Leis em vigor fazem efeito todo mês.
  for (const law of state.laws ?? []) {
    if (next.month > law.until) continue;
    for (const [k, v] of Object.entries(law.monthly) as [KpiId, number][]) {
      const def = KPIS.find((d) => d.id === k);
      if (def) next.kpis[k] = round(clamp(next.kpis[k] + v * months, def.min, def.max), 2);
    }
  }
  next.series = [...(state.series ?? [{ month: state.month, kpis: { ...state.kpis } }]), { month: next.month, kpis: { ...next.kpis } }].slice(-120);
  next = { ...next };
  return next;
}

/** Regras de cada instrumento legislativo. */
export const INSTRUMENTS: Record<Instrument, { label: string; needed: number; months: number; power: number; note: string }> = {
  lei: { label: 'Projeto de lei', needed: 257, months: 3, power: 1, note: 'Maioria simples. Vai ao plenário em 3 meses.' },
  pec: { label: 'PEC', needed: 308, months: 5, power: 1.3, note: '3/5 da Câmara. Demora mais, efeito maior e mais duradouro.' },
  mp: { label: 'Medida provisória', needed: 257, months: 4, power: 1, note: 'Vale na hora. Se o Congresso rejeitar em 4 meses, cai e parte do efeito se desfaz.' },
  decreto: { label: 'Decreto', needed: 0, months: 0, power: 1, note: 'Sem Congresso para votar: vale na hora, e ninguém pode derrubar. O custo aparece lá fora e na rua.' },
};

/**
 * Efeito das regras do jogo mudadas por lei: reeleição, STF, imprensa, eleições.
 * O código aplica, para a mecânica ser a mesma seja qual for o texto que o Claude escreveu.
 */
export function specialEffects(p: Pick<BillProposal, 'special'>): Effects {
  switch (p.special) {
    case 'reeleicao':
      return { institutions: { eleicoes: -12 }, axes: { poder: 10 } };
    case 'stf':
      return { institutions: { stf: -30 }, axes: { poder: 12 } };
    case 'imprensa':
      return { institutions: { imprensa: -25 }, axes: { poder: 8, direitos: -8 } };
    case 'eleicoes':
      return { institutions: { eleicoes: -25 }, axes: { poder: 10 } };
    case 'fortalecer':
      return { institutions: { stf: 8, congresso: 8, imprensa: 8, eleicoes: 8 }, axes: { poder: -8 } };
    default:
      return {};
  }
}

const mergeEffects = (a: Effects, b: Effects): Effects => {
  const m = (x?: Record<string, number | undefined>, y?: Record<string, number | undefined>) => {
    const out: Record<string, number> = {};
    for (const [k, v] of [...Object.entries(x ?? {}), ...Object.entries(y ?? {})]) out[k] = (out[k] ?? 0) + (v ?? 0);
    return out;
  };
  return { axes: m(a.axes, b.axes), kpis: m(a.kpis, b.kpis), factions: m(a.factions, b.factions), relations: m(a.relations, b.relations), institutions: m(a.institutions, b.institutions) };
};

/** Lei que passou: efeito da proposta somado ao da regra mudada (e mandato extra, se for a PEC da reeleição). */
function enact(state: GameState, p: BillProposal, k: number, country: Country): { state: GameState; deltas: Deltas } {
  const r = applyEffects(state, mergeEffects(scaleEffects(p.effects, k), specialEffects(p)), country);
  if (p.special !== 'reeleicao') return r;
  const next = { ...r.state, extraTerms: (r.state.extraTerms ?? 0) + 1 };
  return { state: { ...next, totalMonths: horizon(next) }, deltas: r.deltas };
}

/** Multiplica um efeito (usado para o peso de PEC e para desfazer MP rejeitada). */
export function scaleEffects(e: Effects, k: number): Effects {
  const m = (o?: Record<string, number | undefined>) => Object.fromEntries(Object.entries(o ?? {}).map(([id, v]) => [id, (v ?? 0) * k]));
  return { axes: m(e.axes), kpis: m(e.kpis), factions: m(e.factions), relations: m(e.relations), institutions: m(e.institutions) };
}

/** Envia o projeto: MP já vale e começa a fazer efeito; lei e PEC só depois da votação. */
export function proposeBill(state: GameState, p: BillProposal, instrument: Instrument, country: Country): { state: GameState; deltas: Deltas } {
  const rule = INSTRUMENTS[instrument];
  const bill: Bill = { ...p, instrument, proposedMonth: state.month, voteMonth: state.month + rule.months };
  if (instrument !== 'mp' && instrument !== 'decreto') return { state: { ...state, bill }, deltas: { kpis: {}, axes: {}, factions: {}, relations: {} } };
  const r = enact(state, p, 1, country);
  const law: Law = { title: p.title, icon: p.icon, monthly: p.monthly, until: state.month + p.months };
  // decreto não passa por votação: não fica projeto pendente
  return { state: { ...r.state, bill: instrument === 'decreto' ? null : bill, laws: [...(r.state.laws ?? []), law] }, deltas: r.deltas };
}

/** Resultado da votação no plenário. */
export function concludeBill(state: GameState, passed: boolean, country: Country): { state: GameState; deltas: Deltas } {
  const bill = state.bill;
  if (!bill) return { state, deltas: { kpis: {}, axes: {}, factions: {}, relations: {} } };
  const rule = INSTRUMENTS[bill.instrument];
  let next: GameState = { ...state, bill: null };
  let r;
  if (passed && bill.special?.startsWith('regime:')) {
    // plebiscito ou constituinte: a lei só convoca o voto; quem muda o regime é o resultado
    r = applyEffects(next, { kpis: { coalizao: 3 } }, country);
    next = r.state;
  } else if (passed && bill.instrument !== 'mp') {
    r = enact(next, bill, rule.power, country);
    const law: Law = { title: bill.title, icon: bill.icon, monthly: scaleEffects({ kpis: bill.monthly }, rule.power).kpis ?? {}, until: state.month + Math.round(bill.months * rule.power) };
    next = { ...r.state, laws: [...(r.state.laws ?? []), law] };
  } else if (passed) {
    // MP convertida em lei: o efeito já estava valendo
    r = applyEffects(next, { kpis: { coalizao: 2 } }, country);
    next = r.state;
  } else if (bill.instrument === 'mp') {
    // MP derrubada: cai a lei, desfaz parte do efeito e o governo sai derrotado
    r = applyEffects(next, { ...scaleEffects(bill.effects, -0.6), kpis: { ...(scaleEffects(bill.effects, -0.6).kpis ?? {}), coalizao: -4 } }, country);
    next = { ...r.state, laws: (r.state.laws ?? []).filter((l) => l.title !== bill.title) };
  } else {
    r = applyEffects(next, { kpis: { coalizao: -5, aprovacao: -2 } }, country);
    next = r.state;
  }
  return { state: next, deltas: r.deltas };
}

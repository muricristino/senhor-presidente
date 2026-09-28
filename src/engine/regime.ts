import regimesData from '../../data/regimes.json';
import { ageOf } from './calendar';
import { KPIS } from './kpis';
import type { Country, CrisisKind, GameState, InstitutionId, Regime, RegimeId } from './types';

/*
 * Regimes políticos: cada um é um módulo de dados (data/regimes.json) que diz como se governa,
 * como se perde o poder e quem sustenta o governante. O motor lê o regime em vez de ter
 * eleição e impeachment fixos no código.
 */

export const REGIMES = regimesData as unknown as Regime[];

export function getRegime(id: RegimeId | undefined): Regime {
  return REGIMES.find((r) => r.id === (id ?? 'presidencialismo')) ?? REGIMES[0];
}

export const regimeOf = (s: Pick<GameState, 'regime'>) => getRegime(s.regime);
export const isDemocracy = (s: Pick<GameState, 'regime'>) => regimeOf(s).family === 'democracia';
export const isAutocracy = (s: Pick<GameState, 'regime'>) => regimeOf(s).family === 'autocracia';
/** Regimes em que o governante disputa eleição com mandato de quatro anos. */
export const isPresidential = (s: Pick<GameState, 'regime'>) => s.regime === undefined || s.regime === 'presidencialismo' || s.regime === 'hibrido';
export const isParliamentary = (s: Pick<GameState, 'regime'>) => s.regime === 'parlamentarismo' || s.regime === 'monarquia';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ---------- instituições ----------

export const INSTITUTIONS: { id: InstitutionId; name: string; icon: string; explain: string }[] = [
  { id: 'stf', name: 'Supremo', icon: '⚖️', explain: 'Juízes independentes barram atos inconstitucionais do governo.' },
  { id: 'congresso', name: 'Congresso', icon: '🏛️', explain: 'Um Legislativo independente fiscaliza, rejeita projetos e pode afastar o governante.' },
  { id: 'imprensa', name: 'Imprensa', icon: '📰', explain: 'Imprensa livre investiga e expõe o governo, mesmo quando incomoda.' },
  { id: 'eleicoes', name: 'Eleições', icon: '🗳️', explain: 'Eleições limpas e com regras iguais permitem trocar quem governa.' },
];

/** O Brasil de 2026: instituições fortes, com a imprensa e o Congresso sob pressão. */
export const START_INSTITUTIONS: Record<InstitutionId, number> = { stf: 80, congresso: 75, imprensa: 75, eleicoes: 90 };

export function institutionsOf(s: GameState): Record<InstitutionId, number> {
  return s.institutions ?? { ...START_INSTITUTIONS };
}

/** Aplica o teto de independência do regime em vigor. */
export function capInstitutions(inst: Record<InstitutionId, number>, regime: Regime): Record<InstitutionId, number> {
  const out = { ...inst };
  for (const i of INSTITUTIONS) out[i.id] = Math.round(clamp(Math.min(out[i.id], regime.institutionsCap[i.id] ?? 100), 0, 100) * 10) / 10;
  return out;
}

/** Índice de democracia de 0 a 100: a média da independência das instituições (inspirado no V-Dem). */
export function democracyIndex(s: GameState): number {
  const inst = institutionsOf(s);
  return Math.round(INSTITUTIONS.reduce((n, i) => n + inst[i.id], 0) / INSTITUTIONS.length);
}

/** As quatro categorias do V-Dem (Regimes of the World). */
export function democracyLabel(index: number): { label: string; tone: 'good' | 'warn' | 'bad' | 'dark' } {
  if (index >= 70) return { label: 'Democracia liberal', tone: 'good' };
  if (index >= 50) return { label: 'Democracia eleitoral', tone: 'warn' };
  if (index >= 25) return { label: 'Autocracia eleitoral', tone: 'bad' };
  return { label: 'Autocracia fechada', tone: 'dark' };
}

/**
 * Deriva automática: uma democracia presidencial ou parlamentar que perde os freios vira regime
 * híbrido sem nenhum golpe; um regime híbrido que devolve os freios volta a ser democracia.
 */
export function driftedRegime(s: GameState): RegimeId | null {
  const idx = democracyIndex(s);
  if (isDemocracy(s) && idx < 45) return 'hibrido';
  if (s.regime === 'hibrido' && idx >= 55) return 'presidencialismo';
  return null;
}

// ---------- ameaças ao mandato ----------

export const CRISES: Record<CrisisKind, { name: string; icon: string; warn: string }> = {
  impeachment: { name: 'Impeachment', icon: '⚖️', warn: 'Com a base desfeita e a rua contra, a Câmara pode abrir um processo de impeachment.' },
  desconfianca: { name: 'Moção de desconfiança', icon: '✋', warn: 'A maioria no Parlamento está por um fio. Uma moção de desconfiança derruba o governo.' },
  revolta: { name: 'Revolta popular', icon: '🔥', warn: 'A rua está fervendo. Se a revolta crescer, o palácio pode ser cercado.' },
  golpe_contra: { name: 'Golpe contra você', icon: '🪖', warn: 'Há generais insatisfeitos conversando nos quartéis. Um golpe está no ar.' },
  expurgo: { name: 'Expurgo no partido', icon: '☭', warn: 'O Comitê Central está dividido. Há quem queira um novo Secretário-Geral.' },
  destituicao: { name: 'Destituição pelo conselho', icon: '📜', warn: 'O conselho que sustenta o regime perde a paciência com o seu governo.' },
};

/** Nota da economia de 0 a 100: emprego e preços. */
export function economyScore(s: GameState): number {
  return clamp(50 + (8 - s.kpis.desemprego) * 6 + (4.5 - s.kpis.inflacao) * 6, 0, 100);
}

/** Nível de cada ameaça ao mandato (0 a 100). Em 100, a crise explode. Só as do regime em vigor. */
export function threats(s: GameState): Partial<Record<CrisisKind, number>> {
  const r = regimeOf(s);
  const a = s.kpis.aprovacao;
  const c = s.kpis.coalizao;
  const econ = economyScore(s);
  const inst = institutionsOf(s);
  const dem = democracyIndex(s);
  const seg = s.factions.seguranca ?? 0;
  const pillar = r.pillar ? s.factions[r.pillar.faction] ?? 0 : 0;
  const out: Partial<Record<CrisisKind, number>> = {};
  for (const kind of r.removal) {
    let v = 0;
    switch (kind) {
      case 'impeachment':
        v = ((45 - a) / 17 + (50 - c) / 15) * 50 * (r.id === 'hibrido' ? inst.congresso / 75 : 1);
        break;
      case 'desconfianca':
        v = ((55 - c) / 20) * 80 + ((40 - a) / 20) * 20;
        break;
      case 'revolta':
        v = (35 - a) * 2.6 + Math.max(0, s.kpis.inflacao - 7) * 6 + Math.max(0, s.kpis.desemprego - 11) * 6;
        // na democracia a raiva vai para a urna; na autocracia, o medo segura e a economia pesa
        v += r.family === 'autocracia' ? -seg * 0.3 + (50 - econ) * 0.3 : r.family === 'democracia' ? -15 : 0;
        break;
      case 'golpe_contra':
        v = r.family === 'autocracia' ? -seg * 1.6 + Math.max(0, 45 - c) * 1.2 + Math.max(0, 30 - a) * 0.8 : -seg * 1.3 - 15 + Math.max(0, 30 - a) * 1.2 - (dem - 50) * 0.6;
        break;
      case 'expurgo':
        v = -pillar * 1.5 + Math.max(0, 45 - c) * 1.5 + Math.max(0, 40 - econ) * 0.6;
        break;
      case 'destituicao':
        v = -pillar * 1.5 + Math.max(0, 45 - c) * 1.5 + (r.id === 'tecnocracia' ? Math.max(0, 55 - econ) * 1.2 : Math.max(0, 35 - a) * 0.8);
        break;
    }
    out[kind] = Math.round(clamp(v, 0, 100));
  }
  return out;
}

// ---------- mudar de regime ----------

export interface Requirement {
  label: string;
  ok: boolean;
}

export interface RegimeRoute {
  to: RegimeId;
  /** Plebiscito e constituinte passam pelo Congresso; golpe e revolução, não. */
  via: 'plebiscito' | 'constituinte' | 'golpe' | 'revolucao';
  reqs: Requirement[];
  /** Aviso de risco (ex.: a via chilena atrai golpe). */
  risk?: string;
}

const req = (label: string, ok: boolean): Requirement => ({ label, ok });
const axisReq = (s: GameState, axis: keyof GameState['axes'], sign: 1 | -1, min: number, label: string) =>
  req(`${label} ${sign > 0 ? '≥' : '≤'} ${sign * min} (hoje ${Math.round(s.axes[axis])})`, s.axes[axis] * sign >= min);
const factionReq = (s: GameState, id: string, min: number, name: string) => req(`${name} ≥ ${min} (hoje ${Math.round(s.factions[id] ?? 0)})`, (s.factions[id] ?? 0) >= min);
const kpiReq = (s: GameState, id: 'aprovacao' | 'coalizao', min: number, name: string) => req(`${name} ≥ ${min}% (hoje ${Math.round(s.kpis[id])}%)`, s.kpis[id] >= min);

/** Caminhos legais: passam por uma votação no Congresso e depois pelo voto popular. */
export function legalRoutes(s: GameState): RegimeRoute[] {
  if (!isDemocracy(s) && s.regime !== 'hibrido') return [];
  const out: RegimeRoute[] = [];
  if (isPresidential(s)) out.push({ to: 'parlamentarismo', via: 'plebiscito', reqs: [] });
  if (s.regime !== 'monarquia') out.push({ to: 'monarquia', via: 'plebiscito', reqs: [axisReq(s, 'valores', 1, 20, 'Tradicionalismo')] });
  if (isParliamentary(s)) out.push({ to: 'presidencialismo', via: 'plebiscito', reqs: [] });
  out.push({ to: 'tecnocracia', via: 'constituinte', reqs: [axisReq(s, 'tecnologia', 1, 40, 'Aceleração tecnológica'), kpiReq(s, 'aprovacao', 45, 'Aprovação')] });
  out.push({ to: 'teocracia', via: 'constituinte', reqs: [axisReq(s, 'cultura', 1, 50, 'Religioso'), factionReq(s, 'religiosos', 30, 'Bancada Evangélica')] });
  out.push({
    to: 'socialista',
    via: 'constituinte',
    reqs: [axisReq(s, 'economia', -1, 60, 'Economia planejada'), axisReq(s, 'propriedade', -1, 50, 'Propriedade pública'), kpiReq(s, 'aprovacao', 55, 'Aprovação')],
    risk: 'A via chilena: Allende tentou o socialismo pelo voto em 1970 e caiu num golpe em 1973. As Forças Armadas vão ficar de olho.',
  });
  return out;
}

/** Caminhos de ruptura: sem Congresso, numa única noite. */
export function ruptureRoutes(s: GameState): RegimeRoute[] {
  if (isAutocracy(s)) return [];
  const power = axisReq(s, 'poder', 1, 30, 'Autocrático');
  return [
    { to: 'militar', via: 'golpe', reqs: [power, factionReq(s, 'seguranca', 20, 'Bancada da Bala')] },
    { to: 'personalista', via: 'golpe', reqs: [axisReq(s, 'poder', 1, 50, 'Autocrático'), kpiReq(s, 'aprovacao', 40, 'Aprovação')] },
    { to: 'tecnocracia', via: 'golpe', reqs: [power, axisReq(s, 'tecnologia', 1, 40, 'Aceleração tecnológica')] },
    { to: 'socialista', via: 'revolucao', reqs: [axisReq(s, 'economia', -1, 40, 'Economia planejada'), axisReq(s, 'propriedade', -1, 30, 'Propriedade pública'), kpiReq(s, 'aprovacao', 40, 'Aprovação')] },
    { to: 'teocracia', via: 'revolucao', reqs: [axisReq(s, 'cultura', 1, 40, 'Religioso'), factionReq(s, 'religiosos', 20, 'Bancada Evangélica')] },
  ];
}

export const routeOpen = (r: RegimeRoute) => r.reqs.every((x) => x.ok);

/** A ruptura só é oferecida a quem já concentra poder. */
export function ruptureTempting(s: GameState): boolean {
  return !isAutocracy(s) && s.axes.poder >= 30 && ruptureRoutes(s).some(routeOpen);
}

/**
 * Plebiscito: % de "sim" para a mudança. Os brasileiros já rejeitaram o parlamentarismo em 1963
 * e 1993, e a monarquia teve 13% em 1993: a base de partida reflete isso.
 */
export function plebisciteYes(s: GameState, to: RegimeId, noise = 0): number {
  const a = s.kpis.aprovacao;
  const base: Partial<Record<RegimeId, number>> = { parlamentarismo: 34, monarquia: 14, presidencialismo: 52 };
  let yes = (base[to] ?? 40) + (a - 45) * 0.45 + (s.kpis.coalizao - 50) * 0.15 + noise;
  if (to === 'monarquia') yes += s.axes.valores * 0.25 + (s.factions.religiosos ?? 0) * 0.1;
  if (to === 'tecnocracia') yes += s.axes.tecnologia * 0.15 - 8;
  if (to === 'teocracia') yes += s.axes.cultura * 0.15 - 10;
  if (to === 'socialista') yes += -s.axes.economia * 0.1 - 6;
  return Math.round(clamp(yes, 3, 90) * 10) / 10;
}

/** Idade-limite do jogo em cada regime (nas autocracias, a morte chega antes ou depois). */
function ageCap(r: Regime, s: GameState): number {
  if (r.family === 'autocracia') return 78 + (hash(s.player.name) % 11);
  return 80;
}

function hash(t: string): number {
  let h = 2166136261;
  for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Até quando o jogo vai no regime em vigor: fim do último mandato permitido, ou a idade-limite. */
export function horizon(s: GameState): number {
  const r = regimeOf(s);
  if (isPresidential(s) && r.termLimit) return s.termMonths * (r.termLimit + (s.extraTerms ?? 0));
  const months = (ageCap(r, s) - s.startAge) * 12;
  return Math.max(s.month + 12, months);
}

/** Troca o regime: novas regras, tetos das instituições e horizonte do jogo. */
export function changeRegime(s: GameState, to: RegimeId, via: string): GameState {
  const r = getRegime(to);
  let next: GameState = {
    ...s,
    regime: to,
    regimeHistory: [...(s.regimeHistory ?? []), { month: s.month, regime: to, via }],
    institutions: capInstitutions(institutionsOf(s), r),
    crisisShield: Object.fromEntries(r.removal.map((k) => [k, s.month + 6])),
    warned: {},
  };
  if (isPresidential(next)) {
    // entra no calendário presidencial com pelo menos mais uma eleição pela frente
    const term = Math.floor((s.month - 1) / s.termMonths) + 1;
    next = { ...next, term, extraTerms: Math.max(next.extraTerms ?? 0, term - 1), electionsHeld: next.electionsHeld.filter((t) => t < term) };
  }
  if (isParliamentary(next)) next = { ...next, nextElection: s.month + 48 };
  return { ...next, totalMonths: horizon(next) };
}

/** A morte natural chega nas autocracias (não há aposentadoria para ditadores). */
export function diesNow(s: GameState): boolean {
  const r = regimeOf(s);
  return r.family === 'autocracia' && ageOf(s, s.month) >= ageCap(r, s) && s.month >= s.totalMonths;
}

// ---------- rótulos do regime ----------

const originals = new Map<string, { name: string; short: string }>();
const kpiOriginals = new Map<string, string>();

/**
 * Renomeia bancadas e indicadores para a lógica do regime (Partido, Junta, Conselho...).
 * Toda a interface que lê o país e os indicadores passa a mostrar os nomes novos.
 */
export function applyRegimeLabels(country: Country, regimeId: RegimeId | undefined) {
  const r = getRegime(regimeId);
  for (const f of country.factions) {
    if (!originals.has(f.id)) originals.set(f.id, { name: f.name, short: f.short });
    const o = originals.get(f.id)!;
    const l = r.factionLabels?.[f.id];
    f.name = l?.[0] ?? o.name;
    f.short = l?.[1] ?? o.short;
  }
  for (const k of KPIS) {
    if (!kpiOriginals.has(k.id)) kpiOriginals.set(k.id, k.label);
    k.label = r.kpiLabels?.[k.id as 'aprovacao' | 'coalizao'] ?? kpiOriginals.get(k.id)!;
  }
}

// ---------- legado ----------

export interface LegacyAxes {
  liberdade: number;
  prosperidade: number;
  igualdade: number;
  estabilidade: number;
  prestigio: number;
}

/** O radar do legado: nenhum regime vence em tudo. Valores de 0 a 100. */
export function legacyRadar(s: GameState, country: Country): LegacyAxes {
  const partners = country.partners ?? [];
  const rel = partners.length ? partners.reduce((n, p) => n + (s.relations?.[p.id] ?? 0), 0) / partners.length : 0;
  return {
    liberdade: Math.round(clamp(democracyIndex(s) * 0.75 + (s.axes.direitos + 100) * 0.125, 0, 100)),
    prosperidade: Math.round(economyScore(s)),
    igualdade: Math.round(clamp(50 - s.axes.economia * 0.2 - s.axes.propriedade * 0.1 + (s.kpis.educacao - 5) * 6 - (s.kpis.desemprego - 8) * 2, 0, 100)),
    estabilidade: Math.round(clamp(s.kpis.coalizao * 0.6 + s.kpis.aprovacao * 0.4, 0, 100)),
    prestigio: Math.round(clamp(50 + rel * 0.6, 0, 100)),
  };
}

// ---------- a noite da ruptura ----------

export type RuptureActor = 'generais' | 'congresso' | 'stf' | 'governadores' | 'exterior' | 'rua' | 'clero' | 'mercado' | 'movimentos';

export const RUPTURE_ACTORS: Record<RuptureActor, { label: string; icon: string; sprite: string }> = {
  generais: { label: 'Alto Comando', icon: '🪖', sprite: 'general' },
  congresso: { label: 'Presidente da Câmara', icon: '🏛️', sprite: 'deputado' },
  stf: { label: 'Presidente do STF', icon: '⚖️', sprite: 'ministro' },
  governadores: { label: 'Governadores', icon: '🗺️', sprite: 'deputada' },
  exterior: { label: 'Embaixadas', icon: '🌍', sprite: 'empresario' },
  rua: { label: 'A rua', icon: '📣', sprite: 'manifestante' },
  clero: { label: 'Líderes religiosos', icon: '🙏', sprite: 'pastor' },
  mercado: { label: 'Mercado e big techs', icon: '💹', sprite: 'empresario' },
  movimentos: { label: 'Sindicatos e movimentos', icon: '✊', sprite: 'manifestante2' },
};

export interface RuptureSetup {
  mode: 'golpe' | 'revolucao';
  target: RegimeId;
  actors: { id: RuptureActor; weight: number; stance: number }[];
  /** Apoio ponderado necessário ao amanhecer: instituições fortes resistem mais. */
  threshold: number;
}

const WEIGHTS: Partial<Record<RegimeId, Partial<Record<RuptureActor, number>>>> = {
  militar: { generais: 0.4, congresso: 0.1, stf: 0.1, governadores: 0.15, exterior: 0.1, rua: 0.15 },
  personalista: { generais: 0.3, rua: 0.3, congresso: 0.1, stf: 0.1, governadores: 0.1, exterior: 0.1 },
  tecnocracia: { generais: 0.25, mercado: 0.3, congresso: 0.1, stf: 0.1, exterior: 0.1, rua: 0.15 },
  socialista: { movimentos: 0.3, rua: 0.25, generais: 0.25, congresso: 0.05, stf: 0.05, exterior: 0.1 },
  teocracia: { clero: 0.3, rua: 0.25, generais: 0.25, congresso: 0.05, stf: 0.05, exterior: 0.1 },
};

/** Quem decide a noite, com que peso, e de que lado cada um começa (-100 a +100). */
export function ruptureSetup(s: GameState, target: RegimeId): RuptureSetup {
  const inst = institutionsOf(s);
  const a = s.kpis.aprovacao;
  const rel = (ids: string[]) => ids.reduce((n, id) => n + (s.relations?.[id] ?? 0), 0) / ids.length;
  const stance: Record<RuptureActor, number> = {
    generais: (s.factions.seguranca ?? 0) + (s.axes.poder - 30) * 0.3,
    congresso: (s.kpis.coalizao - 50) * 1.2 - (inst.congresso - 50) * 0.8,
    stf: 20 - inst.stf,
    governadores: (a - 50) * 1.2 - 10,
    exterior: target === 'socialista' ? rel(['china', 'russia']) * 0.8 - 20 : target === 'teocracia' ? rel(['eua', 'ue']) * 0.5 - 30 : rel(['eua', 'ue']) - 15,
    rua: (a - 50) * 1.5 + (target === 'socialista' ? -s.axes.economia * 0.3 : 0),
    clero: (s.factions.religiosos ?? 0) + s.axes.cultura * 0.3,
    mercado: (s.factions.tecnologica ?? 0) * 0.7 + (economyScore(s) - 50) * 0.5,
    movimentos: -s.axes.economia * 0.6 + (a - 40) * 0.5,
  };
  const w = WEIGHTS[target] ?? WEIGHTS.militar!;
  return {
    mode: target === 'socialista' || target === 'teocracia' ? 'revolucao' : 'golpe',
    target,
    actors: (Object.entries(w) as [RuptureActor, number][]).map(([id, weight]) => ({ id, weight, stance: Math.round(clamp(stance[id], -100, 100)) })),
    threshold: Math.round(10 + (democracyIndex(s) - 50) * 0.3),
  };
}

/** Apoio ponderado de -100 a +100. */
export function ruptureSupport(actors: { weight: number; stance: number }[]): number {
  return Math.round(actors.reduce((n, x) => n + x.weight * x.stance, 0));
}

/** O briefing extra que o Claude recebe para escrever a noite. */
export function ruptureBrief(setup: RuptureSetup): string {
  const r = getRegime(setup.target);
  return `A NOITE DA RUPTURA: ${setup.mode === 'golpe' ? 'um golpe' : 'uma revolução'} para transformar o Brasil em ${r.name}.
Atores desta noite, na ordem (id: quem é, peso no desfecho, posição inicial de -100 contra a +100 a favor):
${setup.actors.map((x) => `- ${x.id}: ${RUPTURE_ACTORS[x.id].label}, peso ${Math.round(x.weight * 100)}%, posição ${x.stance}`).join('\n')}`;
}

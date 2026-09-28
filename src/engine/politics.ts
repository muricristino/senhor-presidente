import { ageOf, electionMonth } from './calendar';
import { democracyIndex, economyScore, institutionsOf, isParliamentary, isPresidential, regimeOf, threats } from './regime';
import type { Country, CrisisKind, Cutscene, Effects, Ending, GameState } from './types';

export { economyScore } from './regime';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Ruído determinístico por presidente e mês: a mesma partida dá sempre o mesmo resultado. */
function noise(state: GameState, salt: number, amplitude: number): number {
  let h = salt * 2654435761;
  for (const ch of state.player.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ state.month, 2246822519) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 2 * amplitude;
}

// ---------- eleição ----------

/** Quantos mandatos seguidos o regime permite agora (a PEC da reeleição soma mais um). */
export function maxTerms(state: GameState, country: Country): number {
  const limit = regimeOf(state).termLimit;
  return (limit ?? country.calendar.max_terms) + (state.extraTerms ?? 0);
}

/** Este é o último mandato permitido: não há mais reeleição. */
export function lastTerm(state: GameState, country: Country): boolean {
  return isPresidential(state) && state.term >= maxTerms(state, country);
}

/** Mês da próxima eleição do governante, ou null se o regime não tem eleição para o cargo. */
export function nextElectionMonth(state: GameState, country: Country): number | null {
  if (isPresidential(state)) return lastTerm(state, country) ? null : electionMonth(state, state.term, country.calendar.election_month);
  if (isParliamentary(state)) return state.nextElection ?? state.month + 48;
  return null;
}

export function electionDue(state: GameState, country: Country): boolean {
  if (isPresidential(state) && state.electionsHeld.includes(state.term)) return false;
  const m = nextElectionMonth(state, country);
  return m !== null && state.month >= m;
}

export interface ElectionResult {
  firstRound: number;
  runoff: number | null;
  won: boolean;
}

export function electionResult(state: GameState): ElectionResult {
  const inst = institutionsOf(state);
  // No parlamentarismo o voto é para o Parlamento: a maioria pesa mais que a figura do premiê.
  let base = isParliamentary(state)
    ? 0.45 * state.kpis.aprovacao + 0.2 * economyScore(state) + 0.35 * state.kpis.coalizao
    : 0.6 * state.kpis.aprovacao + 0.25 * economyScore(state) + 0.15 * state.kpis.coalizao;
  // Eleição controlada: tribunal eleitoral aliado e imprensa acuada dão votos que a urna não daria.
  if (regimeOf(state).elections === 'controladas' || inst.eleicoes < 60) base += Math.max(0, 80 - inst.eleicoes) * 0.3 + Math.max(0, 60 - inst.imprensa) * 0.1;
  const firstRound = Math.round(clamp(base - 5 + noise(state, 1, 3), 3, 80) * 10) / 10;
  if (firstRound >= 50) return { firstRound, runoff: null, won: true };
  if (firstRound < 25) return { firstRound, runoff: null, won: false };
  const runoff = Math.round(clamp(50 + (base - 47) * 1.3 + noise(state, 2, 3), 20, 80) * 10) / 10;
  return { firstRound, runoff, won: runoff >= 50 };
}

export function electionCutscene(state: GameState, r: ElectionResult): Cutscene {
  const final = r.runoff ?? r.firstRound;
  const steps: Cutscene['timeline'] = [
    { t: 0.3, do: 'enter_left', actor: 'reporter', dur: 0.8 },
    { t: 1.1, do: 'say', actor: 'reporter', text: `1º turno: ${r.firstRound.toFixed(1).replace('.', ',')}%`, dur: 1.6 },
  ];
  if (r.runoff !== null) steps.push({ t: 2.8, do: 'say', actor: 'reporter', text: `2º turno: ${r.runoff.toFixed(1).replace('.', ',')}%`, dur: 1.6 });
  const end = r.runoff !== null ? 4.6 : 3;
  steps.push(
    { t: end, do: 'enter_right', actor: 'presidente', dur: 0.8 },
    { t: end + 0.9, do: r.won ? 'jump' : 'shake', actor: 'presidente', dur: 0.8 },
    { t: end + 1, do: 'say', actor: 'presidente', text: r.won ? 'MAIS QUATRO ANOS!' : 'O povo decidiu...', dur: 2 },
  );
  if (r.won) steps.push({ t: end + 1, do: 'rain', sprite: 'confete', dur: 3 }, { t: end + 1.2, do: 'flash' });
  return {
    backdrop: 'tv',
    actors: [
      { id: 'reporter', sprite: 'jornalista', x: 60, y: 100, hidden: true },
      { id: 'presidente', sprite: 'presidente', x: 132, y: 100, hidden: true, flip: true },
    ],
    timeline: steps,
    caption: r.won
      ? `TSE: ${state.player.name} é reeleito com ${final.toFixed(1).replace('.', ',')}% dos votos válidos`
      : `TSE: ${state.player.name} é derrotado com ${final.toFixed(1).replace('.', ',')}% dos votos válidos`,
  };
}

// ---------- impeachment ----------

export function impeachmentDue(state: GameState): boolean {
  return crisisDue(state) === 'impeachment';
}

/** A crise terminal que explodiu agora (ameaça no máximo e fora do escudo), se houver. */
export function crisisDue(state: GameState): CrisisKind | null {
  const t = threats(state);
  for (const [kind, level] of Object.entries(t) as [CrisisKind, number][]) {
    const shield = kind === 'impeachment' ? Math.max(state.impeachmentShieldUntil, state.crisisShield?.impeachment ?? 0) : state.crisisShield?.[kind] ?? 0;
    if (level >= 100 && state.month >= shield) return kind;
  }
  return null;
}

export interface ImpeachmentVote {
  yes: number;
  no: number;
  needed: number;
  passed: boolean;
}

/** Votos pelo afastamento na Câmara: a coalizão pesa mais que a rua. */
export function impeachmentVote(state: GameState, country: Country): ImpeachmentVote {
  const { seats, impeachment_votes: needed } = country.chamber;
  const support = 0.65 * state.kpis.coalizao + 0.35 * state.kpis.aprovacao;
  // Congresso capturado não afasta o governante: os votos de oposição encolhem com a independência.
  const independence = state.regime === 'hibrido' ? Math.min(1, institutionsOf(state).congresso / 75) : 1;
  const yes = Math.round(clamp(seats * clamp(1.05 - support / 55, 0.05, 0.97) * independence + noise(state, 3, 15), 0, seats - 5));
  const no = seats - yes - Math.round(clamp(8 + noise(state, 4, 6), 2, 20));
  return { yes, no, needed, passed: yes >= needed };
}

export function impeachmentCutscene(v: ImpeachmentVote, kind: 'impeachment' | 'desconfianca' = 'impeachment'): Cutscene {
  return {
    backdrop: 'camara',
    actors: [
      { id: 'sim', sprite: 'deputado', x: 14, y: 106, count: 5, spacing: 16 },
      { id: 'nao', sprite: 'deputada', x: 114, y: 106, count: 5, spacing: 16 },
      { id: 'mesa', sprite: 'deputado', x: 96, y: 92, holding: 'martelo' },
    ],
    timeline: [
      { t: 0.4, do: 'jump', actor: 'sim' },
      { t: 0.5, do: 'say', actor: 'sim', text: 'SIM!', dur: 1 },
      { t: 1.2, do: 'jump', actor: 'nao' },
      { t: 1.3, do: 'say', actor: 'nao', text: 'NÃO!', dur: 1 },
      { t: 2.2, do: 'say', actor: 'mesa', text: `SIM ${v.yes} × NÃO ${v.no}`, dur: 2.2 },
      { t: 4, do: 'slam', actor: 'mesa' },
      { t: 4.2, do: v.passed ? 'jump' : 'shake', actor: 'sim', dur: 1 },
      { t: 4.2, do: v.passed ? 'shake' : 'jump', actor: 'nao', dur: 1 },
      { t: 4.4, do: 'say', actor: 'mesa', text: v.passed ? (kind === 'desconfianca' ? 'O GOVERNO CAIU!' : 'AUTORIZADO!') : 'ARQUIVADO!', dur: 2 },
    ],
    caption:
      kind === 'desconfianca'
        ? v.passed
          ? `Moção de desconfiança aprovada: ${v.yes} votos (eram necessários ${v.needed}). O governo cai.`
          : `Moção rejeitada: ${v.yes} votos contra o governo, faltaram ${v.needed - v.yes}. O governo fica.`
        : v.passed
          ? `Câmara autoriza o impeachment: ${v.yes} votos (eram necessários ${v.needed}). O Senado afasta o presidente.`
          : `Impeachment barrado: ${v.yes} votos a favor, faltaram ${v.needed - v.yes}. O presidente sobrevive.`,
  };
}

export function presidentAge(state: GameState): number {
  return ageOf(state, state.month);
}

// ---------- crises terminais: como cada saída termina ----------

/** As saídas de cada crise. O Claude escreve as opções; o papel de cada uma decide a mecânica. */
export const CRISIS_ROLES: Record<CrisisKind, { id: string; hint: string }[]> = {
  impeachment: [
    { id: 'negociar', hint: 'comprar votos na Câmara com cargos e emendas' },
    { id: 'opiniao', hint: 'falar ao país e virar a opinião pública' },
    { id: 'ruas', hint: 'convocar a base às ruas para pressionar os deputados' },
    { id: 'renunciar', hint: 'renunciar antes da votação' },
  ],
  desconfianca: [
    { id: 'negociar', hint: 'recompor a maioria com cargos e concessões aos partidos' },
    { id: 'opiniao', hint: 'discurso no Parlamento pedindo confiança' },
    { id: 'dissolver', hint: 'dissolver o Parlamento e antecipar as eleições' },
    { id: 'renunciar', hint: 'renunciar e deixar a maioria escolher outro chefe de governo' },
  ],
  revolta: [
    { id: 'reprimir', hint: 'mandar a polícia e as tropas limparem as ruas' },
    { id: 'ceder', hint: 'atender as exigências da rua, custe o que custar' },
    { id: 'dialogar', hint: 'abrir negociação com os líderes do movimento' },
    { id: 'renunciar', hint: 'deixar o palácio e sair do país' },
  ],
  golpe_contra: [
    { id: 'resistir', hint: 'resistir com as tropas leais e as instituições' },
    { id: 'negociar', hint: 'ceder poder aos militares para ficar no cargo' },
    { id: 'povo', hint: 'chamar o povo às ruas para defender o governo' },
    { id: 'renunciar', hint: 'aceitar a saída e partir para o exílio' },
  ],
  expurgo: [
    { id: 'negociar', hint: 'dividir o poder com a facção rival do partido' },
    { id: 'expurgar', hint: 'atacar primeiro: prender os conspiradores' },
    { id: 'autocritica', hint: 'fazer autocrítica pública e mudar o rumo' },
    { id: 'renunciar', hint: 'deixar o cargo em troca de uma aposentadoria tranquila' },
  ],
  destituicao: [
    { id: 'negociar', hint: 'fazer concessões ao conselho' },
    { id: 'expurgar', hint: 'dissolver o conselho e nomear leais' },
    { id: 'autocritica', hint: 'reconhecer os erros e entregar metas novas' },
    { id: 'renunciar', hint: 'deixar o cargo de forma negociada' },
  ],
};

/** Como a crise termina se o governante perde ou sai. */
export const CRISIS_ENDING: Record<CrisisKind, { lose: Ending; quit: Ending }> = {
  impeachment: { lose: 'impeachment', quit: 'renuncia' },
  desconfianca: { lose: 'desconfianca', quit: 'renuncia' },
  revolta: { lose: 'queda', quit: 'exilio' },
  golpe_contra: { lose: 'deposto', quit: 'exilio' },
  expurgo: { lose: 'expurgo', quit: 'renuncia' },
  destituicao: { lose: 'destituido', quit: 'renuncia' },
};

/** Força da saída escolhida (positivo favorece o governante). Impeachment e moção são decididos no voto. */
function crisisScore(kind: CrisisKind, role: string, s: GameState): number {
  const a = s.kpis.aprovacao;
  const c = s.kpis.coalizao;
  const dem = democracyIndex(s);
  const seg = s.factions.seguranca ?? 0;
  const auto = regimeOf(s).family === 'autocracia';
  const pillar = regimeOf(s).pillar ? s.factions[regimeOf(s).pillar!.faction] ?? 0 : 0;
  switch (`${kind}:${role}`) {
    case 'revolta:reprimir':
      return seg * 0.5 + (auto ? 15 : -10) - (dem - 40) * 0.3;
    case 'revolta:ceder':
      return (a - 22) * 1.2 + (economyScore(s) - 40) * 0.2;
    case 'revolta:dialogar':
      return (a - 25) + (dem - 50) * 0.2;
    case 'golpe_contra:resistir':
      return (dem - 45) * 0.6 + (a - 35) * 0.4 + seg * 0.2;
    case 'golpe_contra:negociar':
      return 8 + seg * 0.3;
    case 'golpe_contra:povo':
      return (a - 40) * 0.8 + (dem - 50) * 0.2;
    case 'expurgo:negociar':
    case 'destituicao:negociar':
      return pillar * 0.4 + (c - 35) * 0.5;
    case 'expurgo:expurgar':
    case 'destituicao:expurgar':
      return seg * 0.5 + 5 - Math.max(0, 30 - c);
    case 'expurgo:autocritica':
    case 'destituicao:autocritica':
      return (c - 30) * 0.6 + (a - 35) * 0.3;
    default:
      // ficar parado numa crise terminal quase nunca salva ninguém
      return -15;
  }
}

/** Chance (0 a 1) de o governante sobreviver com esta saída, para a conselheira avisar antes. */
export function crisisOdds(kind: CrisisKind, role: string, s: GameState, country: Country): number {
  if (role === 'renunciar') return 0;
  if (kind === 'impeachment') {
    const v = impeachmentVote(s, country);
    return clamp(0.5 + (v.needed - v.yes) / 60, 0.03, 0.97);
  }
  if (kind === 'desconfianca') {
    const v = confidenceVote(s, country);
    return role === 'dissolver' ? 1 : clamp(0.5 + (v.needed - v.yes) / 60, 0.03, 0.97);
  }
  return clamp(1 / (1 + Math.exp(-crisisScore(kind, role, s) / 8)), 0.03, 0.97);
}

export const oddsLabel = (p: number) => (p >= 0.7 ? 'alta' : p >= 0.4 ? 'média' : p > 0.03 ? 'baixa' : 'nenhuma');

/** Moção de desconfiança: quantos deputados votam para derrubar o governo (maioria absoluta derruba). */
export function confidenceVote(state: GameState, country: Country): ImpeachmentVote {
  const { seats } = country.chamber;
  const needed = Math.floor(seats / 2) + 1;
  const support = 0.8 * state.kpis.coalizao + 0.2 * state.kpis.aprovacao;
  const yes = Math.round(clamp(seats * clamp(1.02 - support / 70, 0.05, 0.95) + noise(state, 5, 15), 0, seats - 5));
  const no = seats - yes - Math.round(clamp(6 + noise(state, 6, 4), 2, 12));
  return { yes, no, needed, passed: yes >= needed };
}

export interface CrisisOutcome {
  survived: boolean;
  ending?: Ending;
  /** Efeitos da saída escolhida, além dos que a opção já trouxe. */
  effects: Effects;
  vote?: ImpeachmentVote;
  /** Moção de desconfiança respondida com dissolução: eleição agora. */
  earlyElection?: boolean;
}

/** Resolve a crise com o estado já depois dos efeitos da opção escolhida. */
export function resolveCrisis(kind: CrisisKind, role: string, s: GameState, country: Country): CrisisOutcome {
  const ends = CRISIS_ENDING[kind];
  if (role === 'renunciar') return { survived: false, ending: ends.quit, effects: {} };
  if (kind === 'impeachment') {
    const vote = impeachmentVote(s, country);
    return { survived: !vote.passed, ending: vote.passed ? ends.lose : undefined, vote, effects: vote.passed ? {} : { kpis: { coalizao: 6, aprovacao: 3 } } };
  }
  if (kind === 'desconfianca') {
    if (role === 'dissolver') return { survived: true, earlyElection: true, effects: {} };
    const vote = confidenceVote(s, country);
    return { survived: !vote.passed, ending: vote.passed ? ends.lose : undefined, vote, effects: vote.passed ? {} : { kpis: { coalizao: 5 } } };
  }
  const roll = (noise(s, 11 + kind.length, 0.5) + 0.5);
  const survived = roll < crisisOdds(kind, role, s, country);
  if (!survived) return { survived, ending: ends.lose, effects: {} };
  // Sobreviver também tem preço, e ele depende de como se sobreviveu.
  const cost: Record<string, Effects> = {
    'revolta:reprimir': { kpis: { aprovacao: -6 }, axes: { direitos: -15, poder: 10 }, institutions: { imprensa: -8 }, relations: { eua: -10, ue: -15 } },
    'revolta:ceder': { kpis: { inflacao: 0.8, aprovacao: 8 }, axes: { economia: -8 } },
    'revolta:dialogar': { kpis: { aprovacao: 5, coalizao: -4 } },
    'golpe_contra:resistir': { kpis: { aprovacao: 6 }, factions: { seguranca: -10 }, institutions: { congresso: 5, stf: 5 } },
    'golpe_contra:negociar': { factions: { seguranca: 30 }, axes: { poder: 10, defesa: -10 }, institutions: { congresso: -8 } },
    'golpe_contra:povo': { kpis: { aprovacao: 4 }, axes: { poder: 6 }, factions: { seguranca: 10 } },
    'expurgo:expurgar': { factions: { seguranca: 5 }, kpis: { coalizao: 10 }, axes: { poder: 10, direitos: -10 }, relations: { ue: -8 } },
    'destituicao:expurgar': { kpis: { coalizao: 10 }, axes: { poder: 10 } },
  };
  const pillar = regimeOf(s).pillar?.faction;
  const generic: Effects = pillar ? { factions: { [pillar]: 20 }, kpis: { coalizao: 8 } } : { kpis: { coalizao: 6 } };
  return { survived, effects: cost[`${kind}:${role}`] ?? generic };
}

/** O que o Claude precisa saber para escrever cada crise terminal. */
export function crisisSituation(kind: CrisisKind, s: GameState, country: Country): string {
  const r = regimeOf(s);
  switch (kind) {
    case 'impeachment':
      return `A Câmara aceitou um pedido de impeachment por crime de responsabilidade. A votação no plenário é em poucos dias: são necessários ${country.chamber.impeachment_votes} dos ${country.chamber.seats} deputados para o processo seguir ao Senado.`;
    case 'desconfianca':
      return `A oposição apresentou uma moção de desconfiança no Parlamento. Se a maioria absoluta (${Math.floor(country.chamber.seats / 2) + 1} de ${country.chamber.seats}) votar a favor, o governo cai.`;
    case 'revolta':
      return `Revolta popular: multidões tomam as ruas das capitais e cercam o palácio. Inflação de ${s.kpis.inflacao.toFixed(1)}%, desemprego de ${s.kpis.desemprego.toFixed(1)}%, aprovação de ${Math.round(s.kpis.aprovacao)}%.`;
    case 'golpe_contra':
      return `Tanques nas ruas: parte das Forças Armadas se levanta contra o ${r.headTitle.toLowerCase()} e exige a sua saída em horas.`;
    case 'expurgo':
      return 'Uma facção do Comitê Central convocou uma reunião extraordinária para destituir o Secretário-Geral e expurgá-lo do partido.';
    case 'destituicao':
      return `${r.pillar?.label ?? 'O conselho'} se reuniu a portas fechadas para votar a destituição do ${r.headTitle.toLowerCase()}.`;
  }
}

/** A reta final da eleição: as saídas que o jogo sabe resolver. */
export const CAMPAIGN_ROLES = [
  { id: 'maquina', hint: 'usar a máquina pública: obras, inaugurações e anúncios com o governo (funciona, mas o tribunal eleitoral pode cassar a chapa)' },
  { id: 'propostas', hint: 'campanha de propostas e debates, falando com o eleitor indeciso' },
  { id: 'bondades', hint: 'benefícios e bondades de véspera, com custo nas contas' },
  { id: 'ataque', hint: 'campanha negativa contra o adversário' },
];

export function campaignSituation(s: GameState): string {
  return isParliamentary(s)
    ? `Reta final da eleição para o Parlamento. Se o partido do primeiro-ministro perder a maioria, ele deixa o cargo. Aprovação: ${Math.round(s.kpis.aprovacao)}%.`
    : `Reta final da campanha: faltam três semanas para o primeiro turno e o ${regimeOf(s).headTitle.toLowerCase()} tenta continuar no cargo. Aprovação: ${Math.round(s.kpis.aprovacao)}%.${s.regime === 'hibrido' ? ' O regime controla boa parte das regras da eleição.' : ''}`;
}

/** Com a chapa acusada de abuso de poder, o tribunal eleitoral independente pode cassá-la. */
export function cassationRisk(s: GameState): number {
  if (!s.campaignAbuse) return 0;
  return clamp((institutionsOf(s).eleicoes - 50) / 60, 0, 0.7);
}

export function cassated(s: GameState): boolean {
  return noise(s, 21, 0.5) + 0.5 < cassationRisk(s);
}

/** Plebiscito da continuidade de uma autocracia (o Chile de 1988): a propaganda ajuda, mas não decide. */
export function continuityYes(s: GameState): number {
  const inst = institutionsOf(s);
  return Math.round(clamp(18 + s.kpis.aprovacao * 0.55 + (60 - inst.imprensa) * 0.15 + noise(s, 23, 3), 5, 85) * 10) / 10;
}

export function plebisciteNoise(s: GameState): number {
  return noise(s, 25, 4);
}

/** O STF independente derruba lei que fere cláusula pétrea (voto periódico, separação de Poderes). */
export function stfStrikes(s: GameState, special: string | undefined): boolean {
  if (!special || !['reeleicao', 'eleicoes', 'stf'].includes(special)) return false;
  const chance = clamp((institutionsOf(s).stf - 45) / 50, 0, 0.8);
  return noise(s, 27, 0.5) + 0.5 < chance;
}

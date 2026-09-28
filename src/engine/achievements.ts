import { democracyIndex } from './regime';
import type { Country, CrisisKind, Ending, GameState, RegimeId } from './types';

/** Fatos da partida que o estado sozinho não guarda. */
export interface Milestones {
  survivedImpeachment?: boolean;
  reelected?: boolean;
  ending?: Ending;
  /** Regimes por onde o país passou nesta partida. */
  regimes?: RegimeId[];
  /** Crises terminais superadas. */
  survived?: CrisisKind[];
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
  check: (s: GameState, m: Milestones, c: Country) => boolean;
}

const count = (s: GameState, fn: (d: string) => boolean) => s.decisions.filter(fn).length;
const liminares = (s: GameState) => s.history.filter((h) => h.stf).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'primeira_caneta', icon: '🖋️', name: 'Primeira canetada', desc: 'Assinou o primeiro decreto do mandato.', check: (s) => s.history.length >= 1 },
  { id: 'barrado', icon: '⚖️', name: 'Barrado pelo Supremo', desc: 'Teve uma decisão suspensa pelo STF.', check: (s) => liminares(s) >= 1 },
  { id: 'fregues_stf', icon: '🔨', name: 'Freguês do STF', desc: 'Levou 3 liminares do Supremo.', check: (s) => liminares(s) >= 3 },
  { id: 'sobrevivente', icon: '🛡️', name: 'Sobrevivente', desc: 'Escapou de um impeachment na Câmara.', check: (_s, m) => !!m.survivedImpeachment },
  { id: 'reeleito', icon: '🗳️', name: 'Mais quatro anos', desc: 'Foi reeleito presidente.', check: (_s, m) => !!m.reelected },
  { id: 'reeleito_crise', icon: '🌪️', name: 'Reeleito na tormenta', desc: 'Reeleito com inflação acima de 6% ou desemprego acima de 10%.', check: (s, m) => !!m.reelected && (s.kpis.inflacao >= 6 || s.kpis.desemprego >= 10) },
  { id: 'oito_anos', icon: '🏁', name: 'Oito anos de Planalto', desc: 'Completou os dois mandatos.', check: (_s, m) => m.ending === 'fim' },
  { id: 'afastado', icon: '📜', name: 'Afastado', desc: 'Sofreu impeachment.', check: (_s, m) => m.ending === 'impeachment' },
  { id: 'renuncia', icon: '🚪', name: 'Saída à francesa', desc: 'Renunciou antes da votação.', check: (_s, m) => m.ending === 'renuncia' },
  { id: 'derrotado', icon: '🥈', name: 'Voto é soberano', desc: 'Perdeu a reeleição nas urnas.', check: (_s, m) => m.ending === 'derrota' },
  { id: 'pop_star', icon: '🌟', name: 'Pop star', desc: 'Chegou a 75% de aprovação.', check: (s) => s.kpis.aprovacao >= 75 },
  { id: 'rejeicao', icon: '🥶', name: 'Rejeição recorde', desc: 'Caiu para 15% de aprovação e continuou no cargo.', check: (s) => s.kpis.aprovacao <= 15 },
  { id: 'amigo_centrao', icon: '🤝', name: 'Amigo do Centrão', desc: 'Centrão com humor acima de +60.', check: (s) => (s.factions.centrao ?? 0) >= 60 },
  { id: 'isolado', icon: '🏝️', name: 'Ilha em Brasília', desc: 'Todas as bancadas contra você ao mesmo tempo.', check: (s, _m, c) => c.factions.every((f) => (s.factions[f.id] ?? 0) <= -20) },
  { id: 'diplomata', icon: '🌍', name: 'Diplomata', desc: 'Boas relações (+30) com todos os parceiros.', check: (s, _m, c) => (c.partners ?? []).every((p) => (s.relations?.[p.id] ?? 0) >= 30) },
  { id: 'paria', icon: '🚫', name: 'Pária internacional', desc: 'Relação hostil (-40) com 3 parceiros.', check: (s, _m, c) => (c.partners ?? []).filter((p) => (s.relations?.[p.id] ?? 0) <= -40).length >= 3 },
  { id: 'radical', icon: '🧨', name: 'Radical', desc: 'Levou um eixo ideológico a 80 ou mais.', check: (s) => Object.values(s.axes).some((v) => Math.abs(v) >= 80) },
  { id: 'muro', icon: '🧱', name: 'Em cima do muro', desc: 'Um ano de governo sem sair do centro em nenhum eixo.', check: (s) => s.month >= 13 && Object.values(s.axes).every((v) => Math.abs(v) <= 15) },
  { id: 'autoritario', icon: '👑', name: 'Tentação autoritária', desc: 'Eixo Poder acima de +70.', check: (s) => s.axes.poder >= 70 },
  { id: 'guardiao', icon: '🕊️', name: 'Guardião da democracia', desc: 'Eixo Poder abaixo de -50.', check: (s) => s.axes.poder <= -50 },
  { id: 'coletivas', icon: '🎤', name: 'Encarou a imprensa', desc: 'Deu 3 coletivas.', check: (s) => count(s, (d) => d.endsWith(':coletiva') || d.startsWith('CENA_coletiva')) >= 3 },
  { id: 'fantasma', icon: '👻', name: 'Presidente fantasma', desc: 'Deixou 3 decisões sem resposta.', check: (s) => count(s, (d) => d.endsWith(':omissao') || d.endsWith(':arquivado')) >= 3 },
  { id: 'milagre', icon: '📈', name: 'Milagre econômico', desc: 'Desemprego até 5% e inflação até 3% ao mesmo tempo.', check: (s) => s.kpis.desemprego <= 5 && s.kpis.inflacao <= 3 },
  { id: 'paz', icon: '🚓', name: 'Paz nas ruas', desc: 'Segurança 9 ou mais.', check: (s) => s.kpis.seguranca >= 9 },
  // regimes
  { id: 'terceiro_mandato', icon: '♾️', name: 'Mais um, só mais um', desc: 'Aprovou uma PEC da reeleição.', check: (s) => (s.extraTerms ?? 0) >= 1 },
  { id: 'fachada', icon: '🎭', name: 'Democracia de fachada', desc: 'O Brasil virou um regime híbrido sem nenhum golpe.', check: (s) => s.regime === 'hibrido' },
  { id: 'freios', icon: '🛡️', name: 'Freios e contrapesos', desc: 'Índice de democracia 90 ou mais.', check: (s) => democracyIndex(s) >= 90 },
  { id: 'fechada', icon: '🔒', name: 'Autocracia fechada', desc: 'Índice de democracia abaixo de 25.', check: (s) => democracyIndex(s) < 25 },
  { id: 'golpista', icon: '🌒', name: 'A noite mais longa', desc: 'Deu um golpe e acordou no poder.', check: (s) => s.decisions.some((d) => /^CENA_ruptura_\d+:sucesso$/.test(d)) },
  { id: 'recuo', icon: '↩️', name: 'Seis horas', desc: 'Recuou de uma ruptura no meio da noite.', check: (s) => s.decisions.some((d) => /^CENA_ruptura_\d+:recuo$/.test(d)) },
  { id: 'revolucionario', icon: '✊', name: 'Revolucionário', desc: 'Mudou o regime por uma revolução.', check: (s) => (s.regimeHistory ?? []).some((h) => h.via === 'revolução') },
  { id: 'coroa', icon: '👑', name: 'Viva o rei!', desc: 'O Brasil voltou a ser monarquia.', check: (s) => s.regime === 'monarquia' },
  { id: 'parlamento', icon: '🗳️', name: 'Primeiro-ministro', desc: 'O Brasil adotou o parlamentarismo.', check: (s) => s.regime === 'parlamentarismo' },
  { id: 'algoritmo', icon: '🤖', name: 'Governo por planilha', desc: 'Instaurou uma tecnocracia.', check: (s) => s.regime === 'tecnocracia' },
  { id: 'partido', icon: '☭', name: 'Camarada Secretário', desc: 'Instaurou o socialismo de partido único.', check: (s) => s.regime === 'socialista' },
  { id: 'teocrata', icon: '🕌', name: 'Líder Supremo', desc: 'Instaurou uma teocracia.', check: (s) => s.regime === 'teocracia' },
  { id: 'junta', icon: '🪖', name: 'Chefe da Junta', desc: 'Governou numa ditadura militar.', check: (s) => s.regime === 'militar' },
  { id: 'sobreviveu_golpe', icon: '🏰', name: 'O palácio resistiu', desc: 'Sobreviveu a um golpe contra você.', check: (_s, m) => !!m.survived?.includes('golpe_contra') },
  { id: 'preso', icon: '⛓️', name: 'Tentativa de golpe', desc: 'Tentou a ruptura, fracassou e foi preso.', check: (_s, m) => m.ending === 'preso' },
  { id: 'exilio', icon: '✈️', name: 'Voo de madrugada', desc: 'Terminou no exílio.', check: (_s, m) => m.ending === 'exilio' },
  { id: 'deposto', icon: '🎖️', name: 'Deposto', desc: 'Caiu num golpe militar.', check: (_s, m) => m.ending === 'deposto' },
  { id: 'cassado', icon: '🚫', name: 'Ganhou mas não levou', desc: 'Teve a chapa cassada pelo TSE.', check: (_s, m) => m.ending === 'cassado' },
  { id: 'abertura', icon: '🕊️', name: 'Abertura', desc: 'Perdeu o próprio plebiscito e devolveu a democracia.', check: (_s, m) => m.ending === 'abertura' },
  { id: 'eterno', icon: '🕯️', name: 'Até o último dia', desc: 'Morreu no poder.', check: (_s, m) => m.ending === 'morte' },
];

const KEY = 'sp.achievements.v1';

export type Unlocked = Record<string, { at: number; president: string }>;

export function loadUnlocked(): Unlocked {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Unlocked;
  } catch {
    return {};
  }
}

/** Confere as conquistas; devolve as que foram ganhas agora nesta partida e grava na galeria. */
export function checkAchievements(state: GameState, m: Milestones, country: Country): Achievement[] {
  const have = new Set(state.trophies ?? []);
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(state, m, country));
  if (fresh.length) {
    const all = loadUnlocked();
    for (const a of fresh) all[a.id] ??= { at: Date.now(), president: state.player.name };
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* sem armazenamento: a conquista vale só nesta partida */
    }
  }
  return fresh;
}

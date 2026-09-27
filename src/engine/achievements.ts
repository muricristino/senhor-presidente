import type { Country, GameState } from './types';

/** Fatos da partida que o estado sozinho não guarda. */
export interface Milestones {
  survivedImpeachment?: boolean;
  reelected?: boolean;
  ending?: 'impeachment' | 'derrota' | 'renuncia' | 'fim' | 'pausa';
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
  { id: 'coletivas', icon: '🎤', name: 'Encarou a imprensa', desc: 'Deu 3 coletivas.', check: (s) => count(s, (d) => d.endsWith(':coletiva')) >= 3 },
  { id: 'fantasma', icon: '👻', name: 'Presidente fantasma', desc: 'Deixou 3 decisões sem resposta.', check: (s) => count(s, (d) => d.endsWith(':omissao') || d.endsWith(':arquivado')) >= 3 },
  { id: 'milagre', icon: '📈', name: 'Milagre econômico', desc: 'Desemprego até 5% e inflação até 3% ao mesmo tempo.', check: (s) => s.kpis.desemprego <= 5 && s.kpis.inflacao <= 3 },
  { id: 'paz', icon: '🚓', name: 'Paz nas ruas', desc: 'Segurança 9 ou mais.', check: (s) => s.kpis.seguranca >= 9 },
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

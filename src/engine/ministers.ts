import type { GameState } from './types';

const clamp = (n: number) => Math.max(-100, Math.min(100, n));

/**
 * Humor de cada ministro (-100 a +100), lido dos números da área dele.
 * O que ele diz vem do boletim escrito pelo Claude; aqui é só o termômetro.
 */
export function ministerMood(id: string, s: GameState): number {
  const liminares = s.history.filter((h) => h.stf).length;
  switch (id) {
    case 'fazenda':
      return clamp((4.5 - s.kpis.inflacao) * 15 + (8 - s.kpis.desemprego) * 10 + (10.5 - s.kpis.selic) * 5);
    case 'justica':
      return clamp(40 - liminares * 25 + s.axes.direitos * 0.3 - s.axes.poder * 0.4);
    case 'casacivil':
      return clamp((s.kpis.coalizao - 50) * 2);
    case 'defesa':
      return clamp((s.kpis.seguranca - 6.5) * 20 - s.axes.defesa * 0.4);
    case 'agricultura':
      return clamp((s.factions.ruralistas ?? 0) + ((s.relations?.china ?? 0) + (s.relations?.ue ?? 0)) * 0.2);
    case 'comunicacao':
      return clamp((s.kpis.aprovacao - 45) * 2.5);
    default:
      return 0;
  }
}

export function moodFace(v: number): string {
  if (v >= 50) return '😄';
  if (v >= 15) return '🙂';
  if (v > -15) return '😐';
  if (v > -50) return '😟';
  return '😫';
}

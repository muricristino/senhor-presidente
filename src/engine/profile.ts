import { AXES } from './data';
import type { AxisDef, AxisId } from './types';

export interface PoleLean {
  axis: AxisDef;
  value: number;
  pole: string;
  title: string;
  explain: string;
}

export function lean(axis: AxisDef, value: number): PoleLean {
  const b = value > 0;
  return {
    axis,
    value,
    pole: b ? axis.poleB : axis.poleA,
    title: b ? axis.titleB : axis.titleA,
    explain: b ? axis.explainB : axis.explainA,
  };
}

/** Eixos com maior desvio do centro, do mais forte para o mais fraco. */
export function dominantLeans(axes: Record<AxisId, number>, n = 3): PoleLean[] {
  return AXES.filter((a) => Math.abs(axes[a.id]) >= 5)
    .sort((a, b) => Math.abs(axes[b.id]) - Math.abs(axes[a.id]))
    .slice(0, n)
    .map((a) => lean(a, axes[a.id]));
}

export function profileTitle(axes: Record<AxisId, number>): string {
  const [first, second] = dominantLeans(axes, 2);
  if (!first) return 'Centrista';
  return second ? `${first.title} ${second.title.toLowerCase()}` : first.title;
}

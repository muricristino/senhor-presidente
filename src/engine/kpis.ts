import type { KpiId } from './types';

export interface KpiDef {
  id: KpiId;
  label: string;
  short: string;
  min: number;
  max: number;
  decimals: number;
  suffix: string;
  /** +1 quando subir é bom, -1 quando subir é ruim */
  good: 1 | -1;
}

export const KPIS: KpiDef[] = [
  { id: 'aprovacao', label: 'Aprovação', short: 'APROV', min: 0, max: 100, decimals: 0, suffix: '%', good: 1 },
  { id: 'coalizao', label: 'Coalizão', short: 'COALIZÃO', min: 0, max: 100, decimals: 0, suffix: '%', good: 1 },
  { id: 'selic', label: 'Selic', short: 'SELIC', min: 2, max: 30, decimals: 2, suffix: '%', good: -1 },
  { id: 'inflacao', label: 'Inflação', short: 'INFLAÇÃO', min: -2, max: 40, decimals: 1, suffix: '%', good: -1 },
  { id: 'desemprego', label: 'Desemprego', short: 'DESEMP', min: 2, max: 30, decimals: 1, suffix: '%', good: -1 },
  { id: 'seguranca', label: 'Segurança', short: 'SEGURANÇA', min: 0, max: 10, decimals: 1, suffix: '', good: 1 },
  { id: 'educacao', label: 'Educação', short: 'EDUCAÇÃO', min: 0, max: 10, decimals: 1, suffix: '', good: 1 },
];

export function kpiDef(id: KpiId): KpiDef {
  return KPIS.find((k) => k.id === id)!;
}

export function formatKpi(id: KpiId, value: number): string {
  const def = kpiDef(id);
  return value.toFixed(def.decimals).replace('.', ',') + def.suffix;
}

export function formatDelta(id: KpiId, delta: number): string {
  const def = kpiDef(id);
  const sign = delta > 0 ? '+' : '';
  return sign + delta.toFixed(def.decimals).replace('.', ',') + (def.suffix === '%' && def.id !== 'aprovacao' && def.id !== 'coalizao' ? ' p.p.' : def.suffix);
}

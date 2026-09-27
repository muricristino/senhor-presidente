import type { GameState } from './types';

export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** `month` é contado desde a posse (1 = janeiro do primeiro ano). */
export const monthName = (month: number) => MONTH_NAMES[(month - 1) % 12];
export const yearOf = (state: Pick<GameState, 'startYear'>, month: number) => state.startYear + Math.floor((month - 1) / 12);
export const ageOf = (state: Pick<GameState, 'startAge'>, month: number) => state.startAge + Math.floor((month - 1) / 12);

/** Mês (desde a posse) da eleição que encerra o mandato `term`: outubro do último ano. */
export function electionMonth(state: Pick<GameState, 'termMonths'>, term: number, electionCalendarMonth = 10): number {
  return (term - 1) * state.termMonths + state.termMonths - 12 + electionCalendarMonth;
}

export function dateLabel(state: Pick<GameState, 'startYear'>, month: number): string {
  return `${monthName(month)} de ${yearOf(state, month)}`;
}

export function shortDate(state: Pick<GameState, 'startYear'>, month: number): string {
  return `${monthName(month).slice(0, 3).toUpperCase()} ${String(yearOf(state, month)).slice(2)}`;
}

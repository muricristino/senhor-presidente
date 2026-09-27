import axesData from '../../data/axes.json';
import type { AxisDef, Country, Dispatch, GameEvent } from './types';

const countryFiles = import.meta.glob<{ default: Country }>('../../data/countries/*.json', { eager: true });
const dispatchFiles = import.meta.glob<{ default: Dispatch[] }>('../../data/dispatches/*.json', { eager: true });
const eventFiles = import.meta.glob<{ default: GameEvent[] }>('../../data/events/*.json', { eager: true });

export const AXES = axesData as AxisDef[];

export function listCountries(): Country[] {
  return Object.values(countryFiles)
    .map((m) => m.default)
    .sort((a, b) => Number(b.available) - Number(a.available));
}

export function getCountry(id: string): Country {
  const country = listCountries().find((c) => c.country_id === id);
  if (!country) throw new Error(`País desconhecido: ${id}`);
  return country;
}

export function eventsFor(countryId: string): GameEvent[] {
  return Object.values(eventFiles)
    .flatMap((m) => m.default)
    .filter((e) => e.country === countryId || e.country === 'GLOBAL');
}

export function dispatchesFor(countryId: string): Dispatch[] {
  return Object.entries(dispatchFiles)
    .filter(([path]) => path.includes(`/${countryId}_`) || path.includes('/GLOBAL_'))
    .flatMap(([, m]) => m.default);
}


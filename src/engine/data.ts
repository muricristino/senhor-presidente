import axesData from '../../data/axes.json';
import type { AxisDef, Country } from './types';

const countryFiles = import.meta.glob<{ default: Country }>('../../data/countries/*.json', { eager: true });

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




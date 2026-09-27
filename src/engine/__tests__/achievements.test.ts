import { beforeEach, describe, expect, it } from 'vitest';
import { checkAchievements } from '../achievements';
import { getCountry } from '../data';
import { createState } from '../rules';

const br = getCountry('BR');
const store: Record<string, string> = {};
beforeEach(() => {
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe('conquistas', () => {
  it('libera pelo estado e pelos marcos, sem repetir as que a partida já tem', () => {
    const s = createState(br, { name: 'Ana', avatar: 0, bioId: 'politico' });
    s.history = [{ month: 1, event: 'x', choice: 'y', headline: 'z', icon: '✅', stf: 'LIMINAR' }];
    const ids = checkAchievements(s, { reelected: true }, br).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['primeira_caneta', 'barrado', 'reeleito']));
    expect(checkAchievements({ ...s, trophies: ids }, { reelected: true }, br)).toEqual([]);
    expect(JSON.parse(store['sp.achievements.v1']).reeleito.president).toBe('Ana');
  });
});

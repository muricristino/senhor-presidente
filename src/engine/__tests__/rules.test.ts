import { describe, expect, it } from 'vitest';
import { getCountry } from '../data';
import { profileTitle } from '../profile';
import { applyEffects, createState } from '../rules';

const br = getCountry('BR');
const player = { name: 'Teste', avatar: 0, bioId: 'politico' };

describe('createState', () => {
  it('aplica o bônus da biografia sem derivar coalizão', () => {
    const s = createState(br, player);
    expect(s.kpis.coalizao).toBe(br.kpis_iniciais.coalizao + 10);
    expect(s.factions.centrao).toBe(15);
  });
});

describe('applyEffects', () => {
  it('limita eixos em ±100 e informa o delta aplicado', () => {
    const s = createState(br, player);
    const { state, deltas } = applyEffects({ ...s, axes: { ...s.axes, poder: 90 } }, { axes: { poder: 25 } }, br);
    expect(state.axes.poder).toBe(100);
    expect(deltas.axes.poder).toBe(10);
  });

  it('humor das bancadas mexe na coalizão pelo peso da influência', () => {
    const s = createState(br, { ...player, bioId: 'empresario' });
    const { deltas } = applyEffects(s, { factions: { centrao: 10 } }, br);
    expect(deltas.kpis.coalizao).toBeGreaterThan(0);
  });

});

describe('profileTitle', () => {
  it('é centrista sem desvios e combina os dois polos mais fortes', () => {
    const s = createState(br, player);
    expect(profileTitle(s.axes)).toBe('Centrista');
    expect(profileTitle({ ...s.axes, economia: -30, propriedade: -20 })).toBe('Planejador estatista');
  });
});

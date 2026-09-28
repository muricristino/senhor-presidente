import { describe, expect, it } from 'vitest';
import { getCountry } from '../data';
import { advanceMonth, concludeBill, createState, proposeBill } from '../rules';
import type { BillProposal } from '../types';

const br = getCountry('BR');
const base = () => createState(br, { name: 'Lei', avatar: 0, bioId: 'politico' });
const proposal: BillProposal = {
  id: 'b1', icon: '📜', title: 'Reforma Tributária', summary: 's', area: 'economia', needsPec: false,
  effects: { axes: { economia: 10 }, kpis: { aprovacao: 4 }, factions: { centrao: 6 } },
  monthly: { inflacao: -0.05 }, months: 12, lesson: 'l',
};

describe('legislar', () => {
  it('projeto de lei só faz efeito depois de aprovado, e a lei age todo mês', () => {
    let s = proposeBill(base(), proposal, 'lei', br).state;
    expect(s.bill?.voteMonth).toBe(4);
    expect(s.axes.economia).toBe(0);
    s = concludeBill(s, true, br).state;
    expect(s.bill).toBeNull();
    expect(s.axes.economia).toBe(10);
    const before = s.kpis.inflacao;
    s = advanceMonth(s, br, 1);
    expect(s.kpis.inflacao).toBeLessThan(before);
  });

  it('PEC aprovada pesa mais que lei', () => {
    const s = concludeBill(proposeBill(base(), proposal, 'pec', br).state, true, br).state;
    expect(s.axes.economia).toBe(13);
    expect(s.laws?.[0].until).toBe(1 + 16);
  });

  it('MP vale na hora; derrubada, desfaz parte e custa coalizão', () => {
    const start = base();
    let s = proposeBill(start, proposal, 'mp', br).state;
    expect(s.axes.economia).toBe(10);
    expect(s.laws).toHaveLength(1);
    s = concludeBill(s, false, br).state;
    expect(s.axes.economia).toBe(4);
    expect(s.laws).toHaveLength(0);
    expect(s.kpis.coalizao).toBeLessThan(start.kpis.coalizao);
  });

  it('projeto rejeitado é derrota política', () => {
    const start = base();
    const s = concludeBill(proposeBill(start, proposal, 'lei', br).state, false, br).state;
    expect(s.kpis.coalizao).toBeLessThan(start.kpis.coalizao);
    expect(s.axes.economia).toBe(0);
  });
});

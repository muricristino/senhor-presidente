import { describe, expect, it } from 'vitest';
import { ageOf, dateLabel, electionMonth, yearOf } from '../calendar';
import { getCountry } from '../data';
import { electionDue, electionResult, impeachmentDue, impeachmentVote } from '../politics';
import { advanceMonth, applyEffects, createState, resistance } from '../rules';
import type { GameState } from '../types';

const br = getCountry('BR');
const base = () => createState(br, { name: 'Teste', avatar: 0, bioId: 'politico' });
const withKpis = (s: GameState, kpis: Partial<GameState['kpis']>): GameState => ({ ...s, kpis: { ...s.kpis, ...kpis } });

describe('calendário', () => {
  it('começa em janeiro de 2026 com 35 anos e dura dois mandatos', () => {
    const s = base();
    expect(dateLabel(s, 1)).toBe('Janeiro de 2026');
    expect(ageOf(s, 1)).toBe(35);
    expect(yearOf(s, 49)).toBe(2030);
    expect(ageOf(s, 96)).toBe(42);
    expect(s.totalMonths).toBe(96);
  });

  it('a eleição do 1º mandato é em outubro de 2029', () => {
    const s = base();
    const m = electionMonth(s, 1);
    expect(dateLabel(s, m)).toBe('Outubro de 2029');
    expect(electionDue({ ...s, month: m - 1 }, br)).toBe(false);
    expect(electionDue({ ...s, month: m }, br)).toBe(true);
    expect(electionDue({ ...s, month: m, electionsHeld: [1] }, br)).toBe(false);
    expect(electionDue({ ...s, month: 94, term: 2 }, br)).toBe(false);
  });
});

describe('opinião pública', () => {
  it('quedas perdem força perto de zero', () => {
    expect(resistance(50, -10)).toBe(1);
    expect(resistance(10, -10)).toBeLessThan(0.6);
    const low = applyEffects(withKpis(base(), { aprovacao: 8 }), { kpis: { aprovacao: -12 } }, br).state;
    expect(low.kpis.aprovacao).toBeGreaterThan(2);
  });

  it('com o passar dos meses a aprovação volta devagar para o meio', () => {
    const s = advanceMonth(withKpis(base(), { aprovacao: 10 }), br, 6);
    expect(s.month).toBe(7);
    expect(s.kpis.aprovacao).toBeGreaterThan(15);
    expect(s.kpis.aprovacao).toBeLessThan(45);
  });
});

describe('eleição e impeachment', () => {
  it('governo popular com economia boa se reelege; impopular perde', () => {
    expect(electionResult(withKpis(base(), { aprovacao: 58, desemprego: 6.5, inflacao: 3.5 })).won).toBe(true);
    expect(electionResult(withKpis(base(), { aprovacao: 30, desemprego: 11, inflacao: 8 })).won).toBe(false);
  });

  it('impeachment só abre com aprovação e coalizão baixas, e respeita o escudo', () => {
    expect(impeachmentDue(withKpis(base(), { aprovacao: 40, coalizao: 30 }))).toBe(false);
    expect(impeachmentDue(withKpis(base(), { aprovacao: 20, coalizao: 25 }))).toBe(true);
    expect(impeachmentDue({ ...withKpis(base(), { aprovacao: 20, coalizao: 25 }), impeachmentShieldUntil: 99 })).toBe(false);
  });

  it('a Câmara precisa de 342 votos; coalizão forte segura o mandato', () => {
    const fraco = impeachmentVote(withKpis(base(), { aprovacao: 10, coalizao: 10 }), br);
    const firme = impeachmentVote(withKpis(base(), { aprovacao: 25, coalizao: 45 }), br);
    expect(fraco.needed).toBe(342);
    expect(fraco.passed).toBe(true);
    expect(firme.passed).toBe(false);
    expect(fraco.yes + fraco.no).toBeLessThanOrEqual(513);
  });
});

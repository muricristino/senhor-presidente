import { describe, expect, it } from 'vitest';
import { getCountry } from '../data';
import { crisisDue, crisisOdds, electionDue, lastTerm, resolveCrisis } from '../politics';
import {
  changeRegime, democracyIndex, democracyLabel, driftedRegime, legalRoutes, plebisciteYes, REGIMES, routeOpen, ruptureRoutes, ruptureSetup, ruptureSupport, threats,
} from '../regime';
import { advanceMonth, applyEffects, concludeBill, createState, proposeBill } from '../rules';
import { sanitizeBills, sanitizeCrisis } from '../sanitize';
import type { BillProposal, GameState } from '../types';

const br = getCountry('BR');
const base = () => createState(br, { name: 'Teste', avatar: 0, bioId: 'politico' });
const withKpis = (s: GameState, kpis: Partial<GameState['kpis']>): GameState => ({ ...s, kpis: { ...s.kpis, ...kpis } });
const bill = (special?: BillProposal['special']): BillProposal => ({
  id: 'b', icon: '📜', title: 'PEC do terceiro mandato', summary: '', area: 'regime', needsPec: true, effects: {}, monthly: {}, months: 12, lesson: '', special,
});

describe('regimes', () => {
  it('todos os regimes têm título, freios e formas de perder o poder', () => {
    expect(REGIMES).toHaveLength(9);
    for (const r of REGIMES) {
      expect(r.headTitle).toBeTruthy();
      expect(r.removal.length).toBeGreaterThan(0);
      expect(r.examples.length).toBeGreaterThan(1);
    }
  });

  it('o jogo começa numa democracia liberal presidencialista', () => {
    const s = base();
    expect(s.regime).toBe('presidencialismo');
    expect(democracyLabel(democracyIndex(s)).label).toBe('Democracia liberal');
    expect(Object.values(threats(s)).every((v) => v === 0)).toBe(true);
  });

  it('corroer as instituições vira regime híbrido sem golpe, e devolvê-las volta à democracia', () => {
    const eroded = applyEffects(base(), { institutions: { stf: -15, congresso: -15, imprensa: -15, eleicoes: -15 } }, br).state;
    expect(driftedRegime(eroded)).toBeNull();
    let s = eroded;
    for (let i = 0; i < 3; i++) s = applyEffects(s, { institutions: { stf: -15, congresso: -15, imprensa: -15, eleicoes: -15 } }, br).state;
    expect(driftedRegime(s)).toBe('hibrido');
    s = changeRegime(s, 'hibrido', 'erosão');
    for (let i = 0; i < 4; i++) s = applyEffects(s, { institutions: { stf: 15, congresso: 15, imprensa: 15, eleicoes: 15 } }, br).state;
    expect(driftedRegime(s)).toBe('presidencialismo');
  });

  it('numa ditadura não há eleição e os freios ficam no teto do regime', () => {
    const s = changeRegime({ ...base(), month: 20 }, 'militar', 'golpe');
    expect(s.institutions!.imprensa).toBeLessThanOrEqual(15);
    expect(electionDue({ ...s, month: 46 }, br)).toBe(false);
    expect(s.totalMonths).toBeGreaterThan(96);
    expect(Object.keys(threats(s)).sort()).toEqual(['golpe_contra', 'revolta']);
  });

  it('no parlamentarismo a eleição vem a cada quatro anos e não há limite de mandatos', () => {
    const s = changeRegime({ ...base(), month: 30 }, 'parlamentarismo', 'plebiscito');
    expect(s.nextElection).toBe(78);
    expect(electionDue({ ...s, month: 78 }, br)).toBe(true);
    expect(lastTerm(s, br)).toBe(false);
  });
});

describe('esticar o poder por lei', () => {
  it('a PEC da reeleição dá mais um mandato e corrói as eleições', () => {
    const s = { ...base(), term: 2 };
    expect(lastTerm(s, br)).toBe(true);
    const sent = proposeBill(s, bill('reeleicao'), 'pec', br).state;
    const r = concludeBill(sent, true, br).state;
    expect(r.extraTerms).toBe(1);
    expect(r.totalMonths).toBe(144);
    expect(lastTerm(r, br)).toBe(false);
    expect(r.institutions!.eleicoes).toBeLessThan(s.institutions!.eleicoes);
  });

  it('decreto vale na hora e não deixa projeto pendente', () => {
    const s = changeRegime(base(), 'personalista', 'golpe');
    const r = proposeBill(s, { ...bill(), effects: { kpis: { aprovacao: 4 } } }, 'decreto', br).state;
    expect(r.bill).toBeNull();
    expect(r.laws).toHaveLength(1);
  });

  it('o gerador não consegue mandar PEC da reeleição como lei simples', () => {
    const [p] = sanitizeBills({ proposals: [{ title: 'Reeleição sem fim', special: 'reeleicao', needsPec: false, effects: {} }] }, br);
    expect(p.special).toBe('reeleicao');
    expect(p.needsPec).toBe(true);
  });
});

describe('perder o poder antes da hora', () => {
  it('crise terminal explode no máximo da ameaça e respeita o escudo', () => {
    const s = withKpis(base(), { aprovacao: 20, coalizao: 25 });
    expect(crisisDue(s)).toBe('impeachment');
    expect(crisisDue({ ...s, crisisShield: { impeachment: 99 } })).toBeNull();
  });

  it('renunciar encerra; o fim depende da crise', () => {
    const s = withKpis(base(), { aprovacao: 10 });
    expect(resolveCrisis('impeachment', 'renunciar', s, br).ending).toBe('renuncia');
    expect(resolveCrisis('revolta', 'renunciar', s, br).ending).toBe('exilio');
  });

  it('numa democracia forte o golpe contra o presidente tende a falhar', () => {
    const strong = withKpis(base(), { aprovacao: 55 });
    const weak = { ...withKpis(base(), { aprovacao: 25 }), institutions: { stf: 20, congresso: 20, imprensa: 20, eleicoes: 30 } };
    expect(crisisOdds('golpe_contra', 'resistir', strong, br)).toBeGreaterThan(crisisOdds('golpe_contra', 'resistir', weak, br));
  });

  it('o momento decisivo do Claude só vale com uma opção para cada papel', () => {
    const opt = (role: string) => ({ role, title: `Opção ${role}`, headline: 'Manchete', effects: {} });
    const raw = { title: 'Impeachment', dossier: ['a', 'b'], options: [opt('negociar'), opt('opiniao'), opt('ruas'), opt('renunciar')], omission: opt('nada') };
    const roles = ['negociar', 'opiniao', 'ruas', 'renunciar'];
    expect(sanitizeCrisis(raw, br, 5, 'Maio', roles)?.options.map((o) => o.id)).toEqual(roles);
    expect(sanitizeCrisis({ ...raw, options: raw.options.slice(0, 3).concat(opt('negociar')) }, br, 5, 'Maio', roles)).toBeNull();
  });
});

describe('mudar de regime', () => {
  it('a ruptura só abre para quem concentra poder, com requisitos claros', () => {
    const s = base();
    expect(ruptureRoutes(s).some(routeOpen)).toBe(false);
    const strong = { ...s, axes: { ...s.axes, poder: 60 }, factions: { ...s.factions, seguranca: 40 } };
    expect(ruptureRoutes(strong).find((r) => r.to === 'militar')!.reqs.every((x) => x.ok)).toBe(true);
  });

  it('na noite do golpe os pesos somam 100% e instituições fortes exigem mais apoio', () => {
    const s = { ...base(), axes: { ...base().axes, poder: 60 }, factions: { ...base().factions, seguranca: 50 } };
    const setup = ruptureSetup(s, 'militar');
    expect(setup.actors.reduce((n, a) => n + a.weight, 0)).toBeCloseTo(1);
    expect(setup.actors.find((a) => a.id === 'generais')!.stance).toBeGreaterThan(40);
    const weak = ruptureSetup({ ...s, institutions: { stf: 20, congresso: 20, imprensa: 20, eleicoes: 20 } }, 'militar');
    expect(weak.threshold).toBeLessThan(setup.threshold);
    expect(ruptureSupport([{ weight: 0.5, stance: 40 }, { weight: 0.5, stance: -20 }])).toBe(10);
  });

  it('plebiscito da monarquia parte baixo, como em 1993', () => {
    const s = base();
    expect(plebisciteYes(s, 'monarquia')).toBeLessThan(30);
    expect(legalRoutes(s).map((r) => r.to)).toContain('parlamentarismo');
  });

  it('a economia planejada muda os indicadores todo mês', () => {
    const s = changeRegime(withKpis(base(), { desemprego: 10 }), 'socialista', 'revolução');
    expect(advanceMonth(s, br, 12).kpis.desemprego).toBeLessThan(10);
  });
});

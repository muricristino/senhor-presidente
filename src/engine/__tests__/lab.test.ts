import { describe, expect, it } from 'vitest';
import { sanitize, type VoteScript } from '../../lab/scripts';

describe('roteiro da votação', () => {
  it('redistribui as cadeiras para somar 513', () => {
    const g = (seats: number) => ({ name: 'G', seats, stance: 'indeciso', leader: 'L', demand: 'D', offers: [{ label: 'x', cost: 2, swing: 0.5, effects: {}, reaction: 'r' }] });
    const s = sanitize('votacao', { bill: { title: 'T', description: 'D', needed: 257 }, capital: 10, groups: [g(200), g(200), g(150), g(150), g(100), g(54)] }) as VoteScript;
    expect(s.groups.reduce((n, x) => n + x.seats, 0)).toBe(513);
  });

  it('recusa roteiro incompleto em vez de inventar texto', () => {
    expect(() => sanitize('debate', { rounds: [] })).toThrow();
  });
});

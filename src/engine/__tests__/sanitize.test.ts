import { describe, expect, it } from 'vitest';
import { getCountry } from '../data';
import { sanitizeCutscene, sanitizeEvent } from '../sanitize';

const br = getCountry('BR');

const option = (title: string) => ({
  icon: '🤖',
  title,
  summary: 'resumo',
  effects: { axes: { poder: 99, inexistente: 5 }, kpis: { aprovacao: -50, selic: 0.5 }, factions: { centrao: 40, fantasma: 10 } },
  scene: { anim: 'nao_existe' },
  headline: 'Manchete',
  subhead: 'Sub',
  lesson: { title: 'Lição', text: 'Texto longo o bastante.' },
  social: { trending: 'Robos', sentiment: 300, posts: [{ who: 'Tia Cleide', at: '@tiacleide.zap', text: 'oi', likes: 10, tone: 'angry' }] },
});

describe('sanitizeEvent', () => {
  it('limita efeitos, descarta ids desconhecidos e corrige cena', () => {
    const ev = sanitizeEvent(
      { title: 'Exército de robôs', dossier: ['a', 'b'], options: [option('A'), option('B'), option('C'), option('D')], omission: option('O'), callback: 'Lembra da GLO?' },
      br,
      7,
      'Julho',
    )!;
    const o = ev.options[0];
    expect(ev.options).toHaveLength(4);
    expect(o.effects.axes).toEqual({ poder: 30 });
    expect(o.effects.kpis).toEqual({ aprovacao: -12, selic: 0.5 });
    expect(o.effects.factions).toEqual({ centrao: 25 });
    expect(o.scene.anim).toBe('calm');
    expect(o.social.trending).toBe('#Robos');
    expect(o.social.sentiment).toBe(100);
    expect(o.social.posts[0].at).toBe('tiacleide.zap');
    expect(ev.omission.icon).toBe('⌛');
    expect(ev.echoes).toEqual([{ when: '*', text: 'Lembra da GLO?' }]);
  });

  it('rejeita evento sem opções suficientes', () => {
    expect(sanitizeEvent({ title: 'X', options: [option('A')], omission: option('O') }, br, 2, 'Fevereiro')).toBeNull();
  });
});

describe('sanitizeCutscene', () => {
  it('aceita sprites desenhados pelo Claude e remove atores e passos inválidos', () => {
    const cut = sanitizeCutscene({
      backdrop: 'custom',
      customBackdrop: { palette: { a: '#112233', b: 'vermelho' }, rows: Array(20).fill('a'.repeat(60)) },
      sprites: [{ id: 'robo', palette: { m: '#8a8a92' }, rows: ['mm', 'mm'] }, { id: 'Ruim!', palette: {}, rows: [] }],
      actors: [
        { id: 'exercito', sprite: 'robo', x: 20, y: 100, count: 99 },
        { id: 'juiz', sprite: 'ministro_careca', x: 96, y: 86, holding: 'martelo', layer: 'back' },
        { id: 'fantasma', sprite: 'nao_existe', x: 0, y: 0 },
      ],
      timeline: [
        { t: 0.5, do: 'enter_left', actor: 'exercito' },
        { t: 1, do: 'slam', actor: 'juiz' },
        { t: 1, do: 'voar', actor: 'juiz' },
        { t: 2, do: 'say', actor: 'fantasma', text: 'oi' },
      ],
      caption: 'Robôs marcham na Esplanada',
    })!;
    expect(cut.backdrop).toBe('custom');
    expect(cut.customBackdrop!.rows).toHaveLength(28);
    expect(cut.customBackdrop!.rows[0]).toHaveLength(48);
    expect(cut.customBackdrop!.palette).toEqual({ a: '#112233' });
    expect(cut.sprites!.map((s) => s.id)).toEqual(['robo']);
    expect(cut.actors.map((a) => a.id)).toEqual(['exercito', 'juiz']);
    expect(cut.actors[0].count).toBe(24);
    expect(cut.timeline.map((s) => s.do)).toEqual(['enter_left', 'slam']);
  });

  it('volta para a Esplanada quando o cenário customizado é inválido', () => {
    expect(sanitizeCutscene({ backdrop: 'custom', actors: [], timeline: [], caption: 'x' })!.backdrop).toBe('esplanada');
  });
});

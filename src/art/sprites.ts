import type { PixelSprite } from '../engine/types';
import { AVATARS, NPCS } from './avatar';
import type { Ctx } from './pixel';

/* Sprites da biblioteca no mesmo formato que o Claude usa para desenhar os seus. */

type Hair = 'bald' | 'short' | 'long' | 'bun' | 'cap' | 'helmet' | 'beret' | 'hat';
type Outfit = 'toga' | 'suit' | 'uniform' | 'police' | 'tshirt' | 'vest' | 'coat' | 'overalls';
type Face = 'neutral' | 'angry' | 'happy';

interface PersonSpec {
  skin: string;
  hair: string;
  style: Hair;
  outfit: Outfit;
  main: string;
  accent?: string;
  face?: Face;
  sash?: boolean;
  glasses?: boolean;
}

const W = 12;
const H = 22;

function person(id: string, p: PersonSpec): PixelSprite {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0: number, y0: number, w: number, h: number, c: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c;
  };
  const long = p.outfit === 'toga' || p.outfit === 'coat';

  // cabelo atrás
  if (p.style === 'long') fill(2, 2, 8, 8, 'h');
  // cabeça
  fill(3, 2, 6, 6, 'k');
  fill(2, 4, 1, 2, 's');
  fill(9, 4, 1, 2, 's');
  switch (p.style) {
    case 'bald': fill(2, 3, 1, 2, 'h'); fill(9, 3, 1, 2, 'h'); g[2][4] = 'l'; break;
    case 'short': fill(3, 1, 6, 2, 'h'); fill(2, 2, 1, 2, 'h'); fill(9, 2, 1, 2, 'h'); break;
    case 'long': fill(3, 1, 6, 2, 'h'); break;
    case 'bun': fill(3, 1, 6, 2, 'h'); fill(5, 0, 2, 1, 'h'); break;
    case 'cap': fill(3, 1, 6, 2, 'a'); fill(2, 2, 8, 1, 'a'); break;
    case 'helmet': fill(2, 0, 8, 3, 'a'); fill(2, 3, 1, 1, 'a'); fill(9, 3, 1, 1, 'a'); break;
    case 'beret': fill(3, 1, 6, 2, 'a'); fill(8, 1, 2, 1, 'a'); g[1][4] = 'y'; break;
    case 'hat': fill(1, 1, 10, 1, 'a'); fill(3, 0, 6, 1, 'a'); break;
  }
  // rosto
  const face = p.face ?? 'neutral';
  if (face === 'angry' && p.style !== 'helmet') {
    g[3][4] = 'e';
    g[3][7] = 'e';
  }
  g[4][4] = 'e';
  g[4][7] = 'e';
  if (p.glasses) {
    fill(3, 4, 6, 1, 'e');
    g[4][4] = 'w';
    g[4][7] = 'w';
  }
  if (face === 'happy') {
    fill(4, 6, 4, 1, 'm');
    g[5][4] = 'm';
    g[5][7] = 'm';
  } else if (face === 'angry') {
    fill(4, 6, 4, 1, 'm');
  } else {
    fill(5, 6, 2, 1, 'm');
  }
  // pescoço e corpo
  fill(5, 8, 2, 1, 's');
  fill(2, 9, 8, long ? 11 : 7, 'c');
  fill(1, 10, 1, 5, 'c');
  fill(10, 10, 1, 5, 'c');
  g[15][1] = 'k';
  g[15][10] = 'k';
  switch (p.outfit) {
    case 'toga':
      fill(4, 9, 4, 2, 'w');
      fill(5, 11, 2, 1, 'w');
      break;
    case 'suit':
    case 'coat':
      fill(5, 9, 2, 3, 'w');
      fill(5, 10, 2, 4, 't');
      break;
    case 'uniform':
    case 'police':
      fill(2, 12, 8, 1, 'd');
      g[10][3] = 'y';
      break;
    case 'vest':
      fill(3, 9, 1, 6, 't');
      fill(8, 9, 1, 6, 't');
      break;
    case 'overalls':
      fill(3, 12, 6, 4, 't');
      break;
  }
  if (p.sash) for (let i = 0; i < 7; i++) {
    g[9 + i][2 + i] = 'G';
    if (3 + i < W) g[9 + i][3 + i] = 'y';
  }
  // pernas
  if (long) {
    fill(3, 20, 2, 1, 'p');
    fill(7, 20, 2, 1, 'p');
  } else {
    fill(3, 16, 2, 5, 'p');
    fill(7, 16, 2, 5, 'p');
  }
  fill(2, 21, 3, 1, 'b');
  fill(7, 21, 3, 1, 'b');

  const palette: Record<string, string> = {
    k: p.skin,
    s: shade(p.skin),
    h: p.hair,
    l: '#ffffff60',
    e: '#1a1420',
    m: face === 'angry' ? '#5a1a1a' : '#8a3a30',
    w: '#f4f1ea',
    c: p.main,
    d: shade(p.main),
    t: p.accent ?? '#8a2a2a',
    a: p.accent ?? p.main,
    y: '#f4c542',
    G: '#2e8b57',
    p: p.outfit === 'toga' ? '#1a1a1a' : p.outfit === 'uniform' ? shade(p.main) : '#2a2a3a',
    b: '#1a1a1a',
  };
  return { id, palette, rows: g.map((r) => r.join('')) };
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.72));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

const SKIN = ['#e8b48f', '#8d5a3b', '#c68e62', '#5e3a24', '#f1c9a5', '#a8714b'];

const CIENTISTA: PersonSpec = { skin: SKIN[4], hair: '#b8742e', style: 'bun', outfit: 'coat', main: '#f0ece0', accent: '#3a6fd8', glasses: true };

/** Robô cinza e quadrado, com olhos ciano (tecnocracia). */
const ROBO: PixelSprite = {
  id: 'robo',
  palette: { r: '#e0574f', a: '#8a8a92', g: '#b8bcc4', l: '#d0d4dc', d: '#6a6e78', k: '#2a2a32', c: '#4ff0f0', y: '#f4c542' },
  rows: [
    '.....rr.....',
    '.....aa.....',
    '..gggggggg..',
    '..glllllld..',
    '..gkcckccd..',
    '..glllllld..',
    '..gkkkkkkd..',
    '..dddddddd..',
    '....dddd....',
    '..gggggggg..',
    'aaglccllldaa',
    'aaglllllldaa',
    'aaglrlylldaa',
    'aaglllllldaa',
    'kkgddddddgkk',
    '..dddddddd..',
    '...aa..aa...',
    '...aa..aa...',
    '...aa..aa...',
    '...aa..aa...',
    '..kkk..kkk..',
    '..kkk..kkk..',
  ],
};

const PROPS: PixelSprite[] = [
  { id: 'martelo', palette: { b: '#5a3a1a', B: '#9a6a3a', h: '#b8844a' }, rows: ['bBBBBBb', 'bBBBBBb', 'bbbbbbb', '...h...', '...h...', '...h...', '...h...'] },
  { id: 'microfone', palette: { g: '#4a4a52', G: '#8a8a92', b: '#1a1a1a' }, rows: ['.GG.', 'GggG', '.GG.', '.b..', '.b..', '.b..', '.b..', '.b..', '.b..', 'bbbb'] },
  { id: 'cartaz', palette: { r: '#c63d3d', w: '#f0ece0', p: '#7a5a3a' }, rows: ['rrrrrrrrrr', 'rwwwwwwwwr', 'rwrrwwrrwr', 'rwwwwwwwwr', 'rrrrrrrrrr', '....pp....', '....pp....', '....pp....', '....pp....', '....pp....'] },
  { id: 'dinheiro', palette: { g: '#4fc27f', d: '#2e8b57' }, rows: ['ggggg', 'gdgdg', 'ggggg'] },
  { id: 'papel', palette: { w: '#f0ece0', l: '#9aa0b4' }, rows: ['wwww', 'wllw', 'wwww', 'wllw'] },
  { id: 'confete', palette: { a: '#f4c542', b: '#ff6fa8' }, rows: ['ab', 'ba'] },
  { id: 'voto', palette: { w: '#f4f1ea', b: '#1f4fa0' }, rows: ['wwwww', 'wbwbw', 'wwwww', 'wbbbw', 'wwwww'] },
  { id: 'urna', palette: { g: '#c8c8d0', d: '#6a6a72', s: '#2e8b57', k: '#1a1a1a' }, rows: ['gggggggg', 'gsssssdg', 'gsssssdg', 'gggggggg', 'gkkgkkgg', 'gkkgkkgg', 'gggggggg', '.d....d.'] },
  { id: 'camera', palette: { k: '#2a2a32', g: '#6a6a72', r: '#e0574f', l: '#6fb6ff' }, rows: ['.kkkk..r', 'kkkkkkkk', 'kgggggkl', 'kkkkkkkk', '..k..k..', '..k..k..', '.k....k.'] },
  {
    id: 'tanque',
    palette: { g: '#4a5a32', d: '#3e4c2a', k: '#1a1a1a', l: '#6a7a4a' },
    rows: ['.........dddddd.............', '........dggggggdkkkkkkkkkkkk', '.....dddggggggggd...........', '..ddgggggggggggggggggggd....', '.dllllllllllllllllllllllld..', 'dgggggggggggggggggggggggggd.', 'dkgkgkgkgkgkgkgkgkgkgkgkgkd.', '.dkkkkkkkkkkkkkkkkkkkkkkkd..'],
  },
  {
    id: 'caminhao',
    palette: { w: '#d8d4c8', W: '#f0ece0', r: '#c63d3d', b: '#9ad0f0', k: '#1a1a1a' },
    rows: ['WWWWWWWWWWWWWWWWWW........', 'wwwwwwwwwwwwwwwwww.rrrrr..', 'wwwwwwwwwwwwwwwwww.rbbbrr.', 'wwwwwwwwwwwwwwwwww.rbbbrrr', 'wwwwwwwwwwwwwwwwwwrrrrrrrr', 'wwwwwwwwwwwwwwwwwwrrrrrrrr', '..kkk.......kkk.....kkk...', '..kkk.......kkk.....kkk...'],
  },
  {
    id: 'helicoptero',
    palette: { r: '#c63d3d', d: '#8a2a2a', b: '#9ad0f0', k: '#2a2a2a' },
    rows: ['kkkkkkkkkkkkkkkkkkkkkk', '..........k...........', '.......rrrrrrrr.......', 'ddddddrrrrrrrbbbr.....', 'd.....rrrrrrrrbbrr....', '.......rrrrrrrrrr.....', '........k.....k.......', '......kkkkkkkkkkk.....'],
  },
  {
    id: 'bandeira',
    palette: { g: '#2e8b57', y: '#f4c542', b: '#1f4fa0', p: '#8a8a8a' },
    rows: ['pggggggggg', 'pgggyyyggg', 'pggyybyygg', 'pgggyyyggg', 'pggggggggg', 'p.........', 'p.........', 'p.........', 'p.........', 'p.........', 'p.........', 'p.........'],
  },
];

/** Monta a biblioteca. O sprite 'presidente' usa a aparência que o jogador escolheu. */
export function buildLibrary(playerAvatar: number): Map<string, PixelSprite> {
  const a = AVATARS[playerAvatar % AVATARS.length];
  const style: Hair = a.style === 'careca' ? 'bald' : a.style === 'longo' || a.style === 'volume' ? 'long' : a.style === 'coque' ? 'bun' : 'short';
  const people: PixelSprite[] = [
    person('presidente', { skin: a.skin, hair: a.hair, style, outfit: 'suit', main: a.suit, accent: a.tie, sash: true, glasses: a.glasses }),
    person('ministro_careca', { skin: '#e8c0a0', hair: '#c8c8c8', style: 'bald', outfit: 'toga', main: '#1a1a22', face: 'angry' }),
    person('ministro', { skin: SKIN[2], hair: '#8a8a8a', style: 'short', outfit: 'toga', main: '#1a1a22', glasses: true }),
    person('ministra', { skin: SKIN[4], hair: '#5a3a20', style: 'long', outfit: 'toga', main: '#1a1a22' }),
    person('deputado', { skin: SKIN[0], hair: '#3a2a20', style: 'short', outfit: 'suit', main: '#2a3a5a', accent: '#c63d3d' }),
    person('deputada', { skin: SKIN[1], hair: '#1a1210', style: 'bun', outfit: 'suit', main: '#5a2a3a', accent: '#f4c542' }),
    person('assessor', { skin: SKIN[5], hair: '#2a1a12', style: 'short', outfit: 'suit', main: '#6a6a72', accent: '#3a6fd8', glasses: true }),
    person('general', { skin: SKIN[2], hair: '#3a3a3a', style: 'beret', outfit: 'uniform', main: '#4a5a32', accent: '#2a3a1a', face: 'angry' }),
    person('soldado', { skin: SKIN[3], hair: '#1a1a1a', style: 'helmet', outfit: 'uniform', main: '#5a6a3a', accent: '#3e4c2a' }),
    person('policial', { skin: SKIN[1], hair: '#1a1a1a', style: 'cap', outfit: 'police', main: '#2a4a8a', accent: '#1a2a5a' }),
    person('manifestante', { skin: SKIN[3], hair: '#1a1210', style: 'short', outfit: 'tshirt', main: '#c63d3d', face: 'angry' }),
    person('manifestante2', { skin: SKIN[4], hair: '#b8742e', style: 'long', outfit: 'tshirt', main: '#f4c542', face: 'angry' }),
    person('cidadao', { skin: SKIN[2], hair: '#2a1a12', style: 'short', outfit: 'tshirt', main: '#3a6fd8' }),
    person('cidada', { skin: SKIN[5], hair: '#3a2012', style: 'long', outfit: 'tshirt', main: '#8a5cc6' }),
    person('jornalista', { skin: SKIN[0], hair: '#6a4a2a', style: 'bun', outfit: 'suit', main: '#3a3f4a', accent: '#f4c542' }),
    person('empresario', { skin: SKIN[4], hair: '#8a8a8a', style: 'short', outfit: 'suit', main: '#1a2a4a', accent: '#8a6a2a', face: 'happy' }),
    person('pastor', { skin: SKIN[1], hair: '#1a1210', style: 'short', outfit: 'suit', main: '#2b2b33', accent: '#f4f1ea', face: 'happy' }),
    person('caminhoneiro', { skin: SKIN[2], hair: '#2a1a12', style: 'cap', outfit: 'vest', main: '#8a5a3a', accent: '#e8b030' }),
    person('agricultor', { skin: SKIN[5], hair: '#3a2a1a', style: 'hat', outfit: 'overalls', main: '#e8e2d0', accent: '#d8b86a' }),
    person('cientista', CIENTISTA),
  ];
  return new Map([...people, ...PROPS].map((s) => [s.id, s]));
}

export function spriteSize(s: PixelSprite): { w: number; h: number } {
  return { w: Math.max(0, ...s.rows.map((r) => r.length)), h: s.rows.length };
}

/** Desenha com os pés (base) em (x, y), centralizado em x. */
export function drawSprite(ctx: Ctx, s: PixelSprite, x: number, y: number, opts: { flip?: boolean; scale?: number } = {}) {
  const scale = opts.scale ?? 1;
  const { w, h } = spriteSize(s);
  const left = Math.round(x - (w * scale) / 2);
  const top = Math.round(y - h * scale);
  for (let r = 0; r < h; r++) {
    const row = s.rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const color = s.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      const cx = opts.flip ? w - 1 - c : c;
      ctx.fillRect(left + cx * scale, top + r * scale, scale, scale);
    }
  }
}

/** Corpo inteiro de um personagem fixo (ministros, conselheira), a partir do retrato dele. */
export function npcPerson(key: string, face: 'neutral' | 'angry' | 'happy' = 'neutral'): PixelSprite {
  if (key === 'robo') return ROBO;
  if (key === 'cientista') return person('cientista', { ...CIENTISTA, face });
  const a = NPCS[key] ?? AVATARS[0];
  const style: Hair = a.beret ? 'beret' : a.style === 'careca' ? 'bald' : a.style === 'longo' || a.style === 'volume' ? 'long' : a.style === 'coque' ? 'bun' : 'short';
  // clérigos usam túnica longa; militares, farda
  const outfit: Outfit = key.startsWith('clerigo') ? 'coat' : a.beret ? 'uniform' : 'suit';
  return person(key, { skin: a.skin, hair: a.hair, style, outfit, main: a.suit, accent: a.beret ?? a.tie, glasses: a.glasses, face });
}

import { px, rect, type Ctx } from './pixel';

type HairStyle = 'curto' | 'careca' | 'longo' | 'coque' | 'volume' | 'lateral';

interface AvatarPreset {
  skin: string;
  skinShade: string;
  hair: string;
  style: HairStyle;
  suit: string;
  tie: string;
  glasses?: boolean;
  beard?: boolean;
  lipstick?: boolean;
  beret?: string;
}

export const AVATARS: AvatarPreset[] = [
  { skin: '#e8b48f', skinShade: '#c98f6b', hair: '#3b2a20', style: 'lateral', suit: '#1f2a44', tie: '#2e8b57' },
  { skin: '#8d5a3b', skinShade: '#6e4229', hair: '#1a1210', style: 'volume', suit: '#2b2b33', tie: '#c63d3d', lipstick: true },
  { skin: '#f1c9a5', skinShade: '#d6a57f', hair: '#d9d9d9', style: 'careca', suit: '#3a3f4a', tie: '#1f4fa0', glasses: true, beard: true },
  { skin: '#c68e62', skinShade: '#a56f45', hair: '#2a1a12', style: 'longo', suit: '#5a2a3a', tie: '#f4c542', lipstick: true },
  { skin: '#5e3a24', skinShade: '#472a18', hair: '#0f0b09', style: 'curto', suit: '#1b3a2a', tie: '#f4c542', beard: true },
  { skin: '#f3d0b4', skinShade: '#d9ab8c', hair: '#b8742e', style: 'coque', suit: '#e6e1d6', tie: '#1f4fa0', glasses: true, lipstick: true },
  { skin: '#d9a07a', skinShade: '#b98058', hair: '#555555', style: 'curto', suit: '#243a6b', tie: '#8a2a2a', glasses: true },
  { skin: '#a8714b', skinShade: '#86553a', hair: '#231812', style: 'lateral', suit: '#44403a', tie: '#2e8b57', beard: true },
];

/** Personagens fixos do jogo (ministros, conselheira). */
export const NPCS: Record<string, AvatarPreset> = {
  iris: { skin: '#c68e62', skinShade: '#a56f45', hair: '#1a1210', style: 'coque', suit: '#3a2a4a', tie: '#e0b04a', glasses: true, lipstick: true },
  helena: { skin: '#f1c9a5', skinShade: '#d6a57f', hair: '#8a8a8a', style: 'longo', suit: '#1f3a6b', tie: '#c8d8f0', lipstick: true, glasses: true },
  otavio: { skin: '#5e3a24', skinShade: '#472a18', hair: '#d0d0d0', style: 'curto', suit: '#2a1f3a', tie: '#8a5cc6', beard: true },
  rui: { skin: '#e8b48f', skinShade: '#c98f6b', hair: '#6a4a2a', style: 'careca', suit: '#4a4a52', tie: '#9aa0b4' },
  general: { skin: '#d9a07a', skinShade: '#b98058', hair: '#3a3a3a', style: 'curto', suit: '#4a5a32', tie: '#3e4c2a', beret: '#2a3a1a' },
  tereza: { skin: '#a8714b', skinShade: '#86553a', hair: '#3a2012', style: 'longo', suit: '#4a6a2a', tie: '#e8d0a0', lipstick: true },
  caio: { skin: '#f3d0b4', skinShade: '#d9ab8c', hair: '#e05a9a', style: 'volume', suit: '#1a1a1a', tie: '#e0579f' },
};

const INK = '#1a1420';
const WHITE = '#f4f1ea';

/** Desenha o avatar em um canvas de 32x32. `blink` fecha os olhos, `talk` abre a boca. */
export function drawAvatar(ctx: Ctx, who: number | string, opts: { blink?: boolean; talk?: boolean; sash?: boolean; bg?: boolean } = {}) {
  const a = typeof who === 'string' ? NPCS[who] ?? AVATARS[0] : AVATARS[((who % AVATARS.length) + AVATARS.length) % AVATARS.length];
  ctx.clearRect(0, 0, 32, 32);

  if (opts.bg !== false) {
    rect(ctx, 0, 0, 32, 32, '#27324d');
    rect(ctx, 0, 0, 32, 3, '#2e3b5a');
    // bandeira ao fundo
    rect(ctx, 23, 3, 8, 12, '#2e8b57');
    rect(ctx, 25, 6, 4, 6, '#f4c542');
    rect(ctx, 26, 8, 2, 2, '#1f4fa0');
    rect(ctx, 22, 3, 1, 20, '#8a7a5a');
  }

  // cabelo longo atrás do rosto
  if (a.style === 'longo') {
    rect(ctx, 8, 6, 16, 17, a.hair);
  }
  if (a.style === 'volume') {
    rect(ctx, 6, 3, 20, 12, a.hair);
    rect(ctx, 7, 2, 18, 1, a.hair);
    rect(ctx, 6, 15, 4, 4, a.hair);
    rect(ctx, 22, 15, 4, 4, a.hair);
  }

  // corpo / terno
  rect(ctx, 4, 24, 24, 8, a.suit);
  rect(ctx, 3, 26, 1, 6, a.suit);
  rect(ctx, 28, 26, 1, 6, a.suit);
  // camisa + gravata
  rect(ctx, 13, 23, 6, 5, WHITE);
  rect(ctx, 12, 24, 1, 3, WHITE);
  rect(ctx, 19, 24, 1, 3, WHITE);
  rect(ctx, 15, 24, 2, 8, a.tie);
  px(ctx, 15, 23, a.tie);
  px(ctx, 16, 23, a.tie);
  // lapelas
  rect(ctx, 11, 24, 1, 5, '#00000040');
  rect(ctx, 20, 24, 1, 5, '#00000040');

  // faixa presidencial (verde-amarela, diagonal)
  if (opts.sash !== false) {
    for (let i = 0; i < 9; i++) {
      const x = 6 + i * 2.3;
      const y = 24 + i;
      rect(ctx, x, y, 3, 1, '#2e8b57');
      rect(ctx, x + 1, y, 1, 1, '#f4c542');
    }
    px(ctx, 16, 28, '#f4c542');
  }

  // pescoço
  rect(ctx, 14, 20, 4, 3, a.skinShade);
  // rosto
  rect(ctx, 10, 7, 12, 14, a.skin);
  rect(ctx, 11, 21, 10, 1, a.skin);
  rect(ctx, 9, 11, 1, 5, a.skin);
  rect(ctx, 22, 11, 1, 5, a.skin);
  rect(ctx, 10, 19, 1, 2, a.skinShade);
  rect(ctx, 21, 19, 1, 2, a.skinShade);
  // orelhas
  rect(ctx, 8, 12, 1, 3, a.skinShade);
  rect(ctx, 23, 12, 1, 3, a.skinShade);

  // cabelo por cima
  switch (a.style) {
    case 'curto':
      rect(ctx, 10, 5, 12, 3, a.hair);
      rect(ctx, 9, 6, 2, 5, a.hair);
      rect(ctx, 21, 6, 2, 5, a.hair);
      break;
    case 'lateral':
      rect(ctx, 10, 5, 12, 2, a.hair);
      rect(ctx, 9, 6, 3, 5, a.hair);
      rect(ctx, 12, 7, 7, 1, a.hair);
      rect(ctx, 21, 6, 2, 4, a.hair);
      px(ctx, 13, 5, '#ffffff30');
      break;
    case 'careca':
      rect(ctx, 9, 10, 2, 4, a.hair);
      rect(ctx, 21, 10, 2, 4, a.hair);
      px(ctx, 13, 8, '#ffffff50');
      px(ctx, 14, 8, '#ffffff50');
      break;
    case 'longo':
      rect(ctx, 10, 5, 12, 3, a.hair);
      rect(ctx, 9, 6, 2, 8, a.hair);
      rect(ctx, 21, 6, 2, 8, a.hair);
      rect(ctx, 16, 7, 5, 1, a.hair);
      break;
    case 'coque':
      rect(ctx, 13, 1, 6, 4, a.hair);
      rect(ctx, 10, 5, 12, 3, a.hair);
      rect(ctx, 9, 6, 2, 5, a.hair);
      rect(ctx, 21, 6, 2, 5, a.hair);
      break;
    case 'volume':
      rect(ctx, 10, 6, 12, 2, a.hair);
      break;
  }

  if (a.beret) {
    rect(ctx, 9, 4, 14, 4, a.beret);
    rect(ctx, 8, 6, 3, 2, a.beret);
    rect(ctx, 20, 5, 2, 2, '#f4c542');
  }

  // sobrancelhas
  rect(ctx, 12, 10, 3, 1, a.style === 'careca' ? a.skinShade : a.hair);
  rect(ctx, 17, 10, 3, 1, a.style === 'careca' ? a.skinShade : a.hair);
  // olhos
  if (opts.blink) {
    rect(ctx, 12, 12, 3, 1, a.skinShade);
    rect(ctx, 17, 12, 3, 1, a.skinShade);
  } else {
    rect(ctx, 12, 11, 3, 2, WHITE);
    rect(ctx, 17, 11, 3, 2, WHITE);
    rect(ctx, 13, 11, 2, 2, INK);
    rect(ctx, 18, 11, 2, 2, INK);
  }
  // nariz
  rect(ctx, 15, 13, 2, 3, a.skinShade);
  // barba
  if (a.beard) {
    rect(ctx, 10, 16, 12, 5, a.hair);
    rect(ctx, 11, 21, 10, 1, a.hair);
    rect(ctx, 13, 17, 6, 2, a.skin);
  }
  // boca
  const mouth = a.lipstick ? '#a8323a' : '#7a3a30';
  if (opts.talk) {
    rect(ctx, 14, 17, 4, 2, INK);
    rect(ctx, 14, 17, 4, 1, mouth);
  } else {
    rect(ctx, 14, 17, 4, 1, mouth);
  }
  // óculos
  if (a.glasses) {
    ctx.strokeStyle = INK;
    rect(ctx, 11, 10, 5, 1, INK);
    rect(ctx, 16, 11, 1, 1, INK);
    rect(ctx, 16, 10, 5, 1, INK);
    rect(ctx, 11, 13, 5, 1, INK);
    rect(ctx, 16, 13, 5, 1, INK);
    rect(ctx, 11, 10, 1, 4, INK);
    rect(ctx, 15, 10, 1, 4, INK);
    rect(ctx, 16, 10, 1, 4, INK);
    rect(ctx, 20, 10, 1, 4, INK);
  }
}

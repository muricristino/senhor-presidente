import { drawAvatar } from '../art/avatar';
import { makeCanvas } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { ACHIEVEMENTS } from '../engine/achievements';
import { ageOf, yearOf } from '../engine/calendar';
import { AXES } from '../engine/data';
import { dominantLeans, profileTitle } from '../engine/profile';
import type { GameState } from '../engine/types';
import { el, esc } from './dom';
import type { Ending } from '../engine/types';

const W = 1200;
const H = 630;

const ENDING_LINE: Record<Ending, { text: string; color: string }> = {
  impeachment: { text: 'AFASTADO POR IMPEACHMENT', color: '#e0574f' },
  derrota: { text: 'DERROTADO NAS URNAS', color: '#e0574f' },
  renuncia: { text: 'RENUNCIOU AO MANDATO', color: '#e0b04a' },
  fim: { text: 'COMPLETOU OS DOIS MANDATOS', color: '#4fc27f' },
  pausa: { text: 'GOVERNO EM CURSO', color: '#6fb6ff' },
  desconfianca: { text: 'DERRUBADO POR MOÇÃO DE DESCONFIANÇA', color: '#e0574f' },
  queda: { text: 'DERRUBADO PELA REVOLTA POPULAR', color: '#e0574f' },
  exilio: { text: 'TERMINOU NO EXÍLIO', color: '#e0b04a' },
  deposto: { text: 'DEPOSTO POR UM GOLPE', color: '#e0574f' },
  preso: { text: 'PRESO POR TENTATIVA DE GOLPE', color: '#e0574f' },
  cassado: { text: 'CHAPA CASSADA PELO TSE', color: '#e0574f' },
  expurgo: { text: 'EXPURGADO PELO PARTIDO', color: '#e0574f' },
  destituido: { text: 'DESTITUÍDO PELO CONSELHO', color: '#e0574f' },
  morte: { text: 'MORREU NO PODER', color: '#9aa0b4' },
  abertura: { text: 'DEVOLVEU O PAÍS À DEMOCRACIA', color: '#4fc27f' },
};

export interface Legacy {
  headline: string;
  epitaph: string;
}

/** Quebra um texto em linhas que cabem na largura. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Desenha o cartão do legado (1200x630, tamanho de prévia de rede social). */
export async function renderLegacyCard(start: GameState, end: GameState, ending: Ending, legacy: Legacy | null): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts.load('700 40px Game'), document.fonts.load('400 24px Game'), document.fonts.load('20px "Press Start 2P"')]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // fundo
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#243058');
  g.addColorStop(1, '#12141f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff08';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  // faixa verde-amarela
  ctx.fillStyle = '#2e8b57';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = '#f4c542';
  ctx.fillRect(0, 14, W, 6);

  // retrato
  const avatar = makeCanvas(32, 32);
  drawAvatar(avatar.getContext('2d')!, end.player.avatar);
  ctx.fillStyle = '#4e2f1a';
  ctx.fillRect(52, 72, 312, 312);
  ctx.fillStyle = '#f4c542';
  ctx.fillRect(58, 78, 300, 300);
  ctx.drawImage(avatar, 64, 84, 288, 288);

  // título do jogo
  ctx.font = '20px "Press Start 2P"';
  ctx.fillStyle = '#f4c542';
  ctx.fillText('SENHOR PRESIDENTE', 52, 58);

  const x = 404;
  let y = 104;
  ctx.fillStyle = '#9097b4';
  ctx.font = '400 26px Game';
  ctx.fillText(`${start.startYear}–${yearOf(end, end.month)} · ${end.month} meses no poder · ${start.startAge} → ${ageOf(end, end.month)} anos`, x, y);
  y += 58;
  ctx.fillStyle = '#e9e4d4';
  ctx.font = '700 62px Game';
  ctx.fillText(end.player.name.slice(0, 26), x, y);
  y += 44;
  const e = ENDING_LINE[ending];
  ctx.fillStyle = e.color;
  ctx.font = '700 30px Game';
  ctx.fillText(e.text, x, y);
  y += 44;
  ctx.fillStyle = '#ff9f5a';
  ctx.font = '700 38px Game';
  ctx.fillText(profileTitle(end.axes), x, y);

  // manchete e epitáfio escritos pelo Claude
  y += 26;
  if (legacy) {
    ctx.font = '700 32px Game';
    const head = wrap(ctx, `“${legacy.headline}”`, W - x - 90).slice(0, 2);
    ctx.font = '400 22px Game';
    const body = wrap(ctx, legacy.epitaph, W - x - 90).slice(0, 4);
    const boxH = 30 + head.length * 34 + body.length * 24;
    ctx.fillStyle = '#efe9d8';
    ctx.fillRect(x, y, W - x - 48, boxH);
    ctx.fillStyle = '#c63d3d';
    ctx.fillRect(x, y, 10, boxH);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 32px Game';
    head.forEach((l, i) => ctx.fillText(l, x + 26, y + 40 + i * 34));
    ctx.font = '400 22px Game';
    ctx.fillStyle = '#3a3a3a';
    body.forEach((l, i) => ctx.fillText(l, x + 26, y + 44 + head.length * 34 + i * 24));
    y += boxH + 14;
  } else {
    y += 12;
  }

  // indicadores finais
  const stats = [
    ['APROVAÇÃO', `${Math.round(end.kpis.aprovacao)}%`],
    ['INFLAÇÃO', `${end.kpis.inflacao.toFixed(1).replace('.', ',')}%`],
    ['DESEMPREGO', `${end.kpis.desemprego.toFixed(1).replace('.', ',')}%`],
    ['DECISÕES', String(end.history.length)],
  ];
  stats.forEach(([label, value], i) => {
    const sx = x + i * 190;
    ctx.fillStyle = '#0c0e17';
    ctx.fillRect(sx, y, 176, 64);
    ctx.fillStyle = '#9097b4';
    ctx.font = '700 18px Game';
    ctx.fillText(label, sx + 12, y + 22);
    ctx.fillStyle = '#e9e4d4';
    ctx.font = '16px "Press Start 2P"';
    ctx.fillText(value, sx + 12, y + 52);
  });

  // bússola: os polos mais fortes
  let by = 410;
  ctx.font = '700 20px Game';
  ctx.fillStyle = '#f4c542';
  ctx.fillText('BÚSSOLA IDEOLÓGICA', 52, by);
  by += 12;
  for (const l of dominantLeans(end.axes, 4)) {
    const axis = AXES.find((a) => a.id === l.axis.id)!;
    ctx.fillStyle = '#9097b4';
    ctx.font = '400 18px Game';
    ctx.fillText(`${axis.poleA} ↔ ${axis.poleB}`, 52, by + 18);
    ctx.fillStyle = '#0c0e17';
    ctx.fillRect(52, by + 24, 312, 10);
    ctx.fillStyle = '#3a4163';
    ctx.fillRect(52 + 155, by + 22, 2, 14);
    ctx.fillStyle = '#f4c542';
    ctx.fillRect(52 + ((l.value + 100) / 200) * 306, by + 20, 6, 18);
    by += 46;
  }

  // troféus
  const trophies = (end.trophies ?? []).map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.icon).filter(Boolean);
  if (trophies.length) {
    ctx.font = '34px sans-serif';
    trophies.slice(0, 14).forEach((icon, i) => ctx.fillText(icon!, x + i * 46, H - 40));
  }
  ctx.font = '400 18px Game';
  ctx.fillStyle = '#9097b4';
  ctx.textAlign = 'right';
  ctx.fillText('Simulador político em pixel art', W - 48, H - 22);
  ctx.textAlign = 'left';
  return c;
}

/** Mostra o cartão com as opções de baixar e compartilhar. */
export async function showLegacyCard(host: HTMLElement, start: GameState, end: GameState, ending: Ending, legacy: Legacy | null) {
  const card = await renderLegacyCard(start, end, ending, legacy);
  const overlay = el(
    'div',
    'overlay card-overlay',
    `<div class="card-box">
      <div class="modal-head">🖼️ CARTÃO DO LEGADO <button class="close" aria-label="Fechar">✕</button></div>
      <div class="card-preview"></div>
      <div class="lesson-actions">
        <button class="btn-copy">📋 COPIAR IMAGEM</button>
        <button class="btn-share">📤 COMPARTILHAR</button>
        <button class="btn-download">⬇️ BAIXAR PNG</button>
      </div>
      <p class="card-status"></p>
    </div>`,
  );
  card.className = 'card-canvas';
  overlay.querySelector('.card-preview')!.append(card);
  host.append(overlay);
  sfx.fanfare();

  const status = overlay.querySelector<HTMLElement>('.card-status')!;
  const blob = () => new Promise<Blob>((r) => card.toBlob((b) => r(b!), 'image/png'));
  const fileName = `legado-${end.player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  const download = async () => {
    const url = URL.createObjectURL(await blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    status.textContent = 'Imagem baixada.';
  };
  overlay.querySelector('.btn-download')!.addEventListener('click', () => void download());
  overlay.querySelector('.btn-copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await blob() })]);
      status.textContent = 'Imagem copiada. É só colar no WhatsApp ou nas redes.';
    } catch {
      status.textContent = 'Seu navegador não deixou copiar; use o botão de baixar.';
    }
  });
  overlay.querySelector('.btn-share')!.addEventListener('click', async () => {
    const file = new File([await blob()], fileName, { type: 'image/png' });
    const text = legacy ? `${legacy.headline} · Meu legado em Senhor Presidente` : `Meu legado em Senhor Presidente: ${profileTitle(end.axes)}`;
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text }).catch(() => undefined);
    } else {
      await download();
      status.textContent = 'Compartilhamento direto indisponível neste navegador: a imagem foi baixada.';
    }
  });
  const close = () => {
    sfx.click();
    overlay.remove();
  };
  overlay.querySelector('.close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  void esc;
}

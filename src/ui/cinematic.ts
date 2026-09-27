import { CutscenePlayer, cutsceneDuration } from '../art/cutscene';
import { sfx } from '../audio/sfx';
import { SCENE_H, SCENE_W } from '../engine/catalog';
import type { Cutscene, PixelSprite } from '../engine/types';
import { slow } from '../speed';
import { el, esc, typewriter, wait } from './dom';

const SCALE = 5;

/** Toca um roteiro em tela cheia, com legenda de telejornal e balões de fala. Clique pula. */
export async function playCinematic(host: HTMLElement, script: Cutscene, library: Map<string, PixelSprite>, kicker = 'AO VIVO') {
  const overlay = el(
    'div',
    'overlay cinema',
    `<div class="cinema-frame" style="width:${SCENE_W * SCALE}px;height:${SCENE_H * SCALE}px">
       <div class="cinema-bubbles"></div>
       <div class="cinema-live"><i></i>${esc(kicker)}</div>
     </div>
     <div class="cinema-caption"><span></span></div>
     <button class="cinema-skip">pular ▶</button>`,
  );
  const frame = overlay.querySelector<HTMLElement>('.cinema-frame')!;
  const bubbles = overlay.querySelector<HTMLElement>('.cinema-bubbles')!;
  const player = new CutscenePlayer(script, library, {
    onSay(text, x, y, dur) {
      const b = el('div', 'cinema-bubble', esc(text));
      b.style.left = `${x * SCALE}px`;
      b.style.top = `${y * SCALE}px`;
      bubbles.append(b);
      for (let i = 0; i < 6; i++) setTimeout(sfx.type, i * 40);
      setTimeout(() => b.classList.add('out'), slow(dur * 1000));
      setTimeout(() => b.remove(), slow(dur * 1000 + 300));
    },
    onSound(kind) {
      if (kind === 'slam') sfx.gavel();
      else if (kind === 'flash') sfx.stamp();
      else if (kind === 'shake') sfx.down();
      else if (kind === 'jump') sfx.hover();
      else sfx.tick();
    },
  });
  frame.prepend(player.canvas);
  host.append(overlay);
  player.start();

  let skipped = false;
  const skip = new Promise<void>((resolve) => {
    const done = () => {
      skipped = true;
      resolve();
    };
    overlay.addEventListener('click', done, { once: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.code === 'Space') {
        document.removeEventListener('keydown', onKey);
        done();
      }
    };
    setTimeout(() => document.addEventListener('keydown', onKey), 300);
  });
  void typewriter(overlay.querySelector<HTMLElement>('.cinema-caption span')!, script.caption, 22, sfx.type);
  await Promise.race([wait(cutsceneDuration(script) * 1000), skip]);
  overlay.classList.add('out');
  await wait(skipped ? 120 : 300);
  player.stop();
  overlay.remove();
}

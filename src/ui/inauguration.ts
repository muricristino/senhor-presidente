import { drawAvatar } from '../art/avatar';
import { makeCanvas } from '../art/pixel';
import { sfx } from '../audio/sfx';
import type { Country, Player } from '../engine/types';
import { el, typewriter } from './dom';

/** Cena curta de posse: dá peso ao momento antes de jogar o presidente na crise. */
export function inaugurationScreen(root: HTMLElement, player: Player, country: Country, onDone: () => void) {
  const screen = el('div', 'screen inauguration');
  screen.innerHTML = `
    <div class="inaug-portrait"></div>
    <p class="inaug-text"></p>
    <p class="inaug-skip">clique para continuar</p>`;
  root.replaceChildren(screen);
  const canvas = makeCanvas(32, 32, 'inaug-canvas');
  screen.querySelector('.inaug-portrait')!.append(canvas);
  drawAvatar(canvas.getContext('2d')!, player.avatar);

  const text = `${country.capital}, 1º de janeiro. Diante do ${country.institutions.legislative}, ${player.name} recebe a faixa presidencial e jura cumprir a Constituição de ${country.institutions.constitution_year}. Às 6h da manhã seguinte, o telefone do ${country.palace} toca.`;
  const textEl = screen.querySelector<HTMLElement>('.inaug-text')!;
  let typed = false;
  let finished = false;
  const done = () => {
    if (!typed) return textEl.click();
    if (finished) return;
    finished = true;
    document.removeEventListener('keydown', onKey);
    sfx.ring();
    onDone();
  };
  const onKey = (e: KeyboardEvent) => (e.key === 'Enter' || e.code === 'Space') && done();
  void typewriter(textEl, text, 28, sfx.type).then(() => {
    typed = true;
    screen.querySelector('.inaug-skip')!.textContent = '▶ assumir o gabinete';
  });
  setTimeout(() => {
    let typedAtDown = false;
    screen.addEventListener('pointerdown', () => (typedAtDown = typed));
    screen.addEventListener('click', (e) => {
      if (typedAtDown) return done();
      if (e.target !== textEl) textEl.click();
    });
    document.addEventListener('keydown', onKey);
  }, 600);
}

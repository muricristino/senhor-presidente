import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { el, esc } from '../ui/dom';
import { DEMOS, type Demo } from './demos';
import { Stage } from './engine';

/** Laboratório de animação: vitrine do motor novo, com demos jogáveis. */
export function showLab(root: HTMLElement, onBack: () => void) {
  music.play('calm');
  const screen = el(
    'div',
    'screen lab',
    `<header class="lab-head">
      <div><b>🧪 LABORATÓRIO DE ANIMAÇÃO</b><small>Motor novo de cenas interativas: jogue dentro da animação</small></div>
      <button class="home-btn ghost lab-back">◀ VOLTAR</button>
    </header>
    <div class="lab-body">
      <nav class="lab-list">
        ${DEMOS.map(
          (d) => `<button class="lab-card" data-id="${d.id}">
            <span class="lc-icon">${d.icon}</span>
            <div><b>${esc(d.title)}</b><small>${esc(d.kind)}</small></div>
          </button>`,
        ).join('')}
      </nav>
      <main class="lab-main">
        <div class="lab-frame"><div class="lab-hud"></div><span class="lab-fps"></span></div>
        <div class="lab-info">
          <p class="lab-help"></p>
          <div class="lab-tests"></div>
          <button class="home-btn lab-restart">↺ REINICIAR</button>
        </div>
      </main>
    </div>`,
  );
  root.replaceChildren(screen);
  let stage: Stage | null = null;
  let current: Demo = DEMOS[0];
  const fpsTimer = setInterval(() => {
    if (!screen.isConnected) return clearInterval(fpsTimer);
    if (stage) screen.querySelector('.lab-fps')!.textContent = `${stage.fpsValue} fps`;
  }, 500);

  const open = (d: Demo) => {
    current = d;
    stage?.stop();
    stage = new Stage();
    const frame = screen.querySelector('.lab-frame')!;
    const hud = screen.querySelector<HTMLElement>('.lab-hud')!;
    hud.innerHTML = '';
    frame.prepend(stage.root);
    screen.querySelectorAll('.lab-card').forEach((c) => c.classList.toggle('active', (c as HTMLElement).dataset.id === d.id));
    screen.querySelector('.lab-help')!.textContent = d.help;
    screen.querySelector('.lab-tests')!.innerHTML = `<span>O QUE TESTA</span>${d.tests.map((t) => `<i>✓ ${esc(t)}</i>`).join('')}`;
    stage.start();
    void d.run(stage, hud);
  };

  screen.querySelectorAll<HTMLElement>('.lab-card').forEach((c) =>
    c.addEventListener('click', () => {
      sfx.select();
      open(DEMOS.find((d) => d.id === c.dataset.id)!);
    }),
  );
  screen.querySelector('.lab-restart')!.addEventListener('click', () => {
    sfx.click();
    open(current);
  });
  screen.querySelector('.lab-back')!.addEventListener('click', () => {
    sfx.click();
    stage?.stop();
    onBack();
  });
  open(DEMOS[0]);
}

import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { el, esc } from '../ui/dom';
import { DEMOS, type Demo } from './demos';
import { Stage } from './engine';
import { requestScript } from './scripts';

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
            <div><b>${esc(d.title)}</b><small>${esc(d.kind)}</small><em class="lc-status"></em></div>
          </button>`,
        ).join('')}
      </nav>
      <main class="lab-main">
        <div class="lab-frame"><div class="lab-hud"></div><span class="lab-fps"></span></div>
        <div class="lab-info">
          <p class="lab-help"></p>
          <div class="lab-tests"></div>
          <div class="lab-buttons"><button class="home-btn lab-restart">↺ REINICIAR</button><button class="home-btn ghost lab-regen">✦ GERAR OUTRA</button></div>
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

  const status = (d: Demo, text: string) => {
    const s = screen.querySelector(`.lab-card[data-id="${d.id}"] .lc-status`);
    if (s) s.textContent = text;
  };
  // As cenas com roteiro do Claude começam a ser escritas assim que o laboratório abre.
  const prepare = (d: Demo, fresh = false) => {
    if (!d.script) return Promise.resolve(undefined);
    status(d, '✦ o Claude está escrevendo…');
    const job = requestScript(d.script, fresh);
    job.then(() => status(d, '✦ roteiro pronto'), (e) => status(d, `⚠ ${(e as Error).message}`));
    return job;
  };
  DEMOS.forEach((d) => void prepare(d));
  // A caixa de escolhas começa logo abaixo dos medidores da cena, qualquer que seja a altura deles.
  const hudEl = screen.querySelector<HTMLElement>('.lab-hud')!;
  const frameEl = screen.querySelector<HTMLElement>('.lab-frame')!;
  new ResizeObserver(() => frameEl.style.setProperty('--hud-h', `${hudEl.offsetHeight}px`)).observe(hudEl);

  const open = async (d: Demo, fresh = false) => {
    current = d;
    stage?.stop();
    const st = new Stage();
    stage = st;
    const frame = screen.querySelector('.lab-frame')!;
    const hud = screen.querySelector<HTMLElement>('.lab-hud')!;
    hud.innerHTML = '';
    frame.prepend(st.root);
    screen.querySelectorAll('.lab-card').forEach((c) => c.classList.toggle('active', (c as HTMLElement).dataset.id === d.id));
    screen.querySelector('.lab-help')!.textContent = d.help;
    screen.querySelector('.lab-tests')!.innerHTML = `<span>O QUE ENSINA</span>${d.teaches.map((t) => `<i>✓ ${esc(t)}</i>`).join('')}`;
    (screen.querySelector('.lab-regen') as HTMLElement).style.display = d.script ? '' : 'none';
    st.start();
    let script: unknown;
    if (d.script) {
      const wait = el('div', 'lab-loading', '<div>✍️</div><b>O Claude está escrevendo a cena a partir do seu mandato…</b>');
      st.ui.append(wait);
      try {
        script = await prepare(d, fresh);
      } catch (e) {
        wait.innerHTML = `<div>⚠️</div><b>Não deu para gerar esta cena.</b><small>${esc((e as Error).message)}</small>`;
        return;
      }
      wait.remove();
      if (stage !== st) return;
    }
    void d.run(st, hud, script);
  };

  screen.querySelectorAll<HTMLElement>('.lab-card').forEach((c) =>
    c.addEventListener('click', () => {
      sfx.select();
      void open(DEMOS.find((d) => d.id === c.dataset.id)!);
    }),
  );
  screen.querySelector('.lab-restart')!.addEventListener('click', () => {
    sfx.click();
    void open(current);
  });
  screen.querySelector('.lab-regen')!.addEventListener('click', () => {
    sfx.click();
    void open(current, true);
  });
  screen.querySelector('.lab-back')!.addEventListener('click', () => {
    sfx.click();
    stage?.stop();
    onBack();
  });
  void open(DEMOS[0]);
}

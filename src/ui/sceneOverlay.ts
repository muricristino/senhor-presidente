import { sfx } from '../audio/sfx';
import { getCountry } from '../engine/data';
import type { GameState } from '../engine/types';
import type { Demo, SceneResult } from '../lab/demos';
import { Stage } from '../lab/engine';
import { el, esc } from './dom';

function effectChips(r: SceneResult, state: GameState): string {
  const country = getCountry(state.countryId);
  const out: string[] = [];
  const k = r.effects.kpis ?? {};
  const kpi = (id: keyof typeof k, label: string, invert = false, dec = 0) => {
    const v = k[id];
    if (!v) return;
    const good = invert ? v < 0 : v > 0;
    out.push(`<span class="chip ${good ? 'up' : 'down'}">${label} ${v > 0 ? '+' : ''}${dec ? v.toFixed(dec) : Math.round(v)}</span>`);
  };
  kpi('aprovacao', 'Aprovação');
  kpi('coalizao', 'Coalizão');
  kpi('inflacao', 'Inflação', true, 1);
  kpi('desemprego', 'Desemprego', true, 1);
  for (const [id, v] of Object.entries(r.effects.factions ?? {})) {
    const f = country.factions.find((x) => x.id === id);
    if (f && v) out.push(`<span class="chip ${v > 0 ? 'up' : 'down'}">${v > 0 ? '👍' : '👎'} ${esc(f.short)}</span>`);
  }
  for (const [id, v] of Object.entries(r.effects.relations ?? {})) {
    const p = country.partners.find((x) => x.id === id);
    if (p && v) out.push(`<span class="chip ${v > 0 ? 'up' : 'down'}">${p.flag} ${v > 0 ? '+' : ''}${Math.round(v)}</span>`);
  }
  return out.join('') || '<span class="chip">sem efeito nos números</span>';
}

/** Roda uma cena interativa em tela cheia por cima do gabinete e devolve o resultado para o mandato. */
export async function playScene(host: HTMLElement, demo: Demo, script: unknown, state: GameState): Promise<SceneResult | null> {
  const overlay = el(
    'div',
    'overlay scene-overlay',
    `<div class="scene-box">
      <div class="scene-head"><span>${demo.icon}</span><b>${esc(demo.title)}</b><em>${demo.teaches.map((t) => `<i>✓ ${esc(t)}</i>`).join('')}</em>${demo.skip ? '<button class="scene-skip" title="Pular (Esc)">⏭ PULAR</button>' : ''}</div>
      <div class="lab-frame scene-frame"><div class="lab-hud"></div></div>
      <p class="scene-help">${esc(demo.help)}</p>
    </div>`,
  );
  host.append(overlay);
  const stage = new Stage();
  const frame = overlay.querySelector<HTMLElement>('.scene-frame')!;
  const hud = overlay.querySelector<HTMLElement>('.lab-hud')!;
  frame.prepend(stage.root);
  new ResizeObserver(() => frame.style.setProperty('--hud-h', `${hud.offsetHeight}px`)).observe(hud);
  stage.start();
  sfx.ring();
  // Pular é uma escolha como outra qualquer: devolve o custo de fugir da situação.
  const skipBtn = overlay.querySelector<HTMLButtonElement>('.scene-skip');
  const skipped = new Promise<'skip'>((resolve) => {
    if (!skipBtn) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && go();
    const go = () => {
      document.removeEventListener('keydown', onKey);
      resolve('skip');
    };
    skipBtn.addEventListener('click', go, { once: true });
    document.addEventListener('keydown', onKey);
  });
  const outcome = await Promise.race([demo.run(stage, hud, script, { state }).then((r) => ({ r: r ?? null })), skipped]);
  let result: SceneResult | null;
  if (outcome === 'skip') {
    sfx.down();
    skipBtn?.remove();
    stage.ui.replaceChildren();
    result = demo.skip?.(script, { state }) ?? null;
  } else {
    skipBtn?.remove();
    result = outcome.r;
  }
  if (result) {
    const card = el(
      'div',
      'scene-result',
      `<span class="sr-icon">${result.icon}</span><div><b>${esc(result.headline)}</b><div class="chips">${effectChips(result, state)}</div></div><button class="btn-continue">CONTINUAR ▶</button>`,
    );
    overlay.querySelector('.scene-box')!.append(card);
    await new Promise<void>((r) => card.querySelector('.btn-continue')!.addEventListener('click', () => r(), { once: true }));
    sfx.click();
  }
  stage.stop();
  overlay.remove();
  return result;
}

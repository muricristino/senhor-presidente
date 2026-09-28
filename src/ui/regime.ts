import { sfx } from '../audio/sfx';
import { CRISES, democracyIndex, democracyLabel, getRegime, INSTITUTIONS, institutionsOf, regimeOf, routeOpen, type RegimeRoute } from '../engine/regime';
import type { Cutscene, GameState } from '../engine/types';
import { playCinematic } from './cinematic';
import { el, esc, wait } from './dom';
import type { Gabinete } from './shell';

/*
 * Os dois momentos de regime na tela: a audiência reservada em que alguém oferece a ruptura,
 * e a cerimônia que apresenta o regime novo (o que se ganha, o que se perde, onde já aconteceu).
 */

const VIA: Record<RegimeRoute['via'], string> = { plebiscito: 'plebiscito', constituinte: 'constituinte', golpe: 'golpe', revolucao: 'revolução' };

/** A audiência reservada: rotas de ruptura com os requisitos à vista. Devolve a escolhida, ou null (mandou embora). */
export function runRuptureDoor(g: Gabinete, routes: RegimeRoute[], reason: string, ready: (r: RegimeRoute) => boolean): Promise<RegimeRoute | null> {
  g.renderMonth();
  g.renderTimeline('🕯️');
  g.showDesk();
  g.setScene('military');
  g.desk.innerHTML = `
    <div class="memo pauta rupture-door">
      <div class="memo-clip"></div>
      <div class="dossier-top"><span class="kicker">🕯️ AUDIÊNCIA RESERVADA · FORA DA AGENDA</span><span class="step">✦ SIGILO</span></div>
      <p class="door-reason">${esc(reason)}</p>
      <div class="door-routes">
        ${routes
          .map((r, i) => {
            const reg = getRegime(r.to);
            const open = routeOpen(r);
            const ok = open && ready(r);
            return `<article class="door-route ${ok ? 'ok' : 'locked'}" style="--i:${i};--acc:${reg.accent}">
              <div class="bill-top"><span class="bill-icon">${reg.icon}</span><div><small>${VIA[r.via].toUpperCase()} · VOCÊ VIRA ${esc(reg.headTitle.toUpperCase())}</small><b>${esc(reg.name)}</b></div></div>
              <ul class="door-reqs">${r.reqs.map((x) => `<li class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✓' : '✗'} ${esc(x.label)}</li>`).join('')}</ul>
              <button class="door-go" data-i="${i}" ${ok ? '' : 'disabled'}>${ok ? '🌒 Ouvir o plano' : open ? '⏳ plano em preparação' : '🔒 faltam condições'}</button>
            </article>`;
          })
          .join('')}
      </div>
      <button class="pauta-skip door-no">🚪 Mandar embora: o poder tem regras</button>
      <div class="stamp memo-stamp"></div>
    </div>`;
  void g.say('Presidente, isso tem nome: golpe. Se der errado, é prisão. Se der certo, não tem volta. E quem ajuda a subir cobra para sempre.');
  sfx.down();
  return new Promise((resolve) => {
    const finish = async (r: RegimeRoute | null) => {
      const stamp = g.desk.querySelector<HTMLElement>('.memo-stamp')!;
      stamp.textContent = r ? 'SIGILOSO' : 'RECUSADO';
      stamp.classList.add('show');
      sfx.stamp();
      await wait(800);
      g.desk.querySelector('.rupture-door')?.classList.add('out');
      await wait(250);
      resolve(r);
    };
    g.desk.querySelectorAll<HTMLButtonElement>('.door-go').forEach((b) => b.addEventListener('click', () => void finish(routes[Number(b.dataset.i)])));
    g.desk.querySelector('.door-no')!.addEventListener('click', () => void finish(null));
  });
}

/** A cerimônia do regime novo: primeiro a cinemática do Claude (se chegar a tempo), depois a ficha. */
export async function showRegimeChange(g: Gabinete, before: GameState, after: GameState, via: string, cut: Promise<Cutscene | null>) {
  const r = regimeOf(after);
  const loading = el('div', 'overlay regime-loading', `<div><span>📺</span><b>PLANTÃO · EDIÇÃO EXTRA</b><small>As emissoras interrompem a programação…</small></div>`);
  g.screen.append(loading);
  const script = await Promise.race([cut.catch(() => null), wait(25_000).then(() => null)]);
  loading.remove();
  if (script) await playCinematic(g.screen, script, g.library, 'MARCO HISTÓRICO');

  const i0 = democracyIndex(before);
  const i1 = democracyIndex(after);
  const inst = institutionsOf(after);
  const overlay = el(
    'div',
    'overlay regime-overlay',
    `<div class="regime-card" style="--acc:${r.accent}">
      <div class="rc-icon">${r.icon}</div>
      <div class="lesson-kicker">MARCO HISTÓRICO · ${esc(via.toUpperCase())}</div>
      <h2>O Brasil agora é: ${esc(r.name)}</h2>
      <p class="rc-you">Você passa a ser <b>${esc(r.headTitle)}</b>. ${esc(r.summary)}</p>
      <div class="rc-cols">
        <div class="rc-gain"><b>O que se ganha</b><p>${esc(r.gains)}</p></div>
        <div class="rc-loss"><b>O que se perde</b><p>${esc(r.losses)}</p></div>
      </div>
      <div class="rc-row"><span>Onde já aconteceu:</span>${r.examples.map((x) => `<i class="chip">${esc(x)}</i>`).join('')}</div>
      <div class="rc-row"><span>Índice de democracia:</span><b>${i0}</b> → <b class="${i1 < i0 ? 'bad' : 'good'}">${i1}</b> <em>${esc(democracyLabel(i1).label)}</em></div>
      <div class="rc-inst">${INSTITUTIONS.map((x) => `<div><span>${x.icon} ${esc(x.name)}</span><i><b style="width:${inst[x.id]}%"></b></i></div>`).join('')}</div>
      <div class="rc-row"><span>Agora você pode cair por:</span>${r.removal.map((k) => `<i class="chip down">${CRISES[k].icon} ${esc(CRISES[k].name)}</i>`).join('')}</div>
      <button class="btn-continue">GOVERNAR ▶</button>
    </div>`,
  );
  g.screen.append(overlay);
  sfx.fanfare();
  await new Promise<void>((resolve) => overlay.querySelector('.btn-continue')!.addEventListener('click', () => resolve(), { once: true }));
  sfx.click();
  overlay.remove();
}

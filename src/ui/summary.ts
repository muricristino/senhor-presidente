import { drawAvatar } from '../art/avatar';
import { makeCanvas } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { AXES } from '../engine/data';
import { formatDelta, formatKpi, KPIS } from '../engine/kpis';
import { ACHIEVEMENTS } from '../engine/achievements';
import { ageOf, yearOf } from '../engine/calendar';
import { dominantLeans, profileTitle } from '../engine/profile';
import type { Country, GameState } from '../engine/types';
import { slow } from '../speed';
import { el, esc, wait } from './dom';

/** Frase de legado provisório a partir dos dois polos mais fortes. */
function legacy(state: GameState, ending: Ending): string {
  const leans = dominantLeans(state.axes, 2);
  const closing: Record<Ending, string> = {
    impeachment: 'Saiu pela porta dos fundos, afastado pelo Congresso.',
    derrota: 'O eleitor não renovou o contrato.',
    renuncia: 'Preferiu sair antes de ser tirado.',
    fim: state.kpis.aprovacao >= 50 ? 'Deixa o Planalto aplaudido.' : 'Deixa o Planalto sob vaias, mas completou os oito anos.',
    pausa: state.kpis.aprovacao >= 55 ? 'O povo está com você, por enquanto.' : state.kpis.aprovacao < 40 ? 'A rua já fala em impeachment.' : 'O país segue dividido sobre o seu governo.',
  };
  if (!leans.length) return `Um governo que evitou lados. ${closing[ending]}`;
  const marks = leans.map((l) => `${l.pole} (${l.axis.category})`).join(' e ');
  return `Seu governo fica marcado por: ${marks}. ${closing[ending]}`;
}

export type Ending = 'impeachment' | 'derrota' | 'renuncia' | 'fim' | 'pausa';

const ENDING_TITLE: Record<Ending, string> = {
  impeachment: '⚖️ IMPEACHMENT: o Congresso afastou o presidente',
  derrota: '🗳️ DERROTADO NAS URNAS',
  renuncia: '🚪 O PRESIDENTE RENUNCIOU',
  fim: '🏁 FIM DO SEGUNDO MANDATO: oito anos no Planalto',
  pausa: 'BALANÇO DO GOVERNO ATÉ AQUI',
};

export function summaryScreen(
  root: HTMLElement,
  country: Country,
  start: GameState,
  end: GameState,
  ending: Ending,
  cb: { onReplay: () => void; onNewPresident: () => void },
) {

  const screen = el('div', 'screen summary');
  screen.innerHTML = `
    <header class="sum-head">
      <div class="sum-portrait"></div>
      <div>
        <div class="lesson-kicker ending-${ending}">${ENDING_TITLE[ending]}</div>
        <div class="sum-span">${start.startYear}–${yearOf(end, end.month)} · ${end.term === 1 ? 'primeiro' : 'segundo'} mandato · ${end.month} meses no poder · ${start.startAge} → ${ageOf(end, end.month)} anos</div>
        <h1>${esc(end.player.name)}</h1>
        <div class="profile-big">${esc(profileTitle(end.axes))}</div>
        <p class="legacy"></p>
        <div class="sum-trophies">${(end.trophies ?? [])
          .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
          .filter((a) => !!a)
          .map((a) => `<span class="chip lean" title="${esc(a!.desc)}">${a!.icon} ${esc(a!.name)}</span>`)
          .join('')}</div>
      </div>
    </header>
    <div class="sum-grid">
      <section class="panel">
        <div class="panel-label">SUAS ${end.history.length} DECISÕES</div>
        <ol class="sum-decisions">
          ${end.history
            .slice(-7)
            .map(
              (h, i) => `<li style="--i:${i}"><span class="sd-icon">${h.icon}</span><div><small>MÊS ${String(h.month).padStart(2, '0')} · ${esc(h.event)}</small><b>${esc(h.choice)}</b></div></li>`,
            )
            .join('')}
        </ol>
      </section>
      <section class="panel">
        <div class="panel-label">O PAÍS: ANTES → AGORA</div>
        <ul class="sum-kpis">
          ${KPIS.map((k) => {
            const d = Math.round((end.kpis[k.id] - start.kpis[k.id]) * 100) / 100;
            const good = d * k.good > 0;
            return `<li><span>${esc(k.label)}</span><em>${formatKpi(k.id, start.kpis[k.id])} → <b>${formatKpi(k.id, end.kpis[k.id])}</b></em><i class="${d === 0 ? '' : good ? 'good' : 'bad'}">${d === 0 ? '=' : formatDelta(k.id, d)}</i></li>`;
          }).join('')}
        </ul>
      </section>
      <section class="panel">
        <div class="panel-label">SUA BÚSSOLA IDEOLÓGICA</div>
        <div class="sum-axes">
          ${AXES.map(
            (a) => `<div class="sum-axis"><span class="pa">${esc(a.poleA)}</span><div class="axis-track"><i class="axis-mid"></i><i class="axis-marker" style="left:50%" data-v="${(end.axes[a.id] + 100) / 2}"></i></div><span class="pb">${esc(a.poleB)}</span></div>`,
          ).join('')}
        </div>
      </section>
    </div>
    <div class="lesson-actions">
      <button class="btn-new">NOVO PRESIDENTE</button>
      <button class="btn-next">↺ JOGAR DE NOVO COM OUTRAS ESCOLHAS</button>
    </div>`;
  root.replaceChildren(screen);

  const c = makeCanvas(32, 32, 'sum-canvas');
  screen.querySelector('.sum-portrait')!.append(c);
  drawAvatar(c.getContext('2d')!, end.player.avatar);
  sfx.fanfare();

  void (async () => {
    await wait(400);
    screen.querySelectorAll<HTMLElement>('.sum-axes .axis-marker').forEach((m, i) => {
      setTimeout(() => (m.style.left = `${m.dataset.v}%`), slow(i * 70));
    });
    const p = screen.querySelector<HTMLElement>('.legacy')!;
    const text = `${ending === 'pausa' ? 'Legado provisório' : 'Legado'}: ${legacy(end, ending)}`;
    for (let i = 0; i <= text.length; i++) {
      p.textContent = text.slice(0, i);
      if (i % 3 === 0) sfx.type();
      await wait(14);
    }
  })();

  screen.querySelector('.btn-next')!.addEventListener('click', () => {
    sfx.click();
    cb.onReplay();
  });
  screen.querySelector('.btn-new')!.addEventListener('click', () => {
    sfx.click();
    cb.onNewPresident();
  });
  void country;
}

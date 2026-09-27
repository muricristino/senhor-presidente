import { sfx } from '../audio/sfx';
import { AXES } from '../engine/data';
import { formatDelta, KPIS } from '../engine/kpis';
import { dominantLeans, lean, profileTitle } from '../engine/profile';
import type { Country, Deltas, EventOption, GameEvent, GameState } from '../engine/types';
import { el, esc, typewriter, wait } from './dom';

function mount(host: HTMLElement, className: string, html: string): HTMLElement {
  const overlay = el('div', `overlay ${className}`);
  overlay.innerHTML = html;
  host.append(overlay);
  return overlay;
}

function waitClick(button: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      sfx.click();
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        done();
      }
    };
    button.addEventListener('click', done, { once: true });
    setTimeout(() => document.addEventListener('keydown', onKey), 400);
    button.focus();
  });
}

export async function showNewspaper(host: HTMLElement, opt: EventOption, deltas: Deltas, state: GameState, country?: Country) {
  const rows =
    KPIS.filter((k) => deltas.kpis[k.id])
      .map((k) => {
        const d = deltas.kpis[k.id]!;
        const good = d * k.good > 0;
        return `<li class="${good ? 'good' : 'bad'}"><span>${esc(k.label)}</span><b>${good ? '▲' : '▼'} ${formatDelta(k.id, d)}</b></li>`;
      })
      .join('') +
    (country?.partners ?? [])
      .filter((p) => deltas.relations?.[p.id])
      .map((p) => {
        const d = deltas.relations[p.id];
        return `<li class="${d > 0 ? 'good' : 'bad'}"><span>${p.flag} Relação com ${esc(p.short)}</span><b>${d > 0 ? '▲' : '▼'} ${d > 0 ? '+' : ''}${Math.round(d)}</b></li>`;
      })
      .join('');
  const overlay = mount(
    host,
    'newspaper-overlay',
    `<article class="newspaper">
      <header>
        <div class="np-name">CORREIO DO PLANALTO</div>
        <div class="np-meta"><span>BRASÍLIA</span><span>MÊS ${String(state.month).padStart(2, '0')} DO MANDATO</span><span>EDIÇÃO EXTRA</span></div>
      </header>
      <h1>${esc(opt.headline)}</h1>
      <p class="np-sub">${esc(opt.subhead)}</p>
      <div class="np-cols">
        <div class="np-photo"><span>${opt.icon}</span></div>
        <div class="np-board">
          <div class="np-board-title">PLACAR DO GOVERNO</div>
          <ul>${rows || '<li>Nenhum indicador mudou.</li>'}</ul>
        </div>
      </div>
      <button class="btn-continue">CONTINUAR ➔</button>
    </article>`,
  );
  sfx.select();
  await waitClick(overlay.querySelector('.btn-continue')!);
  overlay.remove();
}

export async function showStf(host: HTMLElement, stf: NonNullable<EventOption['stf']>, country: Country) {
  const overlay = mount(
    host,
    'stf-overlay',
    `<div class="stf-card">
      <div class="stf-gavel">⚖️</div>
      <div class="stf-court">${esc(country.institutions.supreme_court)} · SUPREMO TRIBUNAL FEDERAL</div>
      <h2>${esc(stf.title)}</h2>
      <p class="stf-text"></p>
      <button class="btn-continue">ACATAR A DECISÃO ➔</button>
    </div>`,
  );
  await typewriter(overlay.querySelector('.stf-text')!, stf.text, 12, sfx.type);
  await waitClick(overlay.querySelector('.btn-continue')!);
  overlay.remove();
}

const PATHS_KEY = 'sp.paths';

function discoveredPaths(eventId: string, optionId: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(PATHS_KEY) ?? '{}') as Record<string, string[]>;
    const list = new Set(all[eventId] ?? []);
    list.add(optionId);
    all[eventId] = [...list];
    localStorage.setItem(PATHS_KEY, JSON.stringify(all));
    return all[eventId];
  } catch {
    return [optionId];
  }
}

export async function showLesson(
  host: HTMLElement,
  opt: EventOption,
  state: GameState,
  country: Country,
  event: GameEvent,
  cb: { last: boolean; onRetry: () => void; onNext: () => void },
) {
  const moved = AXES.filter((a) => opt.effects.axes?.[a.id]).map((a, i) => {
    const d = opt.effects.axes![a.id]!;
    const l = lean(a, d);
    return `<li style="--i:${i}"><b class="${d > 0 ? 'pb' : 'pa'}">${d > 0 ? '▶' : '◀'} ${esc(l.pole)}</b> <small>(${esc(a.category)})</small><p>${esc(l.explain)}</p></li>`;
  });
  const factionLines = [
    ...country.factions.filter((f) => opt.effects.factions?.[f.id]).map((f) => ({ d: opt.effects.factions![f.id], label: f.short })),
    ...(country.partners ?? []).filter((p) => opt.effects.relations?.[p.id]).map((p) => ({ d: opt.effects.relations![p.id], label: `${p.flag} ${p.short}` })),
  ]
    .map(({ d, label }, i) => `<span class="chip ${d > 0 ? 'up' : 'down'}" style="--i:${i}">${d > 0 ? '👍' : '👎'} ${esc(label)}</span>`)
    .join('');
  const leans = dominantLeans(state.axes, 3);
  const allPaths = [...event.options, event.omission];
  const found = discoveredPaths(event.id, opt.id);

  const overlay = mount(
    host,
    'lesson-overlay',
    `<div class="lesson">
      <div class="lesson-kicker">📖 O PESO DA CANETA</div>
      <h2>${esc(opt.lesson.title)}</h2>
      <p class="lesson-text">${esc(opt.lesson.text || 'Veja abaixo para onde esta decisão empurrou o seu governo, e quem ganhou e perdeu com ela.')}</p>
      <div class="lesson-grid">
        <div>
          <div class="panel-label">PARA ONDE VOCÊ SE MOVEU</div>
          <ul class="moved">${moved.join('') || '<li class="none">Nenhum eixo se moveu: você não defendeu nenhuma ideia.</li>'}</ul>
        </div>
        <div>
          <div class="panel-label">QUEM GOSTOU (E QUEM NÃO)</div>
          <div class="chips">${factionLines}</div>
          <div class="panel-label mt">SEU PERFIL ATÉ AGORA</div>
          <div class="profile-big">${esc(profileTitle(state.axes))}</div>
          <div class="chips">${leans.map((l) => `<span class="chip lean">${esc(l.pole)} ${Math.abs(l.value)}</span>`).join('')}</div>
          <div class="panel-label mt">CAMINHOS DESCOBERTOS NESTA CRISE · ${found.length}/${allPaths.length}</div>
          <div class="paths">${allPaths
            .map((p) => `<span class="path ${found.includes(p.id) ? 'found' : ''} ${p.id === opt.id ? 'new' : ''}" title="${found.includes(p.id) ? esc(p.title) : '???'}">${found.includes(p.id) ? p.icon : '?'}</span>`)
            .join('')}</div>
        </div>
      </div>
      <div class="lesson-actions">
        <button class="btn-retry">↺ REFAZER ESTA DECISÃO</button>
        <button class="btn-next">${cb.last ? 'VER BALANÇO DO MANDATO ➔' : 'PRÓXIMA CRISE ➔'}</button>
      </div>
    </div>`,
  );
  sfx.fanfare();
  await wait(50);
  const next = overlay.querySelector<HTMLElement>('.btn-next')!;
  next.focus();
  overlay.querySelector('.btn-retry')!.addEventListener('click', () => {
    sfx.click();
    cb.onRetry();
  });
  next.addEventListener('click', () => {
    sfx.click();
    cb.onNext();
  });
}

/** Resultado solene: eleição, votação de impeachment, posse. */
export async function showVerdict(host: HTMLElement, v: { icon: string; kicker: string; title: string; text: string; good: boolean; button?: string }) {
  const overlay = mount(
    host,
    `verdict-overlay ${v.good ? 'good' : 'bad'}`,
    `<div class="verdict">
      <div class="verdict-icon">${v.icon}</div>
      <div class="lesson-kicker">${esc(v.kicker)}</div>
      <h2>${esc(v.title)}</h2>
      <p>${esc(v.text)}</p>
      <button class="btn-continue">${esc(v.button ?? 'CONTINUAR ➔')}</button>
    </div>`,
  );
  v.good ? sfx.fanfare() : sfx.down();
  await waitClick(overlay.querySelector('.btn-continue')!);
  overlay.remove();
}

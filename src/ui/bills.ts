import { sfx } from '../audio/sfx';
import { shortDate } from '../engine/calendar';
import { AXES } from '../engine/data';
import { lean } from '../engine/profile';
import { INSTRUMENTS } from '../engine/rules';
import type { BillProposal, Country, GameState, Instrument } from '../engine/types';
import { el, esc, wait } from './dom';

function chips(p: BillProposal, country: Country): string {
  const out: string[] = [];
  for (const a of AXES) {
    const d = p.effects.axes?.[a.id];
    if (d) out.push(`<span class="chip axis-chip ${d > 0 ? 'b' : 'a'}">${d > 0 ? '→' : '←'} ${esc(lean(a, d).pole)}</span>`);
  }
  for (const f of country.factions) {
    const d = p.effects.factions?.[f.id];
    if (d) out.push(`<span class="chip ${d > 0 ? 'up' : 'down'}">${d > 0 ? '👍' : '👎'} ${esc(f.short)}</span>`);
  }
  for (const pt of country.partners ?? []) {
    const d = p.effects.relations?.[pt.id];
    if (d) out.push(`<span class="chip ${d > 0 ? 'up' : 'down'}">${pt.flag} ${d > 0 ? '👍' : '👎'}</span>`);
  }
  out.push('<span class="chip hidden-kpi">💰 economia: ???</span>');
  return out.join('');
}

/** Tela de propostas: 4 projetos escritos pelo Claude e a escolha do instrumento. Devolve null se desistir. */
export async function chooseBill(
  host: HTMLElement,
  country: Country,
  state: GameState,
  load: () => Promise<BillProposal[]>,
): Promise<{ proposal: BillProposal; instrument: Instrument } | null> {
  const overlay = el('div', 'overlay bills-overlay', `<div class="bills-box"><div class="modal-head">📜 PROPOR AO CONGRESSO <button class="close" aria-label="Fechar">✕</button></div><div class="bills-body"><p class="bills-loading loading-dots">O assessor legislativo prepara as propostas</p></div></div>`);
  host.append(overlay);
  sfx.select();
  let done: (v: { proposal: BillProposal; instrument: Instrument } | null) => void = () => {};
  const result = new Promise<{ proposal: BillProposal; instrument: Instrument } | null>((r) => (done = r));
  const close = (v: { proposal: BillProposal; instrument: Instrument } | null) => {
    overlay.remove();
    done(v);
  };
  overlay.querySelector('.close')!.addEventListener('click', () => {
    sfx.click();
    close(null);
  });

  const proposals = await load();
  const body = overlay.querySelector('.bills-body')!;
  if (!proposals.length) {
    body.innerHTML = '<p class="bills-loading">O Claude não conseguiu preparar propostas agora. Tente de novo em instantes.</p>';
    return result;
  }
  body.innerHTML = `
    <p class="bills-intro">Um projeto por vez. Ele tramita enquanto o mandato segue e, no dia da votação, você articula os votos no plenário.</p>
    <div class="bills-grid">
      ${proposals
        .map((p, i) => {
          const options: Instrument[] = p.needsPec ? ['pec'] : ['lei', 'mp'];
          return `<article class="bill-card" style="--i:${i}">
            <div class="bill-top"><span class="bill-icon">${p.icon}</span><div><small>${esc(p.area.toUpperCase())}${p.needsPec ? ' · MEXE NA CONSTITUIÇÃO' : ''}</small><b>${esc(p.title)}</b></div></div>
            <p>${esc(p.summary)}</p>
            <div class="chips">${chips(p, country)}</div>
            <div class="bill-actions">
              ${options
                .map((ins) => {
                  const r = INSTRUMENTS[ins];
                  return `<button class="bill-send" data-i="${i}" data-ins="${ins}" title="${esc(r.note)}"><b>${ins === 'mp' ? '⚡' : ins === 'pec' ? '📘' : '📄'} ${esc(r.label)}</b><small>${r.needed} votos · ${ins === 'mp' ? `vale já · Congresso vota em ${shortDate(state, state.month + r.months)}` : `vota em ${shortDate(state, state.month + r.months)}`}</small></button>`;
                })
                .join('')}
            </div>
          </article>`;
        })
        .join('')}
    </div>`;
  body.querySelectorAll<HTMLButtonElement>('.bill-send').forEach((b) =>
    b.addEventListener('click', async () => {
      const proposal = proposals[Number(b.dataset.i)];
      const instrument = b.dataset.ins as Instrument;
      sfx.stamp();
      const stamp = el('div', 'bills-stamp', instrument === 'mp' ? 'EM VIGOR' : 'ENVIADO AO CONGRESSO');
      overlay.querySelector('.bills-box')!.append(stamp);
      await wait(900);
      close({ proposal, instrument });
    }),
  );
  return result;
}

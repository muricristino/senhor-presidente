import { sfx } from '../audio/sfx';
import { shortDate } from '../engine/calendar';
import { AXES } from '../engine/data';
import { lean } from '../engine/profile';
import { INSTRUMENTS } from '../engine/rules';
import type { BillProposal, Country, Instrument } from '../engine/types';
import { esc, wait } from './dom';
import type { Gabinete } from './shell';

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

/**
 * A pauta do governo na mesa: o Congresso volta do recesso (fevereiro e agosto) e o presidente
 * pode mandar um dos 4 projetos escritos pelo Claude, ou deixar para o próximo semestre.
 */
export function runLegislativeWindow(g: Gabinete, proposals: BillProposal[]): Promise<{ proposal: BillProposal; instrument: Instrument } | null> {
  const { country, state } = g;
  const august = (state.month - 1) % 12 >= 6;
  g.renderMonth();
  g.renderTimeline('📜');
  g.showDesk();
  g.setScene('vote_yes');
  g.desk.innerHTML = `
    <div class="memo pauta">
      <div class="memo-clip"></div>
      <div class="dossier-top">
        <span class="kicker">📜 PAUTA DO GOVERNO · ${august ? 'VOLTA DO RECESSO DE JULHO' : 'ABERTURA DO ANO LEGISLATIVO'}</span>
        <span class="step">✦ CONGRESSO</span>
      </div>
      <p class="pauta-intro">O Congresso volta a trabalhar. Mande um projeto agora: ele tramita enquanto o mandato segue e, no dia da votação, você articula os votos. Um projeto por semestre.</p>
      <div class="pauta-grid">
        ${proposals
          .map((p, i) => {
            const options: Instrument[] = p.needsPec ? ['pec'] : ['lei', 'mp'];
            return `<article class="pauta-card" style="--i:${i}">
              <div class="bill-top"><span class="bill-icon">${p.icon}</span><div><small>${esc(p.area.toUpperCase())}${p.needsPec ? ' · CONSTITUIÇÃO' : ''}</small><b>${esc(p.title)}</b></div></div>
              <p>${esc(p.summary)}</p>
              <div class="chips">${chips(p, country)}</div>
              <div class="bill-actions">
                ${options
                  .map((ins) => {
                    const r = INSTRUMENTS[ins];
                    return `<button class="bill-send" data-i="${i}" data-ins="${ins}" title="${esc(r.note)}"><b>${ins === 'mp' ? '⚡' : ins === 'pec' ? '📘' : '📄'} ${esc(r.label)}</b><small>${r.needed} votos · ${ins === 'mp' ? 'vale já' : `vota em ${shortDate(state, state.month + r.months)}`}</small></button>`;
                  })
                  .join('')}
              </div>
            </article>`;
          })
          .join('')}
      </div>
      <button class="pauta-skip">Não enviar nada agora ▶</button>
      <div class="stamp memo-stamp"></div>
    </div>`;
  void g.say('O Congresso voltou. Mande um projeto agora: ele tramita enquanto governamos, e no dia da votação o senhor articula os votos.');
  sfx.select();
  return new Promise((resolve) => {
    const finish = async (v: { proposal: BillProposal; instrument: Instrument } | null) => {
      g.onKey = null;
      if (v) {
        const stamp = g.desk.querySelector<HTMLElement>('.memo-stamp')!;
        stamp.textContent = v.instrument === 'mp' ? 'EM VIGOR' : 'ENVIADO';
        stamp.classList.add('show');
        sfx.stamp();
        await wait(900);
      } else sfx.click();
      g.desk.querySelector('.pauta')?.classList.add('out');
      await wait(250);
      resolve(v);
    };
    g.desk.querySelectorAll<HTMLButtonElement>('.bill-send').forEach((b) =>
      b.addEventListener('click', () => void finish({ proposal: proposals[Number(b.dataset.i)], instrument: b.dataset.ins as Instrument })),
    );
    g.desk.querySelector('.pauta-skip')!.addEventListener('click', () => void finish(null));
  });
}

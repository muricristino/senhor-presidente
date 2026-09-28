import { sfx } from '../audio/sfx';
import { shortDate } from '../engine/calendar';
import { AXES } from '../engine/data';
import { lean } from '../engine/profile';
import { INSTRUMENTS } from '../engine/rules';
import { getRegime, routeOpen, type RegimeRoute } from '../engine/regime';
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
export type PautaPick = { proposal: BillProposal; instrument: Instrument } | { route: RegimeRoute } | { abertura: true };

const VIA_LABEL: Record<RegimeRoute['via'], string> = { plebiscito: 'plebiscito', constituinte: 'constituinte', golpe: 'golpe', revolucao: 'revolução' };

export function runLegislativeWindow(g: Gabinete, proposals: BillProposal[], opts: { routes?: RegimeRoute[]; autocracy?: boolean } = {}): Promise<PautaPick | null> {
  const { country, state } = g;
  const august = (state.month - 1) % 12 >= 6;
  const auto = !!opts.autocracy;
  const routes = opts.routes ?? [];
  const reform = auto
    ? `<div class="pauta-reform"><span>ABERTURA:</span><button class="reform-btn open" data-abertura="1" title="Como o Chile em 1988: o regime pergunta ao povo se deve continuar. Se o NÃO vencer, começa a transição.">🕊️ Plebiscito da continuidade</button></div>`
    : routes.length
      ? (() => {
          // só os caminhos abertos viram botão; os fechados ficam num resumo (a Home mostra os requisitos)
          const open = routes.map((r, i) => ({ r, i })).filter((x) => routeOpen(x.r));
          const closed = routes.length - open.length;
          return `<div class="pauta-reform"><span>REGRAS DO JOGO:</span>${open
            .map(({ r, i }) => {
              const reg = getRegime(r.to);
              const tip = `${reg.summary}${r.risk ? ` ⚠ ${r.risk}` : ''}`;
              return `<button class="reform-btn open" data-route="${i}" title="${esc(tip)}">${reg.icon} ${esc(reg.name)}<small>${VIA_LABEL[r.via]}</small></button>`;
            })
            .join('')}${closed ? `<button class="reform-btn locked" data-closed="1">🔒 +${closed} fechados</button>` : ''}</div>`;
        })()
      : '';
  g.renderMonth();
  g.renderTimeline('📜');
  g.showDesk();
  g.setScene('vote_yes');
  g.desk.innerHTML = `
    <div class="memo pauta">
      <div class="memo-clip"></div>
      <div class="dossier-top">
        <span class="kicker">${auto ? '🖋️ DECRETOS DO REGIME · O CONGRESSO NÃO VOTA' : `📜 PAUTA DO GOVERNO · ${august ? 'VOLTA DO RECESSO DE JULHO' : 'ABERTURA DO ANO LEGISLATIVO'}`}</span>
        <span class="step">✦ ${auto ? 'DIÁRIO OFICIAL' : 'CONGRESSO'}</span>
      </div>
      <p class="pauta-intro">O Congresso volta a trabalhar. Mande um projeto agora: ele tramita enquanto o mandato segue e, no dia da votação, você articula os votos. Um projeto por semestre.</p>
      <div class="pauta-grid">
        ${proposals
          .map((p, i) => {
            const options: Instrument[] = auto ? ['decreto'] : p.needsPec ? ['pec'] : ['lei', 'mp'];
            return `<article class="pauta-card" style="--i:${i}">
              <div class="bill-top"><span class="bill-icon">${p.icon}</span><div><small>${esc(p.area.toUpperCase())}${p.needsPec && !auto ? ' · CONSTITUIÇÃO' : ''}${p.special && p.special !== 'fortalecer' ? ' · ⚠ REGRAS DO JOGO' : p.special === 'fortalecer' ? ' · 🛡️ FREIOS' : ''}</small><b>${esc(p.title)}</b></div></div>
              <p>${esc(p.summary)}</p>
              <div class="chips">${chips(p, country)}</div>
              <div class="bill-actions">
                ${options
                  .map((ins) => {
                    const r = INSTRUMENTS[ins];
                    return `<button class="bill-send" data-i="${i}" data-ins="${ins}" title="${esc(r.note)}"><b>${ins === 'decreto' ? '🖋️' : ins === 'mp' ? '⚡' : ins === 'pec' ? '📘' : '📄'} ${esc(r.label)}</b><small>${ins === 'decreto' ? 'vale já, sem voto' : `${r.needed} votos · ${ins === 'mp' ? 'vale já' : `vota em ${shortDate(state, state.month + r.months)}`}`}</small></button>`;
                  })
                  .join('')}
              </div>
            </article>`;
          })
          .join('')}
      </div>
      ${reform}
      <button class="pauta-skip">${auto ? 'Nenhum decreto agora ▶' : 'Não enviar nada agora ▶'}</button>
      <div class="stamp memo-stamp"></div>
    </div>`;
  void g.say(
    auto
      ? 'Sem Congresso para votar, o senhor decreta. Vale na hora, mas quem paga a conta são a rua, os generais e o resto do mundo.'
      : 'O Congresso voltou. Mande um projeto agora: ele tramita enquanto governamos, e no dia da votação o senhor articula os votos.',
  );
  sfx.select();
  return new Promise((resolve) => {
    const finish = async (v: PautaPick | null) => {
      g.onKey = null;
      if (v) {
        const stamp = g.desk.querySelector<HTMLElement>('.memo-stamp')!;
        stamp.textContent = 'abertura' in v ? 'CONVOCADO' : 'route' in v ? 'ENVIADO' : v.instrument === 'mp' || v.instrument === 'decreto' ? 'EM VIGOR' : 'ENVIADO';
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
    g.desk.querySelector('[data-abertura]')?.addEventListener('click', () => void finish({ abertura: true }));
    g.desk.querySelector('[data-closed]')?.addEventListener('click', () => {
      sfx.down();
      const names = routes.filter((r) => !routeOpen(r)).map((r) => `${getRegime(r.to).name}: ${r.reqs.filter((x) => !x.ok).map((x) => x.label).join('; ')}`);
      void g.say(`Ainda faltam condições. ${names.slice(0, 2).join(' · ')}. Os requisitos completos estão no painel do país (🏠).`);
    });
    g.desk.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = routes[Number(b.dataset.route)];
        if (routeOpen(r)) return void finish({ route: r });
        sfx.down();
        void g.say(`Para ${getRegime(r.to).name} por ${VIA_LABEL[r.via]}, falta: ${r.reqs.filter((x) => !x.ok).map((x) => x.label).join('; ')}.`);
      }),
    );
  });
}

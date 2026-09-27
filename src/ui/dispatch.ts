import { sfx } from '../audio/sfx';
import { AXES } from '../engine/data';
import { lean } from '../engine/profile';
import { applyEffects } from '../engine/rules';
import type { Dispatch, DispatchOption, GameState } from '../engine/types';
import { el, esc, shake, wait } from './dom';
import type { Gabinete } from './shell';

const SECONDS = 25;

const ARCHIVED: DispatchOption = {
  id: 'arquivado',
  icon: '🗄️',
  label: 'Arquivado',
  stamp: 'ARQUIVADO',
  effects: { kpis: { coalizao: -2, aprovacao: -1 } },
  reaction: 'O despacho ficou parado na gaveta. Em Brasília, demora também é resposta, e ninguém gosta dela.',
  anim: 'calm',
};

/** Um despacho rápido: 2 ou 3 botões, carimbo na hora e micro-lição da conselheira. */
export function runDispatch(g: Gabinete, d: Dispatch): Promise<GameState> {
  return new Promise((done) => {
    let locked = false;
    let remaining = SECONDS;
    g.renderMonth();
    g.renderTimeline(d.icon);

    g.desk.innerHTML = `
      <div class="memo">
        <div class="memo-clip"></div>
        <div class="dossier-top">
          <span class="kicker memo-from">📨 DESPACHO · ${esc(d.from.toUpperCase())}</span>
          <span class="step">${d.generated ? '✦ ' : ''}MÊS ${String(g.state.month).padStart(2, '0')}</span>
        </div>
        <div class="memo-head"><span class="memo-icon">${d.icon}</span><h2 class="ev-title">${esc(d.title)}</h2></div>
        <p class="memo-text">${esc(d.text)}</p>
        <div class="memo-timer"><i></i></div>
        <div class="memo-options" style="--n:${d.options.length}">
          ${d.options
            .map(
              (o, i) => `<button class="memo-option" data-option="${o.id}" style="--i:${i}">
                <span class="opt-key">${i + 1}</span><span class="memo-opt-icon">${o.icon}</span><strong>${esc(o.label)}</strong>
              </button>`,
            )
            .join('')}
        </div>
        <div class="memo-chips"></div>
        <div class="memo-result"></div>
        <div class="stamp memo-stamp"></div>
      </div>`;
    const $ = <T extends Element = HTMLElement>(s: string) => g.desk.querySelector<T>(s)!;
    const buttons = [...g.desk.querySelectorAll<HTMLButtonElement>('.memo-option')];
    sfx.select();

    const chips = $('.memo-chips');
    const showChips = (o: DispatchOption | null) => {
      g.preview(o?.effects ?? null);
      if (!o) return (chips.innerHTML = '');
      const axis = AXES.filter((a) => o.effects.axes?.[a.id]).map((a) => {
        const v = o.effects.axes![a.id]!;
        return `<span class="chip axis-chip ${v > 0 ? 'b' : 'a'}">${v > 0 ? '→' : '←'} ${esc(lean(a, v).pole)}</span>`;
      });
      const fac = g.country.factions
        .filter((f) => o.effects.factions?.[f.id])
        .map((f) => `<span class="chip ${o.effects.factions![f.id] > 0 ? 'up' : 'down'}">${o.effects.factions![f.id] > 0 ? '👍' : '👎'} ${esc(f.short)}</span>`);
      chips.innerHTML = [...axis, ...fac].map((c, i) => c.replace('class="chip', `style="--i:${i}" class="chip`)).join('');
    };
    buttons.forEach((b) => {
      const o = d.options.find((x) => x.id === b.dataset.option)!;
      b.addEventListener('mouseenter', () => {
        if (locked) return;
        sfx.hover();
        showChips(o);
      });
      b.addEventListener('mouseleave', () => !locked && showChips(null));
      b.addEventListener('click', () => void resolve(o));
    });

    const bar = $('.memo-timer i');
    const timer = setInterval(() => {
      if (!g.screen.isConnected) return clearInterval(timer);
      if (locked || document.querySelector('.overlay')) return;
      remaining -= 0.25;
      bar.style.width = `${(remaining / SECONDS) * 100}%`;
      bar.classList.toggle('danger', remaining < 7);
      if (remaining <= 0) void resolve(ARCHIVED);
    }, 250);

    g.onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= d.options.length) void resolve(d.options[n - 1]);
    };
    g.onKeyUp = null;

    const resolve = async (o: DispatchOption) => {
      if (locked) return;
      locked = true;
      g.onKey = null;
      clearInterval(timer);
      buttons.forEach((b) => {
        b.disabled = true;
        b.classList.toggle('selected', b.dataset.option === o.id);
      });
      showChips(o);

      const stamp = $('.memo-stamp');
      stamp.textContent = o.stamp;
      stamp.classList.toggle('omission', o.id === 'arquivado');
      stamp.classList.add('show');
      sfx.stamp();
      shake(g.$('.desk'));

      const result = applyEffects(g.state, o.effects, g.country);
      g.state = {
        ...result.state,
        decisions: [...g.state.decisions, `${d.id}:${o.id}`],
        history: [...g.state.history, { month: g.state.month, event: d.title, choice: o.label, headline: o.reaction, icon: d.icon }],
      };
      if (o.anim) g.setScene(o.anim);
      void g.animateKpis(result.deltas);
      void g.animateAxes(result.deltas, false);
      void g.animateFactions(result.deltas, false);
      if (o.post) {
        g.feed.push(o.post);
      }
      const res = $('.memo-result');
      res.innerHTML = `<p>${esc(o.reaction)}</p><button class="memo-next">PRÓXIMO ▶</button>`;
      res.classList.add('show');
      void g.say(o.reaction);

      const next = res.querySelector<HTMLElement>('.memo-next')!;
      await wait(500);
      await Promise.race([
        new Promise<void>((r) => next.addEventListener('click', () => r(), { once: true })),
        wait(6500),
        new Promise<void>((r) => {
          g.onKey = (e) => (e.key === 'Enter' || e.code === 'Space') && r();
        }),
      ]);
      g.onKey = null;
      sfx.click();
      g.renderTimeline();
      g.desk.querySelector('.memo')?.classList.add('out');
      await wait(250);
      done(g.state);
    };
    void el;
  });
}

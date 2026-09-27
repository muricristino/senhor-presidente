import { drawAvatar } from '../art/avatar';
import { stfCutscene } from '../art/cutscene';
import { makeCanvas } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { AXES } from '../engine/data';
import { lean } from '../engine/profile';
import { applyEffects } from '../engine/rules';
import type { Cutscene, EventOption, GameEvent, GameState } from '../engine/types';
import { playCinematic } from './cinematic';
import { slow } from '../speed';
import { el, esc, shake, typewriter, wait } from './dom';
import { showLesson, showNewspaper, showStf } from './overlays';
import type { Gabinete } from './shell';

export interface BigEventHooks {
  cutsceneFor: (opt: EventOption) => Promise<Cutscene | null>;
  /** Estado logo depois da assinatura: hora de encomendar o próximo evento grande. */
  onResolved: (state: GameState) => void;
  isEnding: (state: GameState) => boolean;
}

export type BigEventResult = { state: GameState; retry: boolean };

/** Um evento grande na mesa: dossiê, 4 saídas, ministros, assinatura, cinemática e consequências. */
export function runBigEvent(g: Gabinete, event: GameEvent, hooks: BigEventHooks): Promise<BigEventResult> {
  return new Promise((done) => {
    const { country } = g;
    const before = g.state;
    let state: GameState = { ...g.state, month: event.month };
    g.state = state;
    g.renderMonth();
    g.renderTimeline('!');
    g.showDesk();
    g.setPlace(event.region, event.options[0]?.icon ?? '❗');
    g.setScene(event.scene.anim);

    let selected: EventOption | null = null;
    let locked = false;
    let remaining = event.pressure.seconds;
    const called = new Set<string>();
    const echoes = (event.echoes ?? []).filter((e) => e.when === '*' || state.decisions.includes(e.when));

    g.desk.innerHTML = `
      <div class="dossier">
        <div class="dossier-top">
          <span class="kicker">${esc(event.kicker)}</span>
          <span class="step">${event.generated ? '✦ ' : ''}DECISÃO ${state.history.length + 1}</span>
        </div>
        <h2 class="ev-title">${esc(event.title)}</h2>
        <div class="dossier-body">
          ${event.dossier.map((p) => `<p class="ev-text">${esc(p)}</p>`).join('')}
          ${echoes.map((e) => `<p class="echo"><b>⟲ ECO DA SUA DECISÃO</b> ${esc(e.text)}</p>`).join('')}
        </div>
        <div class="pressure">
          <span class="pressure-label">⏳ ${esc(event.pressure.label)}</span>
          <span class="pressure-bar"><i></i></span>
          <b class="pressure-value"></b>
        </div>
        <div class="options">
          ${event.options
            .map(
              (o, i) => `<button class="option" data-option="${o.id}" style="--i:${i}">
                <span class="opt-key">${i + 1}</span>
                <span class="opt-icon">${o.icon}</span>
                <strong>${esc(o.title)}</strong>
              </button>`,
            )
            .join('')}
        </div>
        <div class="preview"><p class="preview-empty">👆 Escolha uma saída para ver para onde ela te leva.</p></div>
        <div class="signature-line">
          <canvas class="signature" width="360" height="54"></canvas>
          <span class="sig-caption">${esc(state.player.name)}, ${esc(country.head_of_state_title)}</span>
          <div class="stamp">DECRETADO</div>
        </div>
      </div>
      <div class="actions">
        <button class="pen" disabled>
          <span class="pen-fill"></span>
          <span class="pen-icon">🖋️</span>
          <span class="pen-text">ESCOLHA UMA SAÍDA</span>
        </button>
        <button class="phone"><span class="phone-icon">☎️</span><span>MINISTROS<small>custa tempo</small></span></button>
      </div>`;
    const $ = <T extends Element = HTMLElement>(s: string) => g.desk.querySelector<T>(s)!;
    const $$ = <T extends Element = HTMLElement>(s: string) => [...g.desk.querySelectorAll<T>(s)];

    void g.say(event.advisor);
    g.setTab('redes', false);
    g.feed.wave(event.social, 2600, 700);

    // --- prévia ---
    const previewBox = $('.preview');
    const renderPreviewBox = (opt: EventOption) => {
      const axisChips = AXES.filter((a) => opt.effects.axes?.[a.id]).map((a) => {
        const d = opt.effects.axes![a.id]!;
        return `<span class="chip axis-chip ${d > 0 ? 'b' : 'a'}">${d > 0 ? '→' : '←'} ${esc(lean(a, d).pole)}</span>`;
      });
      const factionChips = country.factions
        .filter((f) => opt.effects.factions?.[f.id])
        .map((f) => {
          const d = opt.effects.factions![f.id];
          return `<span class="chip ${d > 0 ? 'up' : 'down'}">${d > 0 ? '👍' : '👎'} ${esc(f.short)}</span>`;
        });
      const relationChips = (country.partners ?? [])
        .filter((p) => opt.effects.relations?.[p.id])
        .map((p) => `<span class="chip ${opt.effects.relations![p.id] > 0 ? 'up' : 'down'}">${p.flag} ${opt.effects.relations![p.id] > 0 ? '👍' : '👎'}</span>`);
      factionChips.push(...relationChips);
      previewBox.innerHTML = `
        <p class="preview-summary">${esc(opt.summary)}</p>
        <div class="preview-chips">${[...axisChips, ...factionChips].map((c, i) => c.replace('class="chip', `style="--i:${i}" class="chip`)).join('')}<span class="chip hidden-kpi" style="--i:${axisChips.length + factionChips.length}">💰 economia: ???</span></div>`;
    };

    const options = $$<HTMLButtonElement>('.option');
    const pen = $<HTMLButtonElement>('.pen');
    const choose = (opt: EventOption) => {
      if (locked) return;
      selected = opt;
      sfx.select();
      options.forEach((b) => {
        const on = b.dataset.option === opt.id;
        b.classList.toggle('selected', on);
        if (on) {
          b.classList.remove('chosen');
          void b.offsetWidth;
          b.classList.add('chosen');
        }
      });
      g.preview(opt.effects);
      renderPreviewBox(opt);
      pen.disabled = false;
      $('.pen-text').textContent = 'SEGURE PARA ASSINAR';
    };
    options.forEach((b) => {
      const opt = event.options.find((o) => o.id === b.dataset.option)!;
      b.addEventListener('mouseenter', () => {
        if (locked) return;
        sfx.hover();
        g.preview(opt.effects);
      });
      b.addEventListener('mouseleave', () => !locked && g.preview(selected?.effects ?? null));
      b.addEventListener('click', () => choose(opt));
    });

    // --- pressão ---
    const pressureFill = $('.pressure-bar i');
    const pressureValue = $('.pressure-value');
    const renderPressure = () => {
      const ratio = Math.max(0, remaining / event.pressure.seconds);
      pressureFill.style.width = `${ratio * 100}%`;
      pressureFill.classList.toggle('danger', ratio < 0.3);
      pressureValue.textContent = `${Math.ceil(ratio * event.pressure.unitMax)}${event.pressure.unit}`;
    };
    renderPressure();
    const timer = setInterval(() => {
      if (!g.screen.isConnected) return clearInterval(timer);
      if (locked || document.querySelector('.overlay:not(.phone-modal)')) return;
      remaining -= 0.25;
      renderPressure();
      if (remaining <= 10 && Math.abs(remaining % 1) < 0.01) {
        sfx.tick();
        shake($('.pressure'));
      }
      if (remaining === 15) void g.say('Presidente, o tempo está acabando! Se não assinar, a omissão decide pelo senhor.');
      if (remaining <= 0) {
        clearInterval(timer);
        sfx.alarm();
        void resolve(event.omission, true);
      }
    }, 250);

    // --- assinatura ---
    const sig = $<HTMLCanvasElement>('.signature');
    const sctx = sig.getContext('2d')!;
    const sigPath = buildSignature(state.player.name);
    let holdStart = 0;
    let holdRaf = 0;
    const HOLD_MS = 1200;
    const drawSig = (progress: number) => {
      sctx.clearRect(0, 0, sig.width, sig.height);
      sctx.strokeStyle = '#1b2a6b';
      sctx.lineWidth = 2.5;
      sctx.lineCap = 'round';
      sctx.lineJoin = 'round';
      sctx.beginPath();
      sigPath.slice(0, Math.floor(sigPath.length * progress)).forEach(([x, y], i) => (i ? sctx.lineTo(x, y) : sctx.moveTo(x, y)));
      sctx.stroke();
    };
    const beginHold = () => {
      if (locked || !selected || holdRaf) return;
      holdStart = performance.now();
      pen.classList.add('holding');
      const step = (now: number) => {
        const p = Math.min(1, (now - holdStart) / HOLD_MS);
        pen.style.setProperty('--p', String(p));
        drawSig(p);
        if (Math.random() < 0.5) sfx.scribble();
        if (p >= 1) {
          holdRaf = 0;
          pen.classList.remove('holding');
          void resolve(selected!, false);
          return;
        }
        holdRaf = requestAnimationFrame(step);
      };
      holdRaf = requestAnimationFrame(step);
    };
    const cancelHold = () => {
      if (!holdRaf) return;
      cancelAnimationFrame(holdRaf);
      holdRaf = 0;
      pen.classList.remove('holding');
      pen.style.setProperty('--p', '0');
      drawSig(0);
    };
    pen.addEventListener('pointerdown', beginHold);
    pen.addEventListener('pointerup', cancelHold);
    pen.addEventListener('pointerleave', cancelHold);

    // --- telefone ---
    const openPhone = () => {
      if (locked || document.querySelector('.overlay')) return;
      sfx.ring();
      const ministers = country.ministers.filter((m) => event.ministers[m.id]);
      const modal = el('div', 'overlay phone-modal');
      modal.innerHTML = `
        <div class="modal phone-device">
          <div class="modal-head">☎️ LINHA DIRETA COM OS MINISTROS <button class="close" aria-label="Fechar">✕</button></div>
          <p class="phone-warn">⏳ Cada ligação nova consome tempo.</p>
          <div class="ministers">
            ${ministers
              .map(
                (m) => `<button class="minister ${called.has(m.id) ? 'called' : ''}" data-m="${m.id}" style="--mc:${m.color}">
                  <span class="m-face"></span><b>${esc(m.role)}</b><span>${esc(m.name)}</span>
                </button>`,
              )
              .join('')}
          </div>
          <div class="call-box"><span class="call-face"></span><p class="call-text">Para quem o senhor quer ligar?</p></div>
        </div>`;
      g.screen.append(modal);
      modal.querySelectorAll<HTMLElement>('.minister').forEach((b) => {
        const c = makeCanvas(32, 32, 'm-canvas');
        b.querySelector('.m-face')!.append(c);
        drawAvatar(c.getContext('2d')!, ministers.find((x) => x.id === b.dataset.m)!.avatar, { sash: false });
      });
      const callCanvas = makeCanvas(32, 32, 'call-canvas');
      modal.querySelector('.call-face')!.append(callCanvas);
      const cctx = callCanvas.getContext('2d')!;
      let talking: string | null = null;
      const talkTimer = setInterval(() => {
        if (!modal.isConnected) return clearInterval(talkTimer);
        const m = talking && ministers.find((x) => x.id === talking);
        if (m) drawAvatar(cctx, m.avatar, { sash: false, talk: Math.random() < 0.6 });
      }, 120);
      const close = () => {
        sfx.click();
        modal.classList.add('out');
        setTimeout(() => modal.remove(), slow(180));
      };
      modal.querySelector('.close')!.addEventListener('click', close);
      modal.addEventListener('click', (e) => e.target === modal && close());
      modal.querySelectorAll<HTMLButtonElement>('.minister').forEach((b) =>
        b.addEventListener('click', async () => {
          const m = ministers.find((x) => x.id === b.dataset.m)!;
          if (!called.has(m.id)) {
            remaining = Math.max(1, remaining - 5);
            renderPressure();
            called.add(m.id);
            b.classList.add('called');
            b.append(el('span', 'time-cost', '−5s'));
          }
          sfx.ring();
          modal.querySelectorAll('.minister').forEach((x) => x.classList.toggle('talking', x === b));
          talking = m.id;
          const box = modal.querySelector<HTMLElement>('.call-text')!;
          box.innerHTML = '';
          const said = el('span');
          box.append(el('b', '', `${esc(m.name)}:`), ' ', said);
          await typewriter(said, `“${event.ministers[m.id]}”`, 13, sfx.type);
          if (talking === m.id) talking = null;
        }),
      );
    };
    $('.phone').addEventListener('click', openPhone);

    g.onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= event.options.length && !document.querySelector('.overlay')) choose(event.options[n - 1]);
      if (e.code === 'Space' && !e.repeat && !document.querySelector('.overlay')) {
        e.preventDefault();
        beginHold();
      }
      if (e.key.toLowerCase() === 't') openPhone();
      if (e.key === 'Escape') document.querySelector<HTMLElement>('.phone-modal .close')?.click();
    };
    g.onKeyUp = (e) => e.code === 'Space' && cancelHold();

    // --- consequências ---
    const resolve = async (opt: EventOption, omission: boolean) => {
      if (locked) return;
      locked = true;
      g.onKey = null;
      g.onKeyUp = null;
      clearInterval(timer);
      document.querySelector('.phone-modal')?.remove();
      cancelHold();
      g.screen.classList.add('resolving');
      options.forEach((b) => {
        b.disabled = true;
        b.classList.toggle('selected', b.dataset.option === opt.id);
      });
      pen.disabled = true;
      if (omission) renderPreviewBox(opt);

      const stamp = $('.stamp');
      stamp.textContent = omission ? 'OMISSÃO' : 'DECRETADO';
      stamp.classList.toggle('omission', omission);
      await wait(150);
      stamp.classList.add('show');
      sfx.stamp();
      shake(g.$('.desk'));
      await wait(550);

      const ready = await Promise.race([hooks.cutsceneFor(opt), wait(1500).then(() => null)]);
      const script: Cutscene = ready ?? { backdrop: 'esplanada', anim: opt.scene.anim, actors: [], timeline: [], caption: opt.headline };
      await playCinematic(g.screen, { ...script, caption: script.caption || opt.headline }, g.library, omission ? 'PLANTÃO' : 'AO VIVO');

      const result = applyEffects(state, opt.effects, country);
      state = {
        ...result.state,
        decisions: [...state.decisions, `${event.id}:${opt.id}`],
        history: [...state.history, { month: event.month, event: event.title, choice: opt.title, headline: opt.headline, icon: opt.icon, stf: opt.stf?.title }],
      };
      g.state = state;
      hooks.onResolved(state);
      g.setScene(opt.scene.anim);
      void g.say(omission ? 'Presidente... o país decidiu sem o senhor.' : 'Está assinado. Agora vamos ver a reação.');
      await g.animateKpis(result.deltas);
      await g.animateAxes(result.deltas);
      await g.animateFactions(result.deltas);
      await g.animateRelations(result.deltas);
      if (event.ready) await Promise.race([event.ready, wait(45_000)]);
      g.setTab('redes');
      g.feed.wave(opt.social, 900, 100);
      await wait(2000);

      await showNewspaper(g.screen, opt, result.deltas, state, country);

      if (opt.stf) {
        g.$('.stf-status').textContent = 'LIMINAR';
        g.$('.stf').classList.add('alert');
        await playCinematic(g.screen, stfCutscene(`${opt.stf.title}: o Supremo suspende a decisão do Presidente`, 'SUSPENSO!'), g.library, 'STF · URGENTE');
        await showStf(g.screen, opt.stf, country);
        const r = applyEffects(state, opt.stf.effects ?? {}, country);
        state = { ...r.state, stf: 'LIMINAR' };
        g.state = state;
        await g.animateKpis(r.deltas);
        g.renderFactions();
      }

      g.feed.stop();
      g.renderTimeline();
      await showLesson(g.screen, opt, state, country, event, {
        last: hooks.isEnding(state),
        onRetry: () => finish(true),
        onNext: () => finish(false),
      });
    };

    const finish = (retry: boolean) => {
      document.querySelector('.lesson-overlay')?.remove();
      g.screen.classList.remove('resolving');
      if (retry) {
        g.state = before;
        g.render();
      }
      done({ state: retry ? before : state, retry });
    };
  });
}

/** Rabisco de assinatura determinístico a partir do nome. */
function buildSignature(name: string): [number, number][] {
  let seed = 0;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  const pts: [number, number][] = [];
  const letters = Math.max(6, Math.min(16, name.length));
  for (let i = 0; i <= letters * 10; i++) {
    const t = i / (letters * 10);
    pts.push([20 + t * 300, 30 + Math.sin(t * letters * Math.PI * 2) * (10 + rnd() * 6) + Math.sin(t * 5) * 4]);
  }
  for (let i = 0; i <= 20; i++) pts.push([320 - i * 14, 44 + i * 0.3]);
  return pts;
}

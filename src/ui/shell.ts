import { drawAvatar } from '../art/avatar';
import { makeCanvas } from '../art/pixel';
import { BrazilMap, regionAt } from '../art/brazilMap';
import { PlanaltoScene } from '../art/scene';
import { buildLibrary } from '../art/sprites';
import { sfx } from '../audio/sfx';
import { AXES } from '../engine/data';
import { ageOf, monthName, shortDate, yearOf } from '../engine/calendar';
import { formatDelta, formatKpi, KPIS } from '../engine/kpis';
import { ACHIEVEMENTS } from '../engine/achievements';
import { profileTitle } from '../engine/profile';
import { regionalApproval } from '../engine/regions';
import type { Country, Deltas, Effects, GameState, KpiId, PixelSprite, Place, SceneAnim } from '../engine/types';
import { slow } from '../speed';
import { countTo, el, esc, shake, typewriter, wait } from './dom';
import { SocialFeed } from './social';

const KPI_ICONS: Record<KpiId, string> = {
  aprovacao: '👍',
  coalizao: '🤝',
  selic: '🏦',
  inflacao: '🛒',
  desemprego: '👷',
  seguranca: '🛡️',
  educacao: '🎓',
};

export type Tab = 'redes' | 'eixos' | 'bancadas' | 'mapa';

function factionFace(v: number): string {
  if (v >= 40) return '😍';
  if (v >= 12) return '🙂';
  if (v > -12) return '😐';
  if (v > -40) return '😠';
  return '🤬';
}


/**
 * O Gabinete que fica na tela a partida inteira: barra de indicadores, janela, conselheira,
 * linha do tempo, feed, eixos e Congresso. Só a mesa (`desk`) troca entre despachos e eventos.
 */
export class Gabinete {
  readonly screen = el('div', 'screen cabinet');
  readonly scene = new PlanaltoScene();
  readonly feed = new SocialFeed();
  readonly map = new BrazilMap();
  readonly library: Map<string, PixelSprite>;
  readonly desk: HTMLElement;
  state: GameState;
  /** Tecla tratada pelo conteúdo atual da mesa. */
  onKey: ((e: KeyboardEvent) => void) | null = null;
  onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  /** Botão 🏠: abre a Home por cima do gabinete. */
  onHome: (() => void) | null = null;
  private tab: Tab = 'redes';
  private advisorTalking = false;
  private timers: number[] = [];

  constructor(root: HTMLElement, readonly country: Country, state: GameState) {
    this.state = state;
    this.library = buildLibrary(state.player.avatar);
    const s = this.screen;
    s.innerHTML = `
      <div class="topbar">
        <div class="tb-pres"><span class="tb-avatar"></span><div><small>PRESIDENTE</small><b>${esc(state.player.name)}</b></div></div>
        <div class="tb-month"><small class="tb-term"></small><b class="tb-month-num"></b><span class="tb-month-name"></span></div>
        ${KPIS.map(
          (k) => `<div class="tb-item kpi" data-kpi="${k.id}" title="${esc(k.label)}">
            <i class="ico">${KPI_ICONS[k.id]}</i>
            <div><span>${esc(k.label.toUpperCase())}</span><b></b></div>
          </div>`,
        ).join('')}
        <div class="tb-item stf" title="Supremo Tribunal Federal"><i class="ico">⚖️</i><div><span>${esc(country.institutions.supreme_court)}</span><b class="stf-status"></b></div></div>
        <button class="tb-home" title="Início: painel do país (pausa o jogo)">🏠</button>
        <button class="tb-mute" title="Som (M)">🔊</button>
      </div>

      <div class="cab-grid">
        <aside class="col-left">
          <div class="window-frame"><div class="window-label">JANELA DO PLANALTO</div></div>
          <div class="advisor-card">
            <div class="advisor-face"></div>
            <div class="bubble">
              <div class="bubble-head">${esc(country.advisor.name)} · ${esc(country.advisor.role)}</div>
              <p class="advisor-text"></p>
            </div>
          </div>
          <div class="timeline">
            <div class="panel-label">LINHA DO TEMPO DO MANDATO</div>
            <div class="tl-track"></div>
          </div>
          <div class="portrait-card">
            <div class="portrait"></div>
            <div class="portrait-info">
              <div class="pi-title">${esc(country.head_of_state_title)}</div>
              <div class="pi-name">${esc(state.player.name)} <small class="pi-age"></small></div>
              <div class="pi-profile"><span>SEU PERFIL</span><b class="profile-title"></b></div>
            </div>
          </div>
        </aside>

        <main class="desk">
          <div class="nameplate">${esc(country.head_of_state_title.toUpperCase())} · ${esc(state.player.name.toUpperCase())}</div>
          <div class="desk-trophies"></div>
          <div class="desk-content"></div>
        </main>

        <nav class="mnav">
          <button data-view="mesa">🖋️<small>MESA</small><i class="badge"></i></button>
          <button data-view="planalto">🏛️<small>PLANALTO</small><i class="badge"></i></button>
          <button data-view="redes">📱<small>REDES</small><i class="badge"></i></button>
          <button data-view="eixos">🧭<small>EIXOS</small><i class="badge"></i></button>
          <button data-view="bancadas">🏛️<small>CONGR.</small><i class="badge"></i></button>
          <button data-view="mapa">🌎<small>MAPA</small><i class="badge"></i></button>
        </nav>

        <aside class="col-right">
          <nav class="tabs">
            <button class="tab" data-tab="redes">📱 REDES<i class="badge"></i></button>
            <button class="tab" data-tab="eixos">🧭 EIXOS<i class="badge"></i></button>
            <button class="tab" data-tab="bancadas">🏛️ CONGR.<i class="badge"></i></button>
            <button class="tab" data-tab="mapa">🌎 MAPA<i class="badge"></i></button>
          </nav>
          <section class="pane" data-pane="redes"></section>
          <section class="pane" data-pane="eixos">
            <div class="axes">
              ${AXES.map(
                (a) => `<div class="axis" data-axis="${a.id}">
                  <div class="axis-head"><span>${esc(a.poleA)}</span><b>${esc(a.category)}</b><span>${esc(a.poleB)}</span></div>
                  <div class="axis-track"><i class="axis-mid"></i><i class="axis-ghost"></i><i class="axis-marker"></i></div>
                </div>`,
              ).join('')}
            </div>
            <div class="axis-tip">Passe o mouse num eixo para entender os dois lados.</div>
          </section>
          <section class="pane" data-pane="bancadas">
            <p class="pane-intro">O peso de cada bancada no Congresso decide a sua <b>Coalizão</b>.</p>
            ${country.factions
              .map(
                (f) => `<div class="faction" data-faction="${f.id}" style="--fc:${f.color}">
                  <span class="f-face"></span>
                  <div class="f-info">
                    <div class="f-top"><b>${esc(f.name)}</b><span>${f.influence}% dos votos</span></div>
                    <div class="f-bar"><i class="f-fill"></i><i class="f-mid"></i></div>
                    <div class="f-cares">Se importa com: ${esc(f.cares.join(', '))}</div>
                  </div>
                  <span class="f-preview"></span>
                </div>`,
              )
              .join('')}
          </section>
          <section class="pane" data-pane="mapa">
            <div class="map-wrap"><span class="map-marker"></span><span class="map-abroad">🌎</span></div>
            <div class="map-info">Toque ou passe o mouse numa região. <b>Verde</b> aprova, <b>vermelho</b> reprova.</div>
            <div class="panel-label mt">RELAÇÕES INTERNACIONAIS</div>
            ${(country.partners ?? [])
              .map(
                (p) => `<div class="partner" data-partner="${p.id}">
                  <span class="p-flag">${p.flag}</span>
                  <div class="p-info"><div class="p-top"><b>${esc(p.name)}</b><span class="p-val"></span></div><div class="f-bar"><i class="f-fill"></i><i class="f-mid"></i></div></div>
                  <span class="f-preview"></span>
                </div>`,
              )
              .join('')}
          </section>
        </aside>
      </div>`;
    root.replaceChildren(s);
    this.desk = this.$('.desk-content');

    this.$('.window-frame').append(this.scene.canvas);
    this.scene.set('calm', state.kpis.aprovacao);
    this.scene.start();

    const portrait = makeCanvas(32, 32, 'portrait-canvas');
    const mini = makeCanvas(32, 32, 'mini-canvas');
    const advisor = makeCanvas(32, 32, 'advisor-canvas');
    this.$('.portrait').append(portrait);
    this.$('.tb-avatar').append(mini);
    this.$('.advisor-face').append(advisor);
    drawAvatar(mini.getContext('2d')!, state.player.avatar);
    const pctx = portrait.getContext('2d')!;
    const actx = advisor.getContext('2d')!;
    this.every(150, () => {
      drawAvatar(pctx, this.state.player.avatar, { blink: Math.random() < 0.1 });
      drawAvatar(actx, country.advisor.avatar, { sash: false, blink: Math.random() < 0.08, talk: this.advisorTalking && Math.random() < 0.6 });
    });

    this.$$('.tab').forEach((b) =>
      b.addEventListener('click', () => {
        sfx.click();
        this.setTab(b.dataset.tab as Tab);
      }),
    );
    this.setTab('redes');
    this.$$('.mnav button').forEach((b) =>
      b.addEventListener('click', () => {
        sfx.click();
        const v = b.dataset.view!;
        if (v === 'mesa' || v === 'planalto') this.setView(v);
        else this.setTab(v as Tab, true);
      }),
    );
    this.setView('mesa');
    this.feed.onPost = (post) => {
      this.badge('redes');
      this.state = { ...this.state, recentPosts: [post, ...(this.state.recentPosts ?? [])].slice(0, 12) };
    };
    this.$('[data-pane="redes"]').append(this.feed.root);

    const tip = this.$('.axis-tip');
    const defaultTip = tip.innerHTML;
    this.$$('.axis').forEach((row) => {
      const a = AXES.find((x) => x.id === row.dataset.axis)!;
      row.addEventListener('mouseenter', () => {
        tip.innerHTML = `<b>${esc(a.category)}</b><br><span class="pa">◀ ${esc(a.poleA)}:</span> ${esc(a.explainA)}<br><span class="pb">${esc(a.poleB)} ▶:</span> ${esc(a.explainB)}`;
      });
      row.addEventListener('mouseleave', () => (tip.innerHTML = defaultTip));
    });

    const wrap = this.$('.map-wrap');
    wrap.prepend(this.map.canvas);
    const info = this.$('.map-info');
    const defaultInfo = info.innerHTML;
    const inspect = (e: PointerEvent | MouseEvent) => {
      const r = this.map.canvas.getBoundingClientRect();
      const id = regionAt(((e.clientX - r.left) / r.width) * this.map.canvas.width, ((e.clientY - r.top) / r.height) * this.map.canvas.height);
      this.map.setHover(id);
      const region = country.regions.find((x) => x.id === id);
      info.innerHTML = region
        ? `<b>${esc(region.name)}</b> · ${region.pop}% da população · aprovação <b>${regionalApproval(this.state, country)[region.id]}%</b>`
        : defaultInfo;
    };
    this.map.canvas.addEventListener('mousemove', inspect);
    this.map.canvas.addEventListener('pointerdown', inspect);
    this.map.canvas.addEventListener('mouseleave', () => {
      this.map.setHover(null);
      info.innerHTML = defaultInfo;
    });
    this.every(120, () => {
      this.map.draw();
      const pos = this.map.markerPos();
      const marker = this.$('.map-marker');
      marker.style.display = pos ? 'block' : 'none';
      if (pos) {
        marker.style.left = `${(pos.x / this.map.canvas.width) * 100}%`;
        marker.style.top = `${(pos.y / this.map.canvas.height) * 100}%`;
        marker.textContent = this.map.markerIcon;
      }
    });

    this.$('.tb-home').addEventListener('click', () => {
      sfx.click();
      this.onHome?.();
    });
    this.$('.tb-mute').addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).textContent = sfx.toggleMute() ? '🔇' : '🔊';
    });
    const keydown = (e: KeyboardEvent) => {
      if (!s.isConnected) return document.removeEventListener('keydown', keydown);
      if (e.key.toLowerCase() === 'm') this.$('.tb-mute').click();
      if (document.querySelector('.home-overlay')) return;
      this.onKey?.(e);
    };
    const keyup = (e: KeyboardEvent) => {
      if (!s.isConnected) return document.removeEventListener('keyup', keyup);
      this.onKeyUp?.(e);
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);

    this.render();
  }

  $<T extends Element = HTMLElement>(sel: string): T {
    return this.screen.querySelector<T>(sel)!;
  }

  $$<T extends Element = HTMLElement>(sel: string): T[] {
    return [...this.screen.querySelectorAll<T>(sel)];
  }

  private every(ms: number, fn: () => void) {
    const id = window.setInterval(() => (this.screen.isConnected ? fn() : this.destroy()), ms);
    this.timers.push(id);
  }

  destroy() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.scene.stop();
    this.feed.stop();
  }

  // ---------- estado ----------

  render() {
    const { state } = this;
    for (const k of KPIS) this.$(`.kpi[data-kpi="${k.id}"] b`).textContent = formatKpi(k.id, state.kpis[k.id]);
    this.renderAxes();
    this.renderFactions();
    this.renderRelations();
    this.renderTrophies();
    this.renderProfile();
    this.renderMonth();
    this.renderTimeline();
    this.$('.stf-status').textContent = state.stf === 'OK' ? 'OK' : 'ATENTO';
  }

  renderMonth() {
    const m = this.state.month;
    const num = this.$('.tb-month-num');
    const label = monthName(m).slice(0, 3).toUpperCase();
    const changed = num.textContent !== '' && num.textContent !== label;
    num.textContent = label;
    this.$('.tb-month-name').textContent = String(yearOf(this.state, m));
    this.$('.tb-term').textContent = `${this.state.term}º MANDATO`;
    this.$('.pi-age').textContent = `${ageOf(this.state, m)} anos`;
    if (changed) shake(this.$('.tb-month'));
  }

  renderTimeline(current?: string) {
    this.$('.tl-track').innerHTML = [
      ...this.state.history.slice(current ? -3 : -4).map((h) => `<div class="tl-step done" title="${esc(h.choice)}"><span class="tl-dot">${h.icon}</span><small>${esc(shortDate(this.state, h.month))}</small></div>`),
      current ? `<div class="tl-step now"><span class="tl-dot">${current}</span><small>${esc(shortDate(this.state, this.state.month))}</small></div>` : '',
      '<div class="tl-step"><span class="tl-dot">?</span><small>…</small></div>',
    ].join('');
  }

  renderAxes() {
    for (const a of AXES) this.$(`.axis[data-axis="${a.id}"] .axis-marker`).style.left = `${(this.state.axes[a.id] + 100) / 2}%`;
  }

  renderFactions() {
    for (const f of this.country.factions) {
      const v = this.state.factions[f.id];
      const row = this.$(`.faction[data-faction="${f.id}"]`);
      const fill = row.querySelector<HTMLElement>('.f-fill')!;
      fill.style.left = v >= 0 ? '50%' : `${50 + v / 2}%`;
      fill.style.width = `${Math.abs(v) / 2}%`;
      fill.classList.toggle('neg', v < 0);
      row.querySelector('.f-face')!.textContent = factionFace(v);
    }
  }

  /** Troféus da partida em cima da mesa. */
  renderTrophies() {
    this.$('.desk-trophies').innerHTML = (this.state.trophies ?? [])
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
      .filter((a) => !!a)
      .map((a) => `<span title="${esc(a!.name)}: ${esc(a!.desc)}">${a!.icon}</span>`)
      .join('');
  }

  renderRelations() {
    this.map.set(regionalApproval(this.state, this.country));
    for (const p of this.country.partners ?? []) {
      const v = Math.round(this.state.relations?.[p.id] ?? 0);
      const row = this.$(`.partner[data-partner="${p.id}"]`);
      const fill = row.querySelector<HTMLElement>('.f-fill')!;
      fill.style.left = v >= 0 ? '50%' : `${50 + v / 2}%`;
      fill.style.width = `${Math.abs(v) / 2}%`;
      fill.classList.toggle('neg', v < 0);
      const label = row.querySelector<HTMLElement>('.p-val')!;
      label.textContent = v >= 40 ? 'aliado' : v >= 10 ? 'amigável' : v > -10 ? 'neutro' : v > -40 ? 'tenso' : 'hostil';
      label.className = `p-val ${v >= 10 ? 'good' : v <= -10 ? 'bad' : ''}`;
    }
  }

  /** Onde o acontecimento atual se passa: pulsa no mapa e ganha um marcador. */
  setPlace(place: Place | undefined, icon: string) {
    this.map.mark(place, icon);
    this.$('.map-abroad').classList.toggle('on', place === 'exterior');
  }

  async animateRelations(deltas: Deltas, showTab = true) {
    if (!Object.keys(deltas.relations ?? {}).length) return;
    if (showTab) this.setTab('mapa');
    else this.badge('mapa');
    await wait(showTab ? 200 : 0);
    this.renderRelations();
    (this.country.partners ?? []).forEach((p, i) => {
      const d = deltas.relations[p.id];
      if (!d) return;
      setTimeout(() => {
        const row = this.$(`.partner[data-partner="${p.id}"]`);
        const bubble = el('span', `reaction ${d > 0 ? 'up' : 'down'}`, d > 0 ? (d >= 12 ? '🤝' : '🙂') : d <= -12 ? '😡' : '😒');
        row.append(bubble);
        if (showTab) d > 0 ? sfx.up() : sfx.down();
        setTimeout(() => bubble.remove(), slow(1400));
      }, slow(i * 160));
    });
    if (showTab) await wait(1500);
  }

  renderProfile() {
    this.$('.profile-title').textContent = profileTitle(this.state.axes);
  }

  setScene(anim: SceneAnim) {
    this.scene.set(anim, this.state.kpis.aprovacao);
  }

  // ---------- conselheira e abas ----------

  async say(text: string) {
    this.advisorTalking = true;
    const bubble = this.$('.bubble');
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    await typewriter(this.$('.advisor-text'), text, 15, sfx.type);
    this.advisorTalking = false;
  }

  /** No celular, a aba também vira a vista principal (a mesa some enquanto as consequências aparecem). */
  setTab(t: Tab, showOnMobile = true) {
    this.tab = t;
    this.$$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    this.$$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === t));
    this.$(`.tab[data-tab="${t}"] .badge`).classList.remove('on');
    if (showOnMobile && this.mobile) this.setView(t);
  }

  get mobile(): boolean {
    return document.body.classList.contains('mobile');
  }

  /** Vista do celular: mesa, planalto (janela e retrato) ou uma das abas. */
  setView(v: string) {
    this.$('.cab-grid').dataset.view = v;
    this.$$('.mnav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    this.$(`.mnav button[data-view="${v}"] .badge`).classList.remove('on');
  }

  /** Cada novo acontecimento começa com a mesa na frente. */
  showDesk() {
    this.setView('mesa');
    this.setTab(this.tab, false);
  }

  badge(t: Tab) {
    if (t !== this.tab) this.$(`.tab[data-tab="${t}"] .badge`).classList.add('on');
    if (this.mobile && this.$('.cab-grid').dataset.view !== t) this.$(`.mnav button[data-view="${t}"] .badge`).classList.add('on');
  }

  /** Mostra, nos eixos e nas bancadas, para onde uma opção empurra o governo. */
  preview(effects: Effects | null) {
    for (const a of AXES) {
      const row = this.$(`.axis[data-axis="${a.id}"]`);
      const ghost = row.querySelector<HTMLElement>('.axis-ghost')!;
      const d = effects?.axes?.[a.id] ?? 0;
      row.classList.toggle('moving', d !== 0);
      if (d) {
        const from = (this.state.axes[a.id] + 100) / 2;
        const to = (Math.max(-100, Math.min(100, this.state.axes[a.id] + d)) + 100) / 2;
        ghost.style.left = `${Math.min(from, to)}%`;
        ghost.style.width = `${Math.abs(to - from)}%`;
        ghost.dataset.dir = d > 0 ? 'b' : 'a';
      } else {
        ghost.style.width = '0';
      }
    }
    for (const f of this.country.factions) {
      const d = effects?.factions?.[f.id] ?? 0;
      const p = this.$(`.faction[data-faction="${f.id}"] .f-preview`);
      p.textContent = d > 0 ? '👍' : d < 0 ? '👎' : '';
      p.className = `f-preview ${d ? 'show' : ''}`;
    }
    for (const partner of this.country.partners ?? []) {
      const d = effects?.relations?.[partner.id] ?? 0;
      const p = this.$(`.partner[data-partner="${partner.id}"] .f-preview`);
      p.textContent = d > 0 ? '👍' : d < 0 ? '👎' : '';
      p.className = `f-preview ${d ? 'show' : ''}`;
    }
  }

  // ---------- consequências animadas ----------

  private floatDelta(anchor: HTMLElement, text: string, good: boolean) {
    const r = anchor.getBoundingClientRect();
    const s = this.screen.getBoundingClientRect();
    const scale = s.width / 1280;
    const f = el('div', `floater ${good ? 'good' : 'bad'}`, esc(text));
    f.style.left = `${(r.left - s.left) / scale + r.width / scale / 2}px`;
    f.style.top = `${(r.bottom - s.top) / scale}px`;
    this.screen.append(f);
    setTimeout(() => f.remove(), slow(1800));
  }

  async animateKpis(deltas: Deltas) {
    let good = 0;
    let bad = 0;
    const jobs: Promise<void>[] = [];
    KPIS.forEach((k, i) => {
      const d = deltas.kpis[k.id];
      if (!d) return;
      const item = this.$(`.kpi[data-kpi="${k.id}"]`);
      const b = item.querySelector('b')!;
      const positive = d * k.good > 0;
      positive ? good++ : bad++;
      setTimeout(() => {
        item.classList.remove('flash-good', 'flash-bad');
        void item.offsetWidth;
        item.classList.add(positive ? 'flash-good' : 'flash-bad');
        this.floatDelta(item, formatDelta(k.id, d), positive);
      }, slow(i * 90));
      const to = this.state.kpis[k.id];
      jobs.push(countTo(1000, to - d, to, (v) => (b.textContent = formatKpi(k.id, v))));
    });
    if (good || bad) good >= bad ? sfx.up() : sfx.down();
    this.map.set(regionalApproval(this.state, this.country));
    await Promise.all(jobs);
  }

  async animateAxes(deltas: Deltas, showTab = true) {
    if (!Object.keys(deltas.axes).length) return;
    if (showTab) this.setTab('eixos');
    else this.badge('eixos');
    this.preview(null);
    await wait(showTab ? 250 : 0);
    for (const a of AXES) this.$(`.axis[data-axis="${a.id}"]`).classList.toggle('moved', !!deltas.axes[a.id]);
    this.renderAxes();
    this.renderProfile();
    shake(this.$('.profile-title'));
    if (showTab) await wait(1300);
  }

  async animateFactions(deltas: Deltas, showTab = true) {
    if (!Object.keys(deltas.factions).length) return;
    if (showTab) this.setTab('bancadas');
    else this.badge('bancadas');
    await wait(showTab ? 200 : 0);
    this.renderFactions();
    this.country.factions.forEach((f, i) => {
      const d = deltas.factions[f.id];
      if (!d) return;
      setTimeout(() => {
        const row = this.$(`.faction[data-faction="${f.id}"]`);
        const bubble = el('span', `reaction ${d > 0 ? 'up' : 'down'}`, d > 0 ? (d >= 15 ? '😍' : '👏') : d <= -15 ? '🤬' : '😒');
        row.append(bubble);
        if (showTab) d > 0 ? sfx.up() : sfx.down();
        setTimeout(() => bubble.remove(), slow(1400));
      }, slow(i * 160));
    });
    if (showTab) await wait(1500);
  }

  /** Faixa de URGENTE atravessando a tela antes de um evento grande. */
  async urgent(kicker: string, title: string) {
    sfx.alarm();
    sfx.ring();
    const banner = el('div', 'urgent-banner', `<span>${esc(kicker)}</span><b>${esc(title)}</b>`);
    this.screen.append(banner);
    shake(this.$('.desk'));
    await wait(2200);
    banner.classList.add('out');
    await wait(300);
    banner.remove();
  }
}

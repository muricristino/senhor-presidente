import { drawAvatar } from '../art/avatar';
import { BrazilMap } from '../art/brazilMap';
import { chamberCount, drawHemicycle } from '../art/hemicycle';
import { makeCanvas } from '../art/pixel';
import { PlanaltoScene } from '../art/scene';
import { sfx } from '../audio/sfx';
import { ACHIEVEMENTS, loadUnlocked } from '../engine/achievements';
import { ageOf, dateLabel } from '../engine/calendar';
import { AXES } from '../engine/data';
import { formatKpi, KPIS } from '../engine/kpis';
import { ministerMood, moodFace } from '../engine/ministers';
import { profileTitle } from '../engine/profile';
import { regionalApproval } from '../engine/regions';
import type { Country, GameState, KpiId } from '../engine/types';
import { el, esc } from './dom';
import { showGallery } from './trophies';

export interface HomeOptions {
  /** Sem estado: tela de título. Com estado: painel do mandato. */
  state?: GameState;
  country?: Country;
  /** 'resume' vem de um jogo salvo; 'back' volta para um mandato já aberto. */
  primary?: { label: string; onClick: () => void };
  onNew: () => void;
  onLab?: () => void;
  /** Busca o boletim do Claude quando o salvo está desatualizado. */
  loadBulletin?: () => Promise<GameState['bulletin'] | null>;
  /** Home por cima do gabinete (pausa o jogo) em vez de tela própria. */
  overlay?: boolean;
}

function sparkline(values: number[], good: 1 | -1): string {
  if (values.length < 2) return '<svg class="spark" viewBox="0 0 100 24"></svg>';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`).join(' ');
  const trend = (values[values.length - 1] - values[0]) * good;
  const color = trend > 0.01 ? '#4fc27f' : trend < -0.01 ? '#e0574f' : '#9097b4';
  return `<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

/** Tela inicial: título do jogo ou painel completo do mandato em andamento. */
export function showHome(host: HTMLElement, o: HomeOptions): HTMLElement {
  const root = el('div', o.overlay ? 'overlay home home-overlay' : 'screen home');
  const scene = new PlanaltoScene();
  scene.set(o.state ? (o.state.kpis.aprovacao < 35 ? 'protest' : o.state.kpis.aprovacao > 60 ? 'celebrate' : 'calm') : 'celebrate', o.state?.kpis.aprovacao ?? 60);
  scene.canvas.classList.add('home-bg');
  root.append(scene.canvas);
  scene.start();

  const unlocked = Object.keys(loadUnlocked()).length;
  const gallery = `<button class="home-btn ghost home-gallery">🏆 CONQUISTAS ${unlocked}/${ACHIEVEMENTS.length}</button>`;

  if (!o.state || !o.country) {
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="home-title">
        <div class="logo-flag big"><span></span></div>
        <h1>SENHOR<br>PRESIDENTE</h1>
        <p>Assuma o Palácio do Planalto em 2026. Cada canetada move o país, o Congresso, o Supremo e as redes.</p>
        <div class="home-actions">
          <button class="home-btn primary home-new">▶ NOVO MANDATO</button>
          ${gallery}
          <button class="home-btn ghost home-lab">🧪 LAB DE ANIMAÇÃO</button>
        </div>
      </div>`,
    );
  } else {
    const s = o.state;
    const c = o.country;
    const series = s.series ?? [{ month: s.month, kpis: s.kpis }];
    const chamber = chamberCount(s, c).total;
    const regions = regionalApproval(s, c);
    root.insertAdjacentHTML(
      'beforeend',
      `<header class="home-head">
        <div class="home-logo"><div class="logo-flag"><span></span></div><div><b>SENHOR PRESIDENTE</b><small>${esc(dateLabel(s, s.month))} · ${s.term}º mandato</small></div></div>
        <div class="home-actions">
          ${o.primary ? `<button class="home-btn primary home-primary">${esc(o.primary.label)}</button>` : ''}
          <button class="home-btn ghost home-new">NOVO MANDATO</button>
          ${gallery}
        </div>
      </header>
      <div class="home-grid">
        <section class="home-panel home-pres">
          <div class="hp-top">
            <div class="hp-portrait"></div>
            <div>
              <div class="pi-title">${esc(c.head_of_state_title)}</div>
              <div class="hp-name">${esc(s.player.name)}</div>
              <div class="hp-meta">${ageOf(s, s.month)} anos · ${s.history.length} decisões</div>
              <div class="hp-profile">${esc(profileTitle(s.axes))}</div>
              <div class="hp-trophies">${(s.trophies ?? []).map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.icon ?? '').join('')}</div>
            </div>
          </div>
          <div class="hp-kpis">
            ${KPIS.map(
              (k) => `<div class="hp-kpi"><span>${esc(k.label)}</span><b>${formatKpi(k.id, s.kpis[k.id])}</b>${sparkline(series.map((p) => p.kpis[k.id as KpiId]), k.good)}</div>`,
            ).join('')}
          </div>
        </section>

        <section class="home-mid">
          <div class="home-panel hp-congress">
            <div class="panel-label">🏛️ CÂMARA DOS DEPUTADOS</div>
            <div class="hp-hemi"></div>
            <div class="hp-seats"><b>${chamber.base}</b> na base · <b class="red">${chamber.opposition}</b> na oposição</div>
            <div class="hp-thresholds">
              <span class="${chamber.base >= 257 ? 'ok' : ''}">257 · aprova lei</span>
              <span class="${chamber.base >= 308 ? 'ok' : ''}">308 · aprova PEC</span>
              <span class="${chamber.opposition < 342 ? 'ok' : 'bad'}">342 · impeachment ${chamber.opposition < 342 ? 'barrado' : 'passa'}</span>
            </div>
          </div>
          <div class="home-panel hp-world">
            <div class="panel-label">🌎 BRASIL E MUNDO</div>
            <div class="hp-world-grid">
              <div class="hp-map"></div>
              <div class="hp-rel">
                ${(c.partners ?? [])
                  .map((p) => {
                    const v = Math.round(s.relations?.[p.id] ?? 0);
                    return `<div class="hp-rel-row"><span>${p.flag}</span><b>${esc(p.short)}</b><i class="${v >= 10 ? 'good' : v <= -10 ? 'bad' : ''}">${v > 0 ? '+' : ''}${v}</i></div>`;
                  })
                  .join('')}
                <div class="hp-regions">${c.regions.map((r) => `<span>${esc(r.name)} <b>${regions[r.id]}%</b></span>`).join('')}</div>
              </div>
            </div>
          </div>
          <div class="home-panel hp-axes">
            <div class="panel-label">🧭 BÚSSOLA IDEOLÓGICA</div>
            <div class="hp-axes-grid">
              ${AXES.map(
                (a) => `<div class="hp-axis"><small class="pa">${esc(a.poleA)}</small><div class="axis-track"><i class="axis-mid"></i><i class="axis-marker" style="left:${(s.axes[a.id] + 100) / 2}%"></i></div><small class="pb">${esc(a.poleB)}</small></div>`,
              ).join('')}
            </div>
          </div>
        </section>

        <section class="home-panel home-side">
          <div class="panel-label">📺 BOLETIM DO PLANALTO</div>
          <p class="hp-editorial"></p>
          <div class="panel-label mt">👔 MINISTÉRIO</div>
          <div class="hp-ministers">
            ${c.ministers
              .map((m) => {
                const mood = ministerMood(m.id, s);
                return `<div class="hp-minister" data-m="${m.id}" style="--mc:${m.color}">
                  <span class="hp-m-face"></span>
                  <div><b>${esc(m.role)}</b> <em>${moodFace(mood)}</em><p class="hp-m-line"></p></div>
                </div>`;
              })
              .join('')}
          </div>
          <div class="panel-label mt">📱 NAS REDES</div>
          <div class="hp-posts">
            ${(s.recentPosts ?? [])
              .slice(0, 3)
              .map((p) => `<div class="hp-post"><b>${esc(p.who)}</b> ${esc(p.text)} <i>♥ ${p.likes >= 1000 ? `${Math.round(p.likes / 1000)} mil` : p.likes}</i></div>`)
              .join('') || '<div class="hp-post muted">As redes ainda estão digerindo o seu governo.</div>'}
          </div>
        </section>
      </div>`,
    );

    const portrait = makeCanvas(32, 32, 'hp-canvas');
    drawAvatar(portrait.getContext('2d')!, s.player.avatar);
    root.querySelector('.hp-portrait')!.append(portrait);
    root.querySelector('.hp-hemi')!.append(drawHemicycle(s, c));
    const map = new BrazilMap();
    map.set(regions);
    map.draw();
    root.querySelector('.hp-map')!.append(map.canvas);
    root.querySelectorAll<HTMLElement>('.hp-minister').forEach((row) => {
      const m = c.ministers.find((x) => x.id === row.dataset.m)!;
      const cv = makeCanvas(32, 32, 'hp-m-canvas');
      drawAvatar(cv.getContext('2d')!, m.avatar, { sash: false });
      row.querySelector('.hp-m-face')!.append(cv);
    });

    // Boletim: do salvo se for deste mês; senão o Claude escreve agora.
    const fill = (b: GameState['bulletin']) => {
      root.querySelector('.hp-editorial')!.textContent = b?.editorial ?? '';
      root.querySelectorAll<HTMLElement>('.hp-minister').forEach((row) => {
        row.querySelector('.hp-m-line')!.textContent = b?.ministers[row.dataset.m!] ?? '';
      });
    };
    if (s.bulletin && s.bulletin.month === s.month) fill(s.bulletin);
    else if (o.loadBulletin) {
      root.querySelector('.hp-editorial')!.innerHTML = '<span class="loading-dots">A redação está fechando o boletim</span>';
      root.querySelectorAll<HTMLElement>('.hp-m-line').forEach((p) => (p.innerHTML = '<span class="skeleton"></span>'));
      void o.loadBulletin().then((b) => {
        if (!root.isConnected) return;
        if (b) {
          s.bulletin = b;
          fill(b);
        } else {
          root.querySelector('.hp-editorial')!.textContent = '';
          root.querySelectorAll<HTMLElement>('.hp-m-line').forEach((p) => (p.textContent = ''));
        }
      });
    }
  }

  const close = () => {
    scene.stop();
    root.remove();
  };
  root.querySelector('.home-primary')?.addEventListener('click', () => {
    sfx.click();
    close();
    o.primary!.onClick();
  });
  root.querySelector('.home-new')!.addEventListener('click', () => {
    if (o.state && !confirm('Começar um novo mandato? O mandato atual será perdido.')) return;
    sfx.click();
    close();
    o.onNew();
  });
  root.querySelector('.home-gallery')!.addEventListener('click', () => showGallery(root));
  root.querySelector('.home-lab')?.addEventListener('click', () => {
    sfx.click();
    close();
    o.onLab?.();
  });

  if (o.overlay) host.append(root);
  else host.replaceChildren(root);
  sfx.select();
  return root;
}

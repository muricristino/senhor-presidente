import { AVATARS, drawAvatar } from '../art/avatar';
import { makeCanvas } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { ACHIEVEMENTS, loadUnlocked } from '../engine/achievements';
import { listCountries } from '../engine/data';
import { showGallery } from './trophies';
import type { Player } from '../engine/types';
import { el, esc } from './dom';

export function creationScreen(
  root: HTMLElement,
  initial: Partial<Player>,
  onStart: (player: Player, countryId: string) => void,
  resume?: { label: string; onResume: () => void },
) {
  const countries = listCountries();
  const br = countries.find((c) => c.available)!;
  let avatar = initial.avatar ?? 0;
  let bioId = initial.bioId ?? br.bios[0].id;
  const countryId = br.country_id;

  const screen = el('div', 'screen creation');
  screen.innerHTML = `
    <header class="creation-title">
      <div class="logo-flag"><span></span></div>
      <h1>SENHOR PRESIDENTE</h1>
      <p>Tela de criação do presidente</p>
    </header>
    <div class="creation-body">
      <section class="panel avatar-panel">
        <div class="panel-label">APARÊNCIA</div>
        <div class="avatar-frame"></div>
        <div class="avatar-nav">
          <button class="btn-arrow" data-dir="-1" aria-label="Avatar anterior">◀</button>
          <span class="avatar-num"></span>
          <button class="btn-arrow" data-dir="1" aria-label="Próximo avatar">▶</button>
        </div>
      </section>
      <section class="panel form-panel">
        <label class="field">
          <span class="panel-label">NOME DO PRESIDENTE</span>
          <input class="name-input" maxlength="22" placeholder="Digite seu nome" value="${esc(initial.name ?? '')}" autocomplete="off" spellcheck="false" />
        </label>
        <div class="field">
          <span class="panel-label">PAÍS</span>
          <div class="countries">
            ${countries
              .map(
                (c) => `<button class="country ${c.available ? 'active' : 'locked'}" ${c.available ? '' : 'disabled'}>
                  <span class="flag">${c.flag}</span> ${esc(c.country_name)}
                  <small>${c.available ? 'DISPONÍVEL' : '🔒 EM BREVE'}</small>
                </button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="field">
          <span class="panel-label">ORIGEM</span>
          <div class="bios">
            ${br.bios
              .map(
                (b) => `<button class="bio" data-bio="${b.id}">
                  <strong>${esc(b.name)}</strong>
                  <span>${esc(b.desc)}</span>
                  <em>${esc(b.bonus)}</em>
                </button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="start-row">
          <button class="btn-gallery">🏆 CONQUISTAS ${Object.keys(loadUnlocked()).length}/${ACHIEVEMENTS.length}</button>
          ${resume ? `<button class="btn-resume">▶ CONTINUAR: ${esc(resume.label)}</button>` : ''}
          <button class="btn-start" disabled>INICIAR MANDATO ➔</button>
        </div>
      </section>
    </div>
  `;
  root.replaceChildren(screen);

  const canvas = makeCanvas(32, 32, 'avatar-big');
  screen.querySelector('.avatar-frame')!.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const num = screen.querySelector<HTMLElement>('.avatar-num')!;
  const input = screen.querySelector<HTMLInputElement>('.name-input')!;
  const start = screen.querySelector<HTMLButtonElement>('.btn-start')!;

  const renderAvatar = (blink = false) => {
    drawAvatar(ctx, avatar, { blink });
    num.textContent = `${String(avatar + 1).padStart(2, '0')} / ${String(AVATARS.length).padStart(2, '0')}`;
  };
  renderAvatar();
  const blinkTimer = setInterval(() => {
    if (!canvas.isConnected) return clearInterval(blinkTimer);
    renderAvatar(true);
    setTimeout(() => renderAvatar(false), 140);
  }, 2600);

  screen.querySelectorAll<HTMLButtonElement>('.btn-arrow').forEach((b) =>
    b.addEventListener('click', () => {
      avatar = (avatar + Number(b.dataset.dir) + AVATARS.length) % AVATARS.length;
      sfx.click();
      renderAvatar();
    }),
  );

  const bios = screen.querySelectorAll<HTMLButtonElement>('.bio');
  const renderBio = () => bios.forEach((b) => b.classList.toggle('selected', b.dataset.bio === bioId));
  renderBio();
  bios.forEach((b) =>
    b.addEventListener('click', () => {
      bioId = b.dataset.bio!;
      sfx.select();
      renderBio();
    }),
  );

  const validate = () => (start.disabled = input.value.trim().length < 2);
  input.addEventListener('input', () => {
    sfx.type();
    validate();
  });
  validate();
  input.focus();

  const go = () => {
    if (start.disabled) return;
    sfx.fanfare();
    onStart({ name: input.value.trim(), avatar, bioId }, countryId);
  };
  start.addEventListener('click', go);
  screen.querySelector('.btn-gallery')!.addEventListener('click', () => showGallery(screen));
  screen.querySelector('.btn-resume')?.addEventListener('click', () => {
    sfx.fanfare();
    resume!.onResume();
  });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
}

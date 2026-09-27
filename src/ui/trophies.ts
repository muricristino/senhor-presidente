import { sfx } from '../audio/sfx';
import { ACHIEVEMENTS, loadUnlocked, type Achievement } from '../engine/achievements';
import { el, esc, wait } from './dom';

let queue: Promise<void> = Promise.resolve();

/** Aviso de conquista que desce no canto da tela; vários entram em fila. */
export function toastAchievement(host: HTMLElement, a: Achievement) {
  queue = queue.then(async () => {
    const t = el(
      'div',
      'trophy-toast',
      `<span class="tt-icon">${a.icon}</span><div><small>🏆 CONQUISTA DESBLOQUEADA</small><b>${esc(a.name)}</b><em>${esc(a.desc)}</em></div>`,
    );
    host.append(t);
    sfx.fanfare();
    await wait(3200);
    t.classList.add('out');
    await wait(400);
    t.remove();
  });
}

/** Galeria de todas as conquistas, guardadas entre partidas. */
export function showGallery(host: HTMLElement) {
  const unlocked = loadUnlocked();
  const got = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const overlay = el(
    'div',
    'overlay gallery-overlay',
    `<div class="gallery">
      <div class="modal-head">🏆 CONQUISTAS · ${got}/${ACHIEVEMENTS.length} <button class="close" aria-label="Fechar">✕</button></div>
      <div class="gallery-grid">
        ${ACHIEVEMENTS.map((a, i) => {
          const u = unlocked[a.id];
          return `<div class="g-item ${u ? 'on' : ''}" style="--i:${i}">
            <span class="g-icon">${u ? a.icon : '🔒'}</span>
            <b>${esc(a.name)}</b>
            <small>${u ? `${esc(a.desc)}<br><i>${esc(u.president)} · ${new Date(u.at).toLocaleDateString('pt-BR')}</i>` : '???'}</small>
          </div>`;
        }).join('')}
      </div>
    </div>`,
  );
  host.append(overlay);
  sfx.select();
  const close = () => {
    sfx.click();
    overlay.remove();
  };
  overlay.querySelector('.close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
}

import { sfx } from '../audio/sfx';
import type { SocialPost, SocialWave } from '../engine/types';
import { slow } from '../speed';
import { countTo, el, esc } from './dom';

const TONE_COLOR: Record<SocialPost['tone'], string> = {
  angry: '#e0574f',
  happy: '#4fc27f',
  neutral: '#9aa0b4',
  press: '#3a6fd8',
  bot: '#6a6a6a',
  faction: '#e0b04a',
};

const MAX_POSTS = 7;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1000) return `${Math.round(n / 1000)} mil`;
  return String(Math.round(n));
}

function mood(sentiment: number): { emoji: string; label: string } {
  if (sentiment <= -60) return { emoji: '🤬', label: 'FÚRIA' };
  if (sentiment <= -20) return { emoji: '😠', label: 'IRRITADAS' };
  if (sentiment < 20) return { emoji: '😐', label: 'DIVIDIDAS' };
  if (sentiment < 50) return { emoji: '🙂', label: 'FAVORÁVEIS' };
  return { emoji: '🤩', label: 'EUFÓRICAS' };
}

/** Feed ao vivo: posts entram um a um, curtidas sobem, trending e termômetro reagem. */
export class SocialFeed {
  readonly root = el('div', 'feed');
  private list: HTMLElement;
  private trending: HTMLElement;
  private meterFill: HTMLElement;
  private meterFace: HTMLElement;
  private timers: number[] = [];
  onPost?: () => void;

  constructor() {
    this.root.innerHTML = `
      <div class="feed-head">
        <div class="trend"><span>EM ALTA</span><b class="trend-tag"></b></div>
        <div class="meter">
          <span class="meter-label">HUMOR DAS REDES</span>
          <div class="meter-bar"><i class="meter-fill"></i><i class="meter-mid"></i></div>
          <span class="meter-face"></span>
        </div>
      </div>
      <div class="feed-list"></div>`;
    this.list = this.root.querySelector('.feed-list')!;
    this.trending = this.root.querySelector('.trend-tag')!;
    this.meterFill = this.root.querySelector('.meter-fill')!;
    this.meterFace = this.root.querySelector('.meter-face')!;
  }

  wave(wave: SocialWave, gap = 1400, firstDelay = 200) {
    this.stop();
    this.trending.textContent = wave.trending;
    this.trending.classList.remove('pop');
    void this.trending.offsetWidth;
    this.trending.classList.add('pop');
    const m = mood(wave.sentiment);
    const pct = (wave.sentiment + 100) / 2;
    this.meterFill.style.left = wave.sentiment >= 0 ? '50%' : `${pct}%`;
    this.meterFill.style.width = `${Math.abs(wave.sentiment) / 2}%`;
    this.meterFill.classList.toggle('neg', wave.sentiment < 0);
    this.meterFace.innerHTML = `${m.emoji} <small>${m.label}</small>`;
    wave.posts.forEach((p, i) => {
      this.timers.push(window.setTimeout(() => this.push(p), slow(firstDelay + i * gap)));
    });
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  push(p: SocialPost) {
    if (!this.root.isConnected) return this.stop();
    const initials = p.who.split(' ').map((w) => w[0]).slice(0, 2).join('');
    const node = el(
      'article',
      `post tone-${p.tone}`,
      `<div class="post-avatar" style="--pc:${TONE_COLOR[p.tone]}">${esc(initials)}</div>
       <div class="post-body">
         <div class="post-who"><b>${esc(p.who)}</b> <span>@${esc(p.at)}</span></div>
         <p>${esc(p.text)}</p>
         <div class="post-meta"><span class="heart">♥</span> <b class="likes">0</b> <span class="rt">⟳ ${compact(p.likes / 7)}</span></div>
       </div>`,
    );
    this.list.prepend(node);
    while (this.list.children.length > MAX_POSTS) this.list.lastElementChild!.remove();
    sfx.tick();
    this.onPost?.();
    const likes = node.querySelector<HTMLElement>('.likes')!;
    void countTo(1600, 0, p.likes, (v) => (likes.textContent = compact(v))).then(() => node.querySelector('.heart')!.classList.add('beat'));
  }
}

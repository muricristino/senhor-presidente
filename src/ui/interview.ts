import { drawAvatar } from '../art/avatar';
import { makeCanvas } from '../art/pixel';
import { sfx } from '../audio/sfx';
import { applyEffects } from '../engine/rules';
import type { GameState, Interview, InterviewAnswer } from '../engine/types';
import { el, esc, shake, typewriter, wait } from './dom';
import type { Gabinete } from './shell';

const SECONDS = 10;
const SILENCE: InterviewAnswer = { icon: '🤐', label: 'Silêncio', effects: { kpis: { aprovacao: -1 } }, headline: 'Presidente fica em silêncio e deixa repórter sem resposta' };

function reporterAvatar(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `reporter${(h % 4) + 1}`;
}

/** Coletiva de imprensa: três perguntas rápidas, flashes, e a manchete de cada resposta. */
export async function runInterview(g: Gabinete, interview: Interview): Promise<GameState> {
  g.renderMonth();
  g.renderTimeline('🎤');
  g.setPlace('nacional', '🎤');
  g.setScene('speech');
  g.desk.innerHTML = `
    <div class="pressroom">
      <div class="dossier-top">
        <span class="kicker press-kicker">🎤 COLETIVA DE IMPRENSA · PALÁCIO DO PLANALTO</span>
        <span class="step">${interview.generated ? '✦ ' : ''}<b class="q-count">1</b>/${interview.questions.length}</span>
      </div>
      <div class="press-stage">
        <div class="press-reporter"><div class="press-face"></div><b class="press-name"></b><small class="press-outlet"></small></div>
        <div class="press-bubble"><p class="press-question"></p></div>
      </div>
      <div class="press-mics">🎙️🎤🎙️🎤🎙️</div>
      <div class="memo-timer press-timer"><i></i></div>
      <div class="press-answers"></div>
      <div class="press-headlines"></div>
    </div>`;
  const $ = <T extends Element = HTMLElement>(s: string) => g.desk.querySelector<T>(s)!;
  const face = makeCanvas(32, 32, 'press-canvas');
  $('.press-face').append(face);
  const fctx = face.getContext('2d')!;
  void g.say('Imprensa na sala, Presidente. Cada frase vira manchete. Pense rápido.');

  const flash = () => {
    const f = el('div', 'camera-flash');
    g.desk.append(f);
    sfx.stamp();
    setTimeout(() => f.remove(), 400);
  };

  const headlines: string[] = [];
  for (let qi = 0; qi < interview.questions.length; qi++) {
    const q = interview.questions[qi];
    $('.q-count').textContent = String(qi + 1);
    $('.press-name').textContent = q.journalist;
    $('.press-outlet').textContent = q.outlet;
    const avatar = reporterAvatar(q.journalist);
    let talking = true;
    const talk = setInterval(() => drawAvatar(fctx, avatar, { sash: false, talk: talking && Math.random() < 0.6, blink: Math.random() < 0.08 }), 120);
    const stage = $('.press-stage');
    stage.classList.remove('enter');
    void stage.offsetWidth;
    stage.classList.add('enter');
    flash();
    await typewriter($('.press-question'), q.question, 18, sfx.type);
    talking = false;

    const box = $('.press-answers');
    box.innerHTML = q.answers
      .map((a, i) => `<button class="memo-option press-answer" style="--i:${i}"><span class="opt-key">${i + 1}</span><span class="memo-opt-icon">${a.icon}</span><strong>${esc(a.label)}</strong></button>`)
      .join('');
    box.style.setProperty('--n', String(q.answers.length));
    const buttons = [...box.querySelectorAll<HTMLButtonElement>('.press-answer')];
    buttons.forEach((b, i) => b.addEventListener('mouseenter', () => {
      sfx.hover();
      g.preview(q.answers[i].effects);
    }));

    const answer = await new Promise<InterviewAnswer>((resolve) => {
      let remaining = SECONDS;
      const bar = $('.press-timer i');
      const timer = setInterval(() => {
        if (document.querySelector('.overlay')) return;
        remaining -= 0.25;
        bar.style.width = `${(remaining / SECONDS) * 100}%`;
        bar.classList.toggle('danger', remaining < 4);
        if (remaining <= 0) done(SILENCE, -1);
      }, 250);
      const done = (a: InterviewAnswer, i: number) => {
        clearInterval(timer);
        g.onKey = null;
        buttons.forEach((b, j) => {
          b.disabled = true;
          b.classList.toggle('selected', j === i);
        });
        resolve(a);
      };
      buttons.forEach((b, i) => b.addEventListener('click', () => done(q.answers[i], i)));
      g.onKey = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= q.answers.length) done(q.answers[n - 1], n - 1);
      };
    });
    clearInterval(talk);

    flash();
    shake(g.$('.desk'));
    g.preview(null);
    const result = applyEffects(g.state, answer.effects, g.country);
    g.state = result.state;
    void g.animateKpis(result.deltas);
    void g.animateAxes(result.deltas, false);
    void g.animateFactions(result.deltas, false);
    void g.animateRelations(result.deltas, false);
    headlines.push(answer.headline);
    const line = el('div', 'press-headline', `<span>📰</span> ${esc(answer.headline)}`);
    $('.press-headlines').append(line);
    await wait(1800);
  }

  g.state = {
    ...g.state,
    decisions: [...g.state.decisions, `${interview.id}:coletiva`],
    history: [...g.state.history, { month: g.state.month, event: 'Coletiva de imprensa', choice: headlines[0] ?? 'Coletiva', headline: headlines.join(' / '), icon: '🎤' }],
  };
  g.feed.push({ who: 'Economia Hoje', at: 'economiahoje', text: `Resumo da coletiva: ${headlines[0] ?? ''}`, likes: 5000, tone: 'press' });
  const box = $('.press-answers');
  box.innerHTML = '<button class="memo-next press-done">ENCERRAR COLETIVA ▶</button>';
  const next = box.querySelector<HTMLElement>('.press-done')!;
  await Promise.race([
    new Promise<void>((r) => next.addEventListener('click', () => r(), { once: true })),
    wait(7000),
    new Promise<void>((r) => (g.onKey = (e) => (e.key === 'Enter' || e.code === 'Space') && r())),
  ]);
  g.onKey = null;
  sfx.click();
  g.renderTimeline();
  g.desk.querySelector('.pressroom')?.classList.add('out');
  await wait(250);
  return g.state;
}

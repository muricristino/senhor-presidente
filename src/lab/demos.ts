import { buildLibrary } from '../art/sprites';
import { sfx } from '../audio/sfx';
import type { PixelSprite } from '../engine/types';
import { el } from '../ui/dom';
import { coffeeMachine, corridor, esplanada, meetingTable, officeRoom, plenary, stfBench, stfRoom } from './backdrops';
import { Actor, ease, LW, type Stage } from './engine';

export interface Demo {
  id: string;
  icon: string;
  title: string;
  kind: string;
  /** O que a demo testa no motor. */
  tests: string[];
  help: string;
  run: (stage: Stage, hud: HTMLElement) => Promise<void>;
}

const lib = () => buildLibrary(0);
const sprite = (l: Map<string, PixelSprite>, id: string) => l.get(id)!;

// ======================================================================
// 1. Um dia no Planalto: apontar e clicar + diálogo com escolhas
// ======================================================================

const planalto: Demo = {
  id: 'planalto',
  icon: '🏛️',
  title: 'Um dia no Planalto',
  kind: 'Aventura · apontar e clicar',
  tests: ['Caminhada com ciclo de pernas', 'Câmera que segue com paralaxe', 'Diálogo com escolhas dentro da cena', 'Zoom e flashes'],
  help: 'Toque no chão para andar. Toque nas setas ▼ para interagir.',
  async run(stage, hud) {
    const L = lib();
    const WORLD = 640;
    stage.background.push(...corridor(WORLD));
    stage.camera.bounds = { minX: 0, maxX: WORLD - LW };
    const pres = stage.add(new Actor(sprite(L, 'presidente'), 50, 160, 'Presidente'));
    const iris = stage.add(new Actor(sprite(L, 'deputada'), 230, 158, 'Íris'));
    iris.facing = -1;
    const reporters = [0, 1, 2].map((i) => {
      const a = stage.add(new Actor(sprite(L, i === 1 ? 'cidada' : 'jornalista'), WORLD - 40 + i * 12, 162, 'Repórter'));
      a.visible = false;
      return a;
    });
    stage.camera.follow = pres;

    let busy = false;
    let coffee = false;
    let met = false;
    const hotspots = [
      { x: 230, label: 'Conversar com a Íris', action: talkIris },
      { x: 360, label: 'Tomar um café', action: drinkCoffee },
      { x: WORLD - 38, label: 'Entrar na sala de imprensa', action: pressRoom },
    ];
    stage.foreground.push((ctx, t) => {
      coffeeMachine(ctx, 360, t);
      if (busy) return;
      for (const h of hotspots) {
        const y = 92 + Math.sin(t * 5 + h.x) * 3;
        ctx.fillStyle = '#f4c542';
        ctx.fillRect(h.x - 3, y, 7, 2);
        ctx.fillRect(h.x - 2, y + 2, 5, 2);
        ctx.fillRect(h.x - 1, y + 4, 3, 2);
      }
    });
    hud.innerHTML = '<div class="lab-hud-line">☕ <b class="h-coffee">sem café</b> · 🗨️ <b class="h-met">Íris ainda não falou</b></div>';

    stage.onPointer = async (p) => {
      if (busy) return;
      const spot = hotspots.find((h) => Math.abs(p.x - h.x) < 18 && p.y > 80);
      if (spot) {
        busy = true;
        sfx.click();
        await pres.walkTo(spot.x - 18 * Math.sign(spot.x - pres.x || 1), 160);
        pres.facing = spot.x > pres.x ? 1 : -1;
        await spot.action();
        busy = false;
        return;
      }
      if (p.y > 118) {
        sfx.hover();
        void pres.walkTo(Math.max(12, Math.min(WORLD - 12, p.x)), Math.max(150, Math.min(170, p.y)));
      }
    };

    async function talkIris() {
      iris.facing = -1;
      stage.emote(iris, '❗');
      iris.jump();
      await stage.say(iris, met ? 'De volta, Presidente? A imprensa não vai esperar para sempre.' : 'Bom dia, Presidente! A agenda de hoje está pesada.');
      if (met) return;
      const i = await stage.choose('O que o senhor quer primeiro?', [{ label: 'Um café, por favor ☕' }, { label: 'Me dá o resumo do dia 📋' }, { label: 'Quem vazou aquela foto minha? 😠' }], 'Íris Monteiro');
      if (i === 0) {
        await iris.walkTo(346, 158);
        stage.particles.emit(360, 128, { colors: ['#f0ece0', '#d8d4ca'], count: 10, speed: 12, gravity: -30, life: 1.2 });
        await stage.wait(0.6);
        await iris.walkTo(pres.x + 18, 158);
        iris.facing = -1;
        coffee = true;
        stage.emote(pres, '☕');
        pres.jump();
        await stage.say(iris, 'Sem açúcar, como sempre.');
      } else if (i === 1) {
        stage.emote(pres, '😰', 2.5);
        await stage.say(iris, 'Greve no porto de Santos, um deputado irritado e a imprensa na porta.');
      } else {
        stage.emote(iris, '😬');
        iris.jump();
        stage.camera.shake(2, 0.3);
        await stage.say(iris, 'Não fui eu! Juro! Deve ter sido o pessoal da Comunicação…', { tone: 'shout' });
      }
      met = true;
      await stage.say(iris, 'A imprensa está esperando no fim do corredor. Boa sorte.');
      updateHud();
    }

    async function drinkCoffee() {
      stage.particles.emit(360, 128, { colors: ['#f0ece0', '#d8d4ca'], count: 14, speed: 14, gravity: -40, life: 1.4 });
      await stage.wait(0.8);
      coffee = true;
      stage.emote(pres, '☕');
      pres.jump();
      await stage.say(pres, 'Agora sim. Pode vir, Brasil.');
      updateHud();
    }

    async function pressRoom() {
      sfx.ring();
      stage.flash('#fff', 1);
      reporters.forEach((a, i) => {
        a.visible = true;
        a.x = pres.x + 30 + i * 14;
        a.facing = -1;
      });
      await stage.tween(stage.camera, { zoom: 1.6 }, 0.6, ease.out);
      const flashes = setInterval(() => {
        const who = reporters[Math.floor(Math.random() * 3)];
        stage.particles.emit(who.x, who.y - 18, { colors: ['#ffffff', '#fffbe0'], count: 5, speed: 30, gravity: 0, life: 0.25, size: 3 });
        sfx.stamp();
      }, 450);
      reporters[0].jump();
      await stage.say(reporters[0], 'Presidente! Presidente! Uma palavrinha!', { tone: 'shout' });
      const i = await stage.choose(coffee ? 'Com o café no sangue, o senhor…' : 'Sem café, o senhor…', [
        { label: 'Sem comentários 🤐', hint: 'seguro, sem manchete' },
        { label: 'Sorri e acena 👋', hint: 'simpático' },
        { label: 'Discurso improvisado 📣', hint: coffee ? 'arriscado' : 'muito arriscado sem café' },
      ]);
      clearInterval(flashes);
      if (i === 0) {
        await stage.say(pres, 'Sem comentários.');
        stage.emote(reporters[1], '😒');
      } else if (i === 1) {
        pres.jump();
        stage.emote(pres, '😁');
        await stage.say(reporters[2], 'Ele acenou! Manchete: “Presidente de bom humor”.');
      } else if (coffee) {
        await stage.say(pres, 'O Brasil vai crescer como nunca! Anotem!', { tone: 'shout' });
        reporters.forEach((a) => a.jump());
        await stage.banner('DISCURSO VIRALIZA', '12 milhões de visualizações');
      } else {
        await stage.say(pres, 'O Brasil vai… é… crescer… onde eu estava?');
        stage.camera.shake(3, 0.4);
        stage.emote(pres, '😵');
        await stage.banner('GAFE DO DIA', 'Sem café, o presidente se perdeu no discurso');
      }
      await stage.tween(stage.camera, { zoom: 1 }, 0.6, ease.inOut);
      reporters.forEach((a) => (a.visible = false));
    }

    function updateHud() {
      hud.querySelector('.h-coffee')!.textContent = coffee ? 'tomou café' : 'sem café';
      hud.querySelector('.h-met')!.textContent = met ? 'Íris já falou' : 'Íris ainda não falou';
    }
  },
};

// ======================================================================
// 2. Chuva de ovos: ação com teclado ou dedo
// ======================================================================

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'ovo' | 'tomate' | 'flor';
  spin: number;
}

const eggs: Demo = {
  id: 'ovos',
  icon: '🥚',
  title: 'Chuva de ovos na Esplanada',
  kind: 'Ação · desviar',
  tests: ['Controle em tempo real (teclado e arrasto)', 'Projéteis com gravidade', 'Partículas de impacto', 'Esticar/amassar e flash de dano'],
  help: '← → ou A/D para desviar. No celular, arraste o dedo. Pegue as flores 🌸.',
  async run(stage, hud) {
    const L = lib();
    stage.background.push(...esplanada());
    const pres = stage.add(new Actor(sprite(L, 'presidente'), LW / 2, 164, 'Presidente'));
    pres.speed = 0;
    const crowd = Array.from({ length: 16 }, (_, i) => {
      const a = stage.add(new Actor(sprite(L, i % 3 ? 'manifestante' : 'manifestante2'), 10 + i * 20, 124 + (i % 2) * 4));
      a.facing = i < 8 ? 1 : -1;
      return a;
    });
    let approval = 50;
    let time = 30;
    let over = false;
    const shots: Projectile[] = [];
    let spawn = 0;
    let dragX: number | null = null;
    hud.innerHTML = `<div class="lab-meter"><span>APROVAÇÃO</span><i><b class="m-fill"></b></i><em class="m-val">50%</em></div><div class="lab-hud-line">⏱️ <b class="m-time">30</b>s</div>`;
    const render = () => {
      (hud.querySelector('.m-fill') as HTMLElement).style.width = `${approval}%`;
      hud.querySelector('.m-val')!.textContent = `${Math.round(approval)}%`;
      hud.querySelector('.m-time')!.textContent = String(Math.ceil(time));
    };
    stage.onPointer = (p) => (dragX = p.x);
    stage.onPointerMove = (p) => (dragX = p.x);

    stage.onUpdate = (dt) => {
      if (over) return;
      time -= dt;
      // movimento
      const left = stage.keys.has('arrowleft') || stage.keys.has('a');
      const right = stage.keys.has('arrowright') || stage.keys.has('d');
      let vx = (right ? 1 : 0) - (left ? 1 : 0);
      if (dragX !== null && !left && !right) vx = Math.abs(dragX - pres.x) < 3 ? 0 : Math.sign(dragX - pres.x);
      if (vx) pres.facing = vx > 0 ? 1 : -1;
      pres.x = Math.max(12, Math.min(LW - 12, pres.x + vx * 130 * dt));
      // lançamentos: a multidão mira onde o presidente está (com erro), cada vez mais rápido
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.28, 0.9 - (30 - time) * 0.022);
        const thrower = crowd[Math.floor(Math.random() * crowd.length)];
        thrower.jump();
        const kind = Math.random() < 0.14 ? 'flor' : Math.random() < 0.5 ? 'ovo' : 'tomate';
        const T = 1.05;
        const tx = pres.x + (Math.random() - 0.5) * 50;
        const g = 220;
        shots.push({ x: thrower.x, y: thrower.y - 20, vx: (tx - thrower.x) / T, vy: (150 - (thrower.y - 20)) / T - 0.5 * g * T, kind, spin: 0 });
      }
      for (const s of shots) {
        s.vy += 220 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.spin += dt * 10;
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        const hit = Math.abs(s.x - pres.x) < 7 && Math.abs(s.y - (pres.y - 12)) < 11;
        if (hit) {
          shots.splice(i, 1);
          if (s.kind === 'flor') {
            approval = Math.min(100, approval + 4);
            stage.particles.emit(s.x, s.y, { colors: ['#ff6fa8', '#fbe38a', '#4fc27f'], count: 14, speed: 50, gravity: 60 });
            stage.emote(pres, '😊', 0.8);
            sfx.up();
          } else {
            approval = Math.max(0, approval - 6);
            const colors = s.kind === 'ovo' ? ['#f4f1ea', '#f4c542', '#fbe38a'] : ['#e0574f', '#a82a2a', '#4fc27f'];
            stage.particles.emit(s.x, s.y, { colors, count: 22, speed: 80, gravity: 260 });
            pres.punch(-0.35);
            stage.camera.shake(3, 0.2);
            stage.flash(s.kind === 'ovo' ? '#fbe38a' : '#e0574f', 0.35);
            stage.emote(pres, s.kind === 'ovo' ? '🥚' : '🍅', 0.8);
            sfx.stamp();
          }
        } else if (s.y > 172) {
          shots.splice(i, 1);
          if (s.kind !== 'flor') stage.particles.emit(s.x, 170, { colors: s.kind === 'ovo' ? ['#f4f1ea', '#f4c542'] : ['#e0574f'], count: 6, speed: 30, gravity: 200 });
        }
      }
      render();
      if (time <= 0 || approval <= 0) {
        over = true;
        void finish();
      }
    };
    stage.foreground.push((ctx) => {
      for (const s of shots) {
        const x = Math.round(s.x);
        const y = Math.round(s.y);
        if (s.kind === 'ovo') {
          ctx.fillStyle = '#f4f1ea';
          ctx.fillRect(x - 2, y - 3, 4, 6);
          ctx.fillRect(x - 3, y - 1, 6, 3);
        } else if (s.kind === 'tomate') {
          ctx.fillStyle = '#e0574f';
          ctx.fillRect(x - 3, y - 2, 6, 5);
          ctx.fillStyle = '#4fc27f';
          ctx.fillRect(x - 1, y - 3, 2, 1);
        } else {
          ctx.fillStyle = '#4fc27f';
          ctx.fillRect(x, y, 1, 5);
          ctx.fillStyle = Math.sin(s.spin) > 0 ? '#ff6fa8' : '#fbe38a';
          ctx.fillRect(x - 2, y - 3, 5, 3);
        }
      }
    });
    async function finish() {
      const won = approval > 0;
      await stage.slowmo(0.3, 0.8);
      if (won) {
        pres.jump();
        stage.particles.emit(pres.x, pres.y - 30, { colors: ['#f4c542', '#4fc27f', '#6fb6ff', '#ff6fa8'], count: 40, speed: 90, gravity: 120 });
        await stage.banner('SOBREVIVEU AO COMÍCIO', `Terminou com ${Math.round(approval)}% de aprovação`, 3);
      } else {
        stage.emote(pres, '😵', 3);
        await stage.banner('BATEU EM RETIRADA', 'A segurança tirou o presidente do palanque', 3);
      }
    }
  },
};

// ======================================================================
// 3. Negociação com o Centrão: diálogo com medidor de humor e votação
// ======================================================================

const centrao: Demo = {
  id: 'centrao',
  icon: '🤝',
  title: 'Negociação com o Centrão',
  kind: 'Diálogo · negociação',
  tests: ['Árvore de diálogo com consequências', 'Medidor de humor que reage', 'Personagem que bate na mesa (tremor + mola)', 'Transição de cena e votação animada'],
  help: 'Escolha as falas (toque ou teclas 1-3). Você precisa de 257 votos.',
  async run(stage, hud) {
    const L = lib();
    stage.background.push(...officeRoom());
    stage.foreground.push((ctx) => meetingTable(ctx));
    stage.add(new Actor(sprite(L, 'presidente'), 96, 140, 'Presidente'));
    const dep = stage.add(new Actor(sprite(L, 'deputado'), 226, 140, 'Dep. Valdo Moura'));
    dep.facing = -1;
    let mood = -10;
    let votes = 190;
    hud.innerHTML = `<div class="lab-meter mood"><span>HUMOR DO CENTRÃO</span><i><b class="m-fill"></b></i><em class="m-val"></em></div><div class="lab-hud-line">🗳️ <b class="m-votes"></b> / 257 votos</div>`;
    const render = () => {
      const fill = hud.querySelector('.m-fill') as HTMLElement;
      fill.style.width = `${(mood + 100) / 2}%`;
      fill.style.background = mood >= 0 ? '#4fc27f' : '#e0574f';
      hud.querySelector('.m-val')!.textContent = mood >= 40 ? '🤑' : mood >= 0 ? '😏' : mood > -40 ? '😒' : '😠';
      hud.querySelector('.m-votes')!.textContent = String(votes);
    };
    render();
    const react = async (dMood: number, dVotes: number) => {
      mood = Math.max(-100, Math.min(100, mood + dMood));
      votes += dVotes;
      render();
      if (dMood > 0) {
        stage.emote(dep, dMood >= 20 ? '🤑' : '😏');
        dep.jump();
        sfx.up();
      } else {
        stage.emote(dep, '💢');
        dep.punch(-0.4);
        stage.camera.shake(4, 0.35);
        stage.particles.emit(dep.x - 14, 132, { colors: ['#9a6a3a', '#f0ece0'], count: 10, speed: 40, gravity: 200 });
        sfx.stamp();
      }
      await stage.wait(0.6);
    };

    await stage.banner('CÂMARA DOS DEPUTADOS', 'Sala da liderança do Centrão, 23h');
    await stage.say(dep, 'Presidente, o senhor sabe como funciona… a base tem fome.');
    let i = await stage.choose('Sua proposta:', [
      { label: 'Ofereço dois ministérios 💼', hint: 'fisiologismo clássico' },
      { label: 'O Brasil precisa. Não tenho nada a oferecer 🇧🇷' },
      { label: 'Posso liberar emendas no fim do ano 💰' },
    ], 'Presidente');
    await react([30, -25, 15][i], [60, 5, 35][i]);
    await stage.say(dep, ['Agora estamos conversando!', 'Com patriotismo não se paga campanha, Presidente.', 'Fim do ano é longe… mas serve.'][i]);

    await stage.say(dep, 'E tem a bancada evangélica. Eles querem a PEC do ensino religioso.');
    i = await stage.choose('Sobre a PEC:', [{ label: 'Apoio a PEC ✝️' }, { label: 'Estado laico, não dá ⚖️' }, { label: 'Vamos negociar uma versão facultativa 🤝' }], 'Presidente');
    await react([20, -20, 10][i], [45, -15, 25][i]);

    await stage.say(dep, 'Última coisinha… meu sobrinho precisa de um cargo nos Correios.');
    i = await stage.choose('Seu sobrinho?', [{ label: 'Nomeio amanhã 😏' }, { label: 'Isso é nepotismo ❌' }, { label: 'Vou pensar 🤔' }], 'Presidente');
    await react([20, -30, 5][i], [30, -20, 5][i]);
    await stage.say(dep, votes >= 257 ? 'Pode contar com a gente no plenário.' : 'Veremos no plenário, Presidente.');

    // votação no plenário
    stage.flash('#000', 1);
    await stage.wait(0.3);
    stage.actors = [];
    stage.background.length = 0;
    stage.foreground.length = 0;
    stage.background.push(...plenary());
    const seats: { x: number; y: number; yes: boolean; shown: number }[] = [];
    const total = 64;
    const yesSeats = Math.round((votes / 513) * total);
    for (let k = 0; k < total; k++) {
      const row = Math.floor(k / 16);
      seats.push({ x: 24 + (k % 16) * 17.5, y: 72 + row * 19, yes: k < yesSeats, shown: -1 });
    }
    seats.sort(() => Math.random() - 0.5);
    let shownYes = 0;
    let shownNo = 0;
    stage.foreground.push((ctx, t) => {
      for (const s of seats) {
        const up = s.shown >= 0 ? Math.min(1, (t - s.shown) * 6) : 0;
        ctx.fillStyle = s.shown >= 0 ? (s.yes ? '#4fc27f' : '#e0574f') : '#6a7a6a';
        ctx.fillRect(Math.round(s.x - 2), Math.round(s.y - 6 - up * 4), 5, 5);
        ctx.fillRect(Math.round(s.x - 3), Math.round(s.y - 1 - up * 4), 7, 6);
      }
    });
    hud.innerHTML = '<div class="lab-votes"><b class="v-yes">SIM 0</b><b class="v-no">NÃO 0</b></div>';
    for (let k = 0; k < seats.length; k++) {
      seats[k].shown = stage.t;
      if (seats[k].yes) shownYes++;
      else shownNo++;
      hud.querySelector('.v-yes')!.textContent = `SIM ${Math.round((shownYes / total) * 513)}`;
      hud.querySelector('.v-no')!.textContent = `NÃO ${Math.round((shownNo / total) * 513)}`;
      if (k % 4 === 0) sfx.tick();
      await stage.wait(0.045);
    }
    await stage.tween(stage.camera, { zoom: 1.15 }, 0.5, ease.back);
    if (votes >= 257) {
      stage.particles.emit(LW / 2, 60, { colors: ['#f4c542', '#4fc27f', '#6fb6ff', '#ff6fa8'], count: 60, speed: 120, gravity: 110 });
      sfx.fanfare();
      await stage.banner('APROVADO', `${votes} votos: a base segurou`, 3);
    } else {
      stage.camera.shake(4, 0.5);
      sfx.down();
      await stage.banner('DERROTA NO PLENÁRIO', `Só ${votes} votos: faltaram ${257 - votes}`, 3);
    }
  },
};

// ======================================================================
// 4. O martelo do Supremo: tempo certo (QTE)
// ======================================================================

const gavel: Demo = {
  id: 'martelo',
  icon: '🔨',
  title: 'O martelo do Supremo',
  kind: 'Reflexo · tempo certo',
  tests: ['Evento de tempo (QTE) com dificuldade crescente', 'Câmera lenta', 'Rotação de objeto com pivô', 'Poeira, tremor e letreiro de impacto'],
  help: 'Toque ou aperte ESPAÇO quando o cursor estiver na faixa verde. 3 liminares.',
  async run(stage, hud) {
    const L = lib();
    stage.background.push(...stfRoom());
    const judge = stage.add(new Actor(sprite(L, 'ministro_careca'), LW / 2, 128, 'Relator'));
    const others = [50, 86, 234, 270].map((x, i) => stage.add(new Actor(sprite(L, i % 2 ? 'ministra' : 'ministro'), x, 132)));
    stage.foreground.push((ctx) => stfBench(ctx));
    // martelo com pivô na mão do relator
    const hammer = { angle: -0.4 };
    stage.foreground.push((ctx) => {
      ctx.save();
      ctx.translate(Math.round(judge.x + 10), Math.round(judge.y - 12));
      ctx.rotate(hammer.angle);
      ctx.fillStyle = '#b8844a';
      ctx.fillRect(0, -1, 14, 2);
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(12, -5, 6, 10);
      ctx.fillStyle = '#9a6a3a';
      ctx.fillRect(13, -5, 4, 2);
      ctx.restore();
    });
    hud.innerHTML = `<div class="lab-qte"><i class="q-zone"></i><b class="q-cursor"></b></div><div class="lab-hud-line">⚖️ Liminares: <b class="q-count">0</b>/3</div>`;
    const zoneEl = hud.querySelector('.q-zone') as HTMLElement;
    const cursorEl = hud.querySelector('.q-cursor') as HTMLElement;
    let wins = 0;
    let round = 0;
    let armed = false;
    let pos = 0;
    let zone = { from: 0.4, to: 0.6 };
    const setZone = () => {
      const w = [0.22, 0.15, 0.09][round] ?? 0.08;
      const c = 0.2 + Math.random() * 0.6;
      zone = { from: c - w / 2, to: c + w / 2 };
      zoneEl.style.left = `${zone.from * 100}%`;
      zoneEl.style.width = `${w * 100}%`;
    };
    stage.onUpdate = (_dt, t) => {
      if (!armed) return;
      const speed = [1.6, 2.3, 3.1][round] ?? 3.5;
      pos = (Math.sin(t * speed * Math.PI) + 1) / 2;
      cursorEl.style.left = `${pos * 100}%`;
    };
    const press = () => {
      if (!armed) return;
      armed = false;
      void strike(pos >= zone.from && pos <= zone.to);
    };
    stage.onPointer = press;
    const onKey = (e: KeyboardEvent) => e.code === 'Space' && (e.preventDefault(), press());
    document.addEventListener('keydown', onKey);
    stage.own(() => document.removeEventListener('keydown', onKey));

    async function strike(hit: boolean) {
      await stage.tween(hammer, { angle: -1.6 }, 0.18, ease.out);
      if (hit) {
        void stage.slowmo(0.25, 0.7);
        await stage.tween(hammer, { angle: 0.5 }, 0.08, ease.linear);
        stage.camera.shake(6, 0.4);
        stage.flash('#fff', 0.7);
        stage.particles.emit(judge.x + 26, 124, { colors: ['#b8a888', '#8a7a5a', '#f0ece0'], count: 30, speed: 70, gravity: 150, up: 30 });
        sfx.gavel();
        wins++;
        hud.querySelector('.q-count')!.textContent = String(wins);
        others.forEach((o) => o.jump());
        await stage.banner(['SUSPENSO!', 'CASSADO!', 'INCONSTITUCIONAL!'][round] ?? 'SUSPENSO!', `Liminar ${wins} de 3`, 1.2);
        round++;
      } else {
        await stage.tween(hammer, { angle: 0.2 }, 0.12, ease.linear);
        judge.punch(-0.4);
        stage.emote(judge, '😵');
        stage.camera.shake(2, 0.2);
        sfx.down();
        await stage.say(judge, ['Ai! Meu dedo!', 'Errei o ritmo…', 'Ninguém viu isso.'][Math.floor(Math.random() * 3)], { hold: 1.2 });
      }
      await stage.tween(hammer, { angle: -0.4 }, 0.3, ease.back);
      if (round >= 3) {
        document.removeEventListener('keydown', onKey);
        judge.jump();
        await stage.banner('SESSÃO ENCERRADA', 'O Supremo falou três vezes', 3);
        return;
      }
      setZone();
      armed = true;
    }

    await stage.say(judge, 'Está aberta a sessão. Vamos às liminares.');
    setZone();
    armed = true;
  },
};

export const DEMOS: Demo[] = [planalto, eggs, centrao, gavel];

/** Anota no HUD uma dica curta. */
export function helpLine(text: string) {
  return el('div', 'lab-help', text);
}

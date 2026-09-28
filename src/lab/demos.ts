import { buildLibrary, npcPerson } from '../art/sprites';
import { sfx } from '../audio/sfx';
import { getCountry } from '../engine/data';
import type { Effects, GameState, PixelSprite } from '../engine/types';
import { el, esc } from '../ui/dom';
import { cabinetRoom, chamberFloor, desk, meetingTable, officeRoom, plenary, podium, splitCall, tvStudio } from './backdrops';
import { Actor, ease, LW, type Stage } from './engine';
import { labState, type CallScript, type DebateScript, type Kpis, type LabKind, type MeetingScript, type VoteScript } from './scripts';

export interface Demo {
  id: string;
  icon: string;
  title: string;
  kind: string;
  /** Tipo de roteiro que o Claude escreve para esta cena (sem ele, a cena é fixa). */
  script?: LabKind;
  /** O mecanismo político que a cena ensina. */
  teaches: string[];
  help: string;
  run: (stage: Stage, hud: HTMLElement, script: unknown, ctx: SceneContext) => Promise<SceneResult | void>;
}

/** O mandato em que a cena acontece (o real, no jogo; o de exemplo, no laboratório). */
export interface SceneContext {
  state: GameState;
}

/** O que a cena devolve para o jogo aplicar no mandato. */
export interface SceneResult {
  effects: Effects;
  /** Resumo de uma linha para o histórico (e para o Claude dar continuidade). */
  headline: string;
  choice: string;
  icon: string;
  loyalty?: Record<string, number>;
  resigned?: string[];
}

const lib = (st: GameState = labState()) => buildLibrary(st.player.avatar);
const sprite = (l: Map<string, PixelSprite>, id: string) => l.get(id)!;
const MINISTER_NPC: Record<string, string> = { fazenda: 'helena', justica: 'otavio', casacivil: 'rui', defesa: 'general', agricultura: 'tereza', comunicacao: 'caio' };

/** Soma efeitos nos indicadores e mostra o saldo no HUD. */
function effectLine(total: Kpis): string {
  const fmt = (k: keyof Kpis, label: string, pct = true) => {
    const v = total[k] ?? 0;
    if (!v) return '';
    const good = k === 'inflacao' || k === 'desemprego' ? v < 0 : v > 0;
    return `<span class="${good ? 'good' : 'bad'}">${label} ${v > 0 ? '+' : ''}${pct ? Math.round(v) : v.toFixed(1)}</span>`;
  };
  return [fmt('aprovacao', 'Aprovação'), fmt('coalizao', 'Coalizão'), fmt('inflacao', 'Inflação', false), fmt('desemprego', 'Desemprego', false)].filter(Boolean).join(' · ') || '<span>sem custo ainda</span>';
}
function addKpis(a: Kpis, b: Kpis): Kpis {
  const out: Kpis = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Kpis, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}

// ======================================================================
// Negociação com o Centrão (roteiro fixo, a primeira cena do laboratório): diálogo com medidor de humor e votação
// ======================================================================

const centrao: Demo = {
  id: 'centrao',
  icon: '🤝',
  title: 'Negociação com o Centrão',
  kind: 'Diálogo · negociação',
  teaches: ['Troca de apoio por cargos e emendas', 'Pautas de costumes como moeda', 'Fisiologismo e nepotismo'],
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
// Articulação da votação: circular pelo plenário gastando capital político
// ======================================================================

interface Bloc {
  data: VoteScript['groups'][number];
  x: number;
  yes: number;
  undecided: number;
  no: number;
  leader: Actor;
  done: boolean;
  flips: number[];
}

const votacao: Demo = {
  id: 'votacao',
  icon: '🗳️',
  title: 'Articulação da votação',
  kind: 'Estratégia · contar votos',
  script: 'votacao',
  teaches: ['Presidencialismo de coalizão: votos têm preço', 'Maioria simples (257) × PEC (308)', 'Cada concessão tem custo em outra frente'],
  help: 'Toque num grupo para ir negociar com o líder. Gaste o capital político e abra a votação quando achar que tem os votos.',
  async run(stage, hud, raw, ctx) {
    const sc = raw as VoteScript;
    const L = lib(ctx.state);
    const WORLD = 560;
    const factionMood: Record<string, number> = {};
    let talked = 0;
    stage.background.push(...chamberFloor(WORLD));
    stage.camera.bounds = { minX: 0, maxX: WORLD - LW };
    const pres = stage.add(new Actor(sprite(L, 'presidente'), WORLD / 2, 168, 'Presidente'));
    stage.camera.follow = pres;
    stage.camera.x = WORLD / 2 - LW / 2;
    const people = ['deputado', 'deputada', 'empresario', 'pastor', 'agricultor', 'assessor'];
    const blocs: Bloc[] = sc.groups.map((g, i) => {
      const x = 46 + i * ((WORLD - 92) / (sc.groups.length - 1));
      const base = g.stance === 'a_favor' ? [0.8, 0.2, 0] : g.stance === 'contra' ? [0, 0.2, 0.8] : [0.1, 0.8, 0.1];
      const yes = Math.round(g.seats * base[0]);
      const no = Math.round(g.seats * base[2]);
      const leader = stage.add(new Actor(sprite(L, people[i % people.length]), x, 150, g.leader));
      leader.facing = x < WORLD / 2 ? 1 : -1;
      return { data: g, x, yes, no, undecided: g.seats - yes - no, leader, done: false, flips: [] };
    });
    let capital = sc.capital;
    let costs: Kpis = {};
    let busy = false;
    let voting = false;

    // bancadas: cada ponto é ~5 deputados; cor pela posição atual
    stage.foreground.push((ctx, t) => {
      for (const b of blocs) {
        const dots = Math.max(4, Math.round(b.data.seats / 5));
        const yesDots = Math.round((b.yes / b.data.seats) * dots);
        const noDots = Math.round((b.no / b.data.seats) * dots);
        for (let k = 0; k < dots; k++) {
          const col = k % 8;
          const row = Math.floor(k / 8);
          const x = b.x - 18 + col * 5;
          const y = 138 - row * 7;
          const flip = b.flips[k] ? Math.max(0, 1 - (t - b.flips[k]) * 3) : 0;
          ctx.fillStyle = k < yesDots ? '#4fc27f' : k >= dots - noDots ? '#e0574f' : '#9aa0b4';
          ctx.fillRect(Math.round(x), Math.round(y - flip * 4), 3, 5);
        }
        if (!b.done && !busy && !voting) {
          const y = 104 - Math.floor(b.data.seats / 40) * 7 + Math.sin(t * 5 + b.x) * 2;
          ctx.fillStyle = '#f4c542';
          ctx.fillRect(b.x - 3, y, 7, 2);
          ctx.fillRect(b.x - 2, y + 2, 5, 2);
          ctx.fillRect(b.x - 1, y + 4, 3, 2);
        }
      }
    });

    const certain = () => blocs.reduce((n, b) => n + b.yes, 0);
    const renderHud = () => {
      hud.innerHTML = `
        <div class="lab-hud-line"><b>${esc(sc.bill.title)}</b></div>
        <div class="lab-hud-line">💼 Capital: <b>${'●'.repeat(capital)}${'○'.repeat(Math.max(0, sc.capital - capital))}</b> · 🗳️ Garantidos: <b class="${certain() >= sc.bill.needed ? 'good' : ''}">${certain()}</b> / ${sc.bill.needed}</div>
        <div class="lab-hud-line lab-costs">${effectLine(costs)}</div>
        <button class="lab-hud-btn lab-vote">🗳️ ABRIR VOTAÇÃO</button>`;
      hud.querySelector('.lab-vote')!.addEventListener('click', () => void vote());
    };
    renderHud();
    await stage.banner(sc.bill.needed >= 308 ? 'PEC NO PLENÁRIO' : 'PROJETO NO PLENÁRIO', `Precisa de ${sc.bill.needed} votos`, 2);
    await stage.say(pres, sc.bill.description.slice(0, 110));

    stage.onPointer = async (p) => {
      if (busy || voting) return;
      const b = blocs.find((x) => Math.abs(p.x - x.x) < 26);
      if (!b) {
        if (p.y > 140) void pres.walkTo(Math.max(12, Math.min(WORLD - 12, p.x)), 168);
        return;
      }
      if (b.done) {
        stage.emote(b.leader, '🙅');
        return;
      }
      busy = true;
      sfx.click();
      await pres.walkTo(b.x + (pres.x < b.x ? -16 : 16), 168);
      pres.facing = b.x > pres.x ? 1 : -1;
      b.leader.facing = pres.x < b.x ? -1 : 1;
      b.leader.jump();
      await stage.say(b.leader, b.data.demand);
      const options = [...b.data.offers.map((o) => ({ label: o.label, hint: `${'●'.repeat(o.cost)}${o.cost > capital ? ' · sem capital' : ''}` })), { label: 'Sair sem negociar', hint: 'grátis' }];
      let i = await stage.choose(`${b.data.name} · ${b.yes} a favor, ${b.undecided} indecisos, ${b.no} contra`, options, b.data.leader);
      while (i < b.data.offers.length && b.data.offers[i].cost > capital) {
        sfx.down();
        i = await stage.choose('Capital político insuficiente para essa oferta.', options, b.data.leader);
      }
      if (i < b.data.offers.length) {
        const o = b.data.offers[i];
        capital -= o.cost;
        costs = addKpis(costs, o.effects);
        talked++;
        if (b.data.faction) factionMood[b.data.faction] = (factionMood[b.data.faction] ?? 0) + 8;
        const moving = Math.round((b.undecided + b.no) * o.swing);
        const fromUndecided = Math.min(b.undecided, moving);
        b.undecided -= fromUndecided;
        b.no -= moving - fromUndecided;
        b.yes += moving;
        const dots = Math.max(4, Math.round(b.data.seats / 5));
        for (let k = 0; k < dots; k++) b.flips[k] = stage.t + k * 0.03;
        b.done = true;
        stage.emote(b.leader, o.swing >= 0.6 ? '🤝' : '😏');
        sfx.up();
        await stage.say(b.leader, o.reaction);
      } else {
        stage.emote(b.leader, '😒');
        b.done = true;
        if (b.data.faction && b.data.stance !== 'a_favor') factionMood[b.data.faction] = (factionMood[b.data.faction] ?? 0) - 4;
      }
      renderHud();
      busy = false;
    };

    let finished: (r: SceneResult) => void = () => {};
    const done = new Promise<SceneResult>((r) => (finished = r));

    async function vote() {
      if (voting || busy) return;
      voting = true;
      sfx.ring();
      await pres.walkTo(WORLD / 2, 168);
      await stage.tween(stage.camera, { zoom: 1.1 }, 0.6);
      // indecisos se dividem no painel
      let yes = 0;
      let no = 0;
      for (const b of blocs) {
        const undecidedYes = Math.round(b.undecided * 0.4);
        b.yes += undecidedYes;
        b.no += b.undecided - undecidedYes;
        b.undecided = 0;
        const dots = Math.max(4, Math.round(b.data.seats / 5));
        for (let k = 0; k < dots; k++) b.flips[k] = stage.t + k * 0.02;
        yes += b.yes;
        no += b.no;
        hud.innerHTML = `<div class="lab-votes"><b class="v-yes">SIM ${yes}</b><b class="v-no">NÃO ${no}</b></div>`;
        sfx.tick();
        await stage.wait(0.5);
      }
      const passed = yes >= sc.bill.needed;
      if (passed) {
        stage.particles.emit(pres.x, 90, { colors: ['#f4c542', '#4fc27f', '#6fb6ff', '#ff6fa8'], count: 60, speed: 120, gravity: 110 });
        pres.jump();
        sfx.fanfare();
      } else {
        stage.camera.shake(4, 0.5);
        sfx.down();
      }
      hud.insertAdjacentHTML('beforeend', `<div class="lab-hud-line lab-costs">Conta política: ${effectLine(costs)}</div>`);
      await stage.banner(passed ? 'APROVADO' : 'REJEITADO', `${yes} a ${no} · eram necessários ${sc.bill.needed}`, 4);
      const outcome: Kpis = passed ? { aprovacao: 3, coalizao: 3 } : { aprovacao: -3, coalizao: -6 };
      finished({
        effects: { kpis: addKpis(costs, outcome), factions: factionMood },
        headline: `${sc.bill.title}: ${passed ? 'aprovado' : 'rejeitado'} por ${yes} a ${no}`,
        choice: `Articulou ${talked} bancada(s) e ${passed ? 'venceu' : 'perdeu'} no plenário`,
        icon: passed ? '✅' : '❌',
      });
    }
    return done;
  },
};

// ======================================================================
// Debate na TV: ataques com o histórico real e plateia por segmento
// ======================================================================

const debate: Demo = {
  id: 'debate',
  icon: '📺',
  title: 'Debate na TV',
  kind: 'Retórica · plateia e checagem',
  script: 'debate',
  teaches: ['O eleitorado não é um bloco só', 'Checagem de fatos: estilo × verdade', 'O seu histórico vira munição do adversário'],
  help: 'O adversário ataca com as suas decisões. Escolha a réplica: cada setor da plateia reage de um jeito, e a checagem aparece na hora.',
  async run(stage, hud, raw, ctx) {
    const sc = raw as DebateScript;
    const L = lib(ctx.state);
    stage.background.push(...tvStudio());
    const opp = stage.add(new Actor(sprite(L, 'empresario'), 70, 108, sc.opponent.name));
    const pres = stage.add(new Actor(sprite(L, 'presidente'), 250, 108, 'Presidente'));
    pres.facing = -1;
    const mod = stage.add(new Actor(sprite(L, 'jornalista'), 160, 108, sc.moderator));
    stage.foreground.push((ctx) => {
      podium(ctx, 70, '#8a2a2a');
      podium(ctx, 250, '#1f4fa0');
    });
    // plateia em três setores
    const segs = [
      { key: 'progressistas' as const, label: 'Progressistas', color: '#6fa8ff', x: 10 },
      { key: 'indecisos' as const, label: 'Indecisos', color: '#9aa0b4', x: 115 },
      { key: 'conservadores' as const, label: 'Conservadores', color: '#ff9f5a', x: 220 },
    ];
    const start = Math.round(ctx.state.kpis.aprovacao);
    const score: Record<string, number> = { progressistas: start, indecisos: start, conservadores: start };
    const cheer: Record<string, number> = {};
    stage.foreground.push((ctx, t) => {
      for (const s of segs) {
        for (let i = 0; i < 18; i++) {
          const x = s.x + (i % 9) * 10 + 4;
          const y = 160 + Math.floor(i / 9) * 9;
          const c = cheer[s.key] ?? 0;
          const hop = c > 0 && Math.sin(t * 18 + i) > 0 ? -2 : 0;
          ctx.fillStyle = s.color;
          ctx.fillRect(x, y + 3 + hop, 6, 6);
          ctx.fillStyle = '#e8c09a';
          ctx.fillRect(x + 1, y + hop, 4, 3);
          if (c < 0 && i % 4 === 0) {
            ctx.fillStyle = '#e0574f';
            ctx.fillRect(x + 1, y - 5, 4, 3);
          }
        }
      }
    });
    const renderHud = () => {
      hud.innerHTML = segs
        .map((s) => `<div class="lab-meter seg"><span style="color:${s.color}">${s.label}</span><i><b style="width:${score[s.key]}%;background:${s.color}"></b></i><em>${Math.round(score[s.key])}%</em></div>`)
        .join('');
    };
    renderHud();
    await stage.banner('DEBATE PRESIDENCIAL', `${sc.opponent.name} · ${sc.opponent.style}`, 2);
    for (const [ri, round] of sc.rounds.entries()) {
      mod.jump();
      await stage.say(mod, `Bloco ${ri + 1}: ${round.topic}. Candidato ${sc.opponent.name.split(' ')[0]}, sua pergunta.`);
      opp.jump();
      stage.camera.shake(1, 0.2);
      await stage.say(opp, round.attack, { tone: 'shout' });
      const i = await stage.choose('Sua réplica:', round.options.map((o) => ({ label: o.label, hint: o.style })), 'Presidente');
      const o = round.options[i];
      await stage.say(pres, o.reply);
      for (const s of segs) {
        const d = o.audience[s.key];
        score[s.key] = Math.max(0, Math.min(100, score[s.key] + d));
        cheer[s.key] = d;
        if (d >= 4) stage.particles.emit(s.x + 45, 158, { colors: [s.color, '#f4c542'], count: 10, speed: 40, gravity: 60 });
      }
      renderHud();
      sfx[o.audience.indecisos >= 0 ? 'up' : 'down']();
      const stampClass = o.factcheck.verdict === 'verdadeiro' ? 'ok' : o.factcheck.verdict === 'falso' ? 'bad' : 'warn';
      const stamp = el('div', `lab-factcheck ${stampClass}`, `<b>${o.factcheck.verdict === 'verdadeiro' ? '✔ VERDADEIRO' : o.factcheck.verdict === 'falso' ? '✖ FALSO' : '⚠ EXAGERADO'}</b><small>${esc(o.factcheck.note)}</small>`);
      stage.ui.append(stamp);
      sfx.stamp();
      await stage.wait(3.2);
      stamp.remove();
      for (const s of segs) cheer[s.key] = 0;
    }
    await stage.say(opp, sc.closing, { tone: 'shout' });
    const poll = Math.round(score.progressistas * 0.3 + score.indecisos * 0.4 + score.conservadores * 0.3);
    await stage.tween(stage.camera, { zoom: 1.2 }, 0.5, ease.back);
    if (poll >= 50) {
      pres.jump();
      stage.particles.emit(250, 80, { colors: ['#f4c542', '#4fc27f', '#6fb6ff'], count: 40, speed: 90, gravity: 110 });
    } else opp.jump();
    await stage.banner(poll >= 50 ? 'VENCEU O DEBATE' : 'PERDEU O DEBATE', `Pesquisa pós-debate: ${poll}% × ${100 - poll}%`, 4);
    const moved = score.progressistas * 0.3 + score.indecisos * 0.4 + score.conservadores * 0.3 - start;
    return {
      effects: { kpis: { aprovacao: Math.round(moved * 0.6) } },
      headline: `Debate contra ${sc.opponent.name}: pesquisa pós-debate ${poll}% × ${100 - poll}%`,
      choice: poll >= 50 ? 'Venceu o debate na TV' : 'Perdeu o debate na TV',
      icon: '📺',
    };
  },
};

// ======================================================================
// Telefonema com chefe de Estado: concessões dos dois lados
// ======================================================================

const telefonema: Demo = {
  id: 'telefonema',
  icon: '☎️',
  title: 'Telefonema com chefe de Estado',
  kind: 'Diplomacia · concessões',
  script: 'telefonema',
  teaches: ['Diplomacia é troca: nada sai de graça', 'Relações externas mexem na economia', 'Pragmatismo × alinhamento'],
  help: 'Negocie ao telefone. Cada resposta muda a relação com o país e soma pontos de acordo: 5 pontos fecham o acordo.',
  async run(stage, hud, raw, ctx) {
    const sc = raw as CallScript;
    const L = lib(ctx.state);
    const partner = getCountry('BR').partners.find((p) => p.id === sc.partner)!;
    stage.background.push(...splitCall(sc.partner));
    const pres = stage.add(new Actor(sprite(L, 'presidente'), 95, 128, 'Presidente'));
    const leader = stage.add(new Actor(sprite(L, sc.partner === 'china' || sc.partner === 'russia' ? 'empresario' : 'deputado'), 235, 128, sc.leader.name));
    leader.facing = -1;
    stage.foreground.push((ctx) => {
      desk(ctx, 50, 90);
      desk(ctx, 190, 90, '#3a2a2a');
      ctx.fillStyle = '#c63d3d';
      ctx.fillRect(Math.round(pres.x + 5), Math.round(pres.y - 17), 3, 5);
      ctx.fillRect(Math.round(leader.x - 8), Math.round(leader.y - 17), 3, 5);
    });
    const startRelation = Math.round(ctx.state.relations?.[sc.partner] ?? 0);
    let relation = startRelation;
    let points = 0;
    let costs: Kpis = {};
    const renderHud = () => {
      hud.innerHTML = `
        <div class="lab-meter"><span>${partner.flag} ${esc(partner.short)}</span><i><b style="width:${(relation + 100) / 2}%;background:${relation >= 0 ? '#4fc27f' : '#e0574f'}"></b></i><em>${relation > 0 ? '+' : ''}${relation}</em></div>
        <div class="lab-hud-line">🤝 Acordo: <b>${'■'.repeat(Math.min(points, 5))}${'□'.repeat(Math.max(0, 5 - points))}</b></div>
        <div class="lab-hud-line lab-costs">${effectLine(costs)}</div>`;
    };
    renderHud();
    for (let k = 0; k < 3; k++) {
      sfx.ring();
      stage.camera.shake(1, 0.2);
      await stage.wait(0.5);
    }
    await stage.banner(`${partner.flag} LINHA DIRETA`, `${sc.leader.title} ${sc.leader.name}`, 1.8);
    await stage.say(pres, 'Alô? Aqui é do Planalto.');
    await stage.say(leader, sc.context);
    await stage.say(leader, `O que queremos: ${sc.theirAsk}`);
    await stage.say(pres, `E nós precisamos de: ${sc.ourAsk}`);
    for (const round of sc.rounds) {
      await stage.say(leader, round.line);
      const i = await stage.choose('Sua resposta:', round.options.map((o) => ({ label: o.label, hint: `${o.relation > 0 ? '+' : ''}${o.relation} relação · ${'■'.repeat(o.points) || 'sem avanço'}` })), 'Presidente');
      const o = round.options[i];
      relation = Math.max(-100, Math.min(100, relation + o.relation));
      points += o.points;
      costs = addKpis(costs, o.effects);
      renderHud();
      stage.emote(leader, o.relation >= 8 ? '😊' : o.relation <= -8 ? '😠' : '🤔');
      if (o.relation <= -8) leader.punch(-0.3);
      else if (o.relation >= 8) leader.jump();
      await stage.say(leader, o.reaction);
    }
    const deal = points >= 5;
    if (deal) {
      stage.particles.emit(LW / 2, 60, { colors: ['#f4c542', '#4fc27f', '#6fb6ff'], count: 50, speed: 90, gravity: 110 });
      sfx.fanfare();
    } else sfx.down();
    await stage.banner(deal ? 'ACORDO FECHADO' : 'SEM ACORDO', `Relação com ${partner.name}: ${relation > 0 ? '+' : ''}${relation}`, 4);
    return {
      effects: { kpis: addKpis(costs, deal ? { desemprego: -0.2 } : {}), relations: { [sc.partner]: relation - startRelation + (deal ? 10 : 0) } },
      headline: `Telefonema com ${sc.leader.title} ${sc.leader.name}: ${deal ? 'acordo fechado' : 'sem acordo'}`,
      choice: deal ? `Fechou acordo com ${partner.name}` : `Negociou com ${partner.name}, sem acordo`,
      icon: deal ? '🤝' : '☎️',
    };
  },
};

// ======================================================================
// Reunião ministerial: briga na mesa, lealdade e demissão em cena
// ======================================================================

const reuniao: Demo = {
  id: 'reuniao',
  icon: '👔',
  title: 'Reunião ministerial',
  kind: 'Gestão · lealdade do ministério',
  script: 'reuniao',
  teaches: ['Ministros têm agendas próprias', 'Arbitrar conflitos custa lealdade', 'Governo dividido vira manchete'],
  help: 'Dois ministros brigam na sua frente. Decida quem apoiar: a lealdade de cada um muda e, se cair demais, ele pede demissão.',
  async run(stage, hud, raw, ctx) {
    const sc = raw as MeetingScript;
    const country = getCountry('BR');
    const L = lib(ctx.state);
    stage.background.push(...cabinetRoom());
    const pres = stage.add(new Actor(sprite(L, 'presidente'), 30, 150, 'Presidente'));
    const seats = [80, 120, 160, 200, 240, 272];
    const mins = country.ministers.map((m, i) => {
      const a = stage.add(new Actor(npcPerson(MINISTER_NPC[m.id] ?? 'rui'), seats[i], 128, m.name));
      a.facing = -1;
      return { id: m.id, m, a, loyalty: ctx.state.ministerLoyalty?.[m.id] ?? 30, gone: false };
    });
    stage.foreground.push((ctx) => {
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(60, 132, 230, 10);
      ctx.fillStyle = '#8a5a32';
      ctx.fillRect(60, 130, 230, 3);
    });
    const find = (id: string) => mins.find((x) => x.id === id) ?? mins.find((x) => x.m.role.toLowerCase().includes(id.toLowerCase())) ?? mins[2];
    let costs: Kpis = {};
    const renderHud = () => {
      hud.innerHTML = `<div class="lab-loyalty">${mins
        .map((x) => `<div class="${x.gone ? 'gone' : ''} ${x.id === sc.clash.a || x.id === sc.clash.b ? 'clash' : ''}"><span>${esc(x.m.role)}</span><i><b style="width:${Math.max(0, (x.loyalty + 100) / 2)}%;background:${x.loyalty >= 0 ? '#4fc27f' : '#e0574f'}"></b></i></div>`)
        .join('')}</div><div class="lab-hud-line lab-costs">${effectLine(costs)}</div>`;
    };
    renderHud();
    await stage.banner('REUNIÃO MINISTERIAL', sc.agenda, 2.2);
    const a = find(sc.clash.a);
    const b = find(sc.clash.b);
    await stage.say(a.a, sc.clash.aWants);
    b.a.jump();
    await stage.say(b.a, sc.clash.bWants, { tone: 'shout' });
    for (const round of sc.rounds) {
      const speaker = find(round.speaker);
      if (speaker.gone) continue;
      await stage.say(speaker.a, round.line);
      if (round.interrupt) {
        const who = find(round.interrupt.speaker);
        if (!who.gone) {
          who.a.jump();
          stage.camera.shake(3, 0.3);
          stage.particles.emit(who.a.x, 130, { colors: ['#9a6a3a', '#f0ece0'], count: 8, speed: 30, gravity: 200 });
          await stage.say(who.a, round.interrupt.line, { tone: 'shout' });
        }
      }
      const i = await stage.choose('O senhor decide:', round.options.map((o) => ({ label: o.label })), 'Presidente');
      const o = round.options[i];
      costs = addKpis(costs, o.effects);
      for (const [id, d] of Object.entries(o.loyalty)) {
        const x = find(id);
        if (x.gone) continue;
        x.loyalty = Math.max(-100, Math.min(100, x.loyalty + d));
        stage.emote(x.a, d > 0 ? '💚' : '💢');
        if (d < 0) x.a.punch(-0.3);
      }
      renderHud();
      await stage.say(speaker.a, o.reaction);
      for (const x of mins) {
        if (x.gone || x.loyalty > -20) continue;
        x.gone = true;
        stage.emote(x.a, '🚪', 3);
        await stage.say(x.a, sc.resignation[x.id] ?? 'Presidente, com todo o respeito: eu saio.', { tone: 'shout' });
        await x.a.walkTo(300, 140);
        stage.camera.shake(5, 0.4);
        sfx.stamp();
        x.a.visible = false;
        renderHud();
        await stage.banner('PEDIU DEMISSÃO', `${x.m.name} deixa o ${x.m.role}`, 2);
      }
    }
    const lost = mins.filter((x) => x.gone);
    pres.jump();
    await stage.banner(lost.length ? 'GOVERNO RACHADO' : 'MINISTÉRIO UNIDO', lost.length ? `${lost.length} ministro(s) saíram batendo a porta` : 'Ninguém saiu, mas nem todo mundo saiu feliz', 4);
    const exits: Kpis = { coalizao: -3 * lost.length, aprovacao: -2 * lost.length };
    return {
      effects: { kpis: addKpis(costs, exits) },
      headline: lost.length ? `Reunião ministerial termina com demissão: ${lost.map((x) => x.m.name).join(', ')}` : `Reunião ministerial sobre ${sc.agenda.slice(0, 60)}`,
      choice: lost.length ? `Perdeu ${lost.map((x) => x.m.role).join(', ')}` : 'Segurou o ministério unido',
      icon: '👔',
      // quem sai é substituído por um nome novo, que começa neutro
      loyalty: Object.fromEntries(mins.map((x) => [x.id, x.gone ? 20 : x.loyalty])),
      resigned: lost.map((x) => x.id),
    };
  },
};

export const DEMOS: Demo[] = [votacao, debate, telefonema, reuniao, centrao];

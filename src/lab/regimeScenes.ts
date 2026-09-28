import { buildLibrary, npcPerson } from '../art/sprites';
import { sfx } from '../audio/sfx';
import { getRegime, regimeOf, RUPTURE_ACTORS, ruptureSetup, ruptureSupport, type RuptureSetup } from '../engine/regime';
import type { GameState, PixelSprite } from '../engine/types';
import { esc } from '../ui/dom';
import { addKpis, effectLine, type Demo, type SceneResult } from './demos';
import { Actor, ease, LW } from './engine';
import { councilRoom, councilTable, nightDesk, nightPalace } from './regimeRooms';
import type { CouncilScript, Kpis, RuptureScript } from './scripts';

/*
 * Cenas dos regimes: a noite em que o governante tenta mudar o regime e o conselho que o sustenta
 * depois que ele mudou. Falas e ofertas vêm do Claude; posições iniciais e pesos vêm do estado.
 */

const lib = (st: GameState) => buildLibrary(st.player.avatar);
const spriteOf = (l: Map<string, PixelSprite>, id: string) => l.get(id) ?? npcPerson(id);

// ======================================================================
// A noite da ruptura: seis horas até o amanhecer para virar os atores que decidem um golpe
// ======================================================================

export type RuptureRun = RuptureScript & { setup?: RuptureSetup };

export const ruptura: Demo = {
  id: 'ruptura',
  icon: '🌒',
  title: 'A noite da ruptura',
  kind: 'Estratégia · golpe ou revolução',
  script: 'ruptura',
  teaches: ['Golpes dependem de quem aceita obedecer', 'Instituições fortes resistem', 'Recuar também tem preço'],
  help: 'Você tem até o amanhecer. Toque num ator para chamá-lo; cada conversa gasta horas. Anuncie ao amanhecer, ou recue.',
  titleFor: () => 'A noite da ruptura',
  skip: () => ({ effects: { axes: { poder: -6 } }, headline: 'Presidente manda os conspiradores embora e desiste da ruptura', choice: 'Desistiu da ruptura antes de começar', icon: '🚪' }),
  async run(stage, hud, raw, ctx) {
    const sc = raw as RuptureRun;
    const setup = sc.setup ?? ruptureSetup(ctx.state, 'militar');
    const target = getRegime(setup.target);
    const L = lib(ctx.state);
    const TOTAL = 6;
    let hours = TOTAL;
    let costs: Kpis = {};
    let busy = false;
    let over = false;
    const people = setup.actors.map((a) => ({ ...a, start: a.stance, text: sc.actors.find((x) => x.id === a.id), visited: false }));
    const stanceOf = (id: string) => people.find((p) => p.id === id)?.stance ?? 0;
    const tanks = () => (setup.mode === 'golpe' ? Math.max(0, Math.round(stanceOf('generais') / 12)) : Math.max(0, Math.round(stanceOf('generais') / 25)));
    const crowd = () => Math.max(0, Math.round((Math.max(stanceOf('rua'), 0) + Math.max(stanceOf('movimentos'), 0) + Math.max(stanceOf('clero'), 0)) / 5));

    stage.background.push(...nightPalace(() => TOTAL - hours, tanks, crowd));
    stage.foreground.push((c) => nightDesk(c));
    const pres = stage.add(new Actor(spriteOf(L, 'presidente'), 104, 152, 'Presidente'));
    pres.facing = 1;
    // o painel dos atores fica à direita, para a janela (tanques e multidão) ficar à vista
    hud.classList.add('rupture-hud');
    stage.own(() => hud.classList.remove('rupture-hud'));

    const support = () => ruptureSupport(people);
    const renderHud = () => {
      const sup = support();
      if (over) {
        // amanheceu: só o placar, para o letreiro ficar livre
        hud.innerHTML = `<div class="lab-hud-line">🌅 Apoio ao amanhecer: <b class="${sup >= setup.threshold ? 'good' : 'bad'}">${sup > 0 ? '+' : ''}${sup}</b> / precisava ${setup.threshold > 0 ? '+' : ''}${setup.threshold}</div>`;
        return;
      }
      hud.innerHTML = `
        <div class="lab-hud-line">🌒 <b>${esc(sc.codename)}</b> · ${setup.mode === 'golpe' ? 'golpe' : 'revolução'} → ${target.icon} ${esc(target.name)}</div>
        <div class="lab-hud-line">🕐 Noite: <b>${'●'.repeat(hours)}${'○'.repeat(TOTAL - hours)}</b> · Apoio: <b class="${sup >= setup.threshold ? 'good' : 'bad'}">${sup > 0 ? '+' : ''}${sup}</b> / precisa ${setup.threshold > 0 ? '+' : ''}${setup.threshold}</div>
        <div class="rupture-actors">${people
          .map(
            (p) => `<button class="rupture-actor ${p.visited ? 'done' : ''}" data-id="${p.id}" ${p.visited || over ? 'disabled' : ''}>
              <span>${RUPTURE_ACTORS[p.id].icon}</span><em>${esc(p.text?.title || RUPTURE_ACTORS[p.id].label)}<small>peso ${Math.round(p.weight * 100)}%</small></em>
              <i><b style="width:${(p.stance + 100) / 2}%;background:${p.stance >= 0 ? '#4fc27f' : '#e0574f'}"></b></i><strong>${p.stance > 0 ? '+' : ''}${p.stance}</strong></button>`,
          )
          .join('')}</div>
        <div class="lab-hud-line lab-costs">${effectLine(costs)}</div>
        <div class="rupture-actions"><button class="lab-hud-btn rupture-dawn">🌅 ANUNCIAR AO AMANHECER</button><button class="lab-hud-btn rupture-retreat">↩ RECUAR</button></div>`;
      hud.querySelectorAll<HTMLButtonElement>('.rupture-actor').forEach((b) => b.addEventListener('click', () => void call(b.dataset.id!)));
      hud.querySelector('.rupture-dawn')!.addEventListener('click', () => void dawn());
      hud.querySelector('.rupture-retreat')!.addEventListener('click', () => void retreat());
    };

    let finish: (r: SceneResult) => void = () => {};
    const done = new Promise<SceneResult>((r) => (finish = r));

    const call = async (id: string) => {
      const p = people.find((x) => x.id === id);
      if (!p || busy || over || p.visited || hours <= 0) return;
      busy = true;
      sfx.ring();
      const who = stage.add(new Actor(spriteOf(L, RUPTURE_ACTORS[p.id].sprite), 340, 150, p.text?.name || RUPTURE_ACTORS[p.id].label));
      await who.walkTo(222, 150);
      who.facing = -1;
      pres.facing = 1;
      await stage.say(who, p.text?.opening || '…');
      const offers = p.text?.offers ?? [];
      const options = [...offers.map((o) => ({ label: o.label, hint: `${o.hours}h${o.hours > hours ? ' · não dá tempo' : ''}` })), { label: 'Encerrar a conversa', hint: 'sem custo' }];
      let i = await stage.choose(`${p.text?.title || RUPTURE_ACTORS[p.id].label} · posição ${p.stance > 0 ? '+' : ''}${p.stance}`, options, p.text?.name);
      while (i < offers.length && offers[i].hours > hours) {
        sfx.down();
        i = await stage.choose('Não há mais tempo nesta noite para isso.', options, p.text?.name);
      }
      if (i < offers.length) {
        const o = offers[i];
        hours -= o.hours;
        p.stance = Math.max(-100, Math.min(100, p.stance + o.swing));
        costs = addKpis(costs, o.effects);
        stage.emote(who, o.swing >= 15 ? '🤝' : o.swing > 0 ? '🤔' : '😠');
        if (o.swing < 0) {
          who.punch(-0.3);
          stage.camera.shake(3, 0.3);
          sfx.stamp();
        } else sfx.up();
        await stage.say(who, o.reaction);
      }
      p.visited = true;
      // sai de cena sem segurar a noite: o próximo já pode ser chamado
      void who.walkTo(340, 150).then(() => (stage.actors = stage.actors.filter((a) => a !== who)));
      busy = false;
      renderHud();
      if (hours <= 0) void dawn();
    };

    const dawn = async () => {
      if (busy || over) return;
      over = true;
      hours = 0;
      renderHud();
      const sup = support();
      const ok = sup >= setup.threshold;
      await stage.tween(stage.camera, { zoom: 1.12 }, 0.8, ease.inOut);
      if (ok) {
        stage.flash('#fff3c0', 0.8);
        stage.particles.emit(LW / 2, 60, { colors: [target.accent, '#f4c542', '#f4f1ea'], count: 70, speed: 110, gravity: 100 });
        pres.jump();
        sfx.fanfare();
        await stage.banner(`${target.icon} ${target.name.toUpperCase()}`, sc.dawn_success || 'O novo regime amanhece no poder', 4);
      } else {
        stage.camera.shake(6, 0.8);
        sfx.down();
        await stage.banner('A RUPTURA FRACASSOU', sc.dawn_fail || 'Os que decidiam não obedeceram', 4);
      }
      finish({
        rupture: ok ? 'sucesso' : 'fracasso',
        effects: { kpis: costs },
        headline: ok ? sc.dawn_success || `Nasce o regime: ${target.name}` : sc.dawn_fail || 'A ruptura fracassa ao amanhecer',
        choice: ok ? `${setup.mode === 'golpe' ? 'Deu o golpe' : 'Liderou a revolução'}: ${target.name}` : `Tentou ${setup.mode === 'golpe' ? 'um golpe' : 'uma revolução'} e fracassou`,
        icon: ok ? target.icon : '⛓️',
      });
    };

    const retreat = async () => {
      if (busy || over) return;
      over = true;
      renderHud();
      await stage.say(pres, sc.retreat || 'Recuei. Peço desculpas ao país.', { tone: 'shout' });
      stage.camera.shake(3, 0.4);
      sfx.down();
      await stage.banner('RECUO NO MEIO DA NOITE', 'O plano vazou. Agora vem a conta.', 3);
      finish({ rupture: 'recuo', effects: { kpis: costs }, headline: 'Presidente recua de ruptura no meio da madrugada', choice: 'Recuou da ruptura no meio da noite', icon: '↩️' });
    };

    // abertura: o conspirador entra com o plano
    const consp = stage.add(new Actor(spriteOf(L, setup.mode === 'golpe' ? 'general' : 'manifestante2'), 340, 150, sc.conspirator.name || 'Conspirador'));
    await stage.banner(sc.codename.toUpperCase(), `23h · Palácio · ${setup.mode === 'golpe' ? 'golpe' : 'revolução'} para ${target.name}`, 2.2);
    await consp.walkTo(222, 150);
    consp.facing = -1;
    await stage.say(consp, sc.intro || 'Está tudo pronto, Presidente. Só falta o senhor dizer sim.');
    void consp.walkTo(340, 150).then(() => (stage.actors = stage.actors.filter((a) => a !== consp)));
    renderHud();
    return done;
  },
};

// ======================================================================
// O conselho do regime: a Junta, o Politburo, o Conselho... quem perde a lealdade conspira
// ======================================================================

export const conselho: Demo = {
  id: 'conselho',
  icon: '🗝️',
  title: 'O conselho do regime',
  kind: 'Poder · lealdade de quem sustenta',
  script: 'conselho',
  teaches: ['Toda autocracia tem quem a sustente', 'Lealdade se compra, e se perde', 'O perigo vem de dentro'],
  help: 'O círculo que sustenta o regime cobra decisões. Cada resposta muda a lealdade de cada membro; quem cair demais passa a conspirar.',
  titleFor: (st) => regimeOf(st).council?.title ?? 'O conselho do regime',
  skip: (_raw, ctx) => {
    const pillar = regimeOf(ctx.state).pillar?.faction;
    return { effects: pillar ? { factions: { [pillar]: -6 } } : { kpis: { coalizao: -2 } }, headline: 'Governante adia a reunião do conselho e alimenta boatos', choice: 'Adiou o conselho', icon: '⏸️' };
  },
  async run(stage, hud, raw, ctx) {
    const sc = raw as CouncilScript;
    const regime = regimeOf(ctx.state);
    const council = regime.council ?? getRegime('personalista').council!;
    const pillar = regime.pillar?.faction;
    stage.background.push(...councilRoom(council.backdrop));
    stage.foreground.push((c) => councilTable(c));
    const L = lib(ctx.state);
    const pres = stage.add(new Actor(spriteOf(L, 'presidente'), 34, 150, 'Você'));
    const seats = [96, 146, 196, 246, 286];
    const startLoyalty = Math.round(30 + (pillar ? (ctx.state.factions[pillar] ?? 0) * 0.3 : 0));
    const members = sc.members.map((m, i) => {
      const role = council.members[i] ?? council.members[council.members.length - 1];
      const a = stage.add(new Actor(npcPerson(role.npc), seats[i], 128, m.name));
      a.facing = -1;
      return { ...m, npc: role.npc, a, loyalty: startLoyalty, conspiring: false };
    });
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const find = (key: string) => members.find((m) => norm(m.role) === norm(key)) ?? members.find((m) => norm(m.role).includes(norm(key)) || norm(key).includes(norm(m.role)) || norm(m.name) === norm(key));
    let costs: Kpis = {};
    const renderHud = () => {
      hud.innerHTML = `<div class="lab-loyalty">${members
        .map((m) => `<div class="${m.conspiring ? 'gone' : ''}"><span>${m.conspiring ? '🗡️ ' : ''}${esc(m.role)}</span><i><b style="width:${Math.max(0, (m.loyalty + 100) / 2)}%;background:${m.loyalty >= 0 ? '#4fc27f' : '#e0574f'}"></b></i></div>`)
        .join('')}</div><div class="lab-hud-line lab-costs">${effectLine(costs)}</div>`;
    };
    renderHud();
    await stage.banner(council.title.toUpperCase(), sc.agenda, 2.4);
    for (const m of members.slice(0, 2)) await stage.say(m.a, m.stance);
    for (const round of sc.rounds) {
      const speaker = find(round.speaker) ?? members[0];
      if (speaker.conspiring) continue;
      speaker.a.jump();
      await stage.say(speaker.a, round.line);
      const i = await stage.choose('Você decide:', round.options.map((o) => ({ label: o.label })), regime.headTitle);
      const o = round.options[i];
      costs = addKpis(costs, o.effects);
      for (const [key, d] of Object.entries(o.loyalty)) {
        const m = find(key);
        if (!m || m.conspiring) continue;
        m.loyalty = Math.max(-100, Math.min(100, m.loyalty + d));
        stage.emote(m.a, d > 0 ? '💚' : '💢');
        if (d < 0) m.a.punch(-0.3);
      }
      renderHud();
      await stage.say(speaker.a, o.reaction);
      for (const m of members) {
        if (m.conspiring || m.loyalty > -20) continue;
        m.conspiring = true;
        stage.emote(m.a, '🗡️', 3);
        stage.camera.shake(2, 0.3);
        await stage.say(m.a, sc.conspiracy[m.role] ?? Object.values(sc.conspiracy)[0] ?? 'Isso não fica assim…', { tone: 'think' });
        renderHud();
      }
    }
    const plotters = members.filter((m) => m.conspiring);
    const avg = members.reduce((n, m) => n + m.loyalty, 0) / Math.max(1, members.length);
    pres.jump();
    await stage.banner(plotters.length ? 'CONSPIRAÇÃO NO CONSELHO' : 'CONSELHO FECHADO COM VOCÊ', plotters.length ? `${plotters.map((m) => m.role).join(', ')} agora conspira${plotters.length > 1 ? 'm' : ''}` : 'Por enquanto, ninguém ousa se mexer', 3.5);
    const pillarDelta = Math.round((avg - startLoyalty) * 0.4 - plotters.length * 8);
    return {
      effects: { kpis: addKpis(costs, { coalizao: -3 * plotters.length }), factions: pillar ? { [pillar]: pillarDelta } : {} },
      headline: plotters.length ? `${council.title}: ${plotters.map((m) => m.name).join(', ')} passa a conspirar` : `${council.title} discute ${sc.agenda.slice(0, 60)}`,
      choice: plotters.length ? `Perdeu a lealdade de ${plotters.map((m) => m.role).join(', ')}` : 'Manteve o conselho unido',
      icon: plotters.length ? '🗡️' : '🗝️',
      conspirators: plotters.length,
    };
  },
};

import '@fontsource/press-start-2p/400.css';
import './fonts.css';
import './style.css';
import { ageOf, dateLabel, monthName, yearOf } from './engine/calendar';
import { checkAchievements, type Milestones } from './engine/achievements';
import { claudeOnline, Director } from './engine/director';
import { getCountry } from './engine/data';
import {
  CAMPAIGN_ROLES, campaignSituation, cassated, continuityYes, CRISIS_ROLES, crisisDue, crisisOdds, crisisSituation, electionCutscene, electionDue, electionResult,
  impeachmentCutscene, lastTerm, nextElectionMonth, oddsLabel, plebisciteNoise, resolveCrisis, stfStrikes,
} from './engine/politics';
import {
  applyRegimeLabels, changeRegime, CRISES, diesNow, driftedRegime, getRegime, isAutocracy, isParliamentary, legalRoutes, plebisciteYes,
  regimeOf, routeOpen, ruptureBrief, ruptureRoutes, ruptureSetup, ruptureTempting, threats, type RegimeRoute,
} from './engine/regime';
import { showRegimeChange, runRuptureDoor } from './ui/regime';
import { advanceMonth, applyEffects, concludeBill, createState, INSTRUMENTS, proposeBill } from './engine/rules';
import { chamberCount } from './art/hemicycle';
import { runLegislativeWindow } from './ui/bills';
import type { VoteScript } from './lab/scripts';
import { clearSave, loadGame, saveGame } from './engine/save';
import type { CrisisKind, Cutscene, GameEvent, GameState, Player, RegimeId } from './engine/types';
import { music } from './audio/music';
import { runBigEvent } from './ui/bigEvent';
import { playCinematic } from './ui/cinematic';
import { creationScreen } from './ui/creation';
import { runDispatch } from './ui/dispatch';
import { DEMOS } from './lab/demos';
import { ministerMood } from './engine/ministers';
import { capSceneEffects, playScene } from './ui/sceneOverlay';
import type { LabKindName } from './engine/director';
import { wait } from './ui/dom';
import { showLab } from './lab/lab';
import { showHome } from './ui/home';
import { inaugurationScreen } from './ui/inauguration';
import { showVerdict } from './ui/overlays';
import { toastAchievement } from './ui/trophies';
import { Gabinete } from './ui/shell';
import { summaryScreen } from './ui/summary';
import type { Ending } from './engine/types';

const stage = document.getElementById('stage')!;

/**
 * Palco: 1280x720 no computador; no celular em pé, 480 de largura com a altura da tela.
 * Tudo é desenhado nesse tamanho lógico e escalado para caber.
 */
function fit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 760 && vh > vw;
  document.body.classList.toggle('mobile', mobile);
  const w = mobile ? 480 : 1280;
  const h = mobile ? Math.round((480 * vh) / vw) : 720;
  const scale = Math.min(vw / w, vh / h);
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  stage.style.transform = `translate(${(vw - w * scale) / 2}px, ${(vh - h * scale) / 2}px) scale(${scale})`;
}
// Garantia extra: se algo tentar rolar o palco (foco num botão fora da área), volta para o lugar.
stage.addEventListener('scroll', () => {
  stage.scrollLeft = 0;
  stage.scrollTop = 0;
});
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));
fit();

let lastPlayer: Partial<Player> = {};

/** Tela inicial: título do jogo ou, se houver mandato salvo, o painel do país. */
function startHome() {
  music.play('title');
  const save = loadGame();
  if (location.hash === '#lab') {
    showLab(stage, () => {
      history.replaceState(null, '', location.pathname);
      startHome();
    });
    return;
  }
  if (!save) {
    showHome(stage, { onNew: startCreation, onLab: () => (location.hash = '#lab') });
    return;
  }
  const country = getCountry(save.countryId);
  applyRegimeLabels(country, save.state.regime);
  showHome(stage, {
    state: save.state,
    country,
    primary: {
      label: '▶ CONTINUAR MANDATO',
      onClick: () => {
        lastPlayer = save.state.player;
        void runMandate(save.countryId, save.state, false);
      },
    },
    onNew: () => {
      clearSave();
      startCreation();
    },
    loadBulletin: () =>
      new Director(country).bulletin(save.state).then((b) => {
        if (b) saveGame(save.countryId, { ...save.state, bulletin: b });
        return b;
      }),
  });
}

function startCreation() {
  music.play('title');
  const save = loadGame();
  creationScreen(
    stage,
    lastPlayer,
    async (player, countryId) => {
      lastPlayer = player;
      if (!(await claudeOnline())) {
        alert('O Senhor Presidente precisa do Claude para escrever o mandato, e ele não está disponível neste servidor.');
        return;
      }
      clearSave();
      const country = getCountry(countryId);
      applyRegimeLabels(country, 'presidencialismo');
      const state = createState(country, player);
      // A primeira crise começa a ser escrita já na posse, a partir da origem do presidente.
      const director = new Director(country);
      director.requestBig(state);
      director.refillDispatches(state);
      inaugurationScreen(stage, player, country, () => void runMandate(countryId, state, true, director));
    },
    save
      ? {
          label: `${save.state.player.name} · ${dateLabel(save.state, save.state.month)}`,
          onResume: () => {
            lastPlayer = save.state.player;
            void runMandate(save.countryId, save.state, false);
          },
        }
      : undefined,
  );
}

/**
 * O mandato: despachos rápidos na mesa enquanto o Claude escreve o próximo grande acontecimento
 * em segundo plano. O calendário corre de 2026 em diante; o jogo acaba no fim do segundo mandato,
 * numa derrota eleitoral, numa renúncia ou num impeachment.
 */
async function runMandate(countryId: string, start: GameState, fresh: boolean, prepared?: Director) {
  const country = getCountry(countryId);
  const director = prepared ?? new Director(country);
  if (!start.relations) start = { ...start, relations: createState(country, start.player).relations };
  if (!start.institutions) start = { ...start, regime: 'presidencialismo', institutions: createState(country, start.player).institutions };
  applyRegimeLabels(country, start.regime);
  const g = new Gabinete(stage, country, start);
  let inBig = false;

  director.onBigReady = (event) => {
    if (inBig) return;
    g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: `🔥 Fontes do Planalto: “${event.title}”. Vem coisa grande por aí.`, likes: 8000, tone: 'press' });
  };

  const noCutscene = async () => null;
  /**
   * Evento grande na mesa. `cutscenes`: pede as cinemáticas ao Claude. `next`: ao resolver, já encomenda
   * o próximo evento grande (os momentos decisivos não fazem isso, para não descartar um evento pronto).
   */
  const playBig = async (event: GameEvent, opts: { cutscenes: boolean; next: boolean } = { cutscenes: true, next: true }) => {
    inBig = true;
    music.play('tense');
    const ev = { ...event, month: g.state.month, month_name: monthName(g.state.month) };
    if (opts.cutscenes) director.prepareCutscenes(ev, g.state);
    await g.urgent(ev.kicker, ev.title);
    for (;;) {
      const r = await runBigEvent(g, ev, {
        cutsceneFor: opts.cutscenes ? (opt) => director.cutsceneFor(ev, opt, g.state) : noCutscene,
        onResolved: (s) => opts.next && director.requestBig(s),
        isEnding: () => false,
      });
      if (!r.retry) break;
    }
    inBig = false;
    music.play('calm');
    return g.state.decisions[g.state.decisions.length - 1]?.split(':')[1];
  };

  const milestones: Milestones = {};
  /** Confere conquistas depois de cada acontecimento: troféu na mesa e aviso na tela. */
  const trophies = () => {
    const fresh = checkAchievements(g.state, milestones, country);
    if (!fresh.length) return;
    g.state = { ...g.state, trophies: [...(g.state.trophies ?? []), ...fresh.map((a) => a.id)] };
    g.renderTrophies();
    fresh.forEach((a) => toastAchievement(g.screen, a));
  };

  g.onHome = () => {
    const mood = music.current;
    music.play('title');
    showHome(g.screen, {
      overlay: true,
      state: g.state,
      country,
      primary: { label: '▶ VOLTAR AO GABINETE', onClick: () => music.play(mood) },
      onNew: () => {
        g.destroy();
        clearSave();
        startCreation();
      },
      loadBulletin: () =>
        director.bulletin(g.state).then((b) => {
          if (b) {
            g.state = { ...g.state, bulletin: b };
            saveGame(countryId, g.state);
          }
          return b;
        }),
    });
  };

  /** Roda uma cena interativa e aplica o que aconteceu nela ao mandato. */
  const runScene = async (kind: LabKindName, script: unknown) => {
    const demo = DEMOS.find((d) => d.script === kind)!;
    const prevMood = music.current;
    music.play(kind === 'debate' || kind === 'ruptura' ? 'epic' : kind === 'coletiva' ? 'press' : 'tense');
    const r = await playScene(g.screen, demo, script, g.state);
    music.play(prevMood);
    if (!r) return null;
    const result = applyEffects(g.state, capSceneEffects(r.effects), country);
    g.state = {
      ...result.state,
      decisions: [...result.state.decisions, `CENA_${kind}_${g.state.month}:${r.rupture ?? r.icon}`],
      history: [...result.state.history, { month: g.state.month, event: demo.titleFor?.(g.state) ?? demo.title, choice: r.choice, headline: r.headline, icon: r.icon }],
      ministerLoyalty: r.loyalty ? { ...(g.state.ministerLoyalty ?? {}), ...r.loyalty } : g.state.ministerLoyalty,
    };
    g.render();
    void g.animateKpis(result.deltas);
    g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: r.headline, likes: 6000, tone: 'press' });
    for (const id of r.resigned ?? []) {
      const m = country.ministers.find((x) => x.id === id);
      if (m) g.feed.push({ who: 'Economia Hoje', at: 'economiahoje', text: `${m.name} deixa o ministério (${m.role}) depois de bate-boca na reunião.`, likes: 9000, tone: 'press' });
    }
    saveGame(countryId, g.state);
    return r;
  };

  /** Qual cena interativa faz sentido agora: a relação externa mais tensa, um ministro insatisfeito ou uma votação. */
  let lastScene: LabKindName | null = null;
  const pickScene = (): LabKindName => {
    const regime = regimeOf(g.state);
    // nas autocracias (e na monarquia), o conselho que sustenta o regime substitui a reunião ministerial
    const inner: LabKindName = regime.scenes.includes('conselho') && (isAutocracy(g.state) || lastScene === 'reuniao') ? 'conselho' : 'reuniao';
    const tense = (country.partners ?? []).some((p) => (g.state.relations?.[p.id] ?? 0) <= -25);
    const unhappy = country.ministers.some((m) => ministerMood(m.id, g.state) <= -40 || (g.state.ministerLoyalty?.[m.id] ?? 30) <= 0);
    if (tense && lastScene !== 'telefonema') return 'telefonema';
    if ((unhappy || isAutocracy(g.state)) && lastScene !== inner) return inner;
    return lastScene === 'telefonema' ? inner : 'telefonema';
  };
  /** Instruções extras de cada cena para o Claude (os membros do conselho do regime). */
  const sceneExtra = (kind: LabKindName) => {
    const c = regimeOf(g.state).council;
    return kind === 'conselho' && c ? `Conselho: ${c.title}. Papéis dos membros, nesta ordem: ${c.members.map((m) => m.role).join(', ')}.` : '';
  };
  let sceneKind: LabKindName | null = null;

  // ---------- legislar ----------

  /** A pauta do governo abre em fevereiro e agosto (volta do Congresso), se não houver projeto andando. */
  let pautaOffered = '';
  const pautaOpen = () => {
    const m = (g.state.month - 1) % 12;
    if (g.state.bill || !(m === 1 || m === 2 || m === 7 || m === 8)) return false;
    const key = `${Math.ceil(g.state.month / 12)}-${m < 6 ? 1 : 2}`;
    return key !== pautaOffered ? key : false;
  };
  const runPauta = async (key: string): Promise<Ending | null> => {
    pautaOffered = key;
    const proposals = await director.takeBills();
    if (!proposals.length) return null;
    const auto = isAutocracy(g.state);
    const pick = await runLegislativeWindow(g, proposals, { routes: legalRoutes(g.state), autocracy: auto });
    if (!pick) {
      void g.say(auto ? 'Nenhum decreto agora. O regime espera.' : 'Tudo bem. A próxima janela é no outro semestre.');
      return null;
    }
    if ('abertura' in pick) {
      // O Chile de 1988: o regime pergunta ao povo se continua, e às vezes o povo diz não.
      const yes = continuityYes(g.state);
      music.play(yes >= 50 ? 'epic' : 'sad');
      g.state = { ...g.state, history: [...g.state.history, { month: g.state.month, event: 'Plebiscito da continuidade', choice: `Sim ${yes}% × Não ${(100 - yes).toFixed(1)}%`, headline: yes >= 50 ? 'O regime ganha o plebiscito' : 'O povo diz não ao regime', icon: '🕊️' }] };
      if (yes >= 50) {
        g.state = applyEffects(g.state, { kpis: { aprovacao: 6 }, relations: { eua: 8, ue: 10 }, institutions: { eleicoes: 10 } }, country).state;
        g.render();
        await showVerdict(g.screen, { icon: '🕊️', kicker: 'PLEBISCITO DA CONTINUIDADE', title: `SIM: ${String(yes).replace('.', ',')}%`, good: true, text: 'O regime ganhou o próprio plebiscito. Lá fora, a votação dá alguma legitimidade; aqui dentro, a oposição diz que a campanha não foi livre.' });
        return null;
      }
      await showVerdict(g.screen, { icon: '🕊️', kicker: 'PLEBISCITO DA CONTINUIDADE', title: `NÃO: ${(100 - yes).toFixed(1).replace('.', ',')}%`, good: true, button: 'VER O BALANÇO ➔', text: 'Como Pinochet em 1988, o regime perdeu o plebiscito que ele mesmo convocou e aceitou o resultado. Começa a transição para a democracia.' });
      return 'abertura';
    }
    if ('route' in pick) {
      const rt = pick.route;
      const reg = getRegime(rt.to);
      const proposal = {
        id: `REGIME_${rt.to}`, icon: reg.icon, title: `${rt.via === 'plebiscito' ? 'Plebiscito' : 'Constituinte'}: ${reg.name}`.slice(0, 60), summary: reg.summary, area: 'regime',
        needsPec: rt.via === 'constituinte', effects: {}, monthly: {}, months: 6, lesson: `${reg.gains} ${reg.losses}`, special: `regime:${rt.to}` as const,
      };
      const r = proposeBill(g.state, proposal, rt.via === 'constituinte' ? 'pec' : 'lei', country);
      g.state = { ...r.state, history: [...r.state.history, { month: g.state.month, event: 'Reforma do regime', choice: proposal.title, headline: reg.summary, icon: reg.icon }] };
      // A via chilena: tentar o socialismo pelo voto deixa os quartéis em alerta.
      if (rt.to === 'socialista') g.state = applyEffects(g.state, { factions: { seguranca: -30 }, relations: { eua: -15 } }, country).state;
      g.render();
      g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: `${reg.icon} Governo envia ao Congresso: “${proposal.title}”.`, likes: 15000, tone: 'press' });
      void g.say(rt.via === 'plebiscito' ? 'Primeiro o Congresso aprova o plebiscito. Depois, quem decide é o povo.' : 'Uma Constituinte precisa de três quintos do Congresso. Depois, o povo vota a nova Carta.');
      saveGame(countryId, g.state);
      return null;
    }
    const r = proposeBill(g.state, pick.proposal, pick.instrument, country);
    const label = INSTRUMENTS[pick.instrument].label;
    g.state = {
      ...r.state,
      history: [...r.state.history, { month: g.state.month, event: auto ? 'Decreto do regime' : 'Projeto enviado ao Congresso', choice: `${label}: ${pick.proposal.title}`, headline: pick.proposal.summary, icon: pick.proposal.icon }],
    };
    g.render();
    if (pick.instrument === 'mp' || pick.instrument === 'decreto') {
      void g.animateKpis(r.deltas);
      void g.animateAxes(r.deltas, false);
      void g.animateFactions(r.deltas, false);
    }
    g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: `${pick.instrument === 'decreto' ? '🖋️ Decreto publicado' : pick.instrument === 'mp' ? '⚡ Governo edita MP' : '📜 Governo envia ao Congresso'}: “${pick.proposal.title}”.`, likes: 7000, tone: 'press' });
    void g.say(pick.instrument === 'decreto' ? 'Publicado no Diário Oficial. Ninguém vota, ninguém derruba: a conta vem de outro jeito.' : pick.instrument === 'mp' ? 'A MP já vale. Agora o Congresso tem quatro meses para não deixar cair.' : 'Enviado. Até a votação, cada decisão sua mexe nos votos que teremos no plenário.');
    saveGame(countryId, g.state);
    return null;
  };

  /** Dia da votação do projeto do governo: articulação no plenário (ou voto direto, se pular). */
  const billVote = async () => {
    const bill = g.state.bill!;
    const needed = INSTRUMENTS[bill.instrument].needed;
    let script = director.takeScene('votacao');
    if (!script) {
      g.desk.innerHTML = '<div class="desk-waiting"><div>🏛️</div>O plenário se prepara para votar o seu projeto…</div>';
      script = await director.awaitScene('votacao', 60_000);
    }
    let passed: boolean | undefined;
    let costs = {};
    if (script) {
      const sc = script as VoteScript;
      sc.bill = { title: bill.title, description: bill.summary, needed };
      const demo = DEMOS.find((d) => d.script === 'votacao')!;
      const prevMood = music.current;
      music.play('tense');
      const r = await playScene(g.screen, demo, sc, g.state);
      music.play(prevMood);
      passed = r?.passed;
      costs = r?.costs ?? {};
    }
    // pulou a cena (ou ela não veio): o plenário vota com a base que o governo tem
    passed ??= chamberCount(g.state, country).total.base >= needed;
    const withCosts = applyEffects(g.state, capSceneEffects(costs), country).state;
    // lei que mexe nas regras do jogo: um STF independente pode derrubar
    const struck = passed && stfStrikes(withCosts, bill.special);
    const r = concludeBill(withCosts, passed && !struck, country);
    const mp = bill.instrument === 'mp';
    const title = struck ? 'Derrubado no STF' : mp ? (passed ? 'MP virou lei' : 'MP derrubada') : passed ? 'Aprovado!' : 'Rejeitado';
    g.state = {
      ...r.state,
      history: [...r.state.history, { month: g.state.month, event: `Votação: ${bill.title}`, choice: title, headline: `${bill.title}: ${title.toLowerCase()} no Congresso`, icon: passed ? '✅' : '❌' }],
    };
    g.render();
    void g.animateKpis(r.deltas);
    void g.animateAxes(r.deltas, false);
    void g.animateFactions(r.deltas, false);
    await showVerdict(g.screen, {
      icon: passed ? '✅' : '❌',
      kicker: `CONGRESSO NACIONAL · ${INSTRUMENTS[bill.instrument].label.toUpperCase()}`,
      title: `${bill.title}: ${title}`,
      good: passed && !struck,
      text: struck
        ? 'O Congresso aprovou, mas o STF suspendeu a lei: ela fere uma cláusula pétrea da Constituição (art. 60, §4º). É para isso que servem os freios.'
        : passed && bill.special?.startsWith('regime:')
          ? 'Aprovado. Agora a palavra é do povo.'
          : passed
        ? `${mp ? 'A medida provisória foi convertida em lei.' : `A lei entra em vigor e faz efeito pelos próximos ${Math.round(bill.months * INSTRUMENTS[bill.instrument].power)} meses.`} ${bill.lesson}`
        : mp
          ? 'O Congresso derrubou a MP: ela perde a validade, parte do efeito se desfaz e o governo sai enfraquecido.'
          : 'Derrota do governo no plenário. A base não segurou, e a oposição comemora.',
    });
    g.feed.push({ who: 'Economia Hoje', at: 'economiahoje', text: `${bill.title}: ${title.toLowerCase()} no Congresso.`, likes: 9000, tone: 'press' });
    if (struck) g.state = { ...g.state, stf: 'LIMINAR', history: [...g.state.history.slice(0, -1), { ...g.state.history[g.state.history.length - 1], stf: 'STF DERRUBA A LEI' }] };
    saveGame(countryId, g.state);
    director.prepareBills(g.state);
    // plebiscito ou constituinte aprovados: o povo vota
    if (passed && !struck && bill.special?.startsWith('regime:')) {
      const to = bill.special.slice(7) as RegimeId;
      const yes = plebisciteYes(g.state, to, plebisciteNoise(g.state));
      const reg = getRegime(to);
      music.play(yes >= 50 ? 'epic' : 'sad');
      await showVerdict(g.screen, {
        icon: reg.icon, kicker: bill.instrument === 'pec' ? 'REFERENDO DA NOVA CONSTITUIÇÃO' : 'PLEBISCITO', title: `${yes >= 50 ? 'SIM' : 'NÃO'}: ${String(yes >= 50 ? yes : Math.round((100 - yes) * 10) / 10).replace('.', ',')}%`, good: yes >= 50,
        text: yes >= 50 ? `O povo aprovou: o Brasil passa a ser ${reg.name}.` : `O povo rejeitou a mudança (${String(yes).replace('.', ',')}% votaram sim). Em 1963 e em 1993 o Brasil também disse não ao parlamentarismo, e a monarquia teve só 13% em 1993.`,
      });
      g.state = { ...g.state, history: [...g.state.history, { month: g.state.month, event: 'Voto popular', choice: `${reg.name}: sim ${yes}%`, headline: yes >= 50 ? `Brasil aprova: ${reg.name}` : `Brasil rejeita: ${reg.name}`, icon: reg.icon }] };
      if (yes >= 50) await regimeChange(to, bill.instrument === 'pec' ? 'constituinte' : 'plebiscito');
    }
  };

  const nextMonth = () => {
    g.state = advanceMonth(g.state, country);
    g.renderRelations();
  };

  // ---------- regime ----------

  /** Troca o regime em cena: cerimônia com a ficha do regime novo e a cinemática escrita pelo Claude. */
  const regimeChange = async (to: RegimeId, via: string, cut?: Promise<Cutscene | null>) => {
    const before = g.state;
    g.state = changeRegime(g.state, to, via);
    g.state = { ...g.state, history: [...g.state.history, { month: g.state.month, event: 'Mudança de regime', choice: `${getRegime(to).name} (${via})`, headline: `O Brasil agora é: ${getRegime(to).name}`, icon: getRegime(to).icon }] };
    applyRegimeLabels(country, to);
    milestones.regimes = [...(milestones.regimes ?? []), to];
    music.play(isAutocracy(g.state) ? 'tense' : 'epic');
    await showRegimeChange(g, before, g.state, via, cut ?? director.regimeCutscene(g.state, to, via));
    g.refreshRegime();
    g.render();
    saveGame(countryId, g.state);
    music.play('calm');
  };

  /** A ruptura: a porta que alguém abre ao governante que já concentra poder. Devolve o final, se houver. */
  const ruptureScripts = new Set<string>();
  const prepareRuptures = () => {
    if (!ruptureTempting(g.state)) return;
    for (const r of ruptureRoutes(g.state).filter(routeOpen).slice(0, 2)) {
      const key = `ruptura:${r.to}`;
      if (ruptureScripts.has(key)) continue;
      ruptureScripts.add(key);
      director.prepareScene('ruptura', g.state, ruptureBrief(ruptureSetup(g.state, r.to)), key);
    }
  };
  const openRupture = async (reason: string): Promise<Ending | null> => {
    g.state = { ...g.state, ruptureOfferedAt: g.state.month };
    const routes = ruptureRoutes(g.state);
    const pick = await runRuptureDoor(g, routes, reason, (r: RegimeRoute) => director.sceneReady(`ruptura:${r.to}`));
    if (!pick) {
      g.state = applyEffects(g.state, { axes: { poder: -4 } }, country).state;
      g.state = { ...g.state, history: [...g.state.history, { month: g.state.month, event: 'Audiência reservada', choice: 'Mandou os conspiradores embora', headline: reason, icon: '🚪' }] };
      void g.say('Fez bem. Essa porta, uma vez aberta, não fecha mais.');
      return null;
    }
    const key = `ruptura:${pick.to}`;
    g.desk.innerHTML = '<div class="desk-waiting"><div>🌒</div>A noite cai sobre Brasília…</div>';
    let script = director.takeScene(key) ?? (await director.awaitScene(key, 90_000));
    ruptureScripts.delete(key);
    if (!script) {
      void g.say('Os conspiradores sumiram. O plano vazou antes da hora.');
      return null;
    }
    const setup = ruptureSetup(g.state, pick.to);
    script = { ...(script as object), setup };
    const via = setup.mode === 'golpe' ? 'golpe' : 'revolução';
    const cut = director.regimeCutscene(g.state, pick.to, via);
    const r = await runScene('ruptura', script);
    if (r?.rupture === 'sucesso') {
      await regimeChange(pick.to, via, cut);
      return null;
    }
    if (r?.rupture === 'fracasso') {
      music.play('sad');
      await showVerdict(g.screen, {
        icon: '⛓️', kicker: 'AMANHECER EM BRASÍLIA', title: 'A ruptura fracassou', good: false, button: 'VER O BALANÇO ➔',
        text: `Os que decidiam não obedeceram. ${g.state.player.name} é preso ainda de manhã, acusado de tentativa de golpe de Estado, como Pedro Castillo no Peru em 2022.`,
      });
      return 'preso';
    }
    if (r?.rupture === 'recuo') {
      // o caso Yoon (Coreia do Sul, 2024): recuou em horas e mesmo assim sofreu impeachment
      g.state = applyEffects(g.state, { kpis: { aprovacao: -12, coalizao: -18 }, axes: { poder: 8 }, institutions: { congresso: 6 } }, country).state;
      g.state = { ...g.state, crisisShield: {}, impeachmentShieldUntil: 0 };
      g.render();
      await showVerdict(g.screen, {
        icon: '↩️', kicker: 'MADRUGADA', title: 'Recuou, mas o país viu', good: false,
        text: 'Em 2024, o presidente da Coreia do Sul decretou lei marcial e recuou seis horas depois. Sofreu impeachment mesmo assim. A tentativa fica no histórico, e o Congresso também viu.',
      });
    }
    return null;
  };

  /** Momento decisivo escrito pelo Claude: as chances de cada saída aparecem antes da escolha. */
  const runCrisis = async (kind: CrisisKind, ev: GameEvent): Promise<Ending | null> => {
    for (const o of ev.options) {
      const after = applyEffects(g.state, o.effects, country).state;
      const p = crisisOdds(kind, o.id, after, country);
      o.summary = `${o.summary} ${o.id === 'renunciar' ? '· Encerra o mandato.' : `· Chance de ficar no cargo: ${oddsLabel(p)}.`}`;
    }
    const role = (await playBig(ev, { cutscenes: true, next: false })) ?? 'omissao';
    const out = resolveCrisis(kind, role, g.state, country);
    if (out.vote) {
      await playCinematic(g.screen, impeachmentCutscene(out.vote, kind === 'desconfianca' ? 'desconfianca' : 'impeachment'), g.library, kind === 'desconfianca' ? 'PARLAMENTO · AO VIVO' : 'CÂMARA · AO VIVO');
    }
    if (out.ending) {
      music.play('sad');
      const texts: Partial<Record<Ending, string>> = {
        impeachment: `${out.vote?.yes} deputados votaram pelo afastamento (eram necessários ${out.vote?.needed}). O Senado confirma: ${g.state.player.name} deixa o cargo.`,
        desconfianca: `${out.vote?.yes} deputados aprovaram a moção de desconfiança. A nova maioria escolhe outro chefe de governo.`,
        renuncia: 'A carta de renúncia é lida no plenário. Sair antes de ser tirado preserva algo, mas o poder acabou.',
        queda: 'A multidão rompe o cerco do palácio. Os guardas baixam as armas. O governo caiu na rua.',
        exilio: 'Um avião decola de madrugada da base aérea. O destino é o exílio.',
        deposto: 'Os tanques cercam o palácio e os generais anunciam na TV: o governante foi deposto.',
        expurgo: 'O Comitê Central aprova a destituição por unanimidade. Seu nome some das fotos oficiais.',
        destituido: 'O conselho vota a destituição. Um sucessor é anunciado antes do almoço.',
      };
      await showVerdict(g.screen, { icon: CRISES[kind].icon, kicker: CRISES[kind].name.toUpperCase(), title: 'Fim do governo', good: false, button: 'VER O BALANÇO ➔', text: texts[out.ending] ?? '' });
      return out.ending;
    }
    g.state = applyEffects(g.state, out.effects, country).state;
    g.state = { ...g.state, crisisShield: { ...(g.state.crisisShield ?? {}), [kind]: g.state.month + 12 }, warned: { ...(g.state.warned ?? {}), [kind]: 0 } };
    if (kind === 'impeachment') {
      g.state = { ...g.state, impeachmentShieldUntil: g.state.month + 12 };
      milestones.survivedImpeachment = true;
    }
    milestones.survived = [...(milestones.survived ?? []), kind];
    if (out.earlyElection) g.state = { ...g.state, nextElection: g.state.month };
    g.render();
    music.play('epic');
    await showVerdict(g.screen, {
      icon: '🛡️', kicker: CRISES[kind].name.toUpperCase(), title: out.earlyElection ? 'Parlamento dissolvido' : 'O governo sobreviveu', good: true,
      text: out.earlyElection
        ? 'Eleições antecipadas: o povo decide agora quem forma a maioria.'
        : out.vote
          ? `Só ${out.vote.yes} votos contra o governo, ${out.vote.needed - out.vote.yes} a menos que o necessário. Mas a oposição promete voltar.`
          : 'A crise passou, por enquanto. A conta do jeito que ela foi vencida chega nos próximos meses.',
    });
    return null;
  };

  /** Avisa quando uma ameaça ao mandato fica séria e encomenda a crise ao Claude antes de ela explodir. */
  const watchThreats = () => {
    const t = threats(g.state);
    for (const [kind, level] of Object.entries(t) as [CrisisKind, number][]) {
      const warned = g.state.warned?.[kind] ?? 0;
      const step = level >= 85 ? 85 : level >= 60 ? 60 : 0;
      if (step > warned) {
        g.state = { ...g.state, warned: { ...(g.state.warned ?? {}), [kind]: step } };
        void g.say(`${CRISES[kind].icon} ${CRISES[kind].warn}${step >= 85 ? ' É iminente.' : ''}`);
        g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: `${CRISES[kind].icon} Ameaça ao governo: ${CRISES[kind].name.toLowerCase()} (${level}/100).`, likes: 12000, tone: 'press' });
      } else if (level < 40 && warned) g.state = { ...g.state, warned: { ...(g.state.warned ?? {}), [kind]: 0 } };
      if (level >= 60) director.prepareCrisis(kind, g.state, crisisSituation(kind, g.state, country), CRISIS_ROLES[kind]);
    }
  };

  /** Eleição, crises terminais, ruptura e fim do tempo. Devolve o final do jogo, se houver. */
  const politics = async (): Promise<Ending | null> => {
    watchThreats();
    const kind = crisisDue(g.state);
    if (kind) {
      // a crise explodiu: se o Claude ainda está escrevendo, o país espera (ela não pode evaporar)
      if (director.hasCrisis(kind)) g.desk.innerHTML = `<div class="desk-waiting"><div>${CRISES[kind].icon}</div>A crise se agrava a cada hora…</div>`;
      const ev = await director.takeCrisis(kind, 90_000);
      if (ev) {
        const end = await runCrisis(kind, ev);
        if (end) return end;
      } else director.prepareCrisis(kind, g.state, crisisSituation(kind, g.state, country), CRISIS_ROLES[kind]);
    }

    // A deriva: a democracia que perdeu os freios vira regime híbrido sem golpe nenhum (e volta, se os devolver).
    const drift = driftedRegime(g.state);
    if (drift) await regimeChange(drift, drift === 'hibrido' ? 'erosão das instituições' : 'redemocratização');

    const next = nextElectionMonth(g.state, country);
    const campaignKey = `campanha_${next}`;
    if (next !== null && g.state.month >= next - 5) {
      director.prepareCrisis(campaignKey, g.state, campaignSituation(g.state), CAMPAIGN_ROLES);
      if (regimeOf(g.state).debate) director.prepareScene('debate', g.state);
    }

    if (electionDue(g.state, country)) {
      const debate = regimeOf(g.state).debate ? await director.awaitScene('debate', 90_000) : null;
      if (debate) await runScene('debate', debate);
      g.desk.innerHTML = '<div class="desk-waiting"><div>🗳️</div>O marqueteiro prepara a reta final…</div>';
      const campaign = await director.takeCrisis(campaignKey, 120_000);
      if (campaign) {
        const m = campaign.options.find((o) => o.id === 'maquina');
        if (m && regimeOf(g.state).elections === 'livres') m.summary = `${m.summary} · Risco: o tribunal eleitoral pode cassar a chapa.`;
        const choice = await playBig(campaign, { cutscenes: true, next: false });
        if (choice === 'maquina') g.state = { ...g.state, campaignAbuse: true };
      }
      const result = electionResult(g.state);
      music.play(result.won ? 'epic' : 'sad');
      await playCinematic(g.screen, electionCutscene(g.state, result), g.library, `APURAÇÃO · ${yearOf(g.state, g.state.month)}`);
      if (isParliamentary(g.state)) g.state = { ...g.state, nextElection: g.state.month + 48 };
      else g.state = { ...g.state, electionsHeld: [...g.state.electionsHeld, g.state.term] };
      const pct = (result.runoff ?? result.firstRound).toFixed(1).replace('.', ',');
      if (!result.won) {
        await showVerdict(g.screen, {
          icon: '🗳️', kicker: 'RESULTADO DA ELEIÇÃO', title: 'Derrotado nas urnas', good: false,
          text: `${pct}% dos votos válidos não bastaram. ${isParliamentary(g.state) ? 'A oposição forma a nova maioria.' : `Em 1º de janeiro, ${g.state.player.name} passa a faixa ao adversário.`}`,
        });
        // A tentação de não reconhecer o resultado.
        if (ruptureTempting(g.state) || g.state.axes.poder >= 25) {
          const end = await openRupture('A derrota nas urnas. Um grupo de assessores diz que a eleição foi fraudada e que o senhor não precisa aceitar o resultado.');
          if (end) return end;
          if (isAutocracy(g.state)) return null;
        }
        return 'derrota';
      }
      if (cassated(g.state)) {
        music.play('sad');
        await showVerdict(g.screen, {
          icon: '⚖️', kicker: 'TRIBUNAL SUPERIOR ELEITORAL', title: 'Chapa cassada', good: false, button: 'VER O BALANÇO ➔',
          text: 'Venceu nas urnas, mas o TSE julgou que a campanha usou a máquina pública e cassou a chapa. Abuso de poder político torna o candidato inelegível por 8 anos.',
        });
        return 'cassado';
      }
      g.state = { ...g.state, campaignAbuse: false };
      milestones.reelected = true;
      trophies();
      await showVerdict(g.screen, {
        icon: '🎉', kicker: 'RESULTADO DA ELEIÇÃO', title: isParliamentary(g.state) ? 'Maioria renovada!' : 'Reeleito!', good: true, button: 'CONTINUAR ➔',
        text: isParliamentary(g.state)
          ? `${pct}% dos votos: o seu partido segue com a maioria e você continua como primeiro-ministro. No parlamentarismo não há limite de mandatos.`
          : `${pct}% dos votos válidos${result.runoff ? ' no segundo turno' : ' já no primeiro turno'}. ${lastTerm({ ...g.state, term: g.state.term + 1 }, country) ? 'Este será o último mandato permitido.' : 'Mais quatro anos.'}`,
      });
      if (!isParliamentary(g.state)) {
        // A posse do novo mandato é em 1º de janeiro.
        while (g.state.month % g.state.termMonths !== 0) nextMonth();
        nextMonth();
        g.state = { ...g.state, term: g.state.term + 1 };
      }
      g.render();
    }

    // Último ano do último mandato: alguém sugere não passar a faixa.
    if (lastTerm(g.state, country) && g.state.month >= g.state.totalMonths - 3 && (g.state.ruptureOfferedAt ?? -99) < g.state.month - 6 && g.state.axes.poder >= 25) {
      const end = await openRupture('Faltam três meses para passar a faixa. Um grupo leal diz que o senhor pode simplesmente não sair.');
      if (end) return end;
    }

    if (diesNow(g.state)) {
      music.play('sad');
      await showVerdict(g.screen, { icon: '🕯️', kicker: 'NOTA OFICIAL', title: 'Morreu no poder', good: false, button: 'VER O BALANÇO ➔', text: `Aos ${ageOf(g.state, g.state.month)} anos, ${g.state.player.name} morre no palácio. A sucessão abre uma disputa que ninguém sabe como termina.` });
      return 'morte';
    }
    if (g.state.month >= g.state.totalMonths) return isAutocracy(g.state) ? 'morte' : 'fim';
    return null;
  };

  let ending: Ending | null = null;
  music.play('calm');
  if (!prepared) director.requestBig(g.state);
  if (!fresh) void g.say(`Bem-vindo de volta, Presidente. Estamos em ${dateLabel(g.state, g.state.month)}.`);
  director.refillDispatches(g.state);

  // Abertura: sem espera. Os despachos do acervo cobrem o começo enquanto o Claude escreve
  // a primeira crise e a primeira leva de despachos personalizados.
  saveGame(countryId, g.state);
  let sinceBig = 1;
  let sinceInterview = 2;
  let sinceScene = 0;

  for (;;) {
    trophies();
    ending = await politics();
    if (ending) break;
    trophies();
    saveGame(countryId, g.state);

    if (sinceBig >= 1) {
      const big = director.takeBig(g.state);
      if (big) {
        nextMonth();
        await playBig(big);
        sinceBig = 0;
        continue;
      }
      if (!director.bigInFlight && !director.bigReady) director.requestBig(g.state);
    }

    // Projeto do governo: propostas prontas para quando o jogador quiser; votação na data marcada.
    if (!g.state.bill) director.prepareBills(g.state);
    if (g.state.bill && g.state.month >= g.state.bill.voteMonth - 1) director.prepareScene('votacao', g.state);
    if (g.state.bill && g.state.month >= g.state.bill.voteMonth) {
      await billVote();
      continue;
    }
    const pauta = pautaOpen();
    if (pauta && director.billsReady) {
      nextMonth();
      const end = await runPauta(pauta);
      if (end) {
        ending = end;
        break;
      }
      continue;
    }

    // A porta da ruptura: aparece para quem já concentra poder, quando o momento empurra.
    prepareRuptures();
    if (ruptureTempting(g.state) && g.state.month - (g.state.ruptureOfferedAt ?? -99) >= 12 && ruptureRoutes(g.state).some((r) => routeOpen(r) && director.sceneReady(`ruptura:${r.to}`))) {
      const maxThreat = Math.max(0, ...Object.values(threats(g.state)));
      const nextE = nextElectionMonth(g.state, country);
      const reason =
        maxThreat >= 70
          ? 'O cerco ao governo aperta. Alguém pede uma audiência reservada: diz que existe outro caminho.'
          : nextE !== null && nextE - g.state.month <= 6 && g.state.kpis.aprovacao < 45
            ? 'As pesquisas apontam derrota. Um grupo de assessores sugere que talvez não precise haver eleição.'
            : g.state.axes.poder >= 60
              ? 'Um aliado pede uma audiência reservada: o senhor já manda em quase tudo, por que ainda pedir licença?'
              : null;
      if (reason) {
        nextMonth();
        const end = await openRupture(reason);
        if (end) {
          ending = end;
          break;
        }
        continue;
      }
    }

    // Cena interativa (votação, telefonema ou reunião): escolhida pelo momento, encomendada cedo, entra quando pronta.
    if (sinceScene >= 3 && !sceneKind) {
      sceneKind = pickScene();
      director.prepareScene(sceneKind, g.state, sceneExtra(sceneKind));
    }
    if (sinceScene >= 6 && sceneKind) {
      const script = director.takeScene(sceneKind);
      if (script) {
        nextMonth();
        await runScene(sceneKind, script);
        lastScene = sceneKind;
        sceneKind = null;
        sinceScene = 0;
        continue;
      }
    }

    // Coletiva escrita pelo Claude sobre o que aconteceu: encomendada cedo, entra quando estiver pronta.
    if (sinceInterview >= 2) director.prepareInterview(g.state);
    if (sinceInterview >= 5) {
      const interview = director.takeInterview();
      if (interview) {
        nextMonth();
        await runScene('coletiva', interview);
        sinceInterview = 0;
        continue;
      }
    }

    const d = director.nextDispatch(g.state);
    if (d) {
      sinceInterview++;
      sinceScene++;
      nextMonth();
      await runDispatch(g, d);
      sinceBig++;
      continue;
    }

    // Mesa vazia: espera o Claude terminar o próximo despacho ou o próximo evento grande.
    g.desk.innerHTML = '<div class="desk-waiting"><div>📂</div>A assessoria monta o próximo dossiê…</div>';
    while (!director.hasDispatch && !director.bigReady && director.failures < 3) {
      if (!director.bigInFlight && !director.bigReady) director.requestBig(g.state);
      director.refillDispatches(g.state);
      await wait(1000);
    }
    if (!director.hasDispatch && !director.bigReady) {
      await showVerdict(g.screen, {
        icon: '📡', kicker: 'SEM CONEXÃO COM O CLAUDE', title: 'O mandato está em pausa', good: false, button: 'VER O BALANÇO ➔',
        text: 'Todos os acontecimentos do jogo são escritos pelo Claude, e ele não respondeu. O mandato foi salvo: dá para continuar de onde parou.',
      });
      ending = 'pausa';
      break;
    }
    sinceBig = 1;
  }

  milestones.ending = ending;
  trophies();
  if (ending !== 'pausa') clearSave();
  music.play(ending === 'fim' ? 'epic' : ending === 'pausa' ? 'calm' : 'sad');
  g.destroy();
  summaryScreen(
    stage,
    country,
    createState(country, start.player),
    g.state,
    ending,
    {
      onReplay: () => {
        clearSave();
        void runMandate(countryId, createState(country, start.player), true);
      },
      onNewPresident: startHome,
    },
    director.legacy(g.state, ending),
  );
}

window.addEventListener('hashchange', () => location.hash === '#lab' && startHome());
startHome();

import '@fontsource/press-start-2p/400.css';
import './fonts.css';
import './style.css';
import { dateLabel, monthName, yearOf } from './engine/calendar';
import { checkAchievements, type Milestones } from './engine/achievements';
import { claudeOnline, Director } from './engine/director';
import { getCountry } from './engine/data';
import {
  campaignEvent, electionCutscene, electionDue, electionResult, impeachmentCutscene, impeachmentDue, impeachmentEvent, impeachmentVote,
} from './engine/politics';
import { advanceMonth, applyEffects, concludeBill, createState, INSTRUMENTS, proposeBill } from './engine/rules';
import { chamberCount } from './art/hemicycle';
import { runLegislativeWindow } from './ui/bills';
import type { VoteScript } from './lab/scripts';
import { clearSave, loadGame, saveGame } from './engine/save';
import type { Effects, GameEvent, GameState, Player } from './engine/types';
import { music } from './audio/music';
import { runBigEvent } from './ui/bigEvent';
import { playCinematic } from './ui/cinematic';
import { creationScreen } from './ui/creation';
import { runDispatch } from './ui/dispatch';
import { DEMOS } from './lab/demos';
import { ministerMood } from './engine/ministers';
import { electionMonth } from './engine/calendar';
import { playScene } from './ui/sceneOverlay';
import type { LabKindName } from './engine/director';
import { wait } from './ui/dom';
import { showLab } from './lab/lab';
import { showHome } from './ui/home';
import { inaugurationScreen } from './ui/inauguration';
import { showVerdict } from './ui/overlays';
import { toastAchievement } from './ui/trophies';
import { Gabinete } from './ui/shell';
import { summaryScreen, type Ending } from './ui/summary';

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

/** Uma cena interativa soma várias escolhas; o total tem teto para não virar a economia num telefonema. */
function capSceneEffects(e: Effects): Effects {
  const cap = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const limits: Record<string, number> = { aprovacao: 10, coalizao: 10, inflacao: 0.5, desemprego: 0.4 };
  return {
    kpis: Object.fromEntries(Object.entries(e.kpis ?? {}).map(([k, v]) => [k, cap(v ?? 0, limits[k] ?? 1)])),
    factions: Object.fromEntries(Object.entries(e.factions ?? {}).map(([k, v]) => [k, cap(v, 20)])),
    relations: Object.fromEntries(Object.entries(e.relations ?? {}).map(([k, v]) => [k, cap(v, 35)])),
  };
}

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
  const g = new Gabinete(stage, country, start);
  let inBig = false;

  director.onBigReady = (event) => {
    if (inBig) return;
    g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: `🔥 Fontes do Planalto: “${event.title}”. Vem coisa grande por aí.`, likes: 8000, tone: 'press' });
  };

  const noCutscene = async () => null;
  const playBig = async (event: GameEvent, generatedFlow = true) => {
    inBig = true;
    music.play('tense');
    const ev = { ...event, month: g.state.month, month_name: monthName(g.state.month) };
    if (generatedFlow) director.prepareCutscenes(ev, g.state);
    await g.urgent(ev.kicker, ev.title);
    for (;;) {
      const r = await runBigEvent(g, ev, {
        cutsceneFor: generatedFlow ? (opt) => director.cutsceneFor(ev, opt, g.state) : noCutscene,
        onResolved: (s) => generatedFlow && director.requestBig(s),
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
    music.play(kind === 'debate' ? 'epic' : kind === 'coletiva' ? 'press' : 'tense');
    const r = await playScene(g.screen, demo, script, g.state);
    music.play(prevMood);
    if (!r) return;
    const result = applyEffects(g.state, capSceneEffects(r.effects), country);
    g.state = {
      ...result.state,
      decisions: [...result.state.decisions, `CENA_${kind}_${g.state.month}:${r.icon}`],
      history: [...result.state.history, { month: g.state.month, event: demo.title, choice: r.choice, headline: r.headline, icon: r.icon }],
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
  };

  /** Qual cena interativa faz sentido agora: a relação externa mais tensa, um ministro insatisfeito ou uma votação. */
  let lastScene: LabKindName | null = null;
  const pickScene = (): LabKindName => {
    const tense = (country.partners ?? []).some((p) => (g.state.relations?.[p.id] ?? 0) <= -25);
    const unhappy = country.ministers.some((m) => ministerMood(m.id, g.state) <= -40 || (g.state.ministerLoyalty?.[m.id] ?? 30) <= 0);
    if (tense && lastScene !== 'telefonema') return 'telefonema';
    if (unhappy && lastScene !== 'reuniao') return 'reuniao';
    return lastScene === 'telefonema' ? 'reuniao' : 'telefonema';
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
  const runPauta = async (key: string) => {
    pautaOffered = key;
    const proposals = await director.takeBills();
    if (!proposals.length) return;
    const pick = await runLegislativeWindow(g, proposals);
    if (!pick) {
      void g.say('Tudo bem. A próxima janela é no outro semestre.');
      return;
    }
    const r = proposeBill(g.state, pick.proposal, pick.instrument, country);
    const label = INSTRUMENTS[pick.instrument].label;
    g.state = {
      ...r.state,
      history: [...r.state.history, { month: g.state.month, event: 'Projeto enviado ao Congresso', choice: `${label}: ${pick.proposal.title}`, headline: pick.proposal.summary, icon: pick.proposal.icon }],
    };
    g.render();
    if (pick.instrument === 'mp') {
      void g.animateKpis(r.deltas);
      void g.animateAxes(r.deltas, false);
      void g.animateFactions(r.deltas, false);
    }
    g.feed.push({ who: 'Bastidores de Brasília', at: 'bastidores.df', text: `${pick.instrument === 'mp' ? '⚡ Governo edita MP' : '📜 Governo envia ao Congresso'}: “${pick.proposal.title}”.`, likes: 7000, tone: 'press' });
    void g.say(pick.instrument === 'mp' ? 'A MP já vale. Agora o Congresso tem quatro meses para não deixar cair.' : 'Enviado. Até a votação, cada decisão sua mexe nos votos que teremos no plenário.');
    saveGame(countryId, g.state);
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
    const r = concludeBill(withCosts, passed, country);
    const mp = bill.instrument === 'mp';
    const title = mp ? (passed ? 'MP virou lei' : 'MP derrubada') : passed ? 'Aprovado!' : 'Rejeitado';
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
      good: passed,
      text: passed
        ? `${mp ? 'A medida provisória foi convertida em lei.' : `A lei entra em vigor e faz efeito pelos próximos ${Math.round(bill.months * INSTRUMENTS[bill.instrument].power)} meses.`} ${bill.lesson}`
        : mp
          ? 'O Congresso derrubou a MP: ela perde a validade, parte do efeito se desfaz e o governo sai enfraquecido.'
          : 'Derrota do governo no plenário. A base não segurou, e a oposição comemora.',
    });
    g.feed.push({ who: 'Economia Hoje', at: 'economiahoje', text: `${bill.title}: ${title.toLowerCase()} no Congresso.`, likes: 9000, tone: 'press' });
    saveGame(countryId, g.state);
    director.prepareBills(g.state);
  };

  const nextMonth = () => {
    g.state = advanceMonth(g.state, country);
    g.renderRelations();
  };

  /** Eleição, impeachment e fim do tempo. Devolve o final do jogo, se houver. */
  const politics = async (): Promise<Ending | null> => {
    if (impeachmentDue(g.state)) {
      const choice = await playBig(impeachmentEvent(g.state), false);
      if (choice === 'renunciar') return 'renuncia';
      const vote = impeachmentVote(g.state, country);
      await playCinematic(g.screen, impeachmentCutscene(vote), g.library, 'CÂMARA · AO VIVO');
      music.play(vote.passed ? 'sad' : 'epic');
      if (vote.passed) {
        await showVerdict(g.screen, {
          icon: '⚖️', kicker: 'CÂMARA DOS DEPUTADOS', title: 'Impeachment aprovado', good: false, button: 'VER O BALANÇO ➔',
          text: `${vote.yes} deputados votaram pelo afastamento (eram necessários ${vote.needed}). O Senado confirma: ${g.state.player.name} deixa o Planalto.`,
        });
        return 'impeachment';
      }
      milestones.survivedImpeachment = true;
      g.state = { ...applyEffects(g.state, { kpis: { coalizao: 6, aprovacao: 3 } }, country, false).state, impeachmentShieldUntil: g.state.month + 12 };
      g.render();
      await showVerdict(g.screen, {
        icon: '🛡️', kicker: 'CÂMARA DOS DEPUTADOS', title: 'O mandato sobreviveu', good: true,
        text: `Só ${vote.yes} votos pelo impeachment, ${vote.needed - vote.yes} a menos que o necessário. A Câmara arquiva o pedido, mas a oposição promete voltar.`,
      });
    }

    if (electionDue(g.state, country)) {
      // Debate na TV antes da reta final: o roteiro começou a ser escrito meses antes.
      const debate = await director.awaitScene('debate', 90_000);
      if (debate) await runScene('debate', debate);
      await playBig(campaignEvent(g.state), false);
      const result = electionResult(g.state);
      music.play(result.won ? 'epic' : 'sad');
      await playCinematic(g.screen, electionCutscene(g.state, result), g.library, `APURAÇÃO · ${yearOf(g.state, g.state.month)}`);
      g.state = { ...g.state, electionsHeld: [...g.state.electionsHeld, g.state.term] };
      if (!result.won) {
        await showVerdict(g.screen, {
          icon: '🗳️', kicker: 'TRIBUNAL SUPERIOR ELEITORAL', title: 'Derrotado nas urnas', good: false, button: 'VER O BALANÇO ➔',
          text: `${(result.runoff ?? result.firstRound).toFixed(1).replace('.', ',')}% dos votos válidos não bastaram. Em 1º de janeiro, ${g.state.player.name} passa a faixa ao adversário.`,
        });
        return 'derrota';
      }
      milestones.reelected = true;
      trophies();
      await showVerdict(g.screen, {
        icon: '🎉', kicker: 'TRIBUNAL SUPERIOR ELEITORAL', title: 'Reeleito!', good: true, button: 'COMEÇAR O 2º MANDATO ➔',
        text: `${(result.runoff ?? result.firstRound).toFixed(1).replace('.', ',')}% dos votos válidos${result.runoff ? ' no segundo turno' : ' já no primeiro turno'}. São mais quatro anos, os últimos: a Constituição não permite um terceiro mandato seguido.`,
      });
      // A posse do segundo mandato é em 1º de janeiro.
      while (g.state.month % g.state.termMonths !== 0) nextMonth();
      nextMonth();
      g.state = { ...g.state, term: g.state.term + 1 };
      g.render();
    }

    if (g.state.month >= g.state.totalMonths) return 'fim';
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
      await runPauta(pauta);
      continue;
    }

    // Debate da eleição: encomendado alguns meses antes da campanha.
    if (g.state.term < country.calendar.max_terms && g.state.month >= electionMonth(g.state, g.state.term, country.calendar.election_month) - 5) director.prepareScene('debate', g.state);

    // Cena interativa (votação, telefonema ou reunião): escolhida pelo momento, encomendada cedo, entra quando pronta.
    if (sinceScene >= 3 && !sceneKind) {
      sceneKind = pickScene();
      director.prepareScene(sceneKind, g.state);
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

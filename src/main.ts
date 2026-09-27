import '@fontsource/press-start-2p/400.css';
import './fonts.css';
import './style.css';
import { dateLabel, monthName, yearOf } from './engine/calendar';
import { Director } from './engine/director';
import { getCountry } from './engine/data';
import {
  campaignEvent, electionCutscene, electionDue, electionResult, impeachmentCutscene, impeachmentDue, impeachmentEvent, impeachmentVote,
} from './engine/politics';
import { advanceMonth, applyEffects, createState } from './engine/rules';
import { clearSave, loadGame, saveGame } from './engine/save';
import type { GameEvent, GameState, Player } from './engine/types';
import { runBigEvent } from './ui/bigEvent';
import { playCinematic } from './ui/cinematic';
import { creationScreen } from './ui/creation';
import { runDispatch } from './ui/dispatch';
import { runInterview } from './ui/interview';
import { wait } from './ui/dom';
import { inaugurationScreen } from './ui/inauguration';
import { showVerdict } from './ui/overlays';
import { Gabinete } from './ui/shell';
import { summaryScreen, type Ending } from './ui/summary';

const stage = document.getElementById('stage')!;

// Palco fixo de 1280x720 escalado para caber na janela, mantendo a proporção.
function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

let lastPlayer: Partial<Player> = {};

function startCreation() {
  const save = loadGame();
  creationScreen(
    stage,
    lastPlayer,
    (player, countryId) => {
      lastPlayer = player;
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
    return g.state.decisions[g.state.decisions.length - 1]?.split(':')[1];
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
      if (vote.passed) {
        await showVerdict(g.screen, {
          icon: '⚖️', kicker: 'CÂMARA DOS DEPUTADOS', title: 'Impeachment aprovado', good: false, button: 'VER O BALANÇO ➔',
          text: `${vote.yes} deputados votaram pelo afastamento (eram necessários ${vote.needed}). O Senado confirma: ${g.state.player.name} deixa o Planalto.`,
        });
        return 'impeachment';
      }
      g.state = { ...applyEffects(g.state, { kpis: { coalizao: 6, aprovacao: 3 } }, country, false).state, impeachmentShieldUntil: g.state.month + 12 };
      g.render();
      await showVerdict(g.screen, {
        icon: '🛡️', kicker: 'CÂMARA DOS DEPUTADOS', title: 'O mandato sobreviveu', good: true,
        text: `Só ${vote.yes} votos pelo impeachment, ${vote.needed - vote.yes} a menos que o necessário. A Câmara arquiva o pedido, mas a oposição promete voltar.`,
      });
    }

    if (electionDue(g.state, country)) {
      await playBig(campaignEvent(g.state), false);
      const result = electionResult(g.state);
      await playCinematic(g.screen, electionCutscene(g.state, result), g.library, `APURAÇÃO · ${yearOf(g.state, g.state.month)}`);
      g.state = { ...g.state, electionsHeld: [...g.state.electionsHeld, g.state.term] };
      if (!result.won) {
        await showVerdict(g.screen, {
          icon: '🗳️', kicker: 'TRIBUNAL SUPERIOR ELEITORAL', title: 'Derrotado nas urnas', good: false, button: 'VER O BALANÇO ➔',
          text: `${(result.runoff ?? result.firstRound).toFixed(1).replace('.', ',')}% dos votos válidos não bastaram. Em 1º de janeiro, ${g.state.player.name} passa a faixa ao adversário.`,
        });
        return 'derrota';
      }
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
  if (!prepared) director.requestBig(g.state);
  if (!fresh) void g.say(`Bem-vindo de volta, Presidente. Estamos em ${dateLabel(g.state, g.state.month)}.`);
  director.refillDispatches(g.state);

  // Abertura: dá alguns segundos para a primeira crise chegar; se não chegar, começam os despachos.
  if (fresh) {
    g.desk.innerHTML = '<div class="desk-waiting"><div>📂</div>Primeiro dia no Planalto. A assessoria traz o primeiro dossiê…</div>';
    for (let i = 0; i < 3 && director.bigInFlight; i++) await wait(1000);
    const opening = director.takeBig(g.state);
    if (opening) await playBig(opening);
  }
  saveGame(countryId, g.state);
  let sinceBig = 1;
  let sinceInterview = 2;

  for (;;) {
    ending = await politics();
    if (ending) break;
    saveGame(countryId, g.state);

    if (sinceBig >= 1) {
      const big = director.takeBig(g.state);
      if (big) {
        nextMonth();
        await playBig(big);
        sinceBig = 0;
        continue;
      }
      if (!director.bigInFlight && !director.exhausted) director.requestBig(g.state);
    }

    // Coletiva escrita pelo Claude sobre o que aconteceu: encomendada cedo, entra quando estiver pronta.
    if (sinceInterview >= 2) director.prepareInterview(g.state);
    if (sinceInterview >= 5) {
      const interview = director.takeInterview();
      if (interview) {
        nextMonth();
        await runInterview(g, interview);
        sinceInterview = 0;
        continue;
      }
    }

    const d = director.nextDispatch(g.state);
    if (d) {
      sinceInterview++;
      nextMonth();
      await runDispatch(g, d);
      sinceBig++;
      continue;
    }

    // Mesa vazia: espera o evento grande que está sendo escrito.
    if (director.exhausted || !director.bigInFlight) {
      ending = 'pausa';
      break;
    }
    g.desk.innerHTML = '<div class="desk-waiting"><div>📂</div>A assessoria monta o próximo dossiê…</div>';
    while (director.bigInFlight) await wait(1000);
    sinceBig = 1;
  }

  if (ending !== 'pausa') clearSave();
  g.destroy();
  summaryScreen(stage, country, createState(country, start.player), g.state, ending, {
    onReplay: () => {
      clearSave();
      void runMandate(countryId, createState(country, start.player), true);
    },
    onNewPresident: startCreation,
  });
}

startCreation();

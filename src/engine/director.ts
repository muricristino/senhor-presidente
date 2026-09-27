import { ageOf, dateLabel, electionMonth, monthName } from './calendar';
import { AXES, dispatchesFor, eventsFor } from './data';
import { KPIS, formatKpi } from './kpis';
import { dominantLeans, profileTitle } from './profile';
import { mergeDetails, sanitizeCutscene, sanitizeDispatch, sanitizeEvent } from './sanitize';
import type { Country, Cutscene, Dispatch, EventOption, GameEvent, GameState } from './types';

export { monthName } from './calendar';

const moodWord = (v: number) => (v >= 40 ? 'aliada fiel' : v >= 12 ? 'simpática' : v > -12 ? 'neutra' : v > -40 ? 'irritada' : 'em guerra com o governo');

/** Retrato do país em texto, para o Claude continuar a história. */
export function briefing(state: GameState, country: Country): string {
  const bio = country.bios.find((b) => b.id === state.player.bioId)?.name ?? '';
  const kpis = KPIS.map((k) => `- ${k.label}: ${formatKpi(k.id, state.kpis[k.id])} (início do mandato: ${formatKpi(k.id, country.kpis_iniciais[k.id])})`).join('\n');
  const axes = AXES.map((a) => {
    const v = state.axes[a.id];
    const side = v === 0 ? 'centro' : v < 0 ? a.poleA : a.poleB;
    return `- ${a.category}: ${v > 0 ? '+' : ''}${v} (${side})`;
  }).join('\n');
  const factions = country.factions.map((f) => `- ${f.name} (${f.influence}% dos votos): ${state.factions[f.id]} → ${moodWord(state.factions[f.id])}`).join('\n');
  const history = state.history.length
    ? state.history.slice(-25).map((h) => `- ${dateLabel(state, h.month)} · ${h.event}: o presidente escolheu "${h.choice}". Manchete: ${h.headline}${h.stf ? ` · STF reagiu: ${h.stf}` : ''}`).join('\n')
    : '- (nenhuma ainda)';
  const relations = (country.partners ?? [])
    .map((p) => `- ${p.name}: ${Math.round(state.relations?.[p.id] ?? 0)} → ${moodWord(state.relations?.[p.id] ?? 0)}`)
    .join('\n');
  const leans = dominantLeans(state.axes, 3).map((l) => `${l.pole} (${Math.abs(l.value)})`).join(', ') || 'nenhum';
  const nextElection = state.term < country.calendar.max_terms ? electionMonth(state, state.term, country.calendar.election_month) : null;
  const calendar = nextElection
    ? `Faltam ${Math.max(0, nextElection - state.month)} meses para a eleição de ${dateLabel(state, nextElection)}, em que o presidente tenta a reeleição.`
    : 'É o segundo e último mandato: não há mais reeleição. O presidente pensa no legado.';
  return `País: ${country.country_name}. Data: ${dateLabel(state, state.month)} (${state.term}º mandato, mês ${state.month - (state.term - 1) * state.termMonths} de ${state.termMonths}).
${calendar}
Presidente: ${state.player.name}, ${ageOf(state, state.month)} anos (origem: ${bio}). Perfil ideológico: ${profileTitle(state.axes)}. Polos mais fortes: ${leans}.
Relação com o STF: ${state.stf === 'LIMINAR' ? 'o STF já barrou o governo antes; clima tenso' : 'normal'}.

Indicadores:
${kpis}

Eixos ideológicos (-100 a +100):
${axes}

Bancadas no Congresso (-100 a +100):
${factions}

Relações internacionais (-100 a +100):
${relations}

Decisões anteriores, da mais antiga à mais recente:
${history}

Escreva a próxima crise.`;
}

async function post<T>(url: string, body: unknown, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let health: Promise<boolean> | null = null;
export function claudeOnline(): Promise<boolean> {
  health ??= fetch('/api/health')
    .then((r) => (r.ok ? r.json() : { claude: false }))
    .then((j) => !!j.claude)
    .catch(() => false);
  return health;
}

interface BigJob {
  /** Estado usado no briefing: serve para descartar o evento se o país mudou demais desde então. */
  basis: GameState;
  event: GameEvent | null;
  /** true quando o evento chegou (ou falhou) e as cenas tiveram tempo de ficar prontas. */
  settled: boolean;
}

/**
 * Orquestra o ritmo do mandato: um evento grande sendo escrito em segundo plano pelo Claude
 * enquanto despachos rápidos vão sendo decididos na mesa.
 */
export class Director {
  private cutscenes = new Map<string, Promise<Cutscene | null>>();
  private big: BigJob | null = null;
  private dispatchQueue: Dispatch[] = [];
  private dispatchPending = false;
  private usedDispatches = new Set<string>();
  readonly authored: GameEvent[];
  private authoredDispatches: Dispatch[];
  /** true quando nem o Claude nem o banco escrito à mão têm mais eventos grandes. */
  exhausted = false;
  /** Avisado quando um evento grande fica pronto (para anunciar no feed). */
  onBigReady?: (event: GameEvent) => void;

  constructor(private country: Country) {
    this.authored = eventsFor(country.country_id).sort((a, b) => a.month - b.month);
    this.authoredDispatches = shuffle(dispatchesFor(country.country_id));
  }

  // ---------- evento grande ----------

  /** Encomenda o próximo evento grande com o histórico completo até aqui. */
  requestBig(state: GameState) {
    const job: BigJob = { basis: state, event: null, settled: false };
    this.big = job;
    void this.generate(state).then(async (event) => {
      if (this.big !== job) return;
      job.event = event ?? this.fallback(state);
      this.exhausted = !job.event;
      if (job.event) {
        this.prepareCutscenes(job.event, state);
        // Dá até 25s para as cenas ficarem prontas antes de lançar o evento.
        const cuts = [...job.event.options, job.event.omission].map((o) => this.cutsceneFor(job.event!, o, state));
        await Promise.race([Promise.allSettled(cuts), new Promise((r) => setTimeout(r, 25_000))]);
      }
      if (this.big !== job) return;
      job.settled = true;
      if (job.event) this.onBigReady?.(job.event);
    });
  }

  /** Entrega o evento grande se estiver pronto e ainda fizer sentido para o país de agora. */
  takeBig(state: GameState): GameEvent | null {
    const job = this.big;
    if (!job?.settled) return null;
    this.big = null;
    if (!job.event) return null;
    if (isStale(job.basis, state)) {
      this.requestBig(state);
      return null;
    }
    return job.event;
  }

  get bigInFlight(): boolean {
    return !!this.big && !this.big.settled;
  }

  private async generate(state: GameState): Promise<GameEvent | null> {
    if (!(await claudeOnline())) return null;
    const res = await post<{ event: Record<string, unknown> }>(
      '/api/event',
      {
        briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva o próximo grande acontecimento.'),
        axes: AXES.map((a) => a.id),
        factions: this.country.factions.map((f) => f.id),
        partners: (this.country.partners ?? []).map((p) => p.id),
        ministers: this.country.ministers.map((m) => m.id),
      },
      260_000,
    );
    if (!res?.event) return null;
    const event = sanitizeEvent(res.event, this.country, state.month + 1, monthName(state.month + 1));
    if (!event) return null;
    // Lições e redes só são usadas depois da assinatura: geram enquanto o jogador lê o dossiê.
    const opts = [...event.options, event.omission]
      .map((o, i) => `${i < event.options.length ? `Opção ${i + 1}` : 'Omissão'}: "${o.title}" — ${o.summary} Manchete: ${o.headline}. Efeitos: ${JSON.stringify(o.effects)}`)
      .join('\n');
    event.ready = post<{ details: unknown }>(
      '/api/event-details',
      { briefing: `Contexto do país:\n${briefing(state, this.country).replace('Escreva a próxima crise.', '')}\nAcontecimento: ${event.title}. ${event.dossier.join(' ')}\n${opts}` },
      200_000,
    ).then((r) => {
      if (r) mergeDetails(event, r.details);
    });
    return event;
  }

  /** Um evento escrito à mão ainda não jogado, sorteado para as partidas não começarem sempre iguais. */
  private fallback(state: GameState): GameEvent | null {
    const played = new Set(state.decisions.map((d) => d.split(':')[0]));
    const left = this.authored.filter((e) => !played.has(e.id));
    return left.length ? left[Math.floor(Math.random() * left.length)] : null;
  }

  // ---------- despachos ----------

  /** Mantém a fila de despachos gerados abastecida (lotes de 4). */
  refillDispatches(state: GameState) {
    if (this.dispatchPending || this.dispatchQueue.length >= 2) return;
    this.dispatchPending = true;
    void claudeOnline()
      .then((online) =>
        online
          ? post<{ dispatches: unknown[] }>(
              '/api/dispatches',
              {
                briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva 4 despachos para as próximas semanas.'),
                axes: AXES.map((a) => a.id),
                factions: this.country.factions.map((f) => f.id),
        partners: (this.country.partners ?? []).map((p) => p.id),
              },
              120_000,
            )
          : null,
      )
      .then((r) => {
        for (const raw of r?.dispatches ?? []) {
          const d = sanitizeDispatch(raw, this.country);
          if (d) this.dispatchQueue.push(d);
        }
      })
      .finally(() => (this.dispatchPending = false));
  }

  /** Próximo despacho: primeiro os gerados (mais conectados ao momento), depois os escritos à mão. */
  nextDispatch(state: GameState): Dispatch | null {
    this.refillDispatches(state);
    const d = this.dispatchQueue.shift() ?? this.authoredDispatches.find((x) => !this.usedDispatches.has(x.id)) ?? null;
    if (d) this.usedDispatches.add(d.id);
    return d;
  }

  // ---------- cinemáticas ----------

  /** Encomenda as cenas das opções em paralelo. */
  prepareCutscenes(event: GameEvent, state: GameState) {
    void claudeOnline().then((online) => {
      if (!online) return;
      for (const opt of [...event.options, event.omission]) this.cutsceneFor(event, opt, state);
    });
  }

  cutsceneFor(event: GameEvent, opt: EventOption, state: GameState): Promise<Cutscene | null> {
    const key = `${event.id}:${opt.id}`;
    let p = this.cutscenes.get(key);
    if (!p) {
      const brief = `Acontecimento: ${event.title}. ${event.dossier.join(' ')}
Decisão do presidente ${state.player.name}: "${opt.title}" — ${opt.summary}
Manchete: ${opt.headline}. ${opt.subhead}
${opt.cutscene_idea ? `Ideia de cena: ${opt.cutscene_idea}` : ''}
Perfil do presidente: ${profileTitle(state.axes)}. Aprovação: ${state.kpis.aprovacao}%.
Animação da Esplanada mais próxima: ${opt.scene.anim}.`;
      p = claudeOnline().then((online) =>
        online ? post<{ cutscene: unknown }>('/api/cutscene', { briefing: brief }, 200_000).then((r) => (r ? sanitizeCutscene(r.cutscene, opt.headline) : null)) : null,
      );
      this.cutscenes.set(key, p);
    }
    return p;
  }
}

/** O país mudou tanto desde o pedido que o texto do evento ficaria errado. */
function isStale(basis: GameState, now: GameState): boolean {
  return Math.abs(basis.kpis.aprovacao - now.kpis.aprovacao) > 15 || Math.abs(basis.kpis.coalizao - now.kpis.coalizao) > 15;
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

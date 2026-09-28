import { ageOf, dateLabel, electionMonth, monthName } from './calendar';
import { AXES } from './data';
import { KPIS, formatKpi } from './kpis';
import { dominantLeans, profileTitle } from './profile';
import { mergeDetails, sanitizeCutscene, sanitizeDispatch, sanitizeEvent, sanitizeInterview } from './sanitize';
import type { Country, Cutscene, Dispatch, EventOption, GameEvent, GameState, Interview } from './types';

export { monthName } from './calendar';
export type LabKindName = 'votacao' | 'debate' | 'telefonema' | 'reuniao';

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
  /** Tentativas seguidas de gerar o evento grande que falharam. */
  failures = 0;
  /** Avisado quando um evento grande fica pronto (para anunciar no feed). */
  onBigReady?: (event: GameEvent) => void;

  /** Todo conteúdo do mandato é escrito pelo Claude: não há banco fixo de eventos nem de despachos. */
  constructor(private country: Country) {}

  // ---------- evento grande ----------

  /** Encomenda o próximo evento grande com o histórico completo até aqui. */
  requestBig(state: GameState) {
    const job: BigJob = { basis: state, event: null, settled: false };
    this.big = job;
    void this.generate(state).then(async (event) => {
      if (this.big !== job) return;
      job.event = event;
      this.failures = event ? 0 : this.failures + 1;
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

  /** Há um evento grande pronto para entrar. */
  get bigReady(): boolean {
    return !!this.big?.settled && !!this.big.event;
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

  /** Próximo despacho escrito pelo Claude, se já houver um na fila. */
  nextDispatch(state: GameState): Dispatch | null {
    this.refillDispatches(state);
    return this.dispatchQueue.shift() ?? null;
  }

  get hasDispatch(): boolean {
    return this.dispatchQueue.length > 0;
  }

  // ---------- boletim ----------

  /** Editorial do momento e a fala de cada ministro, escritos pelo Claude. */
  bulletin(state: GameState): Promise<GameState['bulletin'] | null> {
    return claudeOnline().then((online) =>
      online
        ? post<{ editorial: string; ministers: Record<string, string> }>(
            '/api/bulletin',
            { briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva o boletim do Planalto.') },
            90_000,
          ).then((r) =>
            r?.editorial
              ? {
                  month: state.month,
                  editorial: String(r.editorial).slice(0, 320),
                  ministers: Object.fromEntries(Object.entries(r.ministers ?? {}).map(([k, v]) => [k, String(v).slice(0, 130)])),
                }
              : null,
          )
        : null,
    );
  }

  // ---------- legado ----------

  /** A manchete e o epitáfio do governo, escritos pelo Claude com o histórico completo. */
  legacy(state: GameState, ending: string): Promise<{ headline: string; epitaph: string } | null> {
    const how: Record<string, string> = {
      impeachment: 'Terminou afastado por impeachment.',
      derrota: 'Terminou derrotado ao tentar a reeleição.',
      renuncia: 'Terminou renunciando.',
      fim: 'Completou os dois mandatos.',
      pausa: 'O governo ainda está em curso.',
    };
    return claudeOnline().then((online) =>
      online
        ? post<{ headline: string; epitaph: string }>(
            '/api/legacy',
            { briefing: `${briefing(state, this.country).replace('Escreva a próxima crise.', '')}\nDesfecho: ${how[ending] ?? ending}\nEscreva o legado.` },
            90_000,
          ).then((r) => (r?.headline ? { headline: String(r.headline).slice(0, 90), epitaph: String(r.epitaph ?? '').slice(0, 420) } : null))
        : null,
    );
  }

  // ---------- cenas interativas ----------

  private scenes = new Map<string, { promise: Promise<unknown>; ready: unknown | null; failed: boolean }>();

  /** Encomenda o roteiro de uma cena interativa ao Claude, com o mandato de agora. */
  prepareScene(kind: LabKindName, state: GameState) {
    if (this.scenes.has(kind)) return;
    const entry = { promise: Promise.resolve<unknown>(null), ready: null as unknown | null, failed: false };
    entry.promise = import('../lab/scripts')
      .then((m) => m.requestScript(kind, true, state))
      .then((script) => (entry.ready = script))
      .catch(() => {
        entry.failed = true;
        this.scenes.delete(kind);
      });
    this.scenes.set(kind, entry);
  }

  /** O roteiro, se já estiver pronto. Nunca espera. */
  takeScene(kind: LabKindName): unknown | null {
    const e = this.scenes.get(kind);
    if (!e?.ready) return null;
    this.scenes.delete(kind);
    return e.ready;
  }

  /** Espera o roteiro por até `ms` (usado no debate da eleição, que não pode ser pulado à toa). */
  async awaitScene(kind: LabKindName, ms: number): Promise<unknown | null> {
    const e = this.scenes.get(kind);
    if (!e) return null;
    await Promise.race([e.promise, new Promise((r) => setTimeout(r, ms))]);
    return this.takeScene(kind);
  }

  // ---------- coletivas ----------

  private interview: Promise<Interview | null> | null = null;
  private readyInterview: Interview | null = null;

  /**
   * Encomenda a próxima coletiva. As perguntas são sempre escritas pelo Claude a partir do
   * que o presidente fez: não existe coletiva de reserva.
   */
  prepareInterview(state: GameState) {
    if (this.interview || this.readyInterview) return;
    const job = claudeOnline().then((online) =>
      online
        ? post<{ questions: unknown[] }>(
            '/api/interview',
            {
              briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva a próxima coletiva de imprensa.'),
              axes: AXES.map((a) => a.id),
              factions: this.country.factions.map((f) => f.id),
              partners: (this.country.partners ?? []).map((p) => p.id),
            },
            120_000,
          ).then((r) => (r ? sanitizeInterview(r, this.country) : null))
        : null,
    );
    this.interview = job;
    void job.then((iv) => {
      if (this.interview !== job) return;
      this.interview = null;
      this.readyInterview = iv;
    });
  }

  /** A coletiva, se o Claude já terminou de escrever. Nunca espera. */
  takeInterview(): Interview | null {
    const iv = this.readyInterview;
    this.readyInterview = null;
    return iv;
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

